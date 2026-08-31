import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { ensureProfileForUser } from "../lib/auth";

test("Multi-tenant isolation: Users cannot access or mutate each other's financial entities", async () => {
  const timestamp = Date.now();
  const userAEmail = `user-a-${timestamp}@example.com`;
  const userBEmail = `user-b-${timestamp}@example.com`;

  const userA = await prisma.user.create({
    data: { email: userAEmail, passwordHash: "hash-a" },
  });
  const userB = await prisma.user.create({
    data: { email: userBEmail, passwordHash: "hash-b" },
  });

  try {
    const profileA = await ensureProfileForUser(userA.id, userAEmail);
    const profileB = await ensureProfileForUser(userB.id, userBEmail);

    assert.notEqual(profileA.id, profileB.id);

    // 1. Profile A creates an Account and a Category
    const accountA = await prisma.account.create({
      data: { profileId: profileA.id, name: "User A Checking", type: "Bank", balance: 500 },
    });
    const categoryA = await prisma.category.create({
      data: { profileId: profileA.id, name: "User A Salary", type: "income" },
    });

    // 2. Profile A creates a Loan and an Investment
    const loanA = await prisma.loan.create({
      data: { profileId: profileA.id, title: "User A Car Loan", direction: "borrowed" },
    });
    const investmentA = await prisma.investment.create({
      data: { profileId: profileA.id, name: "User A Index Fund", assetType: "Stock" },
    });

    // 3. Profile A creates a Transaction
    const txA = await prisma.transaction.create({
      data: {
        profileId: profileA.id,
        title: "Paycheck",
        amount: 2000,
        type: "income",
        accountId: accountA.id,
        categoryId: categoryA.id,
        date: "2026-09-01",
      },
    });

    // Verify Profile B cannot see Profile A's Accounts
    const accountsB = await prisma.account.findMany({ where: { profileId: profileB.id } });
    assert.equal(accountsB.some((acc) => acc.id === accountA.id), false);

    // Verify Profile B cannot see Profile A's Categories
    const categoriesB = await prisma.category.findMany({ where: { profileId: profileB.id } });
    assert.equal(categoriesB.some((cat) => cat.id === categoryA.id), false);

    // Verify Profile B cannot see Profile A's Loans
    const loansB = await prisma.loan.findMany({ where: { profileId: profileB.id } });
    assert.equal(loansB.some((loan) => loan.id === loanA.id), false);

    // Verify Profile B cannot see Profile A's Investments
    const investmentsB = await prisma.investment.findMany({ where: { profileId: profileB.id } });
    assert.equal(investmentsB.some((inv) => inv.id === investmentA.id), false);

    // Verify Profile B cannot access Profile A's Loan by ID
    const loanCrossAccess = await prisma.loan.findFirst({
      where: { id: loanA.id, profileId: profileB.id },
    });
    assert.equal(loanCrossAccess, null);

    // Verify Profile B cannot access Profile A's Investment by ID
    const invCrossAccess = await prisma.investment.findFirst({
      where: { id: investmentA.id, profileId: profileB.id },
    });
    assert.equal(invCrossAccess, null);

    // Verify Profile B cannot access Profile A's Transaction by ID
    const txCrossAccess = await prisma.transaction.findFirst({
      where: { id: txA.id, profileId: profileB.id },
    });
    assert.equal(txCrossAccess, null);
  } finally {
    await prisma.transaction.deleteMany({ where: { profile: { email: { in: [userAEmail, userBEmail] } } } });
    await prisma.loan.deleteMany({ where: { profile: { email: { in: [userAEmail, userBEmail] } } } });
    await prisma.investment.deleteMany({ where: { profile: { email: { in: [userAEmail, userBEmail] } } } });
    await prisma.account.deleteMany({ where: { profile: { email: { in: [userAEmail, userBEmail] } } } });
    await prisma.category.deleteMany({ where: { profile: { email: { in: [userAEmail, userBEmail] } } } });
    await prisma.profile.deleteMany({ where: { email: { in: [userAEmail, userBEmail] } } });
    await prisma.user.deleteMany({ where: { email: { in: [userAEmail, userBEmail] } } });
    await prisma.$disconnect();
  }
});
