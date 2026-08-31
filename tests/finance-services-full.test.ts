import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { ensureProfileForUser } from "../lib/auth";
import { applyBalanceDelta } from "../lib/balance-service";
import { validateRepayment } from "../lib/loan-service";
import { formatCurrency } from "../utils/format";

test("Finance Services Full Suite: Settings, Balance Deltas, Loan Constraints, and Formatters", async () => {
  const timestamp = Date.now();
  const testEmail = `settings-test-${timestamp}@example.com`;

  const user = await prisma.user.create({
    data: { email: testEmail, passwordHash: "dummy-hash" },
  });

  try {
    const profile = await ensureProfileForUser(user.id, testEmail);

    // 1. Test Profile Settings Update and Persistence
    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        currency: "BDT",
        theme: "dark",
        name: "Test Ace User",
      },
    });

    assert.equal(updatedProfile.currency, "BDT");
    assert.equal(updatedProfile.theme, "dark");
    assert.equal(updatedProfile.name, "Test Ace User");

    // 2. Test Account Creation and Balance Delta Modifications
    const account = await prisma.account.create({
      data: {
        profileId: profile.id,
        name: "Test Savings",
        type: "Bank",
        balance: 10000,
      },
    });

    // Credit balance +5000
    await applyBalanceDelta(prisma, account.id, 5000);
    const accAfterCredit = await prisma.account.findUnique({ where: { id: account.id } });
    assert.equal(accAfterCredit?.balance, 15000);

    // Debit balance -3000
    await applyBalanceDelta(prisma, account.id, -3000);
    const accAfterDebit = await prisma.account.findUnique({ where: { id: account.id } });
    assert.equal(accAfterDebit?.balance, 12000);

    // 3. Test Loan Repayment Validation Constraint
    assert.doesNotThrow(() => {
      validateRepayment(5000, 3000);
    });

    assert.doesNotThrow(() => {
      validateRepayment(5000, 5000);
    });

    assert.throws(
      () => {
        validateRepayment(5000, 6000);
      },
      /exceeds outstanding balance/
    );

    // 4. Test Currency Formatting with BDT and other currencies
    assert.equal(formatCurrency(12345.67, "BDT"), "৳12,345.67");
    assert.equal(formatCurrency(-500.5, "BDT"), "-৳500.50");
    assert.equal(formatCurrency(0, "BDT"), "৳0.00");
    assert.equal(formatCurrency(null, "BDT"), "৳0.00");
    assert.equal(formatCurrency(1000, "USD"), "$1,000.00");
  } finally {
    await prisma.transaction.deleteMany({ where: { profile: { email: testEmail } } });
    await prisma.account.deleteMany({ where: { profile: { email: testEmail } } });
    await prisma.profile.deleteMany({ where: { email: testEmail } });
    await prisma.user.deleteMany({ where: { email: testEmail } });
  }
});
