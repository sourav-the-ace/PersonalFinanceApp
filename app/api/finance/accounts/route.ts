import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst({ where: { email: "demo@northstar.finance" } });
    if (!profile) {
      return NextResponse.json([]);
    }

    const accounts = await prisma.account.findMany({ where: { profileId: profile.id } });
    return NextResponse.json(accounts);
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

    const account = await prisma.account.create({
      data: {
        profileId: profile.id,
        name: body.name,
        type: body.type,
        balance: Number(body.balance ?? 0),
      },
    });

    return NextResponse.json(account);
  } catch {
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }
}
