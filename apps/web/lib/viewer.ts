import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, upsertUser } from "@memsync/db";

import { getCachedSubscriptionForUser, refreshPolarCustomerStateForUser } from "./billing";

export async function getViewer(options?: { refreshBilling?: boolean }) {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find(address => address.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;
  const displayName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || clerkUser?.username || email;

  const user =
    await upsertUser({
      clerkUserId: userId,
      email,
      displayName
    }) ?? await getUserByClerkId(userId);

  const subscription = options?.refreshBilling ? await refreshPolarCustomerStateForUser(userId) : await getCachedSubscriptionForUser(userId);

  if (!user) {
    return null;
  }

  return {
    user,
    subscription,
    email,
    displayName
  };
}

export async function ensureViewer(options?: { refreshBilling?: boolean }) {
  return await getViewer(options);
}
