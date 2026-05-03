import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { deleteUserByClerkId, revokeAllExtensionTokensForUser, upsertUser } from "@memsync/db";

import { env } from "@/env";

function getPrimaryEmail(data: Record<string, unknown>) {
  const addresses = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  const primaryId = typeof data.primary_email_address_id === "string" ? data.primary_email_address_id : null;
  const primary = addresses.find(value => value && typeof value === "object" && (value as { id?: string }).id === primaryId) as { email_address?: string } | undefined;
  return primary?.email_address ?? null;
}

function getDisplayName(data: Record<string, unknown>, email: string | null) {
  const firstName = typeof data.first_name === "string" ? data.first_name : null;
  const lastName = typeof data.last_name === "string" ? data.last_name : null;
  const username = typeof data.username === "string" ? data.username : null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return fullName || username || email;
}

export async function POST(request: Request) {
  const secret = env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SIGNING_SECRET is not configured." }, { status: 503 });
  }

  const payload = await request.text();
  const headerList = await headers();
  const svixId = headerList.get("svix-id");
  const svixTimestamp = headerList.get("svix-timestamp");
  const svixSignature = headerList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Svix headers." }, { status: 400 });
  }

  try {
    const webhook = new Webhook(secret);
    const event = webhook.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature
    }) as { type: string; data: Record<string, unknown> };

    if (event.type === "user.created" || event.type === "user.updated") {
      const id = typeof event.data.id === "string" ? event.data.id : null;
      if (id) {
        const email = getPrimaryEmail(event.data);
        await upsertUser({
          clerkUserId: id,
          email,
          displayName: getDisplayName(event.data, email)
        });
      }
    }

    if (event.type === "user.deleted") {
      const id = typeof event.data.id === "string" ? event.data.id : null;
      if (id) {
        await revokeAllExtensionTokensForUser(id);
        await deleteUserByClerkId(id);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook verification failed." }, { status: 400 });
  }
}
