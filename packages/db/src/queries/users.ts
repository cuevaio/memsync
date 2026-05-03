import { eq } from "drizzle-orm";

import { getDb, nowIso } from "../client";
import { users, type UserRecord } from "../schema";

type UpsertUserInput = {
  clerkUserId: string;
  email: string | null;
  displayName: string | null;
  polarCustomerId?: string | null;
};

export async function getUserByClerkId(clerkUserId: string) {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, clerkUserId)).limit(1);
  return (user as UserRecord | undefined) ?? null;
}

export async function upsertUser(input: UpsertUserInput) {
  const timestamp = nowIso();
  const db = getDb();

  await db.insert(users).values({
    clerkUserId: input.clerkUserId,
    email: input.email,
    displayName: input.displayName,
    polarCustomerId: input.polarCustomerId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp
  }).onConflictDoUpdate({
    target: users.clerkUserId,
    set: {
      email: input.email,
      displayName: input.displayName,
      polarCustomerId: input.polarCustomerId ?? undefined,
      updatedAt: timestamp
    }
  });

  return await getUserByClerkId(input.clerkUserId);
}

export async function setUserPolarCustomerId(clerkUserId: string, polarCustomerId: string | null) {
  const db = getDb();
  await db.update(users).set({ polarCustomerId, updatedAt: nowIso() }).where(eq(users.clerkUserId, clerkUserId));
  return await getUserByClerkId(clerkUserId);
}

export async function deleteUserByClerkId(clerkUserId: string) {
  const db = getDb();
  await db.delete(users).where(eq(users.clerkUserId, clerkUserId));
}
