import { randomBytes, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { createExtensionTokenRecord, listExtensionTokensForUser } from "@memsync/db";

import { isEntitledStatus } from "@/lib/billing";
import { ensureViewer } from "@/lib/viewer";
import { hashExtensionToken, serializeExtensionTokenRecord } from "@/lib/extension-tokens";

export async function GET() {
  const viewer = await ensureViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = (await listExtensionTokensForUser(viewer.user.clerkUserId)).map(serializeExtensionTokenRecord);
  return NextResponse.json({ tokens });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewer = await ensureViewer({ refreshBilling: true });
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isEntitledStatus(viewer.subscription?.status ?? null)) {
    return NextResponse.json({ error: "An active or trialing subscription is required before generating extension tokens." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { label?: string };
  const label = body.label?.trim() || "Primary browser";
  const token = `msx_${randomBytes(24).toString("base64url")}`;
  const tokenPrefix = token.slice(0, 11);
  const last4 = token.slice(-4);

  const record = await createExtensionTokenRecord({
    id: randomUUID(),
    clerkUserId: viewer.user.clerkUserId,
    label,
    tokenPrefix,
    tokenHash: hashExtensionToken(token),
    last4
  });

  if (!record) {
    return NextResponse.json({ error: "Failed to persist the extension token." }, { status: 500 });
  }

  return NextResponse.json({
    token,
    record: serializeExtensionTokenRecord(record)
  });
}
