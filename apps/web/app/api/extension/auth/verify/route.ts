import { NextResponse } from "next/server";

import { verifyExtensionToken } from "@/lib/extension-tokens";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();

  if (!token) {
    return NextResponse.json({ ok: false, status: "invalid", message: "Missing extension token." }, { status: 400 });
  }

  const result = await verifyExtensionToken(token);
  if (result.ok) {
    return NextResponse.json(result);
  }

  const status = result.status === "subscription_required" ? 403 : 401;
  return NextResponse.json(result, { status });
}
