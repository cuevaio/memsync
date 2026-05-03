import { eq } from "drizzle-orm";

import { getDb, nowIso } from "../client";
import { subscriptions, type SubscriptionRecord } from "../schema";

type UpsertSubscriptionInput = {
  clerkUserId: string;
  polarCustomerId: string | null;
  polarSubscriptionId: string | null;
  productId: string | null;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  metadataJson: Record<string, unknown> | null;
};

export async function getSubscriptionByClerkUserId(clerkUserId: string) {
  const db = getDb();
  const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.clerkUserId, clerkUserId)).limit(1);
  return (subscription as SubscriptionRecord | undefined) ?? null;
}

export async function upsertSubscriptionState(input: UpsertSubscriptionInput) {
  const db = getDb();
  const updatedAt = nowIso();

  await db.insert(subscriptions).values({
    clerkUserId: input.clerkUserId,
    polarCustomerId: input.polarCustomerId,
    polarSubscriptionId: input.polarSubscriptionId,
    productId: input.productId,
    status: input.status,
    trialEndsAt: input.trialEndsAt,
    currentPeriodEnd: input.currentPeriodEnd,
    cancelAtPeriodEnd: input.cancelAtPeriodEnd,
    metadataJson: input.metadataJson,
    updatedAt
  }).onConflictDoUpdate({
    target: subscriptions.clerkUserId,
    set: {
      polarCustomerId: input.polarCustomerId,
      polarSubscriptionId: input.polarSubscriptionId,
      productId: input.productId,
      status: input.status,
      trialEndsAt: input.trialEndsAt,
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      metadataJson: input.metadataJson,
      updatedAt
    }
  });

  return await getSubscriptionByClerkUserId(input.clerkUserId);
}

export async function clearSubscriptionState(clerkUserId: string) {
  const db = getDb();
  await db.delete(subscriptions).where(eq(subscriptions.clerkUserId, clerkUserId));
}
