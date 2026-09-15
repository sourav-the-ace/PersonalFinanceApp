import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { applyTransfer, revertTransfer } from "../lib/balance-service";
import { buildDashboardSummary, buildDynamicMonthlyChart, filterTransactionsBySearch } from "../features/finance/data";
import type { Transaction } from "../types/finance";

test("Transfers Test Suite: balance updates, reversals, dashboard neutrality, and constraints", async () => {
  const testEmail = `transfer-test-${Date.now()}@example.com`;
  const otherEmail = `transfer-other-${Date.now()}@example.com`;

  const user = await prisma.user.create({
    data: { email: testEmail, passwordHash: "hashed-pass" },
  });

  const profile = await prisma.profile.create({
    data: { userId: user.id, email: testEmail, name: "Transfer Tester", currency: "BDT" },
  });

  const otherUser = await prisma.user.create({
    data: { email: otherEmail, passwordHash: "hashed-pass" },
  });

  const otherProfile = await prisma.profile.create({
    data: { userId: otherUser.id, email: otherEmail, name: "Other User", currency: "BDT" },
  });

  try {
    // 1. Create two accounts for main user
    const accA = await prisma.account.create({
      data: { profileId: profile.id, name: "EBL Checking", type: "Bank", balance: 50000 },
    });
    const accB = await prisma.account.create({
      data: { profileId: profile.id, name: "IBBL Savings", type: "Bank", balance: 10000 },
    });

    // Account for other user
    const accOther = await prisma.account.create({
      data: { profileId: otherProfile.id, name: "Foreign Account", type: "Bank", balance: 5000 },
    });

    // 2. Test applyTransfer
    const transferAmount = 15000;
    await prisma.$transaction(async (tx) => {
      await applyTransfer(tx, accA.id, accB.id, transferAmount);
    });

    const updatedA = await prisma.account.findUniqueOrThrow({ where: { id: accA.id } });
    const updatedB = await prisma.account.findUniqueOrThrow({ where: { id: accB.id } });

    assert.equal(updatedA.balance, 35000);
    assert.equal(updatedB.balance, 25000);
    // Net worth remains 60000
    assert.equal(updatedA.balance + updatedB.balance, 60000);

    // 3. Create Transfer Transaction in DB
    const txRecord = await prisma.transaction.create({
      data: {
        profileId: profile.id,
        title: "Transfer: EBL Checking → IBBL Savings",
        amount: transferAmount,
        type: "transfer",
        accountId: accA.id,
        toAccountId: accB.id,
        date: "2026-09-15",
        notes: "Moving savings",
      },
      include: { account: true, toAccount: true },
    });

    assert.equal(txRecord.type, "transfer");
    assert.equal(txRecord.accountId, accA.id);
    assert.equal(txRecord.toAccountId, accB.id);
    assert.equal(txRecord.account?.name, "EBL Checking");
    assert.equal(txRecord.toAccount?.name, "IBBL Savings");

    // 4. Test Dashboard & Chart neutrality
    const frontendTx: Transaction = {
      id: txRecord.id,
      title: txRecord.title,
      amount: txRecord.amount,
      type: "transfer",
      category: "",
      account: txRecord.account?.name ?? "",
      toAccount: txRecord.toAccount?.name ?? "",
      accountId: txRecord.accountId ?? undefined,
      toAccountId: txRecord.toAccountId ?? undefined,
      date: txRecord.date,
    };

    const summary = buildDashboardSummary([frontendTx], [updatedA, updatedB], "2026-09");
    assert.equal(summary.monthlyIncome, 0, "Transfers must not count as income");
    assert.equal(summary.monthlyExpenses, 0, "Transfers must not count as expenses");
    assert.equal(summary.totalBalance, 60000, "Total balance must equal sum of accounts");

    const chart = buildDynamicMonthlyChart([frontendTx], "2026-09");
    const currentMonth = chart.find((m) => m.month === "Sep");
    if (currentMonth) {
      assert.equal(currentMonth.income, 0);
      assert.equal(currentMonth.expense, 0);
    }

    // 5. Test search filter with toAccount
    const searchResultA = filterTransactionsBySearch([frontendTx], "EBL", "all");
    assert.equal(searchResultA.length, 1);
    const searchResultB = filterTransactionsBySearch([frontendTx], "IBBL", "all");
    assert.equal(searchResultB.length, 1, "Searching by destination account name must find the transfer");
    const filterTransferOnly = filterTransactionsBySearch([frontendTx], "", "transfer");
    assert.equal(filterTransferOnly.length, 1);
    const filterExpenseOnly = filterTransactionsBySearch([frontendTx], "", "expense");
    assert.equal(filterExpenseOnly.length, 0);

    // 6. Test revertTransfer
    await prisma.$transaction(async (tx) => {
      await revertTransfer(tx, accA.id, accB.id, transferAmount);
      await tx.transaction.delete({ where: { id: txRecord.id } });
    });

    const revertedA = await prisma.account.findUniqueOrThrow({ where: { id: accA.id } });
    const revertedB = await prisma.account.findUniqueOrThrow({ where: { id: accB.id } });

    assert.equal(revertedA.balance, 50000, "Source account should be restored to original balance");
    assert.equal(revertedB.balance, 10000, "Destination account should be restored to original balance");

    // 7. Test Account delete protection with toAccountId
    const newTx = await prisma.transaction.create({
      data: {
        profileId: profile.id,
        title: "Test transfer protection",
        amount: 100,
        type: "transfer",
        accountId: accA.id,
        toAccountId: accB.id,
        date: "2026-09-15",
      },
    });

    const countDest = await prisma.transaction.count({
      where: {
        OR: [{ accountId: accB.id }, { toAccountId: accB.id }],
      },
    });
    assert.equal(countDest, 1, "Destination account must be detected as having transaction activity");

    await prisma.transaction.delete({ where: { id: newTx.id } });
  } finally {
    await prisma.transaction.deleteMany({ where: { profile: { email: { in: [testEmail, otherEmail] } } } });
    await prisma.account.deleteMany({ where: { profile: { email: { in: [testEmail, otherEmail] } } } });
    await prisma.profile.deleteMany({ where: { email: { in: [testEmail, otherEmail] } } });
    await prisma.user.deleteMany({ where: { email: { in: [testEmail, otherEmail] } } });
    await prisma.$disconnect();
  }
});

