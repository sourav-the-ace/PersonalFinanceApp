import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardSummary, filterTransactionsBySearch, initialTransactions } from "./data";

test("filterTransactionsBySearch matches search text and transaction type", () => {
  const result = filterTransactionsBySearch(initialTransactions, "gro", "all");

  assert.equal(result.length, 1);
  assert.equal(result[0]?.title, "Groceries");
});

test("filterTransactionsBySearch respects the selected transaction type", () => {
  const result = filterTransactionsBySearch(initialTransactions, "", "income");

  assert.equal(result.length, 2);
  assert.ok(result.every((transaction) => transaction.type === "income"));
});

test("buildDashboardSummary filters monthly income and expenses by the selected month", () => {
  const transactions = [
    { id: "1", title: "Salary", amount: 5000, type: "income", category: "Salary", account: "Checking", date: "2026-07-01", notes: "" },
    { id: "2", title: "Rent", amount: 1200, type: "expense", category: "Housing", account: "Checking", date: "2026-07-03", notes: "" },
    { id: "3", title: "Bonus", amount: 800, type: "income", category: "Bonus", account: "Checking", date: "2026-06-20", notes: "" },
  ];

  const summary = buildDashboardSummary(transactions, [{ id: "acc-1", name: "Checking", type: "Bank", balance: 5000 }], "2026-07");

  assert.equal(summary.monthlyIncome, 5000);
  assert.equal(summary.monthlyExpenses, 1200);
  assert.equal(summary.incomeVsExpense[0]?.month, "2026-07");
});
