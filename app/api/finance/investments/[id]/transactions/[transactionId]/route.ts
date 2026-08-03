import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta } from "@/lib/balance-service";

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
    const delta = existing.type === "investment_in" ? amount : -amount;
    await prisma.$transaction(async (tx) => {
      await applyBalanceDelta(tx, existing.accountId, -delta);
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
