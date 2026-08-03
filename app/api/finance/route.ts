import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTransactionRelationIds } from "@/lib/finance-relations";
import { isFinanceStateSyncPayload } from "@/features/finance/finance-service";
import { getDemoProfile } from "@/lib/demo-profile";
import { applyBalanceDelta } from "@/lib/balance-service";
import type { Prisma } from "@prisma/client";

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: { category: true; account: true };
}>;

export async function GET() {
  try {
    const profile = await getDemoProfile();
    const fullProfile = await prisma.profile.findFirst({
      where: { id: profile.id },
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
  } catch {
    return NextResponse.json({ transactions: [], accounts: [], categories: [] });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await getDemoProfile();
    const body = await request.json();
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
      profile.id,
      body,
    );

    const amount = Number(body.amount ?? 0);
    const transaction = await prisma.$transaction(async (tx) => {
      const created = await tx.transaction.create({
        data: {
          profileId: profile.id,
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
  } catch {
    return NextResponse.json({ error: "Unable to create transaction" }, { status: 500 });
  }
}