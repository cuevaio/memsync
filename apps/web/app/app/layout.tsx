import Link from "next/link";
import { redirect } from "next/navigation";

import { UserButton } from "@clerk/nextjs";

import { auth } from "@clerk/nextjs/server";
import { APP_NAME } from "@memsync/shared";

export default async function AuthenticatedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-muted-foreground">{APP_NAME}</p>
            <p className="mt-1 text-sm text-muted-foreground">Account, billing, and extension setup</p>
          </div>

          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/app" className="hover:text-foreground">Overview</Link>
            <Link href="/app/billing" className="hover:text-foreground">Billing</Link>
            <Link href="/app/settings/extension" className="hover:text-foreground">Extension</Link>
            <UserButton />
          </nav>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
