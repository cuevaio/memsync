import "server-only";

import { clearSubscriptionState, getSubscriptionByClerkUserId, setUserPolarCustomerId, upsertSubscriptionState } from "@memsync/db";

import { env } from "@/env";
import { polar } from "@/lib/polar";

export function isEntitledStatus(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

export function getReadableSubscriptionStatus(status: string | null | undefined) {
  if (status === "active") {
    return "Active";
  }

  if (status === "trialing") {
    return "Trialing";
  }

  if (status === "canceled") {
    return "Canceled";
  }

  if (status === "past_due") {
    return "Past due";
  }

  return "No active subscription";
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null;
}

function isPolarNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error && error.statusCode === 404;
}

export async function refreshPolarCustomerStateForUser(clerkUserId: string) {
  const customerState = await polar.customers.getStateExternal({ externalId: clerkUserId }).catch(error => {
    if (isPolarNotFoundError(error)) {
      return null;
    }

    throw error;
  });

  if (!customerState) {
    await clearSubscriptionState(clerkUserId);
    return null;
  }

  await setUserPolarCustomerId(clerkUserId, customerState.id);

  const productFilter = env.POLAR_MONTHLY_PRODUCT_ID;
  const subscription =
    customerState.activeSubscriptions.find(item => item.productId === productFilter) ??
    customerState.activeSubscriptions[0];

  if (!subscription) {
    await clearSubscriptionState(clerkUserId);
    return null;
  }

  return await upsertSubscriptionState({
    clerkUserId,
    polarCustomerId: customerState.id,
    polarSubscriptionId: subscription.id,
    productId: subscription.productId,
    status: subscription.status,
    trialEndsAt: toIsoString(subscription.trialEnd),
    currentPeriodEnd: toIsoString(subscription.currentPeriodEnd),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    metadataJson: subscription as unknown as Record<string, unknown>
  });
}

export async function getCachedSubscriptionForUser(clerkUserId: string) {
  return await getSubscriptionByClerkUserId(clerkUserId);
}
