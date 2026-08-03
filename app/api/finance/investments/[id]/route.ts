import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInvestmentTotals, validateWithdrawal } from "@/lib/investment-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const investment = await prisma.investment.findUnique({ where: { id } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { investmentId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      investment: {
        ...investment,
        ...(await getInvestmentTotals(id)),
      },
      transactions,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load investment" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existingInvestment = await prisma.investment.findUnique({ where: { id } });
    if (!existingInvestment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    if (body.status === "closed") {
      const totals = await getInvestmentTotals(id);
      if (totals.netInvested !== 0) {
        return NextResponse.json({ error: `Investment has net invested balance ${totals.netInvested}` }, { status: 400 });
      }
    }

    const investment = await prisma.investment.update({
      where: { id },
      data: {
        name: body.name ?? existingInvestment.name,
        institution: body.institution ?? existingInvestment.institution,
        notes: body.notes ?? existingInvestment.notes,
        status: body.status ?? existingInvestment.status,
      },
    });

    return NextResponse.json(investment);
  } catch {
    return NextResponse.json({ error: "Unable to update investment" }, { status: 500 });
  }
}
