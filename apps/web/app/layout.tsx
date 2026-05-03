import type { Metadata } from "next";

import { ClerkProvider } from "@clerk/nextjs";

import { env } from "@/env";

import "./globals.css";

export const metadata: Metadata = {
  title: "MemSync",
  description: "Clerk auth, Polar billing, and extension token management for MemSync."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      publishableKey={env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInForceRedirectUrl="/app"
      signUpForceRedirectUrl="/app"
      afterSignOutUrl="/"
    >
      <html lang="en">
        <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
