import { NextResponse } from "next/server";
import { getDemoProfile } from "@/lib/demo-profile";
import { prisma } from "@/lib/prisma";
import { getLoanOutstanding } from "@/lib/loan-service";

export async function GET() {
  try {
    const profile = await getDemoProfile();
    const loans = await prisma.loan.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
    });

    const loansWithOutstanding = await Promise.all(
      loans.map(async (loan) => ({
        ...loan,
        outstanding: await getLoanOutstanding(loan.id, loan.direction as "borrowed" | "lent"),
      })),
    );

    return NextResponse.json(loansWithOutstanding);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getDemoProfile();
    const body = await request.json();
    const loan = await prisma.loan.create({
      data: {
        profileId: profile.id,
        title: body.title,
        direction: body.direction,
        counterparty: body.counterparty ?? null,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json(loan);
  } catch {
    return NextResponse.json({ error: "Unable to create loan" }, { status: 500 });
  }
}
