import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profileId = await getSessionProfile();
    const accounts = await prisma.account.findMany({ where: { profileId } });
    return NextResponse.json(accounts);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const profileId = await getSessionProfile();
    const body = await request.json();

    const account = await prisma.account.create({
      data: {
        profileId,
        name: body.name,
        type: body.type,
        balance: Number(body.balance ?? 0),
      },
    });

    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to create account" }, { status: 500 });
  }
}
