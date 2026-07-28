import type { Account, Category, DashboardSummary, Transaction, TransactionType } from "@/types/finance";

export const initialTransactions: Transaction[] = [
  {
    id: "tx-1",
    title: "Freelance Design Project",
    amount: 3200,
    type: "income",
    category: "Freelance",
    account: "Business Checking",
    date: "2026-07-20",
    notes: "Website redesign for a SaaS client",
  },
  {
    id: "tx-2",
    title: "Groceries",
    amount: 128.45,
    type: "expense",
    category: "Food",
    account: "Checking",
    date: "2026-07-21",
    notes: "Weekly grocery run",
  },
  {
    id: "tx-3",
    title: "Salary",
    amount: 6400,
    type: "income",
    category: "Salary",
    account: "Checking",
    date: "2026-07-01",
  },
  {
    id: "tx-4",
    title: "Electric Bill",
    amount: 89.2,
    type: "expense",
    category: "Utilities",
    account: "Credit Card",
    date: "2026-07-10",
  },
  {
    id: "tx-5",
    title: "Gym Membership",
    amount: 45,
    type: "expense",
    category: "Health",
    account: "Wallet",
    date: "2026-07-14",
  },
];

export const initialAccounts: Account[] = [
  { id: "acc-1", name: "Checking", type: "Bank", balance: 12640.2 },
  { id: "acc-2", name: "Business Checking", type: "Bank", balance: 8450.73 },
  { id: "acc-3", name: "Wallet", type: "Wallet", balance: 320.5 },
  { id: "acc-4", name: "Credit Card", type: "Credit Card", balance: -1280.4 },
];

export const initialCategories: Category[] = [
  { id: "cat-1", name: "Salary", type: "income" },
  { id: "cat-2", name: "Freelance", type: "income" },
  { id: "cat-3", name: "Food", type: "expense" },
  { id: "cat-4", name: "Utilities", type: "expense" },
  { id: "cat-5", name: "Health", type: "expense" },
];

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

export function buildDashboardSummary(
  transactions: Transaction[],
  accounts: Account[],
  selectedMonth?: string,
): DashboardSummary {
  const filteredTransactions = selectedMonth
    ? transactions.filter((item) => item.date.startsWith(selectedMonth))
    : transactions;

  const monthlyIncome = filteredTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const monthlyExpenses = filteredTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
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

  const incomeVsExpense = [
    { month: "Jan", income: 4800, expense: 2800 },
    { month: "Feb", income: 5200, expense: 3100 },
    { month: "Mar", income: 5500, expense: 3200 },
    { month: "Apr", income: 6100, expense: 2900 },
    { month: "May", income: 6300, expense: 3400 },
    { month: "Jun", income: 6400, expense: 3500 },
  ];

  return {
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    savingsRate,
    recentTransactions: filteredTransactions.slice(0, 5),
    incomeVsExpense: selectedMonth
      ? [{ month: selectedMonth, income: monthlyIncome, expense: monthlyExpenses }]
      : incomeVsExpense,
    expenseByCategory,
  };
}
