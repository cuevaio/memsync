import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { polar } from "@/lib/polar";
import { getViewer } from "@/lib/viewer";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const viewer = await getViewer({ refreshBilling: true });
  if (!viewer) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  try {
    const session = await polar.customerSessions.create({
      externalCustomerId: viewer.user.clerkUserId,
      returnUrl: `${new URL(request.url).origin}/app/billing`
    });

    return NextResponse.redirect(session.customerPortalUrl);
  } catch (error) {
    const url = new URL("/app/billing", request.url);
    url.searchParams.set("error", error instanceof Error ? error.message : "portal_failed");
    return NextResponse.redirect(url);
  }
}
