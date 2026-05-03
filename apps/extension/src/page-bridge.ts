import { normalizeMemoryResponse } from "./lib/claude-memory";
import { normalizeChatGptMemoryResponse } from "./lib/chatgpt-memory";
import {
  BRIDGE_SOURCE,
  type BridgeFromPageMessage,
  type BridgeRequest,
  type BridgeToPageMessage,
  type ProviderId,
  postBridgeMessage,
} from "./lib/bridge";
import { deriveOrgId } from "./lib/org-id";
import { getCurrentProviderFromLocation } from "./lib/providers";

let cachedClaudeOrgId: string | null = null;

function getCookie(name: string): string | null {
  const entries = document.cookie.split(";").map(part => part.trim());
  for (const entry of entries) {
    if (entry.startsWith(`${name}=`)) {
      return decodeURIComponent(entry.slice(name.length + 1));
    }
  }

  return null;
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function getStorageValue(key: string): string | null {
  return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
}

function findJwtInObject(value: unknown, seen = new WeakSet<object>()): string | null {
  if (typeof value === "string") {
    return /^eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(value) ? value : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJwtInObject(item, seen);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findJwtInObject(nested, seen);
    if (found) {
      return found;
    }
  }

  return null;
}

function getAuthTokenFromStorage(): string | null {
  const candidateKeys = [
    "__Secure-next-auth.session-token",
    "__Secure-next-auth.session-token.0",
    "__Secure-next-auth.session-token.1",
    "accessToken",
    "accessTokenData",
    "oai/authToken",
    "oai/apps/auth",
    "oai/apps/session",
    "auth-access-token",
    "authToken",
    "token",
  ];

  for (const key of candidateKeys) {
    const raw = getStorageValue(key);
    if (!raw) {
      continue;
    }

    if (raw.startsWith("eyJ")) {
      return raw;
    }

    const parsed = safeJsonParse<Record<string, unknown>>(raw);
    if (!parsed) {
      continue;
    }

    const nestedCandidates = [parsed.accessToken, parsed.token, parsed.bearerToken, parsed.idToken, parsed.authToken];
    for (const nested of nestedCandidates) {
      if (typeof nested === "string" && nested.startsWith("eyJ")) {
        return nested;
      }
    }

    const deepMatch = findJwtInObject(parsed);
    if (deepMatch) {
      return deepMatch;
    }
  }

  const globalCandidates = [
    (window as unknown as Record<string, unknown>).__NEXT_DATA__,
    (window as unknown as Record<string, unknown>).__remixContext,
    (window as unknown as Record<string, unknown>)._oai,
    (window as unknown as Record<string, unknown>).__INITIAL_STATE__,
  ];

  for (const candidate of globalCandidates) {
    const found = findJwtInObject(candidate);
    if (found) {
      return found;
    }
  }

  const scripts = Array.from(document.querySelectorAll("script"));
  for (const script of scripts) {
    const text = script.textContent;
    if (!text || text.length > 2_000_000) {
      continue;
    }

    const match = text.match(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/);
    if (match) {
      return match[0];
    }
  }

  return null;
}

type ChatGptConfig = {
  buildNumber: string | null;
  clientVersion: string | null;
  sessionId: string | null;
  deviceId: string | null;
  sentinelRequirements: string | null;
  sentinelProof: string | null;
  turnstileToken: string | null;
  conduitToken: string | null;
  echoLogs: string | null;
};

type ChatGptConversationPrepareResponse = {
  status?: string;
  conduit_token?: string;
};

let observedChatGptHeaders: Partial<Record<string, string>> = {};

function rememberChatGptHeaders(headers: HeadersInit | undefined) {
  if (!headers) {
    return;
  }

  const pairs = new Headers(headers);
  const interestingHeaders = [
    "oai-client-build-number",
    "oai-client-version",
    "oai-session-id",
    "oai-echo-logs",
    "oai-device-id",
    "oai-language",
  ] as const;

  for (const name of interestingHeaders) {
    const value = pairs.get(name);
    if (value) {
      observedChatGptHeaders[name] = value;
    }
  }
}

function installChatGptFetchObserver() {
  const currentFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : null;
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : request?.url ?? "";

    if (url.includes("/backend-api/") && url.includes("chatgpt.com") || url.startsWith("/backend-api/")) {
      rememberChatGptHeaders(init?.headers ?? request?.headers);
    }

    return currentFetch(input, init);
  }) as typeof fetch;
}

function getStringFromObject(value: unknown, key: string, seen = new WeakSet<object>()): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = getStringFromObject(item, key, seen);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  const direct = record[key];
  if (typeof direct === "string" && direct.length > 0) {
    return direct;
  }

  for (const nested of Object.values(record)) {
    const found = getStringFromObject(nested, key, seen);
    if (found) {
      return found;
    }
  }

  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getStringFromScripts(key: string) {
  const escapedKey = escapeRegExp(key);
  const patterns = [
    new RegExp(`"${escapedKey}":"([^"]+)"`),
    new RegExp(`"${escapedKey}":\s*"([^"]+)"`),
    new RegExp(`${escapedKey}[:=]"([^"]+)"`),
  ];

  const scripts = Array.from(document.querySelectorAll("script"));
  for (const script of scripts) {
    const text = script.textContent;
    if (!text || text.length > 2_000_000) {
      continue;
    }

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return null;
}

function getMetaContent(name: string) {
  return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;
}

function getChatGptConfig(): ChatGptConfig {
  const globalConfig = (window as typeof window & { __remixContext?: unknown; __NEXT_DATA__?: unknown; _oai?: unknown })._oai;

  return {
    buildNumber:
      observedChatGptHeaders["oai-client-build-number"]
      ??
      getStringFromObject(globalConfig, "buildNumber")
      ?? getStorageValue("oai-client-build-number")
      ?? getMetaContent("oai-client-build-number")
      ?? getStringFromScripts("buildNumber")
      ?? getStringFromScripts("oai-client-build-number")
      ?? null,
    clientVersion:
      observedChatGptHeaders["oai-client-version"]
      ??
      getStringFromObject(globalConfig, "clientVersion")
      ?? getStorageValue("oai-client-version")
      ?? getMetaContent("oai-client-version")
      ?? getStringFromScripts("clientVersion")
      ?? getStringFromScripts("oai-client-version")
      ?? null,
    sessionId:
      observedChatGptHeaders["oai-session-id"]
      ??
      getStringFromObject(globalConfig, "sessionId")
      ?? getStorageValue("oai-session-id")
      ?? getMetaContent("oai-session-id")
      ?? getStringFromScripts("sessionId")
      ?? getStringFromScripts("oai-session-id")
      ?? null,
    deviceId: observedChatGptHeaders["oai-device-id"] ?? getStringFromObject(globalConfig, "deviceId") ?? getCookie("oai-did") ?? null,
    sentinelRequirements:
      getStringFromObject(globalConfig, "chatRequirementsToken")
      ?? getStorageValue("openai-sentinel-chat-requirements-token")
      ?? getCookie("openai-sentinel-chat-requirements-token")
      ?? null,
    sentinelProof:
      getStringFromObject(globalConfig, "proofToken")
      ?? getStorageValue("openai-sentinel-proof-token")
      ?? getCookie("openai-sentinel-proof-token")
      ?? null,
    turnstileToken:
      getStringFromObject(globalConfig, "turnstileToken")
      ?? getStorageValue("openai-sentinel-turnstile-token")
      ?? getCookie("openai-sentinel-turnstile-token")
      ?? null,
    conduitToken:
      getStringFromObject(globalConfig, "conduitToken")
      ?? getStorageValue("x-conduit-token")
      ?? getCookie("x-conduit-token")
      ?? null,
    echoLogs: observedChatGptHeaders["oai-echo-logs"] ?? getStringFromObject(globalConfig, "echoLogs") ?? getStorageValue("oai-echo-logs") ?? null,
  };
}

function createRequest(url: string, headers: Record<string, string>) {
  return { url, headers };
}

function redactHeaderValue(name: string, value: string) {
  const lowerName = name.toLowerCase();
  if (
    lowerName === "authorization"
    || lowerName.includes("token")
    || lowerName === "cookie"
    || lowerName === "set-cookie"
    || lowerName === "x-conduit-token"
  ) {
    return `<redacted:${name}>`;
  }

  return value;
}

function sanitizeHeaders(headers: HeadersInit | undefined) {
  const sanitized: Record<string, string> = {};
  if (!headers) {
    return sanitized;
  }

  const pairs = new Headers(headers);
  for (const [key, value] of pairs.entries()) {
    sanitized[key] = redactHeaderValue(key, value);
  }

  return sanitized;
}

function sanitizeBody(body: BodyInit | null | undefined) {
  if (typeof body !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.p === "string") {
        parsed.p = `<redacted:p:${parsed.p.length}>`;
      }
      if (typeof parsed.prepare_token === "string") {
        parsed.prepare_token = `<redacted:prepare_token:${parsed.prepare_token.length}>`;
      }
      if (typeof parsed.openai_sentinel_chat_requirements_token === "string") {
        parsed.openai_sentinel_chat_requirements_token = "<redacted:chat_requirements_token>";
      }
      if (typeof parsed.openai_sentinel_proof_token === "string") {
        parsed.openai_sentinel_proof_token = "<redacted:proof_token>";
      }
      if (typeof parsed.openai_sentinel_turnstile_token === "string") {
        parsed.openai_sentinel_turnstile_token = "<redacted:turnstile_token>";
      }
    }
    return parsed;
  } catch {
    return body.length > 500 ? `${body.slice(0, 500)}...` : body;
  }
}

function sanitizeResponseText(text: string) {
  if (!text) {
    return text;
  }

  let sanitized = text;
  sanitized = sanitized.replace(/"prepare_token":"[^"]+"/g, '"prepare_token":"<redacted>"');
  sanitized = sanitized.replace(/"token":"[^"]+"/g, '"token":"<redacted>"');
  sanitized = sanitized.replace(/"dx":"[^"]+"/g, '"dx":"<redacted>"');
  return sanitized.length > 2000 ? `${sanitized.slice(0, 2000)}...` : sanitized;
}

function postDebug(requestId: string, provider: ProviderId, action: string, payload: unknown) {
  postBridgeMessage({
    source: BRIDGE_SOURCE,
    target: "content",
    requestId,
    type: "provider:debug",
    provider,
    action,
    payload,
  });
}

async function debugFetch(requestId: string, provider: ProviderId, action: string, input: string, init: RequestInit) {
  postDebug(requestId, provider, `${action}:request`, {
    url: input,
    method: init.method ?? "GET",
    headers: sanitizeHeaders(init.headers),
    body: sanitizeBody(init.body),
    locationHref: window.location.href,
    referrer: document.referrer,
    currentScript: (document.currentScript as HTMLScriptElement | null)?.src ?? null,
  });

  const response = await fetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  let responsePreview: string | null = null;

  if (contentType.includes("application/json") || contentType.includes("text/")) {
    try {
      responsePreview = sanitizeResponseText(await response.clone().text());
    } catch {
      responsePreview = "<unavailable>";
    }
  }

  postDebug(requestId, provider, `${action}:response`, {
    url: input,
    status: response.status,
    ok: response.ok,
    contentType,
    headers: sanitizeHeaders(response.headers),
    bodyPreview: responsePreview,
  });

  return response;
}

function createError(provider: ProviderId, action: string, error: unknown, request?: BridgeRequest, requestId: string = crypto.randomUUID()) {
  return {
    source: BRIDGE_SOURCE,
    target: "content",
    requestId,
    type: "provider:error",
    provider,
    action,
    message: error instanceof Error ? error.message : String(error),
    request,
  } satisfies BridgeFromPageMessage;
}

window.addEventListener("error", event => {
  postBridgeMessage(
    createError(
      getCurrentProviderFromLocation() ?? "chatgpt",
      "bridge:runtime",
      new Error(event.message || "Unknown page bridge error"),
    ),
  );
});

window.addEventListener("unhandledrejection", event => {
  const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  postBridgeMessage(createError(getCurrentProviderFromLocation() ?? "chatgpt", "bridge:runtime", reason));
});

installChatGptFetchObserver();

function buildClaudeHeaders(referer: string, includeJsonContentType: boolean) {
  const headers: Record<string, string> = {
    accept: "*/*",
    "accept-language": navigator.language ? `${navigator.language},en;q=0.9` : "en-US,en;q=0.9",
    "anthropic-client-platform": "web_claude_ai",
    "anthropic-client-version": "1.0.0",
    "cache-control": "no-cache",
    pragma: "no-cache",
    priority: "u=1, i",
    referer,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-activity-session-id": getCookie("activitySessionId") ?? crypto.randomUUID(),
  };

  const anonymousId = getCookie("ajs_anonymous_id")?.replace(/^"|"$/g, "");
  const deviceId = getCookie("anthropic-device-id");

  if (anonymousId) {
    headers["anthropic-anonymous-id"] = anonymousId;
  }

  if (deviceId) {
    headers["anthropic-device-id"] = deviceId;
  }

  if (includeJsonContentType) {
    headers["content-type"] = "application/json";
  }

  return headers;
}

function buildChatGptHeaders(targetPath: string, accept = "*/*", contentType?: string) {
  const authToken = getAuthTokenFromStorage();
  const config = getChatGptConfig();
  const headers: Record<string, string> = {
    accept,
    authorization: authToken ? `Bearer ${authToken}` : "",
    "accept-language": navigator.language ? `${navigator.language},en;q=0.9` : "en-US,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    priority: "u=1, i",
    referer: window.location.href,
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "oai-device-id": config.deviceId ?? "",
    "oai-language": navigator.language || "en-US",
    "x-openai-target-path": targetPath,
    "x-openai-target-route": targetPath,
  };

  const buildNumber = config.buildNumber;
  const clientVersion = config.clientVersion;
  const sessionId = config.sessionId;
  const sentinelRequirements = config.sentinelRequirements;
  const sentinelProof = config.sentinelProof;
  const turnstileToken = config.turnstileToken;
  const conduitToken = config.conduitToken;
  const echoLogs = config.echoLogs;

  if (buildNumber) headers["oai-client-build-number"] = buildNumber;
  if (clientVersion) headers["oai-client-version"] = clientVersion;
  if (sessionId) headers["oai-session-id"] = sessionId;
  if (echoLogs) headers["oai-echo-logs"] = echoLogs;
  if (sentinelRequirements) headers["openai-sentinel-chat-requirements-token"] = sentinelRequirements;
  if (sentinelProof) headers["openai-sentinel-proof-token"] = sentinelProof;
  if (turnstileToken) headers["openai-sentinel-turnstile-token"] = turnstileToken;
  if (conduitToken) headers["x-conduit-token"] = conduitToken;
  if (contentType) headers["content-type"] = contentType;

  return headers;
}

async function fetchClaudeMemory() {
  const orgId = cachedClaudeOrgId ?? deriveOrgId();
  cachedClaudeOrgId = orgId;
  const url = `/api/organizations/${orgId}/memory`;
  const headers = buildClaudeHeaders(window.location.href, true);
  const response = await debugFetch(crypto.randomUUID(), "claude", "claude:memory", url, { credentials: "include", headers });
  const request = createRequest(url, headers);

  if (!response.ok) {
    throw { error: new Error(`Failed to load Claude memory (${response.status}): ${await response.text() || response.statusText}`), request };
  }

  return {
    accountKey: orgId,
    payload: normalizeMemoryResponse(await response.json()),
    request,
  };
}

async function replaceClaudeControls(requestId: string, controls: string[], action: "claude:add-control" | "claude:replace-controls") {
  const orgId = cachedClaudeOrgId ?? deriveOrgId();
  cachedClaudeOrgId = orgId;
  const url = `/api/organizations/${orgId}/memory/controls`;
  const headers = buildClaudeHeaders("https://claude.ai/settings/capabilities?modal=memory", true);
  const request = createRequest(url, headers);
  const response = await debugFetch(requestId, "claude", action, url, {
    method: "PUT",
    credentials: "include",
    headers,
    body: JSON.stringify({ controls }),
  });

  if (!response.ok) {
    throw { error: new Error(`Failed to save Claude memory (${response.status}): ${await response.text() || response.statusText}`), request };
  }

  const refreshed = await fetchClaudeMemory();
  postBridgeMessage({
    source: BRIDGE_SOURCE,
    target: "content",
    requestId,
    type: "provider:action-complete",
    provider: "claude",
    action,
    accountKey: orgId,
    payload: refreshed.payload,
    request,
  });
}

async function fetchChatGptMemories() {
  const url = "/backend-api/memories?exclusive_to_gizmo=false&include_memory_entries=true";
  const headers = buildChatGptHeaders("/backend-api/memories", "*/*");
  const request = createRequest(url, headers);
  if (!headers.authorization) {
    throw { error: new Error("Could not find ChatGPT bearer token in page runtime. The request was not sent."), request };
  }
  const response = await debugFetch(crypto.randomUUID(), "chatgpt", "chatgpt:memories", url, { credentials: "include", headers });

  if (!response.ok) {
    throw { error: new Error(`Failed to load ChatGPT memories (${response.status}): ${await response.text() || response.statusText}`), request };
  }

  return {
    accountKey: getCookie("_puid") ?? "default",
    payload: normalizeChatGptMemoryResponse(await response.json()),
    request,
  };
}

async function prepareChatGptConversation(requestId: string, prompt: string) {
  const url = "/backend-api/f/conversation/prepare";
  const headers = buildChatGptHeaders(url, "*/*", "application/json");
  headers.origin = window.location.origin;
  headers.referer = `${window.location.origin}/`;
  headers["x-conduit-token"] = "no-token";
  headers["x-oai-turn-trace-id"] = crypto.randomUUID();
  const request = createRequest(url, headers);

  const payload = {
    action: "next",
    fork_from_shared_post: false,
    parent_message_id: "client-created-root",
    model: "gpt-5-3",
    client_prepare_state: "none",
    timezone_offset_min: new Date().getTimezoneOffset() * -1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    conversation_mode: { kind: "primary_assistant" },
    system_hints: [],
    partial_query: {
      id: crypto.randomUUID(),
      author: { role: "user" },
      content: { content_type: "text", parts: [prompt.slice(0, 1) || "h"] },
    },
    supports_buffering: true,
    supported_encodings: ["v1"],
    client_contextual_info: { app_name: "chatgpt.com" },
  };

  const response = await debugFetch(requestId, "chatgpt", "chatgpt:prepare", url, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw { error: new Error(`Failed to prepare ChatGPT conversation (${response.status}): ${await response.text() || response.statusText}`), request };
  }

  const data = await response.json() as ChatGptConversationPrepareResponse;
  postDebug(requestId, "chatgpt", "chatgpt:prepare:parsed", {
    status: data.status ?? null,
    hasConduitToken: typeof data.conduit_token === "string",
  });

  return { data, request };
}

function getChatGptComposer() {
  const selectors = [
    '#prompt-textarea',
    'div.ProseMirror#prompt-textarea',
    'textarea[data-testid="composer-text-input"]',
    'textarea[placeholder]',
    'textarea',
    '[contenteditable="true"][data-testid="composer-text-input"]',
    '[contenteditable="true"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLElement) {
      return element;
    }
  }

  return null;
}

function getChatGptSendButton() {
  const selectors = [
    '#composer-submit-button',
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="send"]',
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element instanceof HTMLButtonElement) {
      return element;
    }
  }

  return null;
}

function setNativeTextAreaValue(element: HTMLTextAreaElement, value: string) {
  const prototype = Object.getPrototypeOf(element) as HTMLTextAreaElement;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
}

async function waitForChatGptSendButton(timeoutMs = 2000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const sendButton = getChatGptSendButton();
    if (sendButton && !sendButton.disabled) {
      return sendButton;
    }
    await new Promise(resolve => window.setTimeout(resolve, 50));
  }

  return getChatGptSendButton();
}

async function sendChatGptConversationViaUi(requestId: string, prompt: string) {
  const composer = getChatGptComposer();
  if (!composer) {
    postDebug(requestId, "chatgpt", "chatgpt:ui-send:missing-composer", {});
    return false;
  }

  postDebug(requestId, "chatgpt", "chatgpt:ui-send:composer", {
    tagName: composer.tagName,
    isContentEditable: composer instanceof HTMLElement ? composer.isContentEditable : false,
  });

  if (composer instanceof HTMLTextAreaElement) {
    composer.focus();
    setNativeTextAreaValue(composer, prompt);
    composer.dispatchEvent(new Event("focus", { bubbles: true }));
    composer.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, data: prompt, inputType: "insertText" }));
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt, inputType: "insertText" }));
    composer.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    composer.focus();
    composer.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    composer.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    composer.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.execCommand("selectAll", false);
    document.execCommand("insertText", false, prompt);
    composer.dispatchEvent(new Event("focus", { bubbles: true }));
    composer.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, data: prompt, inputType: "insertText" }));
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, data: prompt, inputType: "insertText" }));
    composer.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const sendButton = await waitForChatGptSendButton();
  postDebug(requestId, "chatgpt", "chatgpt:ui-send:button-state", {
    found: !!sendButton,
    disabled: sendButton?.disabled ?? null,
  });

  if (sendButton && !sendButton.disabled) {
    postDebug(requestId, "chatgpt", "chatgpt:ui-send:button", { disabled: sendButton.disabled });
    sendButton.click();
    return true;
  }

  postDebug(requestId, "chatgpt", "chatgpt:ui-send:failed", {});
  composer.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
  composer.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", bubbles: true }));
  composer.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
  return false;
}

async function sendChatGptConversation(requestId: string, prompt: string) {
  const sentViaUi = await sendChatGptConversationViaUi(requestId, prompt);
  if (!sentViaUi) {
    throw {
      error: new Error("Failed to trigger ChatGPT's native send flow from the UI composer."),
      request: createRequest(window.location.href, {}),
    };
  }

  await new Promise(resolve => window.setTimeout(resolve, 3000));

  const refreshed = await fetchChatGptMemories();
  postBridgeMessage({
    source: BRIDGE_SOURCE,
    target: "content",
    requestId,
    type: "provider:action-complete",
    provider: "chatgpt",
    action: "chatgpt:store-memories",
    accountKey: refreshed.accountKey,
    payload: refreshed.payload,
    request: createRequest(window.location.href, {}),
  });
}

async function handleLoad(requestId: string, provider: ProviderId) {
  if (provider === "claude") {
    const result = await fetchClaudeMemory();
    postBridgeMessage({
      source: BRIDGE_SOURCE,
      target: "content",
      requestId,
      type: "provider:loaded",
      provider,
      accountKey: result.accountKey,
      payload: result.payload,
      request: result.request,
    });
    return;
  }

  const result = await fetchChatGptMemories();
  postBridgeMessage({
    source: BRIDGE_SOURCE,
    target: "content",
    requestId,
    type: "provider:loaded",
    provider,
    accountKey: result.accountKey,
    payload: result.payload,
    request: result.request,
  });
}

window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== window.location.origin) {
    return;
  }

  const message = event.data as BridgeToPageMessage | undefined;
  if (!message || message.source !== BRIDGE_SOURCE || message.target !== "page") {
    return;
  }

  const provider = getCurrentProviderFromLocation();

  if (message.type === "bridge:ping") {
    if (!provider) {
      return;
    }

    postBridgeMessage({
      source: BRIDGE_SOURCE,
      target: "content",
      requestId: message.requestId,
      type: "bridge:pong",
      provider,
    });
    return;
  }

  if (message.type === "provider:load") {
    void handleLoad(message.requestId, message.provider).catch(cause => {
      const data = cause as { error?: unknown; request?: BridgeRequest };
      postBridgeMessage(createError(message.provider, "provider:load", data.error ?? cause, data.request, message.requestId));
    });
    return;
  }

  if (message.type === "claude:add-control") {
    void fetchClaudeMemory()
      .then(result => replaceClaudeControls(message.requestId, [...result.payload.controls, message.value.trim()], "claude:add-control"))
      .catch(cause => {
        const data = cause as { error?: unknown; request?: BridgeRequest };
        postBridgeMessage(createError("claude", "claude:add-control", data.error ?? cause, data.request, message.requestId));
      });
    return;
  }

  if (message.type === "claude:replace-controls") {
    void replaceClaudeControls(message.requestId, message.controls, "claude:replace-controls").catch(cause => {
      const data = cause as { error?: unknown; request?: BridgeRequest };
      postBridgeMessage(createError("claude", "claude:replace-controls", data.error ?? cause, data.request, message.requestId));
    });
    return;
  }

  if (message.type === "chatgpt:store-memories") {
    if (provider !== "chatgpt") {
      postBridgeMessage(createError("chatgpt", "chatgpt:store-memories", new Error("ChatGPT sync must be triggered while on chatgpt.com."), undefined, message.requestId));
      return;
    }

    void sendChatGptConversation(message.requestId, message.prompt).catch(cause => {
      const data = cause as { error?: unknown; request?: BridgeRequest };
      postBridgeMessage(createError("chatgpt", "chatgpt:store-memories", data.error ?? cause, data.request, message.requestId));
    });
  }
});
