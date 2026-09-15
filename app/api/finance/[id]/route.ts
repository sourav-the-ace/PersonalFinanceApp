import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyBalanceDelta, applyTransfer, getTransactionBalanceDelta, revertTransfer } from "@/lib/balance-service";
import { getSessionProfile } from "@/lib/auth";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const body = await request.json();
    const existing = await prisma.transaction.findFirst({ where: { id, profileId } });

    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const nextAmount = Number(body.amount ?? existing.amount);
    const nextType = body.type ?? existing.type;
    const nextDate = body.date ?? existing.date;
    const nextNotes = body.notes ?? existing.notes;
    const oldDelta = getTransactionBalanceDelta(existing.type, existing.amount);
    const newDelta = getTransactionBalanceDelta(nextType, nextAmount);

    const updateData: Record<string, unknown> = {
      title: body.title ?? existing.title,
      amount: nextAmount,
      type: nextType,
      date: nextDate,
      notes: nextNotes ?? null,
    };

    if (body.categoryId) {
      const category = await prisma.category.findFirst({ where: { id: body.categoryId, profileId } });
      if (category) {
        updateData.category = { connect: { id: body.categoryId } };
      }
    } else if (body.categoryId === null) {
      updateData.category = { disconnect: true };
    }

    if (body.accountId) {
      const account = await prisma.account.findFirst({ where: { id: body.accountId, profileId } });
      if (account) {
        updateData.account = { connect: { id: body.accountId } };
      }
    } else if (body.accountId === null) {
      updateData.account = { disconnect: true };
    }

    if (body.toAccountId) {
      const toAccount = await prisma.account.findFirst({ where: { id: body.toAccountId, profileId } });
      if (toAccount) {
        updateData.toAccount = { connect: { id: body.toAccountId } };
      }
    } else if (body.toAccountId === null) {
      updateData.toAccount = { disconnect: true };
    }

    const transaction = await prisma.$transaction(async (tx) => {
      if (existing.type === "transfer") {
        if (existing.accountId && existing.toAccountId) {
          await revertTransfer(tx, existing.accountId, existing.toAccountId, existing.amount);
        }
        const updated = await tx.transaction.update({
          where: { id },
          data: updateData as never,
          include: { category: true, account: true, toAccount: true },
        });
        const targetAccountId = body.accountId ?? existing.accountId;
        const targetToAccountId = body.toAccountId ?? existing.toAccountId;
        if (targetAccountId && targetToAccountId) {
          await applyTransfer(tx, targetAccountId, targetToAccountId, nextAmount);
        }
        return updated;
      } else {
        await applyBalanceDelta(tx, existing.accountId, -oldDelta);
        const updated = await tx.transaction.update({
          where: { id },
          data: updateData as never,
          include: { category: true, account: true, toAccount: true },
        });
        await applyBalanceDelta(tx, body.accountId ?? existing.accountId, newDelta);
        return updated;
      }
    });

    return NextResponse.json({
      ...transaction,
      category: transaction.category?.name ?? "",
      account: transaction.account?.name ?? "",
      toAccount: transaction.toAccount?.name ?? "",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update transaction" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const existing = await prisma.transaction.findFirst({ where: { id, profileId } });

    if (!existing) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (existing.type === "transfer") {
        if (existing.accountId && existing.toAccountId) {
          await revertTransfer(tx, existing.accountId, existing.toAccountId, existing.amount);
        }
      } else {
        const delta = getTransactionBalanceDelta(existing.type, existing.amount);
        await applyBalanceDelta(tx, existing.accountId, -delta);
      }
      await tx.transaction.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to delete transaction" }, { status: 500 });
  }
}
