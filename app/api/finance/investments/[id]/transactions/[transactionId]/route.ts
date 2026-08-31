import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta } from "@/lib/balance-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; transactionId: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id, transactionId } = await params;
    const body = await request.json();
    const investment = await prisma.investment.findFirst({ where: { id, profileId } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    const existing = await prisma.transaction.findFirst({ where: { id: transactionId, investmentId: id, profileId } });
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const oldAmount = Number(existing.amount ?? 0);
    const oldDelta = existing.type === "investment_in" ? -oldAmount : oldAmount;
    const nextAmount = body.amount !== undefined ? Number(body.amount) : oldAmount;
    const nextType = body.type ?? existing.type;
    const nextDelta = nextType === "investment_in" ? -nextAmount : nextAmount;
    const nextAccountId = body.accountId !== undefined ? (body.accountId ? String(body.accountId) : null) : existing.accountId;

    if (nextAccountId) {
      const account = await prisma.account.findFirst({ where: { id: nextAccountId, profileId } });
      if (!account) {
        return NextResponse.json({ error: "Selected account was not found" }, { status: 400 });
      }
    }

    const transaction = await prisma.$transaction(async (tx) => {
      await applyBalanceDelta(tx, existing.accountId, -oldDelta);
      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          title: body.title ?? existing.title,
          amount: nextAmount,
          type: nextType,
          accountId: nextAccountId,
          date: body.date ?? existing.date,
          notes: body.notes !== undefined ? (body.notes || null) : existing.notes,
        },
      });
      await applyBalanceDelta(tx, nextAccountId, nextDelta);
      return updated;
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Unable to update investment transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; transactionId: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id, transactionId } = await params;
    const investment = await prisma.investment.findFirst({ where: { id, profileId } });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found" }, { status: 404 });
    }

    const existing = await prisma.transaction.findFirst({ where: { id: transactionId, investmentId: id, profileId } });
    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const amount = Number(existing.amount ?? 0);
    const reversalDelta = existing.type === "investment_in" ? amount : -amount;
    await prisma.$transaction(async (tx) => {
      await applyBalanceDelta(tx, existing.accountId, reversalDelta);
      await tx.transaction.delete({ where: { id: transactionId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to delete investment transaction" }, { status: 500 });
  }
}
