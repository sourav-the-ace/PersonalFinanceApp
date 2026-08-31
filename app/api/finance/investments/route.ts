import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/auth";
import { getInvestmentTotals } from "@/lib/investment-service";

export async function GET() {
  try {
    const profileId = await getSessionProfile();
    const investments = await prisma.investment.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
    });

    const investmentsWithTotals = await Promise.all(
      investments.map(async (investment) => ({
        ...investment,
        ...(await getInvestmentTotals(investment.id)),
      })),
    );

    return NextResponse.json(investmentsWithTotals);
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
    const investment = await prisma.investment.create({
      data: {
        profileId,
        name: body.name,
        assetType: body.assetType,
        institution: body.institution ?? null,
        notes: body.notes ?? null,
      },
    });
    return NextResponse.json({
      ...investment,
      totalInvested: 0,
      totalReturned: 0,
      netInvested: 0,
      realizedPnL: 0,
    });
  } catch {
    return NextResponse.json({ error: "Unable to create investment" }, { status: 500 });
  }
}
