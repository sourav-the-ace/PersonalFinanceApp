export type LoanDirection = "borrowed" | "lent";
export type EntityStatus = "open" | "closed";
export type LoanTransactionType = "loan_borrow" | "loan_repayment" | "loan_lend" | "loan_receive_repayment";
export type InvestmentTransactionType = "investment_in" | "investment_out";
export type TransactionType = "income" | "expense" | LoanTransactionType | InvestmentTransactionType;

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  account: string;
  date: string;
  notes?: string;
  loanId?: string;
  investmentId?: string;
  principalAmount?: number;
  interestAmount?: number;
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

export interface Loan {
  id: string;
  title: string;
  direction: LoanDirection;
  counterparty?: string;
  status: EntityStatus;
  notes?: string;
  outstanding: number;
}

export interface Investment {
  id: string;
  name: string;
  assetType: string;
  institution?: string;
  status: EntityStatus;
  notes?: string;
  totalInvested: number;
  totalReturned: number;
  netInvested: number;
  realizedPnL: number;
}

export interface DashboardSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
  recentTransactions: Transaction[];
  incomeVsExpense: Array<{ month: string; income: number; expense: number }>;
  expenseByCategory: Array<{ name: string; value: number }>;
  outstandingBorrowed: number;
  outstandingLent: number;
  openLoansCount: number;
  closedLoansCount: number;
  netInvested: number;
  realizedPnL: number;
}
