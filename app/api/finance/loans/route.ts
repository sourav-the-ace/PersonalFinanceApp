import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/auth";
import { getLoanOutstanding } from "@/lib/loan-service";

export async function GET() {
  try {
    const profileId = await getSessionProfile();
    const loans = await prisma.loan.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });

    const loansWithOutstanding = await Promise.all(
      loans.map(async (loan) => ({
        ...loan,
        outstanding: await getLoanOutstanding(loan.id, loan.direction as "borrowed" | "lent"),
      })),
    );

    return NextResponse.json(loansWithOutstanding);
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
    const loan = await prisma.loan.create({
      data: {
        profileId,
        title: body.title,
        direction: body.direction,
        counterparty: body.counterparty ?? null,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json({ ...loan, outstanding: 0 });
  } catch {
    return NextResponse.json({ error: "Unable to create loan" }, { status: 500 });
  }
}
