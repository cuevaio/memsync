export type ProviderId = "claude" | "chatgpt";

const PROVIDER_URLS: Record<ProviderId, string> = {
  claude: "https://claude.ai/",
  chatgpt: "https://chatgpt.com/",
};

export function isClaudeHost(hostname = window.location.hostname) {
  return hostname === "claude.ai";
}

export function isChatGptHost(hostname = window.location.hostname) {
  return hostname === "chatgpt.com";
}

export function getCurrentProviderFromLocation(hostname = window.location.hostname): ProviderId | null {
  if (isClaudeHost(hostname)) {
    return "claude";
  }

  if (isChatGptHost(hostname)) {
    return "chatgpt";
  }

  return null;
}

export function getProviderFromHostname(hostname?: string | null): ProviderId | null {
  if (!hostname) {
    return null;
  }

  return getCurrentProviderFromLocation(hostname);
}

export function getProviderFromUrl(url?: string | null): ProviderId | null {
  if (!url) {
    return null;
  }

  try {
    return getProviderFromHostname(new URL(url).hostname);
  } catch {
    return null;
  }
}

export function getProviderLabel(provider: ProviderId) {
  return provider === "claude" ? "Claude" : "ChatGPT";
}

export function getProviderHomeUrl(provider: ProviderId) {
  return PROVIDER_URLS[provider];
}
