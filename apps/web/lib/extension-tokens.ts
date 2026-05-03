import "server-only";

import { createHash } from "node:crypto";

import { findExtensionTokenByHash, getUserByClerkId, touchExtensionToken } from "@memsync/db";

import type { ExtensionTokenRecord, ExtensionTokenVerificationResult } from "@memsync/shared";

import { isEntitledStatus, refreshPolarCustomerStateForUser } from "./billing";

export function hashExtensionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function serializeExtensionTokenRecord(record: {
  id: string;
  label: string;
  tokenPrefix: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}): ExtensionTokenRecord {
  return {
    id: record.id,
    label: record.label,
    tokenPreview: `${record.tokenPrefix}...${record.last4}`,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt
  };
}

export async function verifyExtensionToken(token: string): Promise<ExtensionTokenVerificationResult> {
  const tokenHash = hashExtensionToken(token);
  const record = await findExtensionTokenByHash(tokenHash);

  if (!record || record.revokedAt) {
    return {
      ok: false,
      status: "invalid",
      userEmail: null,
      tokenPreview: null,
      verifiedAt: null,
      message: "This extension token is invalid or has been revoked."
    };
  }

  const user = await getUserByClerkId(record.clerkUserId);
  const subscription = await refreshPolarCustomerStateForUser(record.clerkUserId);
  if (!isEntitledStatus(subscription?.status ?? null)) {
    return {
      ok: false,
      status: "subscription_required",
      userEmail: user?.email ?? null,
      tokenPreview: `${record.tokenPrefix}...${record.last4}`,
      verifiedAt: null,
      message: "An active or trialing subscription is required before the extension can authenticate."
    };
  }

  await touchExtensionToken(record.id);

  return {
    ok: true,
    status: "authenticated",
    userEmail: user?.email ?? null,
    tokenPreview: `${record.tokenPrefix}...${record.last4}`,
    verifiedAt: new Date().toISOString(),
    message: null
  };
}
