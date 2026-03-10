import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTenant } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { isAdmin?: boolean } | null;
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Support both form POST (from <form>) and JSON body.
  let name = "";
  let twilioPhone: string | null = null;
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = (await req.json()) as { name?: string; twilioPhone?: string };
    name = data.name ?? "";
    twilioPhone = data.twilioPhone ?? null;
  } else {
    const form = await req.formData();
    name = String(form.get("name") ?? "");
    const phone = form.get("twilioPhone");
    twilioPhone = phone ? String(phone) : null;
  }

  if (!name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  try {
    const tenant = await createTenant(name, twilioPhone);
    return NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 500 });
  }
}

