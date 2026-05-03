export const BRIDGE_SOURCE = "memsync-extension";

export type ProviderId = "claude" | "chatgpt";

export type CanonicalMemoryItem = {
  id: string;
  text: string;
  normalizedText: string;
  sourceProvider: ProviderId;
  sourceId: string | null;
  updatedAt: string | null;
};

export type ClaudeMemoryPayload = {
  memory: string;
  controls: string[];
  updated_at: string | null;
};

export type ChatGptMemoryPayload = {
  entries: Array<{
    id: string;
    content: string;
    updated_at: string | null;
  }>;
  updated_at: string | null;
  entry_count: number;
  token_count: number | null;
};

export type BridgeRequest = {
  url: string;
  headers: Record<string, string>;
};

export type BridgeToPageMessage =
  | {
      source: typeof BRIDGE_SOURCE;
      target: "page";
      requestId: string;
      type: "bridge:ping";
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "page";
      requestId: string;
      type: "provider:load";
      provider: ProviderId;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "page";
      requestId: string;
      type: "claude:add-control";
      value: string;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "page";
      requestId: string;
      type: "claude:replace-controls";
      controls: string[];
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "page";
      requestId: string;
      type: "chatgpt:store-memories";
      items: CanonicalMemoryItem[];
      prompt: string;
    };

export type BridgeFromPageMessage =
  | {
      source: typeof BRIDGE_SOURCE;
      target: "content";
      requestId: string;
      type: "bridge:pong";
      provider: ProviderId;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "content";
      requestId: string;
      type: "provider:loaded";
      provider: ProviderId;
      accountKey: string;
      payload: ClaudeMemoryPayload | ChatGptMemoryPayload;
      request: BridgeRequest;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "content";
      requestId: string;
      type: "provider:action-complete";
      provider: ProviderId;
      action: "claude:add-control" | "claude:replace-controls" | "chatgpt:store-memories";
      accountKey: string;
      payload?: ClaudeMemoryPayload | ChatGptMemoryPayload;
      request: BridgeRequest;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "content";
      requestId: string;
      type: "provider:error";
      provider: ProviderId;
      action: string;
      message: string;
      request?: BridgeRequest;
    }
  | {
      source: typeof BRIDGE_SOURCE;
      target: "content";
      requestId: string;
      type: "provider:debug";
      provider: ProviderId;
      action: string;
      payload: unknown;
    };

export function postBridgeMessage(message: BridgeToPageMessage | BridgeFromPageMessage) {
  window.postMessage(message, window.location.origin);
}

export function isBridgeFromPageMessage(value: unknown): value is BridgeFromPageMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<BridgeFromPageMessage>;
  return message.source === BRIDGE_SOURCE && message.target === "content" && typeof message.type === "string";
}

export function isBridgeToPageMessage(value: unknown): value is BridgeToPageMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<BridgeToPageMessage>;
  return message.source === BRIDGE_SOURCE && message.target === "page" && typeof message.type === "string";
}
