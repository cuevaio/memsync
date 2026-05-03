import Link from "next/link";

import { auth } from "@clerk/nextjs/server";
import { Button } from "@memsync/ui/button";

import { APP_NAME, APP_TAGLINE, BILLING_MONTHLY_PRICE_LABEL, BILLING_TRIAL_DAYS } from "@memsync/shared";

const highlights = [
  "A dedicated Next.js account area for billing and extension setup.",
  "Clerk-powered authentication with a single account flow.",
  "Polar-backed billing with a 14-day free trial and cancel-anytime portal.",
  "A first-party extension token so the extension can be authenticated independently of the browser session."
];

export default async function HomePage() {
  const { userId } = await auth();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">{APP_NAME}</p>
          <p className="mt-1 text-sm text-muted-foreground">Clerk auth, Polar billing, and extension-ready token auth.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href="/pricing">Pricing</Link>
          </Button>
          <Button asChild>
            <Link href={userId ? "/app" : "/sign-up"}>{userId ? "Open app" : "Start free trial"}</Link>
          </Button>
        </div>
      </header>

      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-8">
          <div className="space-y-4">
            <p className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {BILLING_MONTHLY_PRICE_LABEL} with a {BILLING_TRIAL_DAYS}-day free trial
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
              {APP_TAGLINE}
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
              Replace the old Bun demo app with a real account surface for authentication, subscriptions, and extension onboarding without destabilizing the existing extension sync engine.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={userId ? "/app/settings/extension" : "/sign-up"}>{userId ? "Set up the extension" : "Create an account"}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="rounded-2xl border border-border bg-background p-6">
            <p className="text-sm font-medium text-muted-foreground">What ships in this migration</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-foreground/90">
              {highlights.map(item => (
                <li key={item} className="flex gap-3">
                  <span className="mt-1 block size-2 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-2xl border border-border bg-muted p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Extension flow</p>
              <p className="mt-2">Open the web app from the popup, sign in, generate a token, return to the extension, paste it once, and the extension remains authenticated until you revoke it.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
