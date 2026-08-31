import type { Account, Category, DashboardSummary, Investment, Loan, Transaction, TransactionType } from "@/types/finance";

export const initialTransactions: Transaction[] = [];

export const initialAccounts: Account[] = [];

export const initialCategories: Category[] = [];

export function createDefaultFinanceState() {
  return {
    transactions: initialTransactions,
    accounts: initialAccounts,
    categories: initialCategories,
  };
}

export function filterTransactionsBySearch(
  transactions: Transaction[],
  search: string,
  filter: TransactionType | "all",
) {
  return transactions.filter((transaction) => {
    const matchesSearch = `${transaction.title} ${transaction.category} ${transaction.account}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesFilter = filter === "all" || transaction.type === filter;

    return matchesSearch && matchesFilter;
  });
}

export function buildDynamicMonthlyChart(
  transactions: Transaction[],
  endMonthStr?: string,
): Array<{ month: string; income: number; expense: number }> {
  let refYear: number;
  let refMonth: number;

  if (endMonthStr && /^\d{4}-\d{2}$/.test(endMonthStr)) {
    const [y, m] = endMonthStr.split("-").map(Number);
    refYear = y;
    refMonth = m;
  } else {
    const now = new Date();
    refYear = now.getFullYear();
    refMonth = now.getMonth() + 1;
  }

  const months: Array<{ key: string; label: string; income: number; expense: number }> = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(refYear, refMonth - 1 - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-US", { month: "short" });
    months.push({ key, label, income: 0, expense: 0 });
  }

  const monthMap = new Map(months.map((m) => [m.key, m]));

  for (const tx of transactions) {
    if (!tx.date) continue;
    const txMonth = tx.date.slice(0, 7);
    const entry = monthMap.get(txMonth);
    if (!entry) continue;

    if (tx.type === "income" || tx.type === "loan_receive_repayment") {
      entry.income += tx.type === "loan_receive_repayment" ? (tx.interestAmount ?? 0) : tx.amount;
    } else if (tx.type === "expense" || tx.type === "loan_repayment") {
      entry.expense += tx.type === "loan_repayment" ? (tx.interestAmount ?? 0) : tx.amount;
    }
  }

  return months.map(({ label, income, expense }) => ({
    month: label,
    income: Math.round(income * 100) / 100,
    expense: Math.round(expense * 100) / 100,
  }));
}

export function buildDashboardSummary(
  transactions: Transaction[],
  accounts: Account[],
  selectedMonth?: string,
  loans: Loan[] = [],
  investments: Investment[] = [],
): DashboardSummary {
  const filteredTransactions = selectedMonth
    ? transactions.filter((item) => item.date.startsWith(selectedMonth))
    : transactions;

  const monthlyIncome = filteredTransactions
    .filter((item) => item.type === "income" || item.type === "loan_receive_repayment")
    .reduce((sum, item) => sum + (item.type === "loan_receive_repayment" ? (item.interestAmount ?? 0) : item.amount), 0);
  const monthlyExpenses = filteredTransactions
    .filter((item) => item.type === "expense" || item.type === "loan_repayment")
    .reduce((sum, item) => sum + (item.type === "loan_repayment" ? (item.interestAmount ?? 0) : item.amount), 0);
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

  const expenseByCategory = Array.from(
    filteredTransactions
      .filter((item) => item.type === "expense")
      .reduce((map, item) => {
        const current = map.get(item.category) ?? 0;
        map.set(item.category, current + item.amount);
        return map;
      }, new Map<string, number>())
      .entries(),
  ).map(([name, value]) => ({ name, value }));

  const incomeVsExpense = buildDynamicMonthlyChart(transactions, selectedMonth);

  const outstandingBorrowed = loans.filter((loan) => loan.direction === "borrowed").reduce((sum, loan) => sum + loan.outstanding, 0);
  const outstandingLent = loans.filter((loan) => loan.direction === "lent").reduce((sum, loan) => sum + loan.outstanding, 0);
  const openLoansCount = loans.filter((loan) => loan.status === "open").length;
  const closedLoansCount = loans.filter((loan) => loan.status === "closed").length;
  const netInvested = investments.reduce((sum, investment) => sum + investment.netInvested, 0);
  const realizedPnL = investments.reduce((sum, investment) => sum + investment.realizedPnL, 0);

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
    recentTransactions: filteredTransactions.slice(0, 5),
    incomeVsExpense,
    expenseByCategory,
    outstandingBorrowed,
    outstandingLent,
    openLoansCount,
    closedLoansCount,
    netInvested,
    realizedPnL,
  };
}
