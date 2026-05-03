import { NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";
import { revokeExtensionToken } from "@memsync/db";

import { ensureViewer } from "@/lib/viewer";
import { serializeExtensionTokenRecord } from "@/lib/extension-tokens";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const viewer = await ensureViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const record = await revokeExtensionToken(id, viewer.user.clerkUserId);
  if (!record) {
    return NextResponse.json({ error: "Token not found." }, { status: 404 });
  }

  return NextResponse.json({ record: serializeExtensionTokenRecord(record) });
}
