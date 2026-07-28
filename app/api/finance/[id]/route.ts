import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {
      title: body.title,
      amount: Number(body.amount),
      type: body.type,
      date: body.date,
      notes: body.notes ?? null,
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

    const transaction = await prisma.transaction.update({
      where: { id },
      data: updateData as never,
      include: { category: true, account: true },
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}
