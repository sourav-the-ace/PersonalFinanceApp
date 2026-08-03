import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const body = await request.json();
    const account = await prisma.account.findFirst({ where: { id, profileId } });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const updated = await prisma.account.update({
      where: { id },
      data: { name: body.name ?? account.name, type: body.type ?? account.type },
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update account" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const account = await prisma.account.findFirst({ where: { id, profileId } });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const transactionCount = await prisma.transaction.count({ where: { accountId: id } });
    if (transactionCount > 0 || account.balance !== 0) {
      return NextResponse.json({ error: "Account has activity and cannot be deleted" }, { status: 400 });
    }

    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to delete account" }, { status: 500 });
  }
}
