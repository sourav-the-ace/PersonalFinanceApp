import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta } from "@/lib/balance-service";
import { validateRepayment } from "@/lib/loan-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; transactionId: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id, transactionId } = await params;
    const body = await request.json();
    const loan = await prisma.loan.findFirst({ where: { id, profileId } });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const existing = await prisma.transaction.findFirst({ where: { id: transactionId, loanId: id, profileId } });
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const oldAmount = Number(existing.amount ?? 0);
    const oldDelta = existing.type === "loan_borrow" || existing.type === "loan_receive_repayment" ? oldAmount : -oldAmount;
    const nextAmount = Number(body.amount ?? existing.amount ?? 0);
    const nextType = body.type ?? existing.type;
    const nextDelta = nextType === "loan_borrow" || nextType === "loan_receive_repayment" ? nextAmount : -nextAmount;

    if (body.principalAmount !== undefined || body.type === "loan_repayment" || body.type === "loan_receive_repayment") {
      const outstanding = await prisma.transaction.aggregate({
        where: { loanId: id, type: loan.direction === "borrowed" ? "loan_borrow" : "loan_lend" },
        _sum: { amount: true },
      });
      const repaid = await prisma.transaction.aggregate({
        where: { loanId: id, type: loan.direction === "borrowed" ? "loan_repayment" : "loan_receive_repayment" },
        _sum: { principalAmount: true },
      });
      const balance = (outstanding._sum.amount ?? 0) - (repaid._sum.principalAmount ?? 0);
      validateRepayment(balance, Number(body.principalAmount ?? existing.principalAmount ?? 0));
    }

    const transaction = await prisma.$transaction(async (tx) => {
      await applyBalanceDelta(tx, body.accountId ?? existing.accountId, -oldDelta);
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          title: body.title ?? existing.title,
          amount: nextAmount,
          type: nextType,
          accountId: body.accountId ?? existing.accountId ?? null,
          date: body.date ?? existing.date,
          notes: body.notes ?? existing.notes,
          principalAmount: body.principalAmount ?? existing.principalAmount,
          interestAmount: body.interestAmount ?? existing.interestAmount,
        },
      });
      await applyBalanceDelta(tx, body.accountId ?? existing.accountId, nextDelta);
      return updated;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unable to update loan transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; transactionId: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id, transactionId } = await params;
    const loan = await prisma.loan.findFirst({ where: { id, profileId } });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const existing = await prisma.transaction.findFirst({ where: { id: transactionId, loanId: id, profileId } });
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const amount = Number(existing.amount ?? 0);
    const delta = existing.type === "loan_borrow" || existing.type === "loan_receive_repayment" ? amount : -amount;
    await prisma.$transaction(async (tx) => {
      await applyBalanceDelta(tx, existing.accountId, -delta);
      await tx.transaction.delete({ where: { id: transactionId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to delete loan transaction" }, { status: 500 });
  }
}
