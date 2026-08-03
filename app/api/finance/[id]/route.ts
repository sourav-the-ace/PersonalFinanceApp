import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta } from "@/lib/balance-service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.transaction.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const nextAmount = Number(body.amount ?? existing.amount);
    const nextType = body.type ?? existing.type;
    const nextDate = body.date ?? existing.date;
    const nextNotes = body.notes ?? existing.notes;
    const oldDelta = existing.type === "income" ? existing.amount : existing.type === "expense" ? -existing.amount : 0;
    const newDelta = nextType === "income" ? nextAmount : nextType === "expense" ? -nextAmount : 0;

    const updateData: Record<string, unknown> = {
      title: body.title ?? existing.title,
      amount: nextAmount,
      type: nextType,
      date: nextDate,
      notes: nextNotes ?? null,
    };

    if (body.categoryId) {
      updateData.category = { connect: { id: body.categoryId } };
    } else {
      updateData.category = { disconnect: true };
    }

    if (body.accountId) {
      updateData.account = { connect: { id: body.accountId } };
    } else {
      updateData.account = { disconnect: true };
    }

    const transaction = await prisma.$transaction(async (tx) => {
      await applyBalanceDelta(tx, existing.accountId, -oldDelta);
      const updated = await tx.transaction.update({
        where: { id },
        data: updateData as never,
        include: { category: true, account: true },
      });
      await applyBalanceDelta(tx, body.accountId ?? existing.accountId, newDelta);
      return updated;
    });

    return NextResponse.json({
      ...transaction,
      category: transaction.category?.name ?? "",
      account: transaction.account?.name ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Unable to update transaction" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await prisma.transaction.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ success: false });
    }

    await prisma.$transaction(async (tx) => {
      const delta = existing.type === "income" ? existing.amount : existing.type === "expense" ? -existing.amount : 0;
      await applyBalanceDelta(tx, existing.accountId, -delta);
      await tx.transaction.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}
