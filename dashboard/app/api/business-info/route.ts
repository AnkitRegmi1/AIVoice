import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getClinicTenantId } from "@/lib/clinic-tenant";
import { getBusinessInfo, updateBusinessInfo } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = getClinicTenantId();
  const info = await getBusinessInfo(tenantId);
  return NextResponse.json(info ?? {});
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = getClinicTenantId();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const updated = await updateBusinessInfo(tenantId, {
    businessName: body.businessName as string | null | undefined,
    businessHours: body.businessHours as string | null | undefined,
    services: body.services as string | null | undefined,
    address: body.address as string | null | undefined,
    phone: body.phone as string | null | undefined,
    extraNotes: body.extraNotes as string | null | undefined,
    customInstructions: body.customInstructions as string | null | undefined,
  });
  return NextResponse.json(updated ?? {});
}
