import { and, eq, isNull } from "drizzle-orm";

import { getDb, nowIso } from "../client";
import { extensionTokens, type ExtensionTokenRecord } from "../schema";

type CreateExtensionTokenInput = {
  id: string;
  clerkUserId: string;
  label: string;
  tokenPrefix: string;
  tokenHash: string;
  last4: string;
};

export async function listExtensionTokensForUser(clerkUserId: string) {
  const db = getDb();
  return await db.select().from(extensionTokens).where(eq(extensionTokens.clerkUserId, clerkUserId)).orderBy(extensionTokens.createdAt);
}

export async function createExtensionTokenRecord(input: CreateExtensionTokenInput) {
  const db = getDb();
  await db.insert(extensionTokens).values({
    id: input.id,
    clerkUserId: input.clerkUserId,
    label: input.label,
    tokenPrefix: input.tokenPrefix,
    tokenHash: input.tokenHash,
    last4: input.last4,
    createdAt: nowIso(),
    lastUsedAt: null,
    revokedAt: null
  });

  const tokens = await listExtensionTokensForUser(input.clerkUserId);
  return tokens.find(token => token.id === input.id) ?? null;
}

export async function findExtensionTokenByHash(tokenHash: string) {
  const db = getDb();
  const [record] = await db.select().from(extensionTokens).where(eq(extensionTokens.tokenHash, tokenHash)).limit(1);
  return (record as ExtensionTokenRecord | undefined) ?? null;
}

export async function touchExtensionToken(id: string) {
  const db = getDb();
  await db.update(extensionTokens).set({ lastUsedAt: nowIso() }).where(eq(extensionTokens.id, id));
}

export async function revokeExtensionToken(id: string, clerkUserId: string) {
  const db = getDb();
  await db.update(extensionTokens).set({ revokedAt: nowIso() }).where(and(eq(extensionTokens.id, id), eq(extensionTokens.clerkUserId, clerkUserId)));
  const tokens = await listExtensionTokensForUser(clerkUserId);
  return tokens.find(token => token.id === id) ?? null;
}

export async function revokeAllExtensionTokensForUser(clerkUserId: string) {
  const db = getDb();
  await db.update(extensionTokens).set({ revokedAt: nowIso() }).where(and(eq(extensionTokens.clerkUserId, clerkUserId), isNull(extensionTokens.revokedAt)));
}
