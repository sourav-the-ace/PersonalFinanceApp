import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionProfile } from "@/lib/auth";
import { applyTransfer } from "@/lib/balance-service";

export async function POST(request: Request) {
  try {
    const profileId = await getSessionProfile();
    const body = await request.json();

    const { fromAccountId, toAccountId, date, notes } = body;
    const amount = Number(body.amount);

    const charge = Number(body.charge ?? 0);

    if (!fromAccountId || !toAccountId) {
      return NextResponse.json({ error: "Source and destination accounts are required" }, { status: 400 });
    }

    if (fromAccountId === toAccountId) {
      return NextResponse.json({ error: "Cannot transfer to the same account" }, { status: 400 });
    }

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Transfer amount must be greater than zero" }, { status: 400 });
    }

    if (isNaN(charge) || charge < 0) {
      return NextResponse.json({ error: "Transfer charge cannot be negative" }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: "Date is required" }, { status: 400 });
    }

    // Verify both accounts exist and belong to this profile
    const [fromAccount, toAccount] = await Promise.all([
      prisma.account.findFirst({ where: { id: fromAccountId, profileId } }),
      prisma.account.findFirst({ where: { id: toAccountId, profileId } }),
    ]);

    if (!fromAccount) {
      return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }

    if (!toAccount) {
      return NextResponse.json({ error: "Destination account not found" }, { status: 404 });
    }

    const totalRequired = amount + charge;
    if (fromAccount.balance < totalRequired) {
      return NextResponse.json({
        error: `Insufficient balance in ${fromAccount.name}. Available: ${fromAccount.balance}, requested: ${amount}${charge > 0 ? ` + ${charge} charge = ${totalRequired}` : ""}`,
      }, { status: 400 });
    }

    const defaultTitle = `Transfer: ${fromAccount.name} → ${toAccount.name}`;
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : defaultTitle;

    const transaction = await prisma.$transaction(async (tx) => {
      await applyTransfer(tx, fromAccountId, toAccountId, amount, charge);

      const created = await tx.transaction.create({
        data: {
          profileId,
          title,
          amount,
          charge,
          type: "transfer",
          accountId: fromAccountId,
          toAccountId,
          date,
          notes: notes || null,
        },
        include: {
          account: true,
          toAccount: true,
        },
      });

      return created;
    });

    return NextResponse.json({
      ...transaction,
      account: transaction.account?.name ?? "",
      toAccount: transaction.toAccount?.name ?? "",
      category: "",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to complete transfer" }, { status: 500 });
  }
}

