import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@memsync/ui/card";

import { listExtensionTokensForUser } from "@memsync/db";

import { isEntitledStatus } from "@/lib/billing";
import { serializeExtensionTokenRecord } from "@/lib/extension-tokens";
import { getViewer } from "@/lib/viewer";

import { ExtensionTokenManager } from "./token-manager";

export default async function ExtensionSettingsPage() {
  const viewer = await getViewer({ refreshBilling: true });

  if (!viewer) {
    redirect("/sign-in");
  }

  const entitled = isEntitledStatus(viewer.subscription?.status ?? null);
  const tokens = (await listExtensionTokensForUser(viewer.user.clerkUserId)).map(serializeExtensionTokenRecord);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Extension setup</CardTitle>
          <CardDescription>Use this page after signing in from the extension popup. Billing and token generation are both managed here.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          <p>The extension does not reuse your Clerk session directly. Instead, it stores a dedicated app-issued token so you can revoke browser access without affecting your main account.</p>
        </CardContent>
      </Card>

      <ExtensionTokenManager entitled={entitled} initialTokens={tokens} />
    </div>
  );
}
