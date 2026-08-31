import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta } from "@/lib/balance-service";
import { getInvestmentTotals } from "@/lib/investment-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const profileId = await getSessionProfile();
    const body = await request.json();
    const investment = await prisma.investment.findFirst({ where: { id, profileId } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    const accountId = body.accountId && String(body.accountId).trim() !== "" ? String(body.accountId).trim() : null;
    if (!accountId) {
      return NextResponse.json({ error: "Please select an account for this transaction" }, { status: 400 });
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, profileId } });
    if (!account) {
      return NextResponse.json({ error: "Selected account was not found" }, { status: 400 });
    }

    const amount = Number(body.amount ?? 0);
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Transaction amount must be greater than zero" }, { status: 400 });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          profileId,
          title: body.title || (body.type === "investment_in" ? "Investment Contribution" : "Investment Withdrawal"),
          amount,
          type: body.type,
          investmentId: id,
          accountId,
          date: body.date,
          notes: body.notes ?? null,
          categoryId: null,
        },
      });

      const delta = body.type === "investment_in" ? -amount : amount;
      await applyBalanceDelta(tx, accountId, delta);
      return created;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create investment transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
