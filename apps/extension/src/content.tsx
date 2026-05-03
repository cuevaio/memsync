import type { BridgeFromPageMessage, BridgeToPageMessage } from "./lib/bridge";
import { getCurrentProviderFromLocation } from "./lib/providers";
import { isPopupRequest, type PopupResponse } from "./lib/runtime";
import { persistProviderSnapshot } from "./lib/panel-state";

const BRIDGE_ID = "memsync-extension-bridge";
const pendingRequests = new Map<string, (response: PopupResponse) => void>();
let runtimeBridgeRegistered = false;

function hasValidExtensionContext() {
  try {
    return typeof chrome !== "undefined" && !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function ensureBridgeScript() {
  if (!hasValidExtensionContext()) {
    return;
  }

  if (document.getElementById(BRIDGE_ID)) {
    return;
  }

  const script = document.createElement("script");
  script.id = BRIDGE_ID;
  script.src = chrome.runtime.getURL("page-bridge.js");
  script.async = false;
  script.onload = () => {
    const provider = getCurrentProviderFromLocation();
    if (provider) {
      window.postMessage(
        {
          source: "memsync-extension",
          target: "page",
          requestId: crypto.randomUUID(),
          type: "provider:load",
          provider,
        },
        window.location.origin,
      );
    }
  };
  script.onerror = () => {
    const provider = getCurrentProviderFromLocation();
    window.postMessage(
      {
        source: "memsync-extension",
        target: "content",
        requestId: crypto.randomUUID(),
        type: "provider:error",
        provider: provider ?? "chatgpt",
        action: "bridge:load",
        message: "Injected page bridge failed to load.",
      },
      window.location.origin,
    );
  };
  (document.head || document.documentElement).appendChild(script);
}

function postBridgeMessage(message: BridgeToPageMessage) {
  window.postMessage(message, window.location.origin);
}

function resolvePendingRequest(requestId: string, response: PopupResponse) {
  const pending = pendingRequests.get(requestId);
  if (!pending) {
    return;
  }

  pendingRequests.delete(requestId);
  pending(response);
}

function registerRuntimeBridge() {
  if (runtimeBridgeRegistered) {
    return;
  }

  runtimeBridgeRegistered = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isPopupRequest(message)) {
      return false;
    }

    const provider = getCurrentProviderFromLocation();
    if (!provider) {
      sendResponse({ ok: false, requestId: message.requestId, error: "This page is not supported. Open Claude or ChatGPT and try again." } satisfies PopupResponse);
      return false;
    }

    pendingRequests.set(message.requestId, sendResponse);

    if (message.type === "popup:ping") {
      pendingRequests.delete(message.requestId);
      sendResponse({ ok: true, requestId: message.requestId } satisfies PopupResponse);
      return false;
    }

    if (message.type === "popup:load-provider" && message.provider !== provider) {
      pendingRequests.delete(message.requestId);
      sendResponse({
        ok: false,
        requestId: message.requestId,
        error: `Open ${message.provider === "claude" ? "Claude" : "ChatGPT"} before trying to refresh it.`,
      } satisfies PopupResponse);
      return false;
    }

    if (message.type === "popup:load-provider") {
      postBridgeMessage({
        source: "memsync-extension",
        target: "page",
        requestId: message.requestId,
        type: "provider:load",
        provider: message.provider,
      });
      return true;
    }

    if (message.type === "popup:sync-chatgpt-to-claude") {
      postBridgeMessage({
        source: "memsync-extension",
        target: "page",
        requestId: message.requestId,
        type: "claude:replace-controls",
        controls: message.controls,
      });
      return true;
    }

    postBridgeMessage({
      source: "memsync-extension",
      target: "page",
      requestId: message.requestId,
      type: "chatgpt:store-memories",
      items: [],
      prompt: message.prompt,
    });
    return true;
  });

  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }

    const message = event.data as BridgeFromPageMessage | undefined;
    if (!message || message.source !== "memsync-extension" || message.target !== "content") {
      return;
    }

    if (message.type === "provider:error") {
      resolvePendingRequest(message.requestId, { ok: false, requestId: message.requestId, error: message.message });
      return;
    }

    if (message.type === "provider:debug") {
      console.groupCollapsed(`[memsync] ${message.provider} ${message.action}`);
      console.log(message.payload);
      console.groupEnd();
      return;
    }

    if (message.type === "bridge:pong") {
      resolvePendingRequest(message.requestId, { ok: true, requestId: message.requestId });
      return;
    }

    if (!message.payload) {
      resolvePendingRequest(message.requestId, { ok: true, requestId: message.requestId });
      return;
    }

    void persistProviderSnapshot(message.provider, message.accountKey, message.payload)
      .then(() => {
        resolvePendingRequest(message.requestId, { ok: true, requestId: message.requestId });
      })
      .catch(error => {
        resolvePendingRequest(message.requestId, {
          ok: false,
          requestId: message.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });
}

function init() {
  if (!hasValidExtensionContext()) {
    return;
  }

  ensureBridgeScript();
  registerRuntimeBridge();
}

init();
