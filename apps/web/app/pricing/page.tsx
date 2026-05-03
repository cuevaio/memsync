import Link from "next/link";

import { auth } from "@clerk/nextjs/server";
import { Button } from "@memsync/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@memsync/ui/card";

import { BILLING_MONTHLY_PRICE_LABEL, BILLING_TRIAL_DAYS } from "@memsync/shared";

import { getViewer } from "@/lib/viewer";
import { isEntitledStatus } from "@/lib/billing";

export default async function PricingPage() {
  const { userId } = await auth();
  const viewer = userId ? await getViewer({ refreshBilling: true }) : null;
  const entitled = isEntitledStatus(viewer?.subscription?.status ?? null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">Pricing</p>
        <h1 className="mt-4 text-5xl font-semibold tracking-tight">Simple, personal billing for MemSync</h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">One subscription, one account, and a dedicated extension token workflow after sign-in.</p>
      </div>

      <Card className="mx-auto mt-12 max-w-xl border-border bg-card shadow-sm">
        <CardHeader className="gap-3">
          <CardTitle className="text-3xl">Starter</CardTitle>
          <CardDescription className="text-base">Everything needed to authenticate the extension and keep your memory sync setup managed from one account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-5xl font-semibold tracking-tight">{BILLING_MONTHLY_PRICE_LABEL}</p>
            <p className="mt-2 text-sm text-muted-foreground">Includes a {BILLING_TRIAL_DAYS}-day free trial. Cancel anytime from your billing portal.</p>
          </div>

          <ul className="space-y-3 text-sm leading-6 text-foreground/90">
            <li className="flex gap-3"><span className="mt-1 block size-2 rounded-full bg-primary" />Clerk-managed sign-in and account access</li>
            <li className="flex gap-3"><span className="mt-1 block size-2 rounded-full bg-primary" />Polar checkout and customer portal</li>
            <li className="flex gap-3"><span className="mt-1 block size-2 rounded-full bg-primary" />Manual extension token generation and revocation</li>
            <li className="flex gap-3"><span className="mt-1 block size-2 rounded-full bg-primary" />One-click route back into extension setup after billing</li>
          </ul>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {entitled ? (
            <>
              <Button asChild className="w-full sm:flex-1">
                <Link href="/app/settings/extension">Set up the extension</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:flex-1">
                <Link href="/api/polar/portal">Manage billing</Link>
              </Button>
            </>
          ) : userId ? (
            <>
              <Button asChild className="w-full sm:flex-1">
                <Link href="/api/polar/checkout">Start free trial</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:flex-1">
                <Link href="/app">Back to account</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild className="w-full sm:flex-1">
                <Link href="/sign-up">Create account</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:flex-1">
                <Link href="/sign-in">Sign in</Link>
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
