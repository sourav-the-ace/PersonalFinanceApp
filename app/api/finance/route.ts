import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTransactionRelationIds } from "@/lib/finance-relations";
import { isFinanceStateSyncPayload } from "@/features/finance/finance-service";

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
      transactions: profile.transactions.map((transaction) => ({
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

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (isFinanceStateSyncPayload(body)) {
      return NextResponse.json({ ok: true });
    }

    const profile = await prisma.profile.upsert({
      where: { email: "demo@northstar.finance" },
      update: {},
      create: {
        email: "demo@northstar.finance",
        name: "Demo User",
        currency: "USD",
        theme: "light",
      },
    });

    const { categoryId, accountId } = await resolveTransactionRelationIds(
      {
        category: prisma.category,
        account: prisma.account,
      },
      profile.id,
      {
        categoryId: body.categoryId,
        accountId: body.accountId,
        category: body.category,
        account: body.account,
        type: body.type,
      },
    );

    const createData: Record<string, unknown> = {
      profileId: profile.id,
      title: body.title,
      amount: Number(body.amount),
      type: body.type,
      date: body.date,
      notes: body.notes,
    };

    if (categoryId) {
      createData.categoryId = categoryId;
    }

    if (accountId) {
      createData.accountId = accountId;
    }

    const transaction = await prisma.transaction.create({
      data: createData as never,
      include: { category: true, account: true },
    });

    return NextResponse.json({ transaction });
  } catch (error) {
    console.error("Finance transaction create failed", error);
    return NextResponse.json({ transaction: null, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
