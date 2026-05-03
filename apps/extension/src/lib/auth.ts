import type { ExtensionAuthSnapshot } from "@memsync/shared";

import { verifyExtensionTokenRequest } from "./api";
import { clearExtensionAuth as clearStoredExtensionAuth, previewToken, readExtensionAuth, writeExtensionAuth } from "./storage";

function buildAnonymousSnapshot(): ExtensionAuthSnapshot {
  return {
    token: null,
    tokenPreview: null,
    status: "anonymous",
    userEmail: null,
    verifiedAt: null,
    lastError: null,
  };
}

export async function refreshExtensionAuth(tokenOverride?: string | null) {
  const current = await readExtensionAuth();
  const token = tokenOverride?.trim() || current.token;

  if (!token) {
    const anonymous = buildAnonymousSnapshot();
    await writeExtensionAuth(anonymous);
    return anonymous;
  }

  const verifyingSnapshot: ExtensionAuthSnapshot = {
    ...current,
    token,
    tokenPreview: current.tokenPreview ?? previewToken(token),
    status: "verifying",
    lastError: null,
  };
  await writeExtensionAuth(verifyingSnapshot);

  try {
    const result = await verifyExtensionTokenRequest(token);
    const nextSnapshot: ExtensionAuthSnapshot = {
      token,
      tokenPreview: result.tokenPreview ?? previewToken(token),
      status: result.status,
      userEmail: result.userEmail,
      verifiedAt: result.verifiedAt,
      lastError: result.message,
    };
    await writeExtensionAuth(nextSnapshot);
    return nextSnapshot;
  } catch (error) {
    const failedSnapshot: ExtensionAuthSnapshot = {
      token,
      tokenPreview: previewToken(token),
      status: "invalid",
      userEmail: current.userEmail,
      verifiedAt: null,
      lastError: error instanceof Error ? error.message : "Failed to verify the extension token.",
    };
    await writeExtensionAuth(failedSnapshot);
    return failedSnapshot;
  }
}

export async function loadExtensionAuth() {
  const current = await readExtensionAuth();
  if (!current.token) {
    return current;
  }

  return await refreshExtensionAuth(current.token);
}

export async function saveExtensionToken(token: string) {
  return await refreshExtensionAuth(token);
}

export async function clearExtensionAuth() {
  await clearStoredExtensionAuth();
  return await readExtensionAuth();
}
