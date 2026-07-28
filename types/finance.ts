export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  account: string;
  date: string;
  notes?: string;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
}

export interface DashboardSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  recentTransactions: Transaction[];
  incomeVsExpense: Array<{ month: string; income: number; expense: number }>;
  expenseByCategory: Array<{ name: string; value: number }>;
}
