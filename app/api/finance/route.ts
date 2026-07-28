import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTransactionRelationIds } from "@/lib/finance-relations";
import { isFinanceStateSyncPayload } from "@/features/finance/finance-service";
import type { Prisma } from "@prisma/client";

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: { category: true; account: true };
}>;

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst({
      where: { email: "demo@northstar.finance" },
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

    if (!profile) {
      return NextResponse.json({ transactions: [], accounts: [], categories: [] });
    }

    return NextResponse.json({
      transactions: profile.transactions.map((transaction: TransactionWithRelations) => ({
        ...transaction,
        category: transaction.category?.name ?? "",
        account: transaction.account?.name ?? "",
      })),
      accounts: profile.accounts,
      categories: profile.categories,
    });
  } catch {
    return NextResponse.json({ transactions: [], accounts: [], categories: [] });
  }
}