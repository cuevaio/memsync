"use client";

import { useMemo, useState } from "react";

import { Button } from "@memsync/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@memsync/ui/card";
import type { ExtensionTokenRecord } from "@memsync/shared";

type TokenManagerProps = {
  entitled: boolean;
  initialTokens: ExtensionTokenRecord[];
};

type CreateTokenResponse = {
  token: string;
  record: ExtensionTokenRecord;
};

export function ExtensionTokenManager({ entitled, initialTokens }: TokenManagerProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("Primary browser");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasTokens = useMemo(() => tokens.some(token => !token.revokedAt), [tokens]);

  async function createToken() {
    setBusy("create");
    setError(null);
    setFreshToken(null);

    try {
      const response = await fetch("/api/extension/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ label })
      });

      const payload = (await response.json()) as CreateTokenResponse | { error?: string };
      if (!response.ok || !("token" in payload)) {
        throw new Error(("error" in payload ? payload.error : undefined) ?? "Failed to create an extension token.");
      }

      setFreshToken(payload.token);
      setTokens(current => [payload.record, ...current]);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create an extension token.");
    } finally {
      setBusy(null);
    }
  }

  async function revokeToken(id: string) {
    setBusy(id);
    setError(null);

    try {
      const response = await fetch(`/api/extension/tokens/${id}`, {
        method: "DELETE"
      });

      const payload = (await response.json()) as { record?: ExtensionTokenRecord; error?: string };
      if (!response.ok || !payload.record) {
        throw new Error(payload.error ?? "Failed to revoke the token.");
      }

      setTokens(current => current.map(token => (token.id === id ? payload.record! : token)));
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke the token.");
    } finally {
      setBusy(null);
    }
  }

  async function copyToken() {
    if (!freshToken) {
      return;
    }

    await navigator.clipboard.writeText(freshToken);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <Card>
        <CardHeader>
          <CardTitle>1. Open the extension settings</CardTitle>
          <CardDescription>Use the popup Settings button, then paste a token into the new authentication section.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="space-y-3 leading-6">
            <li>Open the extension popup and select <span className="font-medium text-foreground">Settings</span>.</li>
            <li>Select <span className="font-medium text-foreground">Open app</span> if you need to sign in again or manage billing.</li>
            <li>Paste the token shown here into the extension and save it once.</li>
            <li>The extension verifies the token against the app and stores the authenticated state locally.</li>
          </ol>
          {hasTokens ? <p>Existing active tokens stay valid until you revoke them.</p> : <p>No active extension tokens have been created yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Generate a token</CardTitle>
          <CardDescription>Tokens are available only while your account is trialing or active.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!entitled ? (
            <p className="rounded-2xl border border-dashed border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Start or reactivate your subscription before generating extension tokens.
            </p>
          ) : (
            <>
              <label className="block space-y-2 text-sm">
                <span className="font-medium text-foreground">Token label</span>
                <input
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={label}
                  onChange={event => setLabel(event.target.value)}
                  placeholder="Primary browser"
                />
              </label>
              <Button className="w-full" onClick={createToken} disabled={busy === "create"}>
                {busy === "create" ? "Generating token..." : "Generate token"}
              </Button>
            </>
          )}

          {freshToken ? (
            <div className="space-y-3 rounded-2xl border border-border bg-muted p-4">
              <p className="text-sm font-medium text-foreground">Copy this token now</p>
              <textarea className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm" readOnly value={freshToken} />
              <div className="flex gap-3">
                <Button type="button" onClick={copyToken}>Copy token</Button>
                <Button type="button" variant="outline" onClick={() => setFreshToken(null)}>Hide token</Button>
              </div>
              <p className="text-xs text-muted-foreground">The full value is only shown once. If you lose it, revoke the token and create a new one.</p>
            </div>
          ) : null}

          {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Issued tokens</CardTitle>
          <CardDescription>Revoke any token you no longer want the extension to trust.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tokens.length ? (
            tokens.map(token => (
              <div key={token.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">{token.label}</p>
                  <p className="text-muted-foreground">{token.tokenPreview}</p>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(token.createdAt).toLocaleString()}
                    {token.lastUsedAt ? ` · last used ${new Date(token.lastUsedAt).toLocaleString()}` : " · never used yet"}
                  </p>
                </div>
                {token.revokedAt ? (
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Revoked</span>
                ) : (
                  <Button type="button" variant="outline" disabled={busy === token.id} onClick={() => revokeToken(token.id)}>
                    {busy === token.id ? "Revoking..." : "Revoke"}
                  </Button>
                )}
              </div>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-muted px-4 py-3 text-sm text-muted-foreground">No extension tokens have been generated yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
