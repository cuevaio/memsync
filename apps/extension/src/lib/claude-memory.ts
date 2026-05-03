import type { CanonicalMemoryItem, ClaudeMemoryPayload } from "./bridge";

export type ClaudeMemoryResponse = ClaudeMemoryPayload;

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeMemoryResponse(value: unknown): ClaudeMemoryResponse {
  if (!value || typeof value !== "object") {
    throw new Error("Claude memory response was not an object.");
  }

  const data = value as Partial<ClaudeMemoryResponse>;

  return {
    memory: typeof data.memory === "string" ? data.memory : "",
    controls: Array.isArray(data.controls) ? data.controls.filter((item): item is string => typeof item === "string") : [],
    updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
  };
}

export function toCanonicalClaudeItems(payload: ClaudeMemoryPayload): CanonicalMemoryItem[] {
  return payload.controls.map(control => ({
    id: `claude:${normalizeText(control)}`,
    text: control,
    normalizedText: normalizeText(control),
    sourceProvider: "claude",
    sourceId: null,
    updatedAt: payload.updated_at,
  }));
}

export function mergeClaudeControls(existing: string[], incoming: CanonicalMemoryItem[]) {
  const seen = new Set(existing.map(normalizeText));
  const merged = [...existing];

  for (const item of incoming) {
    if (seen.has(item.normalizedText)) {
      continue;
    }

    seen.add(item.normalizedText);
    merged.push(item.text);
  }

  return merged;
}
