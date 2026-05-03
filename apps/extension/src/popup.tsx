import "./popup.css";

import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionAuthSnapshot } from "@memsync/shared";

import { clearExtensionAuth, loadExtensionAuth, saveExtensionToken } from "./lib/auth";
import { getExtensionSetupUrl } from "./lib/api";
import type { ProviderId } from "./lib/bridge";
import { loadSharedCache } from "./lib/panel-state";
import { getProviderFromUrl } from "./lib/providers";
import { beginManualSyncRun, endManualSyncRun, refreshProvider as refreshProviderViaRunner, setScheduledSyncEnabled, syncDirection } from "./lib/sync";
import type { SharedCache } from "./lib/storage";
import { MemoryPanel } from "./ui/memory-panel";

type ActiveTabState = {
  id: number | null;
  provider: ProviderId | null;
};

type PopupScreen = "main" | "settings";

async function getActiveTab(): Promise<ActiveTabState> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return {
    id: typeof tab?.id === "number" ? tab.id : null,
    provider: getProviderFromUrl(tab?.url),
  };
}

function PopupApp() {
  const [cache, setCache] = useState<SharedCache | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderId>("claude");
  const [currentProvider, setCurrentProvider] = useState<ProviderId | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadingProvider, setLoadingProvider] = useState<ProviderId | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ProviderId, string>>>({});
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [screen, setScreen] = useState<PopupScreen>("main");
  const [authState, setAuthState] = useState<ExtensionAuthSnapshot | null>(null);
  const [authBusy, setAuthBusy] = useState<"save" | "refresh" | "clear" | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const isAuthenticated = authState?.status === "authenticated";
  const isSupportedHost = !!currentProvider && activeTabId !== null;

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      const [initialCache, tab, initialAuth] = await Promise.all([loadSharedCache(), getActiveTab(), loadExtensionAuth()]);
      if (cancelled) {
        return;
      }

      setCache(initialCache);
      setAuthState(initialAuth);
      setCurrentProvider(tab.provider);
      setActiveTabId(tab.id);
      setActiveTab(tab.provider ?? (initialCache.providers.chatgpt ? "chatgpt" : "claude"));
    }

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshProvider(provider: ProviderId) {
    if (activeTabId === null && currentProvider !== provider) {
      setErrors(current => ({ ...current, [provider]: "Open Claude or ChatGPT to refresh live data." }));
      return;
    }

    setLoadingProvider(provider);
    setErrors(current => ({ ...current, [provider]: undefined }));

    try {
      const updatedCache = await refreshProviderViaRunner(provider);
      setCache(updatedCache);
    } catch (error) {
      setErrors(current => ({ ...current, [provider]: error instanceof Error ? error.message : String(error) }));
    } finally {
      setLoadingProvider(current => (current === provider ? null : current));
    }
  }

  useEffect(() => {
    if (!currentProvider || !isAuthenticated) {
      return;
    }

    void refreshProvider(currentProvider);
  }, [currentProvider, activeTabId, isAuthenticated]);

  async function handleSaveToken() {
    const value = tokenInput.trim();
    if (!value) {
      return;
    }

    setAuthBusy("save");
    const nextAuth = await saveExtensionToken(value);
    setAuthState(nextAuth);
    setTokenInput("");
    setAuthBusy(null);
  }

  async function handleRefreshAuth() {
    setAuthBusy("refresh");
    const nextAuth = await loadExtensionAuth();
    setAuthState(nextAuth);
    setAuthBusy(null);
  }

  async function handleClearAuth() {
    setAuthBusy("clear");
    const nextAuth = await clearExtensionAuth();
    setAuthState(nextAuth);
    setTokenInput("");
    setScheduleError(null);
    setAuthBusy(null);
  }

  async function openAppSetup() {
    await chrome.tabs.create({ url: getExtensionSetupUrl() });
  }

  async function syncChatGptToClaude() {
    if (!cache?.providers.chatgpt || !cache.providers.claude) {
      return;
    }

    setBusyAction("chatgptToClaude");
    setErrors(current => ({ ...current, claude: undefined }));

    let runOwner: string | null = null;

    try {
      runOwner = await beginManualSyncRun();
      const { cache: updatedCache } = await syncDirection("chatgptToClaude", "manual");
      setCache(updatedCache);
    } catch (error) {
      setErrors(current => ({ ...current, claude: error instanceof Error ? error.message : String(error) }));
    } finally {
      if (runOwner) {
        await endManualSyncRun(runOwner);
      }
      setBusyAction(null);
    }
  }

  async function syncClaudeToChatGpt() {
    if (!cache?.providers.claude) {
      return;
    }

    setBusyAction("claudeToChatgpt");
    setErrors(current => ({ ...current, chatgpt: undefined }));

    let runOwner: string | null = null;

    try {
      runOwner = await beginManualSyncRun();
      const { cache: updatedCache } = await syncDirection("claudeToChatgpt", "manual");
      setCache(updatedCache);
    } catch (error) {
      setErrors(current => ({ ...current, chatgpt: error instanceof Error ? error.message : String(error) }));
    } finally {
      if (runOwner) {
        await endManualSyncRun(runOwner);
      }
      setBusyAction(null);
    }
  }

  async function toggleScheduledSync(enabled: boolean) {
    if (!isAuthenticated) {
      setScheduleError("Authenticate the extension first before enabling scheduled sync.");
      return;
    }

    setScheduleBusy(true);
    setScheduleError(null);

    try {
      const updatedCache = await setScheduledSyncEnabled(enabled);
      setCache(updatedCache);
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : String(error));
    } finally {
      setScheduleBusy(false);
    }
  }

  const description = useMemo(() => {
    if (currentProvider) {
      return undefined;
    }

    return "Open Claude or ChatGPT to refresh or sync memories.";
  }, [currentProvider]);

  return (
    <div className="flex h-full w-full flex-col bg-transparent p-3 text-foreground">
      <MemoryPanel
        screen={screen}
        currentProvider={currentProvider}
        activeTab={activeTab}
        cache={cache}
        errors={errors}
        loadingProvider={loadingProvider}
        busyAction={busyAction}
        scheduleBusy={scheduleBusy}
        scheduleError={scheduleError}
        authState={authState}
        authBusy={authBusy}
        tokenInput={tokenInput}
        onTabChange={setActiveTab}
        onOpenSettings={() => setScreen("settings")}
        onBack={() => setScreen("main")}
        onOpenApp={openAppSetup}
        onTokenInputChange={setTokenInput}
        onSaveToken={() => {
          void handleSaveToken();
        }}
        onRefreshAuth={() => {
          void handleRefreshAuth();
        }}
        onClearAuth={() => {
          void handleClearAuth();
        }}
        onSyncClaudeToChatGpt={() => {
          void syncClaudeToChatGpt();
        }}
        onSyncChatGptToClaude={() => {
          void syncChatGptToClaude();
        }}
        onToggleScheduledSync={enabled => {
          void toggleScheduledSync(enabled);
        }}
        unsupportedDescription={description}
        liveActionsEnabled={isSupportedHost && isAuthenticated}
      />
    </div>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Popup root element was not found.");
}

createRoot(root).render(
  <StrictMode>
    <PopupApp />
  </StrictMode>,
);
