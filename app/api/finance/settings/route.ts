import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profileId = await getSessionProfile();
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        theme: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({
      currency: profile.currency || "BDT",
      theme: profile.theme || "dark",
      name: profile.name || "",
      email: profile.email,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to load settings" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const profileId = await getSessionProfile();
    const body = await request.json();

    const dataToUpdate: Record<string, string> = {};
    if (typeof body.currency === "string" && body.currency.trim()) {
      dataToUpdate.currency = body.currency.trim();
    }
    if (typeof body.theme === "string" && body.theme.trim()) {
      dataToUpdate.theme = body.theme.trim();
    }
    if (typeof body.name === "string") {
      dataToUpdate.name = body.name.trim();
    }

    const updated = await prisma.profile.update({
      where: { id: profileId },
      data: dataToUpdate,
      select: {
        id: true,
        email: true,
        name: true,
        currency: true,
        theme: true,
      },
    });

    return NextResponse.json({
      currency: updated.currency,
      theme: updated.theme,
      name: updated.name,
      email: updated.email,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update settings" }, { status: 500 });
  }
}
