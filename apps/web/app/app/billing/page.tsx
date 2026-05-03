import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@memsync/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@memsync/ui/card";

import { BILLING_MONTHLY_PRICE_LABEL, BILLING_TRIAL_DAYS } from "@memsync/shared";

import { getViewer } from "@/lib/viewer";
import { getReadableSubscriptionStatus, isEntitledStatus } from "@/lib/billing";

export default async function BillingPage() {
  const viewer = await getViewer({ refreshBilling: true });

  if (!viewer) {
    redirect("/sign-in");
  }

  const status = viewer.subscription?.status ?? null;
  const entitled = isEntitledStatus(status);

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <Card className="gap-5 rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="px-5 sm:px-6">
          <CardTitle className="text-xl tracking-tight">Billing</CardTitle>
          <CardDescription className="max-w-2xl text-base leading-6">Polar is the billing source of truth. Clerk handles identity only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-5 text-sm text-muted-foreground sm:px-6">
          <div className="rounded-lg bg-muted p-4">
            <p className="font-semibold text-foreground">Current plan</p>
            <p className="mt-1.5 text-base">Starter · {BILLING_MONTHLY_PRICE_LABEL}</p>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="font-semibold text-foreground">Status</p>
            <p className="mt-1.5 text-base">{getReadableSubscriptionStatus(status)}</p>
          </div>
          <div className="rounded-lg bg-muted p-4">
            <p className="font-semibold text-foreground">Trial policy</p>
            <p className="mt-1.5 text-base">{BILLING_TRIAL_DAYS}-day free trial, then recurring monthly billing unless canceled.</p>
          </div>
          {viewer.subscription?.currentPeriodEnd ? (
            <div className="rounded-lg bg-muted p-4">
              <p className="font-semibold text-foreground">Current period end</p>
              <p className="mt-1.5 text-base">{new Date(viewer.subscription.currentPeriodEnd).toLocaleString()}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-5 rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="px-5 sm:px-6">
          <CardTitle className="text-xl tracking-tight">Actions</CardTitle>
          <CardDescription className="text-base leading-6">Use checkout when you are new, and the customer portal once you already have an active or trialing subscription.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-5 sm:px-6">
          {entitled ? (
            <>
              <Button asChild size="lg" className="w-full rounded-lg shadow-sm">
                <Link href="/api/polar/portal">Open customer portal</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full rounded-lg">
                <Link href="/app/settings/extension">Continue to extension setup</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="lg" className="w-full rounded-lg shadow-sm">
                <Link href="/api/polar/checkout">Start free trial</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full rounded-lg">
                <Link href="/pricing">Back to pricing</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
