import type { CanonicalMemoryItem, ChatGptMemoryPayload } from "./bridge";

type ChatGptMemoryResponse = {
  memories?: Array<{
    id?: string;
    content?: string;
    updated_at?: string;
  }>;
  memory_num_tokens?: number;
};

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeChatGptMemoryResponse(value: unknown): ChatGptMemoryPayload {
  if (!value || typeof value !== "object") {
    throw new Error("ChatGPT memory response was not an object.");
  }

  const data = value as ChatGptMemoryResponse;
  const entries = Array.isArray(data.memories)
    ? data.memories
        .filter(item => typeof item?.content === "string")
        .map(item => ({
          id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
          content: item.content!.trim(),
          updated_at: typeof item.updated_at === "string" ? item.updated_at : null,
        }))
    : [];

  return {
    entries,
    updated_at: entries[0]?.updated_at ?? null,
    entry_count: entries.length,
    token_count: typeof data.memory_num_tokens === "number" ? data.memory_num_tokens : null,
  };
}

export function toCanonicalChatGptItems(payload: ChatGptMemoryPayload): CanonicalMemoryItem[] {
  return payload.entries.map(entry => ({
    id: `chatgpt:${entry.id}`,
    text: entry.content,
    normalizedText: normalizeText(entry.content),
    sourceProvider: "chatgpt",
    sourceId: entry.id,
    updatedAt: entry.updated_at,
  }));
}

export function buildChatGptSyncPrompt(items: CanonicalMemoryItem[]) {
  const body = items.map(item => `- ${item.text}`).join("\n");
  return `Please store the following as memories if they are not already saved. Each bullet is a separate memory.\n\n${body}`;
}
