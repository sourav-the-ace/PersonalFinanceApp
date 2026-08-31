import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta } from "@/lib/balance-service";
import { validateRepayment } from "@/lib/loan-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const profileId = await getSessionProfile();
    const body = await request.json();
    const loan = await prisma.loan.findFirst({ where: { id, profileId } });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const accountId = body.accountId && String(body.accountId).trim() !== "" ? String(body.accountId).trim() : null;
    if (!accountId) {
      return NextResponse.json({ error: "Please select an account for this transaction" }, { status: 400 });
    }

    const account = await prisma.account.findFirst({ where: { id: accountId, profileId } });
    if (!account) {
      return NextResponse.json({ error: "Selected account was not found" }, { status: 400 });
    }

    const repaymentType = body.type === "loan_repayment" || body.type === "loan_receive_repayment";
    const amount = repaymentType
      ? Number(body.principalAmount ?? 0) + Number(body.interestAmount ?? 0)
      : Number(body.amount ?? 0);

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Transaction amount must be greater than zero" }, { status: 400 });
    }

    if (repaymentType) {
      const outstanding = await prisma.transaction.aggregate({
        where: { loanId: id, type: loan.direction === "borrowed" ? "loan_borrow" : "loan_lend" },
        _sum: { amount: true },
      });
      const repaid = await prisma.transaction.aggregate({
        where: { loanId: id, type: loan.direction === "borrowed" ? "loan_repayment" : "loan_receive_repayment" },
        _sum: { principalAmount: true },
      });
      const balance = (outstanding._sum.amount ?? 0) - (repaid._sum.principalAmount ?? 0);
      validateRepayment(balance, Number(body.principalAmount ?? 0));
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          profileId,
          title: body.title || (repaymentType ? "Loan Repayment" : loan.direction === "borrowed" ? "Loan Borrow" : "Loan Lend"),
          amount,
          type: body.type,
          loanId: id,
          accountId,
          date: body.date,
          notes: body.notes ?? null,
          principalAmount: body.principalAmount ? Number(body.principalAmount) : null,
          interestAmount: body.interestAmount ? Number(body.interestAmount) : null,
          categoryId: null,
        },
      });

      const delta = body.type === "loan_borrow" || body.type === "loan_receive_repayment" ? amount : -amount;
      await applyBalanceDelta(tx, accountId, delta);
      return created;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create loan transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
