import { mergeClaudeControls, toCanonicalClaudeItems } from "./claude-memory";
import { buildChatGptSyncPrompt, toCanonicalChatGptItems } from "./chatgpt-memory";
import type { ChatGptMemoryPayload, ClaudeMemoryPayload, ProviderId } from "./bridge";
import { readSharedCache, type ProviderCache, type SharedCache, type SyncDirection, type SyncStatus, updateProviderCache, updateScheduleConfig, updateSyncStatus } from "./storage";

export type PanelErrorState = Partial<Record<ProviderId, string>>;

export function normalizeProviderSnapshot(provider: ProviderId, accountKey: string, payload: ClaudeMemoryPayload | ChatGptMemoryPayload): ProviderCache {
  const fetchedAt = new Date().toISOString();

  if (provider === "claude") {
    const claudePayload = payload as ClaudeMemoryPayload;
    return {
      provider,
      accountKey,
      fetchedAt,
      sourceUpdatedAt: claudePayload.updated_at,
      items: toCanonicalClaudeItems(claudePayload),
      native: {
        summaryText: claudePayload.memory,
        controls: claudePayload.controls,
      },
      lastError: null,
    };
  }

  const chatPayload = payload as ChatGptMemoryPayload;
  return {
    provider,
    accountKey,
    fetchedAt,
    sourceUpdatedAt: chatPayload.updated_at,
    items: toCanonicalChatGptItems(chatPayload),
    native: {
      entryCount: chatPayload.entry_count,
    },
    lastError: null,
  };
}

export async function loadSharedCache() {
  return await readSharedCache();
}

export async function persistProviderSnapshot(provider: ProviderId, accountKey: string, payload: ClaudeMemoryPayload | ChatGptMemoryPayload) {
  const snapshot = normalizeProviderSnapshot(provider, accountKey, payload);
  await updateProviderCache(provider, snapshot);
  return snapshot;
}

export function mergeSnapshotIntoCache(cache: SharedCache | null, snapshot: ProviderCache): SharedCache {
  return {
    version: 1,
    providers: { ...(cache?.providers ?? {}), [snapshot.provider]: snapshot },
    sync: cache?.sync ?? {},
    schedule: cache?.schedule ?? {
      enabled: true,
      intervalHours: 5,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
    },
  };
}

export async function recordSyncAttempt(direction: SyncDirection, status: SyncStatus) {
  await updateSyncStatus(direction, status);
}

export async function recordSyncFailure(direction: SyncDirection, itemCount: number, error: string) {
  const cache = await readSharedCache();
  const current = cache.sync[direction];
  await updateSyncStatus(direction, {
    lastAttemptAt: current?.lastAttemptAt ?? new Date().toISOString(),
    lastSuccessAt: current?.lastSuccessAt ?? null,
    lastError: error,
    itemCount,
  });
}

export async function recordSyncSuccess(direction: SyncDirection, itemCount: number) {
  const cache = await readSharedCache();
  const now = new Date().toISOString();
  await updateSyncStatus(direction, {
    lastAttemptAt: currentAttemptAt(cache.sync[direction], now),
    lastSuccessAt: now,
    lastError: null,
    itemCount,
  });
}

export async function recordScheduledRunResult({
  ranAt,
  succeeded,
  error,
}: {
  ranAt: string;
  succeeded: boolean;
  error: string | null;
}) {
  await updateScheduleConfig({
    lastRunAt: ranAt,
    lastSuccessAt: succeeded ? ranAt : null,
    lastError: error,
  });
}

export function buildChatGptToClaudeControls(cache: SharedCache) {
  const claudeControls = cache.providers.claude?.native.controls ?? [];
  const chatGptItems = cache.providers.chatgpt?.items ?? [];
  return mergeClaudeControls(claudeControls, chatGptItems);
}

export function buildClaudeToChatGptPrompt(cache: SharedCache) {
  return buildChatGptSyncPrompt(cache.providers.claude?.items ?? []);
}

function currentAttemptAt(status: SyncStatus | undefined, fallback: string) {
  return status?.lastAttemptAt ?? fallback;
}
