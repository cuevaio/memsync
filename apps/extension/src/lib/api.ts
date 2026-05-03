import type { ExtensionTokenVerificationResult } from "@memsync/shared";

import { env } from "../env";

export function getAppBaseUrl() {
  return env.MEMSYNC_APP_URL.replace(/\/$/, "");
}

export function getExtensionSetupUrl() {
  return `${getAppBaseUrl()}/app/settings/extension`;
}

export async function verifyExtensionTokenRequest(token: string) {
  const response = await fetch(`${getAppBaseUrl()}/api/extension/auth/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token }),
  });

  const payload = (await response.json().catch(() => null)) as ExtensionTokenVerificationResult | { message?: string } | null;
  if (!payload) {
    throw new Error(`Auth verification failed with status ${response.status}.`);
  }

  if (!response.ok && !("status" in payload)) {
    throw new Error(payload.message ?? `Auth verification failed with status ${response.status}.`);
  }

  return payload as ExtensionTokenVerificationResult;
}
