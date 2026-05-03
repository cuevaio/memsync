import type { CanonicalMemoryItem, ProviderId } from "./bridge";
import type { ExtensionAuthSnapshot } from "@memsync/shared";

export const CACHE_KEY = "memsync.cache.v1";
export const SYNC_RUN_KEY = "memsync.sync-run.v1";
export const AUTH_KEY = "memsync.auth.v1";

export type SyncDirection = "claudeToChatgpt" | "chatgptToClaude";

export type ProviderCache = {
  provider: ProviderId;
  accountKey: string;
  fetchedAt: string | null;
  sourceUpdatedAt: string | null;
  items: CanonicalMemoryItem[];
  native: {
    summaryText?: string | null;
    controls?: string[];
    entryCount?: number;
  };
  lastError: string | null;
};

export type SyncStatus = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  itemCount: number;
};

export type ScheduleConfig = {
  enabled: boolean;
  intervalHours: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
};

export type SyncRunState = {
  owner: string;
  startedAt: string;
  source: "manual" | "scheduled";
};

export type SharedCache = {
  version: 1;
  providers: Partial<Record<ProviderId, ProviderCache>>;
  sync: {
    claudeToChatgpt?: SyncStatus;
    chatgptToClaude?: SyncStatus;
  };
  schedule: ScheduleConfig;
};

function emptyAuthState(): ExtensionAuthSnapshot {
  return {
    token: null,
    tokenPreview: null,
    status: "anonymous",
    userEmail: null,
    verifiedAt: null,
    lastError: null,
  };
}

function emptySchedule(): ScheduleConfig {
  return {
    enabled: true,
    intervalHours: 5,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
  };
}

function emptyCache(): SharedCache {
  return {
    version: 1,
    providers: {},
    sync: {},
    schedule: emptySchedule(),
  };
}

function normalizeCache(cache: SharedCache | undefined): SharedCache {
  if (cache?.version !== 1) {
    return emptyCache();
  }

  return {
    version: 1,
    providers: cache.providers ?? {},
    sync: cache.sync ?? {},
    schedule: {
      ...emptySchedule(),
      ...(cache.schedule ?? {}),
    },
  };
}

export async function readSharedCache(): Promise<SharedCache> {
  const stored = await chrome.storage.local.get(CACHE_KEY);
  const cache = stored[CACHE_KEY] as SharedCache | undefined;
  return normalizeCache(cache);
}

export function previewToken(token: string) {
  return `${token.slice(0, 11)}...${token.slice(-4)}`;
}

export async function readExtensionAuth(): Promise<ExtensionAuthSnapshot> {
  const stored = await chrome.storage.local.get(AUTH_KEY);
  const auth = stored[AUTH_KEY] as ExtensionAuthSnapshot | undefined;

  if (!auth || typeof auth !== "object") {
    return emptyAuthState();
  }

  return {
    ...emptyAuthState(),
    ...auth,
  };
}

export async function writeExtensionAuth(auth: ExtensionAuthSnapshot) {
  await chrome.storage.local.set({ [AUTH_KEY]: auth });
}

export async function clearExtensionAuth() {
  await writeExtensionAuth(emptyAuthState());
}

export async function writeSharedCache(cache: SharedCache) {
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

export async function updateProviderCache(provider: ProviderId, snapshot: ProviderCache) {
  const cache = await readSharedCache();
  cache.providers[provider] = snapshot;
  await writeSharedCache(cache);
}

export async function setProviderError(provider: ProviderId, error: string) {
  const cache = await readSharedCache();
  const current = cache.providers[provider];
  if (!current) {
    return;
  }

  cache.providers[provider] = { ...current, lastError: error };
  await writeSharedCache(cache);
}

export async function updateSyncStatus(direction: "claudeToChatgpt" | "chatgptToClaude", status: SyncStatus) {
  const cache = await readSharedCache();
  cache.sync[direction] = status;
  await writeSharedCache(cache);
}

export async function updateScheduleConfig(partial: Partial<ScheduleConfig>) {
  const cache = await readSharedCache();
  cache.schedule = {
    ...cache.schedule,
    ...partial,
  };
  await writeSharedCache(cache);
  return cache.schedule;
}

export async function readSyncRunState(): Promise<SyncRunState | null> {
  const stored = await chrome.storage.local.get(SYNC_RUN_KEY);
  const run = stored[SYNC_RUN_KEY] as SyncRunState | undefined;
  if (!run || typeof run.owner !== "string" || typeof run.startedAt !== "string") {
    return null;
  }

  return run;
}

export async function acquireSyncRunLock(run: SyncRunState) {
  const existing = await readSyncRunState();
  if (existing) {
    return false;
  }

  await chrome.storage.local.set({ [SYNC_RUN_KEY]: run });
  const persisted = await readSyncRunState();
  return persisted?.owner === run.owner;
}

export async function releaseSyncRunLock(owner: string) {
  const existing = await readSyncRunState();
  if (existing?.owner !== owner) {
    return false;
  }

  await chrome.storage.local.remove(SYNC_RUN_KEY);
  return true;
}
