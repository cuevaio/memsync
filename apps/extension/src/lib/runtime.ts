import type { ProviderId } from "./bridge";

export type RuntimeRequestId = string;

export type ExtensionRuntimeRequest =
  | {
      type: "popup:ping";
      requestId: RuntimeRequestId;
    }
  | {
      type: "popup:load-provider";
      requestId: RuntimeRequestId;
      provider: ProviderId;
    }
  | {
      type: "popup:sync-chatgpt-to-claude";
      requestId: RuntimeRequestId;
      controls: string[];
    }
  | {
      type: "popup:sync-claude-to-chatgpt";
      requestId: RuntimeRequestId;
      prompt: string;
    };

export type PopupRequest = ExtensionRuntimeRequest;

export type ExtensionRuntimeResponse =
  | {
      ok: true;
      requestId: RuntimeRequestId;
    }
  | {
      ok: false;
      requestId: RuntimeRequestId;
      error: string;
    };

export type PopupResponse = ExtensionRuntimeResponse;

export function isPopupRequest(value: unknown): value is ExtensionRuntimeRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Partial<ExtensionRuntimeRequest>;
  return typeof message.type === "string" && typeof message.requestId === "string";
}
