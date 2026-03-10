import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBusinessInfo, updateBusinessInfo } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as { tenantId?: number }).tenantId ?? 1;
  const info = await getBusinessInfo(tenantId);
  return NextResponse.json(info ?? {});
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = (session.user as { tenantId?: number }).tenantId ?? 1;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updated = await updateBusinessInfo(tenantId, {
    businessHours: body.businessHours as string | null | undefined,
    services: body.services as string | null | undefined,
    address: body.address as string | null | undefined,
    phone: body.phone as string | null | undefined,
    extraNotes: body.extraNotes as string | null | undefined,
    customInstructions: body.customInstructions as string | null | undefined,
  });
  return NextResponse.json(updated ?? {});
}
