import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvestmentTotals } from "@/lib/investment-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const investment = await prisma.investment.findFirst({ where: { id, profileId } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { investmentId: id, profileId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      investment: {
        ...investment,
        ...(await getInvestmentTotals(id)),
      },
      transactions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to load investment" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const body = await request.json();
    const existingInvestment = await prisma.investment.findFirst({ where: { id, profileId } });
    if (!existingInvestment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    if (body.status === "closed") {
      const totals = await getInvestmentTotals(id);
      if (totals.netInvested > 0) {
        return NextResponse.json({ error: `Investment has unrecovered invested balance ${totals.netInvested}` }, { status: 400 });
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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update investment" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const investment = await prisma.investment.findFirst({ where: { id, profileId } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    const totals = await getInvestmentTotals(id);
    if (totals.netInvested > 0) {
      return NextResponse.json(
        { error: `Cannot delete an investment with active invested funds (${totals.netInvested}). Withdraw remaining funds first.` },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { investmentId: id, profileId } });
      await tx.investment.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to delete investment" }, { status: 500 });
  }
}
