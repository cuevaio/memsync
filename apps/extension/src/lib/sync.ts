import { loadExtensionAuth } from "./auth";
import { buildChatGptToClaudeControls, buildClaudeToChatGptPrompt, recordScheduledRunResult, recordSyncAttempt, recordSyncFailure, recordSyncSuccess } from "./panel-state";
import { getProviderHomeUrl, getProviderFromUrl, type ProviderId } from "./providers";
import type { ExtensionRuntimeRequest, ExtensionRuntimeResponse } from "./runtime";
import { acquireSyncRunLock, readSharedCache, readSyncRunState, releaseSyncRunLock, updateScheduleConfig, type ScheduleConfig, type SharedCache, type SyncDirection } from "./storage";

const SCHEDULED_SYNC_ALARM = "scheduled-sync";
const DEFAULT_SYNC_INTERVAL_HOURS = 5;

type SyncRunnerSource = "manual" | "scheduled";

type ProviderTab = {
  tabId: number;
  created: boolean;
};

type SyncResult = {
  cache: SharedCache;
};

export function getScheduledSyncAlarmName() {
  return SCHEDULED_SYNC_ALARM;
}

export async function ensureScheduledSyncAlarm(intervalHours = DEFAULT_SYNC_INTERVAL_HOURS) {
  await chrome.alarms.clear(SCHEDULED_SYNC_ALARM);
  await chrome.alarms.create(SCHEDULED_SYNC_ALARM, {
    periodInMinutes: intervalHours * 60,
  });
}

export async function configureScheduledSync(schedule: Pick<ScheduleConfig, "enabled" | "intervalHours">) {
  if (!schedule.enabled) {
    await chrome.alarms.clear(SCHEDULED_SYNC_ALARM);
    return;
  }

  await ensureScheduledSyncAlarm(schedule.intervalHours || DEFAULT_SYNC_INTERVAL_HOURS);
}

export async function setScheduledSyncEnabled(enabled: boolean) {
  if (enabled) {
    await assertExtensionAuthenticated();
  }

  const cache = await readSharedCache();
  const schedule = await updateScheduleConfig({ enabled, lastError: null });
  await configureScheduledSync({
    enabled: schedule.enabled,
    intervalHours: schedule.intervalHours || cache.schedule.intervalHours || DEFAULT_SYNC_INTERVAL_HOURS,
  });
  return await readSharedCache();
}

export async function refreshProvider(provider: ProviderId) {
  await assertExtensionAuthenticated();

  const target = await ensureProviderTab(provider);
  try {
    await sendRuntimeRequest(target.tabId, {
      type: "popup:load-provider",
      requestId: crypto.randomUUID(),
      provider,
    });
  } finally {
    await cleanupTab(target);
  }

  return await readSharedCache();
}

export async function syncDirection(direction: SyncDirection, source: SyncRunnerSource): Promise<SyncResult> {
  await assertExtensionAuthenticated();

  const cache = await readSharedCache();

  if (direction === "chatgptToClaude") {
    if (!cache.providers.chatgpt) {
      throw new Error("Refresh ChatGPT first so there is cached data to sync.");
    }

    const target = await ensureProviderTab("claude");
    const controls = buildChatGptToClaudeControls(cache);
    const itemCount = cache.providers.chatgpt.items.length;
    const attemptAt = new Date().toISOString();

    await recordSyncAttempt(direction, {
      lastAttemptAt: attemptAt,
      lastSuccessAt: cache.sync[direction]?.lastSuccessAt ?? null,
      lastError: null,
      itemCount,
    });

    try {
      await sendRuntimeRequest(target.tabId, {
        type: "popup:sync-chatgpt-to-claude",
        requestId: crypto.randomUUID(),
        controls,
      });
      await recordSyncSuccess(direction, itemCount);
      return { cache: await readSharedCache() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await recordSyncFailure(direction, itemCount, message);
      throw error;
    } finally {
      await cleanupTab(target, source);
    }
  }

  if (!cache.providers.claude) {
    throw new Error("Refresh Claude first so there is cached data to sync.");
  }

  const target = await ensureProviderTab("chatgpt");
  const prompt = buildClaudeToChatGptPrompt(cache);
  const itemCount = cache.providers.claude.items.length;
  const attemptAt = new Date().toISOString();

  await recordSyncAttempt(direction, {
    lastAttemptAt: attemptAt,
    lastSuccessAt: cache.sync[direction]?.lastSuccessAt ?? null,
    lastError: null,
    itemCount,
  });

  try {
    await sendRuntimeRequest(target.tabId, {
      type: "popup:sync-claude-to-chatgpt",
      requestId: crypto.randomUUID(),
      prompt,
    });
    await recordSyncSuccess(direction, itemCount);
    return { cache: await readSharedCache() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordSyncFailure(direction, itemCount, message);
    throw error;
  } finally {
    await cleanupTab(target, source);
  }
}

export async function runScheduledTwoWaySync() {
  const owner = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const locked = await acquireSyncRunLock({ owner, startedAt, source: "scheduled" });
  if (!locked) {
    return { skipped: true, reason: "A sync run is already in progress." };
  }

  try {
    await refreshProvider("chatgpt");
    await refreshProvider("claude");
    await syncDirection("chatgptToClaude", "scheduled");
    await refreshProvider("claude");
    await syncDirection("claudeToChatgpt", "scheduled");

    await recordScheduledRunResult({ ranAt: startedAt, succeeded: true, error: null });
    return { skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordScheduledRunResult({ ranAt: startedAt, succeeded: false, error: message });
    throw error;
  } finally {
    await releaseSyncRunLock(owner);
  }
}

export async function beginManualSyncRun() {
  const owner = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const locked = await acquireSyncRunLock({ owner, startedAt, source: "manual" });
  if (!locked) {
    const current = await readSyncRunState();
    throw new Error(current?.source === "scheduled" ? "A scheduled sync is already running." : "A sync is already running.");
  }

  return owner;
}

export async function endManualSyncRun(owner: string) {
  await releaseSyncRunLock(owner);
}

async function sendRuntimeRequest(tabId: number, request: ExtensionRuntimeRequest) {
  const response = (await chrome.tabs.sendMessage(tabId, request)) as ExtensionRuntimeResponse | undefined;
  if (!response?.ok) {
    throw new Error(response?.error ?? "The target tab is not ready. Reload the page and try again.");
  }
}

async function ensureProviderTab(provider: ProviderId): Promise<ProviderTab> {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find(tab => getProviderFromUrl(tab.url) === provider && typeof tab.id === "number");
  if (existing?.id !== undefined) {
    await waitForTabComplete(existing.id);
    await waitForContentScript(existing.id);
    return { tabId: existing.id, created: false };
  }

  const tab = await chrome.tabs.create({ url: getProviderHomeUrl(provider), active: false });
  if (typeof tab.id !== "number") {
    throw new Error(`Failed to open a ${provider} tab.`);
  }

  await waitForTabComplete(tab.id);
  await delay(750);
  await chrome.tabs.reload(tab.id);
  await waitForTabComplete(tab.id);
  await waitForContentScript(tab.id);
  return { tabId: tab.id, created: true };
}

async function cleanupTab(tab: ProviderTab, source: SyncRunnerSource = "manual") {
  if (!tab.created || source !== "scheduled") {
    return;
  }

  await chrome.tabs.remove(tab.tabId).catch(() => undefined);
}

async function waitForTabComplete(tabId: number, timeoutMs = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") {
      return;
    }

    await delay(250);
  }

  throw new Error("Timed out waiting for the provider tab to finish loading.");
}

async function waitForContentScript(tabId: number, timeoutMs = 20000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = (await chrome.tabs.sendMessage(tabId, {
        type: "popup:ping",
        requestId: crypto.randomUUID(),
      })) as ExtensionRuntimeResponse | undefined;
      if (response?.ok) {
        return;
      }
    } catch {
      await delay(1000);
    }
  }

  throw new Error("Timed out waiting for the extension content script to become ready.");
}

function delay(ms: number) {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}

async function assertExtensionAuthenticated() {
  const auth = await loadExtensionAuth();
  if (auth.status !== "authenticated") {
    throw new Error(auth.lastError ?? "Authenticate the extension from Settings before running sync.");
  }
}
