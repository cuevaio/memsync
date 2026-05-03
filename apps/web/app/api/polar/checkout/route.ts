import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { env } from "@/env";
import { polar } from "@/lib/polar";
import { getViewer } from "@/lib/viewer";
import { isEntitledStatus } from "@/lib/billing";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const viewer = await getViewer({ refreshBilling: true });
  if (!viewer) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  if (isEntitledStatus(viewer.subscription?.status ?? null)) {
    return NextResponse.redirect(new URL("/app/billing", request.url));
  }

  try {
    const origin = new URL(request.url).origin;
    const checkout = await polar.checkouts.create({
      products: [env.POLAR_MONTHLY_PRODUCT_ID],
      externalCustomerId: viewer.user.clerkUserId,
      customerEmail: viewer.email,
      customerName: viewer.displayName,
      successUrl: `${origin}/app/billing?checkout=success`,
      returnUrl: `${origin}/pricing`,
      allowTrial: true,
      metadata: {
        source: "memsync-web"
      }
    });

    return NextResponse.redirect(checkout.url);
  } catch (error) {
    const url = new URL("/pricing", request.url);
    url.searchParams.set("error", error instanceof Error ? error.message : "checkout_failed");
    return NextResponse.redirect(url);
  }
}
