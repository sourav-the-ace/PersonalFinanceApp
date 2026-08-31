import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTransactionRelationIds } from "@/lib/finance-relations";
import { isFinanceStateSyncPayload } from "@/features/finance/finance-service";
import { applyBalanceDelta } from "@/lib/balance-service";
import { getSessionProfile } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: { category: true; account: true };
}>;

export async function GET() {
  try {
    const profileId = await getSessionProfile();
    const fullProfile = await prisma.profile.findFirst({
      where: { id: profileId },
      include: {
        transactions: {
          include: {
            category: true,
            account: true,
          },
        },
        accounts: true,
        categories: true,
      },
    });

    if (!fullProfile) {
      return NextResponse.json({ transactions: [], accounts: [], categories: [] });
    }

    return NextResponse.json({
      transactions: fullProfile.transactions.map((transaction: TransactionWithRelations) => ({
        ...transaction,
        category: transaction.category?.name ?? "",
        account: transaction.account?.name ?? "",
      })),
      accounts: fullProfile.accounts,
      categories: fullProfile.categories,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ transactions: [], accounts: [], categories: [] });
  }
}

export async function POST(request: Request) {
  try {
    const profileId = await getSessionProfile();
    const body = await request.json();

    if (isFinanceStateSyncPayload(body)) {
      return NextResponse.json({ ok: true });
    }

    if (!body.title || !body.type) {
      return NextResponse.json({ error: "Title and type are required" }, { status: 400 });
    }

    const { categoryId, accountId } = await resolveTransactionRelationIds(
      {
        category: {
          findFirst: (args) => prisma.category.findFirst(args),
          create: (args) => prisma.category.create(args),
        },
        account: {
          findFirst: (args) => prisma.account.findFirst(args),
          create: (args) => prisma.account.create(args),
        },
      },
      profileId,
      body,
    );

    const amount = Number(body.amount ?? 0);
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          profileId,
          title: body.title,
          amount,
          type: body.type,
          categoryId: categoryId ?? null,
          accountId: accountId ?? null,
          date: body.date,
          notes: body.notes ?? null,
        },
        include: { category: true, account: true },
      });

      const delta = body.type === "income" ? amount : body.type === "expense" ? -amount : 0;
      await applyBalanceDelta(tx, accountId ?? null, delta);
      return {
        ...created,
        category: created.category?.name ?? "",
        account: created.account?.name ?? "",
      };
    });

    return NextResponse.json(transaction);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to create transaction" }, { status: 500 });
  }
}