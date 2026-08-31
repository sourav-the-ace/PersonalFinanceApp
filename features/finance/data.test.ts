import test from "node:test";
import assert from "node:assert/strict";
import { buildDashboardSummary, filterTransactionsBySearch } from "./data";
import type { Account, Investment, Loan, Transaction } from "@/types/finance";

test("buildDashboardSummary calculates monthly income and expense correctly", () => {
  const transactions: Transaction[] = [
    { id: "tx-1", title: "Salary", amount: 5000, type: "income", category: "Salary", account: "Checking", date: "2026-08-01" },
    { id: "tx-2", title: "Groceries", amount: 200, type: "expense", category: "Food", account: "Checking", date: "2026-08-05" },
    { id: "tx-3", title: "Loan Borrow", amount: 1000, type: "loan_borrow", category: "", account: "Checking", date: "2026-08-10" },
    { id: "tx-4", title: "Loan Repayment", amount: 250, principalAmount: 200, interestAmount: 50, type: "loan_repayment", category: "", account: "Checking", date: "2026-08-15" },
    { id: "tx-5", title: "Receive Repayment", amount: 120, principalAmount: 100, interestAmount: 20, type: "loan_receive_repayment", category: "", account: "Checking", date: "2026-08-20" },
    { id: "tx-6", title: "Investment In", amount: 1500, type: "investment_in", category: "", account: "Checking", date: "2026-08-22" },
    { id: "tx-7", title: "Investment Out", amount: 500, type: "investment_out", category: "", account: "Checking", date: "2026-08-25" },
  ];

  const accounts: Account[] = [
    { id: "acc-1", name: "Checking", type: "Bank", balance: 5000 },
  ];

  const loans: Loan[] = [
    { id: "loan-1", title: "Car Loan", direction: "borrowed", status: "open", outstanding: 800 },
    { id: "loan-2", title: "Personal Loan to Friend", direction: "lent", status: "open", outstanding: 400 },
  ];

  const investments: Investment[] = [
    { id: "inv-1", name: "S&P 500 Index", assetType: "Stock", status: "open", totalInvested: 1500, totalReturned: 500, netInvested: 1000, realizedPnL: -1000 },
  ];

  const summary = buildDashboardSummary(transactions, accounts, "2026-08", loans, investments);

  // Income: 5000 (salary) + 20 (loan_receive_repayment interest) = 5020
  assert.equal(summary.monthlyIncome, 5020);
  // Expense: 200 (groceries) + 50 (loan_repayment interest) = 250
  assert.equal(summary.monthlyExpenses, 250);
  assert.equal(summary.totalBalance, 5000);
  assert.equal(summary.outstandingBorrowed, 800);
  assert.equal(summary.outstandingLent, 400);
  assert.equal(summary.netInvested, 1000);
});

test("filterTransactionsBySearch filters correctly by search query and type", () => {
  const transactions: Transaction[] = [
    { id: "tx-1", title: "Salary", amount: 5000, type: "income", category: "Salary", account: "Checking", date: "2026-08-01" },
    { id: "tx-2", title: "Groceries", amount: 200, type: "expense", category: "Food", account: "Checking", date: "2026-08-05" },
  ];

  const filteredBySearch = filterTransactionsBySearch(transactions, "groc", "all");
  assert.equal(filteredBySearch.length, 1);
  assert.equal(filteredBySearch[0].id, "tx-2");

  const filteredByType = filterTransactionsBySearch(transactions, "", "income");
  assert.equal(filteredByType.length, 1);
  assert.equal(filteredByType[0].id, "tx-1");
});

test("buildDynamicMonthlyChart produces 6 trailing months aggregated accurately from transactions", () => {
  const { buildDynamicMonthlyChart } = require("./data");
  const transactions: Transaction[] = [
    { id: "tx-1", title: "July Salary", amount: 4000, type: "income", category: "Salary", account: "Checking", date: "2026-07-15" },
    { id: "tx-2", title: "July Rent", amount: 1500, type: "expense", category: "Housing", account: "Checking", date: "2026-07-01" },
    { id: "tx-3", title: "August Salary", amount: 4500, type: "income", category: "Salary", account: "Checking", date: "2026-08-01" },
    { id: "tx-4", title: "August Utilities", amount: 300, type: "expense", category: "Utilities", account: "Checking", date: "2026-08-10" },
  ];

  const chart = buildDynamicMonthlyChart(transactions, "2026-08");
  assert.equal(chart.length, 6);
  // Last entry is August 2026
  assert.equal(chart[5].month, "Aug");
  assert.equal(chart[5].income, 4500);
  assert.equal(chart[5].expense, 300);

  // Second to last is July 2026
  assert.equal(chart[4].month, "Jul");
  assert.equal(chart[4].income, 4000);
  assert.equal(chart[4].expense, 1500);

  // Prior months should be 0
  assert.equal(chart[0].income, 0);
  assert.equal(chart[0].expense, 0);
});

