import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta } from "@/lib/balance-service";
import { getInvestmentTotals, validateWithdrawal } from "@/lib/investment-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const profileId = await getSessionProfile();
    const body = await request.json();
    const investment = await prisma.investment.findUnique({ where: { id } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    if (body.type === "investment_out") {
      const totals = await getInvestmentTotals(id);
      validateWithdrawal(totals.netInvested, Number(body.amount ?? 0));
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          profileId,
          title: body.title,
          amount: Number(body.amount ?? 0),
          type: body.type,
          investmentId: id,
          accountId: body.accountId ?? null,
          date: body.date,
          notes: body.notes ?? null,
          categoryId: null,
        },
      });

      const delta = body.type === "investment_in" ? -Number(body.amount ?? 0) : Number(body.amount ?? 0);
      await applyBalanceDelta(tx, body.accountId, delta);
      return created;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create investment transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
