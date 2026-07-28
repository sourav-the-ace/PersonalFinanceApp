import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst({ where: { email: "demo@northstar.finance" } });
    if (!profile) {
      return NextResponse.json([]);
    }

    const categories = await prisma.category.findMany({ where: { profileId: profile.id } });
    return NextResponse.json(categories);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const profile = await prisma.profile.upsert({
      where: { email: "demo@northstar.finance" },
      update: {},
      create: { email: "demo@northstar.finance", name: "Demo User", currency: "USD", theme: "light" },
    });

    const category = await prisma.category.create({
      data: {
        profileId: profile.id,
        name: body.name,
        type: body.type,
      },
    });

    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Unable to create category" }, { status: 500 });
  }
}
