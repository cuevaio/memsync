import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@memsync/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@memsync/ui/card";

import { BILLING_MONTHLY_PRICE_LABEL } from "@memsync/shared";

import { getViewer } from "@/lib/viewer";
import { isEntitledStatus, getReadableSubscriptionStatus } from "@/lib/billing";

export default async function AppOverviewPage() {
  const viewer = await getViewer({ refreshBilling: true });

  if (!viewer) {
    redirect("/sign-in");
  }

  const entitled = isEntitledStatus(viewer.subscription?.status ?? null);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <Card>
        <CardHeader>
          <CardTitle>Account overview</CardTitle>
          <CardDescription>The new web app is now the source of truth for authentication, billing, and extension onboarding.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Signed in as</p>
            <p className="mt-1">{viewer.email ?? viewer.displayName ?? viewer.user.clerkUserId}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Subscription status</p>
            <p className="mt-1">{getReadableSubscriptionStatus(viewer.subscription?.status ?? null)}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Next step</p>
            <p className="mt-1">{entitled ? "Generate an extension token and finish setup from the extension settings screen." : `Start your ${BILLING_MONTHLY_PRICE_LABEL} plan to unlock token generation.`}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recommended actions</CardTitle>
          <CardDescription>Use the account area in this order so the extension setup stays straightforward.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button asChild className="w-full">
            <Link href={entitled ? "/app/settings/extension" : "/pricing"}>{entitled ? "Set up the extension" : "Open pricing"}</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/app/billing">Billing details</Link>
          </Button>
          {entitled ? (
            <Button asChild variant="outline" className="w-full">
              <Link href="/api/polar/portal">Manage subscription</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
