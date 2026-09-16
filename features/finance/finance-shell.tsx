"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import {
  ArrowRightLeft,
  BriefcaseBusiness,
  Calendar,
  ChevronUp,
  CreditCard,
  Download,
  FileText,
  Landmark,
  PiggyBank,
  Plus,
  RotateCcw,
  Search,
  Wallet,
  X,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { buildDashboardSummary } from "@/features/finance/data";
import { emptyTransactionForm, createTransactionFromForm } from "@/features/finance/finance-forms";
import { downloadTransactionsCsv } from "@/features/finance/export";
import { EmptyState } from "@/features/finance/empty-state";
import { createAccount, createCategory, fetchAccounts, fetchCategories } from "@/features/finance/finance-crud";
import { useRouter } from "next/navigation";
import { createFinanceTransaction, createTransfer, deleteFinanceTransaction, fetchFinanceData, updateFinanceTransaction } from "@/features/finance/finance-api";
import { fetchLoans } from "@/features/finance/loan-api";
import { fetchInvestments } from "@/features/finance/investment-api";
import { LoansView } from "@/features/finance/loans-view";
import { InvestmentsView } from "@/features/finance/investments-view";
import { filterTransactionsBySearch } from "@/features/finance/finance-service";
import type { Account, Category, Investment, Loan, Transaction, TransactionType } from "@/types/finance";
import { formatCurrency } from "@/utils/format";

const palette = ["#0f172a", "#2563eb", "#7c3aed", "#14b8a6", "#f59e0b"];

function isPositiveFlow(type: string): boolean {
  return ["income", "loan_borrow", "loan_receive_repayment", "investment_out"].includes(type);
}

function renderTransactionBadge(type: string) {
  switch (type) {
    case "transfer":
      return <span className="inline-flex items-center rounded-full bg-cyan-500/20 px-2 py-0.5 text-xs text-cyan-400 font-medium">Transfer</span>;
    case "loan_borrow":
      return <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400 font-medium">Loan Borrow</span>;
    case "loan_lend":
      return <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400 font-medium">Loan Lent</span>;
    case "loan_repayment":
      return <span className="inline-flex items-center rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400 font-medium">Loan Repayment</span>;
    case "loan_receive_repayment":
      return <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400 font-medium">Loan Repaid</span>;
    case "investment_in":
      return <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-400 font-medium">Deposit</span>;
    case "investment_out":
      return <span className="inline-flex items-center rounded-full bg-teal-500/20 px-2 py-0.5 text-xs text-teal-400 font-medium">Withdraw</span>;
    default:
      return null;
  }
}

export function FinanceShell() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [view, setView] = useState<"dashboard" | "transactions" | "accounts" | "categories" | "reports" | "settings" | "loans" | "investments">("dashboard");
  const [search, setSearch] = useState("");
  const [currency, setCurrency] = useState("BDT");
  const [darkMode, setDarkMode] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", type: "Bank", balance: 0 });
  const [categoryForm, setCategoryForm] = useState({ name: "", type: "expense" as TransactionType });
  const [typeFilter, setTypeFilter] = useState<TransactionType | "all">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState(emptyTransactionForm);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountForm, setEditAccountForm] = useState({ name: "", type: "Bank" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState<{ name: string; type: TransactionType }>({ name: "", type: "expense" });
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    charge: "",
    date: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [transferError, setTransferError] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("northstar-finance-state");
      } catch {}
    }
    setIsHydrated(true);

    void fetch("/api/finance/settings").then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data.currency) setCurrency(data.currency);
        if (data.theme) {
          const isDark = data.theme === "dark";
          setDarkMode(isDark);
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", isDark);
          }
        }
      }
    }).catch(() => {});

    void fetchFinanceData().then((response) => {
      setTransactions(response.transactions || []);
      setAccounts(response.accounts || []);
      setCategories(response.categories || []);
    });

    void fetchAccounts().then((nextAccounts) => {
      if (Array.isArray(nextAccounts)) {
        setAccounts(nextAccounts);
      }
    });

    void fetchCategories().then((nextCategories) => {
      if (Array.isArray(nextCategories)) {
        setCategories(nextCategories);
      }
    });

    void fetchLoans().then((nextLoans) => {
      if (Array.isArray(nextLoans)) {
        setLoans(nextLoans);
      }
    }).catch(() => {});

    void fetchInvestments().then((nextInvestments) => {
      if (Array.isArray(nextInvestments)) {
        setInvestments(nextInvestments);
      }
    }).catch(() => {});
  }, []);

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency);
    await fetch("/api/finance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: newCurrency }),
    }).catch(() => {});
  };

  const handleThemeChange = async (isDark: boolean) => {
    setDarkMode(isDark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", isDark);
    }
    await fetch("/api/finance/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: isDark ? "dark" : "light" }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (view === "dashboard" || view === "loans") {
      void fetchLoans().then((nextLoans) => Array.isArray(nextLoans) && setLoans(nextLoans)).catch(() => {});
    }
    if (view === "dashboard" || view === "investments") {
      void fetchInvestments().then((nextInvestments) => Array.isArray(nextInvestments) && setInvestments(nextInvestments)).catch(() => {});
    }
  }, [view]);

  const summary = useMemo(
    () => buildDashboardSummary(transactions, accounts, selectedMonth, loans, investments),
    [transactions, accounts, selectedMonth, loans, investments]
  );
  const filteredTransactions = useMemo(() => {
    return filterTransactionsBySearch(transactions, search, typeFilter, startDate, endDate, accountFilter);
  }, [transactions, search, typeFilter, startDate, endDate, accountFilter]);

  const ledgerMetrics = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const tx of filteredTransactions) {
      if (tx.type === "transfer") {
        if ((tx.charge ?? 0) > 0) {
          totalOutflow += tx.charge ?? 0;
        }
      } else if (isPositiveFlow(tx.type)) {
        if (tx.type === "loan_receive_repayment") {
          totalInflow += tx.interestAmount ?? tx.amount;
        } else {
          totalInflow += tx.amount;
        }
      } else {
        if (tx.type === "loan_repayment") {
          totalOutflow += tx.interestAmount ?? tx.amount;
        } else {
          totalOutflow += tx.amount;
        }
      }
    }

    return {
      count: filteredTransactions.length,
      inflow: Math.round(totalInflow * 100) / 100,
      outflow: Math.round(totalOutflow * 100) / 100,
      net: Math.round((totalInflow - totalOutflow) * 100) / 100,
    };
  }, [filteredTransactions]);

  const setQuickDateRange = (preset: "all" | "this_month" | "last_30_days" | "this_year") => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "this_month") {
      const firstDay = `${todayStr.slice(0, 7)}-01`;
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === "last_30_days") {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      setStartDate(thirtyDaysAgo.toISOString().slice(0, 10));
      setEndDate(todayStr);
    } else if (preset === "this_year") {
      const firstDayOfYear = `${today.getFullYear()}-01-01`;
      setStartDate(firstDayOfYear);
      setEndDate(todayStr);
    }
  };

  const hasActiveFilters = Boolean(
    search || typeFilter !== "all" || startDate || endDate || accountFilter !== "all"
  );

  const clearAllFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStartDate("");
    setEndDate("");
    setAccountFilter("all");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedCategory = categories.find((item) => item.id === form.categoryId);
    const selectedAccount = accounts.find((item) => item.id === form.accountId);
    const transactionDraft = createTransactionFromForm(
      form,
      selectedCategory?.name ?? form.category,
      selectedAccount?.name ?? form.account,
    );
    const next = { ...transactionDraft, id: editingTransactionId ?? transactionDraft.id };

    if (editingTransactionId) {
      try {
        const updated = await updateFinanceTransaction({
          ...next,
          categoryId: form.categoryId || undefined,
          accountId: form.accountId || undefined,
        });
        setTransactions((current) => current.map((item) => (item.id === editingTransactionId ? {
          ...item,
          ...updated,
          category: updated.category ?? item.category,
          account: updated.account ?? item.account,
        } : item)));
      } catch {
        // Keep the local fallback behavior if the API is unavailable.
      }
    } else {
      setTransactions((current) => [next, ...current]);
      try {
        await createFinanceTransaction({
          ...next,
          categoryId: form.categoryId || undefined,
          accountId: form.accountId || undefined,
        });
      } catch {
        // Keep the local fallback behavior if the API is unavailable.
      }
    }

    setEditingTransactionId(null);
    setIsAddTxOpen(false);
    setForm({ ...emptyTransactionForm, date: new Date().toISOString().slice(0, 10) });
  };

  const handleTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTransferError(null);
    const amount = Number(transferForm.amount);
    const charge = transferForm.charge ? Number(transferForm.charge) : 0;
    if (!transferForm.fromAccountId || !transferForm.toAccountId) {
      setTransferError("Please select both source and destination accounts.");
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      setTransferError("Source and destination accounts must be different.");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      setTransferError("Transfer amount must be greater than zero.");
      return;
    }
    if (isNaN(charge) || charge < 0) {
      setTransferError("Transfer charge cannot be negative.");
      return;
    }
    const fromAcc = accounts.find((a) => a.id === transferForm.fromAccountId);
    const totalDeduction = amount + charge;
    if (fromAcc && fromAcc.balance < totalDeduction) {
      setTransferError(
        `Insufficient balance in ${fromAcc.name} (${formatCurrency(fromAcc.balance, currency)} available, requested ${formatCurrency(amount, currency)}${charge > 0 ? ` + ${formatCurrency(charge, currency)} charge` : ""}).`
      );
      return;
    }

    setIsTransferring(true);
    try {
      const created = await createTransfer({
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount,
        charge,
        date: transferForm.date,
        notes: transferForm.notes || undefined,
      });

      setTransactions((current) => [created, ...current]);
      setAccounts((current) =>
        current.map((acc) => {
          if (acc.id === transferForm.fromAccountId) {
            return { ...acc, balance: acc.balance - totalDeduction };
          }
          if (acc.id === transferForm.toAccountId) {
            return { ...acc, balance: acc.balance + amount };
          }
          return acc;
        })
      );

      setTransferForm({
        fromAccountId: "",
        toAccountId: "",
        amount: "",
        charge: "",
        date: new Date().toISOString().slice(0, 10),
        notes: "",
      });
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : "Failed to transfer funds");
    } finally {
      setIsTransferring(false);
    }
  };

  const initiateTransferFromAccount = (accountId: string) => {
    setView("accounts");
    setTransferForm((prev) => ({
      ...prev,
      fromAccountId: accountId,
    }));
    setTimeout(() => {
      const transferCard = document.getElementById("transfer-funds-card");
      if (transferCard) {
        transferCard.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const removeTransaction = async (id: string) => {
    const target = transactions.find((item) => item.id === id);
    setTransactions((current) => current.filter((item) => item.id !== id));
    if (target && target.type === "transfer") {
      const charge = target.charge ?? 0;
      setAccounts((current) =>
        current.map((acc) => {
          if (acc.name === target.account || acc.id === target.accountId) {
            return { ...acc, balance: acc.balance + target.amount + charge };
          }
          if (acc.name === target.toAccount || acc.id === target.toAccountId) {
            return { ...acc, balance: acc.balance - target.amount };
          }
          return acc;
        })
      );
    }
    try {
      await deleteFinanceTransaction(id);
      const data = await fetchFinanceData();
      if (data.accounts) setAccounts(data.accounts);
    } catch {
      // Keep the local fallback behavior if the API is unavailable.
    }
  };

  const startEditingTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
    setIsAddTxOpen(true);
    setForm({
      title: transaction.title,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      account: transaction.account,
      date: transaction.date,
      notes: transaction.notes ?? "",
      categoryId: categories.find((item) => item.name === transaction.category)?.id ?? "",
      accountId: accounts.find((item) => item.name === transaction.account)?.id ?? "",
    });
  };

  const cancelEditingTransaction = () => {
    setEditingTransactionId(null);
    setIsAddTxOpen(false);
    setForm({ ...emptyTransactionForm, date: new Date().toISOString().slice(0, 10) });
  };

  const handleCreateAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAccount = await createAccount({
      name: accountForm.name,
      type: accountForm.type,
      balance: accountForm.balance,
    });
    setAccounts((current) => [...current, nextAccount]);
    setAccountForm({ name: "", type: "Bank", balance: 0 });
  };

  const handleCreateCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextCategory = await createCategory({
      name: categoryForm.name,
      type: categoryForm.type,
    });
    setCategories((current) => [...current, nextCategory]);
    setCategoryForm({ name: "", type: "expense" });
  };

  const startEditingAccount = (account: Account) => {
    setEditingAccountId(account.id);
    setEditAccountForm({ name: account.name, type: account.type });
  };

  const cancelEditingAccount = () => {
    setEditingAccountId(null);
    setEditAccountForm({ name: "", type: "Bank" });
  };

  const handleSaveEditAccount = async (event: React.FormEvent<HTMLFormElement>, accountId: string) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/finance/accounts/${accountId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editAccountForm.name, type: editAccountForm.type }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update account");
      }
      const updated = await response.json();
      setAccounts((current) => current.map((item) => item.id === accountId ? { ...item, ...updated } : item));
      setEditingAccountId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update account");
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    try {
      const response = await fetch(`/api/finance/accounts/${accountId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to delete account");
      }
      setAccounts((current) => current.filter((item) => item.id !== accountId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete account");
    }
  };

  const startEditingCategory = (category: Category) => {
    setEditingCategoryId(category.id);
    setEditCategoryForm({ name: category.name, type: category.type as TransactionType });
  };

  const cancelEditingCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryForm({ name: "", type: "expense" });
  };

  const handleSaveEditCategory = async (event: React.FormEvent<HTMLFormElement>, categoryId: string) => {
    event.preventDefault();
    try {
      const response = await fetch(`/api/finance/categories/${categoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editCategoryForm.name, type: editCategoryForm.type }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to update category");
      }
      const updated = await response.json();
      setCategories((current) => current.map((item) => item.id === categoryId ? { ...item, ...updated } : item));
      setEditingCategoryId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update category");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const response = await fetch(`/api/finance/categories/${categoryId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to delete category");
      }
      setCategories((current) => current.filter((item) => item.id !== categoryId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete category");
    }
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-[24px] border border-[#2f463f] bg-[#101b18]/70 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-[#7c9189]">Monthly view</p>
          <p className="text-lg font-semibold">Income and expenses for {selectedMonth}</p>
        </div>
        <Input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="max-w-[220px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total Balance", value: formatCurrency(summary.totalBalance, currency), icon: Landmark },
          { label: "Monthly Income", value: formatCurrency(summary.monthlyIncome, currency), icon: Wallet },
          { label: "Monthly Expenses", value: formatCurrency(summary.monthlyExpenses, currency), icon: CreditCard },
          { label: "Savings Rate", value: `${summary.savingsRate.toFixed(1)}%`, icon: PiggyBank },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between py-5">
              <div>
                <p className="text-sm text-[#7c9189]">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
              <div className="rounded-2xl bg-[#1b2b24] p-3">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Outstanding Borrowed", value: formatCurrency(summary.outstandingBorrowed, currency), icon: Landmark },
          { label: "Outstanding Lent", value: formatCurrency(summary.outstandingLent, currency), icon: Wallet },
          { label: "Open Loans", value: String(summary.openLoansCount), icon: BriefcaseBusiness },
          { label: "Net Invested", value: formatCurrency(summary.netInvested, currency), icon: PiggyBank },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between py-5">
              <div>
                <p className="text-sm text-[#7c9189]">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
              </div>
              <div className="rounded-2xl bg-[#1b2b24] p-3">
                <item.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.incomeVsExpense}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), currency)} />
                  <Bar dataKey="income" fill="#2563eb" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="expense" fill="#0f172a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={summary.expenseByCategory} dataKey="value" nameKey="name" outerRadius={90}>
                    {summary.expenseByCategory.map((entry, index) => (
                      <Cell key={entry.name} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0), currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {transactions.length === 0 ? (
          <EmptyState />
        ) : (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Transactions</CardTitle>
              <Button type="button" onClick={() => setView("transactions")} className="gap-2">
                <Plus className="h-4 w-4" /> Manage
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {summary.recentTransactions.map((transaction) => {
                  const isTransfer = transaction.type === "transfer";
                  const positive = isPositiveFlow(transaction.type);
                  return (
                    <div key={transaction.id} className="flex items-center justify-between rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{transaction.title}</p>
                          {renderTransactionBadge(transaction.type)}
                        </div>
                        <p className="text-sm text-[#7c9189]">
                          {isTransfer && transaction.toAccount
                            ? `${transaction.account} ➔ ${transaction.toAccount}`
                            : (transaction.category || transaction.account)} • {transaction.date}
                          {isTransfer && transaction.charge && transaction.charge > 0 ? (
                            <span className="text-amber-400"> (Fee: {formatCurrency(transaction.charge, currency)})</span>
                          ) : null}
                        </p>
                        {transaction.notes ? (
                          <p className="mt-1 text-xs text-[#8ca39b] dark:text-[#7c9189] flex items-center gap-1.5">
                            <FileText className="h-3 w-3 shrink-0 text-[#52796f]" />
                            <span className="line-clamp-1">{transaction.notes}</span>
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className={isTransfer ? "font-semibold text-cyan-400" : positive ? "font-semibold text-[#3fe0a5]" : "font-semibold text-[#F2545B]"}>
                          {isTransfer ? "" : positive ? "+" : "-"}{formatCurrency(transaction.amount, currency)}
                        </p>
                        <p className="text-sm text-[#7c9189]">
                          {isTransfer && transaction.toAccount ? `${transaction.account} ➔ ${transaction.toAccount}` : transaction.account}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((account) => (
              <div key={account.id} className="flex items-center justify-between rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
                <div>
                  <p className="font-medium">{account.name}</p>
                  <p className="text-sm text-[#7c9189]">{account.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{formatCurrency(account.balance, currency)}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => initiateTransferFromAccount(account.id)}
                  >
                    Transfer
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setView("accounts");
                      startEditingAccount(account);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-rose-400 hover:text-rose-300"
                    onClick={() => void handleDeleteAccount(account.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">Transaction Ledger</h2>
          <p className="text-sm text-[#7c9189]">
            Record, audit, and filter all account inflows, outflows, and transfers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => downloadTransactionsCsv(filteredTransactions)}
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (isAddTxOpen && editingTransactionId) {
                cancelEditingTransaction();
              } else {
                setIsAddTxOpen((prev) => !prev);
              }
            }}
            className="gap-2"
          >
            {isAddTxOpen ? (
              <>
                <ChevronUp className="h-4 w-4" /> Hide Form
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" /> Add Transaction
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 2. Ledger KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#7c9189]">Transactions</p>
          <p className="mt-1 text-2xl font-bold text-slate-100">{ledgerMetrics.count}</p>
          <p className="text-xs text-[#52796f]">
            {ledgerMetrics.count === transactions.length ? "All records" : `Filtered from ${transactions.length}`}
          </p>
        </div>
        <div className="rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#7c9189]">Total Inflow</p>
          <p className="mt-1 text-2xl font-bold text-[#3fe0a5]">+{formatCurrency(ledgerMetrics.inflow, currency)}</p>
          <p className="text-xs text-[#52796f]">Credits & Income</p>
        </div>
        <div className="rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#7c9189]">Total Outflow</p>
          <p className="mt-1 text-2xl font-bold text-[#F2545B]">-{formatCurrency(ledgerMetrics.outflow, currency)}</p>
          <p className="text-xs text-[#52796f]">Expenses & Fees</p>
        </div>
        <div className="rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#7c9189]">Net Ledger Flow</p>
          <p className={`mt-1 text-2xl font-bold ${ledgerMetrics.net >= 0 ? "text-[#3fe0a5]" : "text-[#F2545B]"}`}>
            {ledgerMetrics.net >= 0 ? "+" : ""}{formatCurrency(ledgerMetrics.net, currency)}
          </p>
          <p className="text-xs text-[#52796f]">Inflow - Outflow</p>
        </div>
      </div>

      {/* 3. Collapsible Add / Edit Transaction Form */}
      {isAddTxOpen && (
        <Card className="border-emerald-500/30 bg-[#12231e]/90 shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">
              {editingTransactionId ? "Edit Transaction" : "New Transaction Entry"}
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              onClick={cancelEditingTransaction}
              className="h-8 w-8 p-0 text-[#7c9189] hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-[#7c9189]">Title / Description</label>
                <Input
                  placeholder="e.g. Grocery Store, Client Payment"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7c9189]">Amount</label>
                <Input
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(event) => setForm({ ...form, amount: event.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7c9189]">Type</label>
                <Select
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value as TransactionType })}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7c9189]">Date</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7c9189]">Category</label>
                <Select
                  value={form.categoryId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      categoryId: event.target.value,
                      category: categories.find((item) => item.id === event.target.value)?.name ?? "",
                    })
                  }
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#7c9189]">Account</label>
                <Select
                  value={form.accountId}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      accountId: event.target.value,
                      account: accounts.find((item) => item.id === event.target.value)?.name ?? "",
                    })
                  }
                >
                  <option value="">Select account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({formatCurrency(account.balance, currency)})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-[#7c9189]">Notes / Memo (optional)</label>
                <Textarea
                  placeholder="Add notes, tags, or details..."
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  className="h-10 min-h-[40px] resize-none"
                />
              </div>
              <div className="flex gap-2 md:col-span-2 lg:col-span-4 justify-end pt-2">
                {editingTransactionId ? (
                  <Button type="button" variant="outline" onClick={cancelEditingTransaction}>
                    Cancel
                  </Button>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setIsAddTxOpen(false)}>
                    Close
                  </Button>
                )}
                <Button type="submit">
                  {editingTransactionId ? "Update Transaction" : "Save Transaction"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 4. Filter & Date Range Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#7c9189]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, notes, category..."
                className="pl-9 pr-8"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2.5 text-[#7c9189] hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            {/* Type Filter */}
            <Select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TransactionType | "all")}
            >
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
              <option value="transfer">Transfers</option>
              <option value="loan_borrow">Loan Borrow</option>
              <option value="loan_repayment">Loan Repayment</option>
              <option value="loan_lend">Loan Lend</option>
              <option value="loan_receive_repayment">Loan Repaid</option>
              <option value="investment_in">Investment Deposit</option>
              <option value="investment_out">Investment Withdraw</option>
            </Select>

            {/* Account Filter */}
            <Select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
            >
              <option value="all">All Accounts</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </Select>

            {/* Reset Filters */}
            <div className="flex items-center gap-2">
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllFilters}
                  className="w-full gap-2 border-[#2f463f] text-[#7c9189] hover:text-slate-100 h-9 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
                </Button>
              ) : (
                <div className="hidden lg:flex items-center text-xs text-[#52796f]">
                  All active filters clear
                </div>
              )}
            </div>
          </div>

          {/* Date Range Filtering (From Date & To Date) */}
          <div className="flex flex-col gap-3 pt-2 border-t border-[#23352f]/60 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#7c9189] flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#52796f]" /> From:
                </span>
                <div className="relative">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 w-40 text-xs"
                  />
                  {startDate && (
                    <button
                      type="button"
                      onClick={() => setStartDate("")}
                      className="absolute right-7 top-2.5 text-[#7c9189] hover:text-slate-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[#7c9189] flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-[#52796f]" /> To:
                </span>
                <div className="relative">
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 w-40 text-xs"
                  />
                  {endDate && (
                    <button
                      type="button"
                      onClick={() => setEndDate("")}
                      className="absolute right-7 top-2.5 text-[#7c9189] hover:text-slate-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#7c9189] mr-1">Quick ranges:</span>
              <button
                type="button"
                onClick={() => setQuickDateRange("this_month")}
                className="rounded-lg border border-[#2f463f] bg-[#101b18] px-2.5 py-1 text-xs text-[#a7b5af] hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setQuickDateRange("last_30_days")}
                className="rounded-lg border border-[#2f463f] bg-[#101b18] px-2.5 py-1 text-xs text-[#a7b5af] hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                onClick={() => setQuickDateRange("this_year")}
                className="rounded-lg border border-[#2f463f] bg-[#101b18] px-2.5 py-1 text-xs text-[#a7b5af] hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
              >
                This Year
              </button>
              <button
                type="button"
                onClick={() => setQuickDateRange("all")}
                className="rounded-lg border border-[#2f463f] bg-[#101b18] px-2.5 py-1 text-xs text-[#a7b5af] hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
              >
                All Time
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Transactions Ledger Presentation */}
      <Card>
        <CardContent className="p-0 sm:p-2">
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="rounded-full bg-[#1b2b25] p-4 text-[#52796f]">
                <Search className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-100">No transactions found</h3>
              <p className="mt-1 max-w-sm text-sm text-[#7c9189]">
                {hasActiveFilters
                  ? "Try loosening your search terms or expanding your date range filters."
                  : "No transactions have been recorded yet. Click '+ Add Transaction' above to begin."}
              </p>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearAllFilters}
                  className="mt-4 gap-2 border-[#2f463f] h-9 text-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Clear All Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Ledger Table (md: and up) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#23352f] text-xs font-semibold uppercase tracking-wider text-[#7c9189]">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Description & Notes</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Category / Route</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#23352f]/60 text-sm">
                    {filteredTransactions.map((transaction) => {
                      const isTransfer = transaction.type === "transfer";
                      const positive = isPositiveFlow(transaction.type);
                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-[#12231e]/50 transition-colors group"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-[#a7b5af] whitespace-nowrap align-top">
                            {transaction.date}
                          </td>
                          <td className="py-3 px-4 align-top max-w-xs lg:max-w-md">
                            <p className="font-medium text-slate-100 leading-snug">
                              {transaction.title}
                            </p>
                            {/* Notes incorporated on the bottom of each transaction in small text */}
                            {transaction.notes ? (
                              <p className="mt-1 text-xs text-[#8ca39b] dark:text-[#7c9189] flex items-start gap-1.5 leading-relaxed">
                                <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#52796f]" />
                                <span className="break-words">{transaction.notes}</span>
                              </p>
                            ) : null}
                          </td>
                          <td className="py-3 px-4 align-top whitespace-nowrap">
                            {renderTransactionBadge(transaction.type)}
                          </td>
                          <td className="py-3 px-4 align-top whitespace-nowrap">
                            {isTransfer && transaction.toAccount ? (
                              <div>
                                <span className="text-xs font-medium text-cyan-300">
                                  {transaction.account} ➔ {transaction.toAccount}
                                </span>
                                {transaction.charge && transaction.charge > 0 ? (
                                  <p className="text-xs text-amber-400/90 font-mono">
                                    Fee: {formatCurrency(transaction.charge, currency)}
                                  </p>
                                ) : null}
                              </div>
                            ) : (
                              <div>
                                <p className="text-xs font-medium text-slate-200">
                                  {transaction.category || "Uncategorized"}
                                </p>
                                <p className="text-xs text-[#7c9189]">{transaction.account}</p>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                            <p
                              className={
                                isTransfer
                                  ? "font-semibold text-cyan-400 font-mono"
                                  : positive
                                  ? "font-semibold text-[#3fe0a5] font-mono"
                                  : "font-semibold text-[#F2545B] font-mono"
                              }
                            >
                              {isTransfer ? "" : positive ? "+" : "-"}
                              {formatCurrency(transaction.amount, currency)}
                            </p>
                          </td>
                          <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                type="button"
                                className="h-8 px-2 text-xs text-[#7c9189] hover:text-slate-100"
                                onClick={() => startEditingTransaction(transaction)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                type="button"
                                className="h-8 px-2 text-xs text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10"
                                onClick={() => removeTransaction(transaction.id)}
                              >
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Ledger Cards (< md) */}
              <div className="block md:hidden divide-y divide-[#23352f]/60">
                {filteredTransactions.map((transaction) => {
                  const isTransfer = transaction.type === "transfer";
                  const positive = isPositiveFlow(transaction.type);
                  return (
                    <div key={transaction.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-[#7c9189]">{transaction.date}</span>
                        {renderTransactionBadge(transaction.type)}
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-medium text-slate-100">{transaction.title}</p>
                        <p
                          className={
                            isTransfer
                              ? "font-semibold text-cyan-400 font-mono text-base shrink-0"
                              : positive
                              ? "font-semibold text-[#3fe0a5] font-mono text-base shrink-0"
                              : "font-semibold text-[#F2545B] font-mono text-base shrink-0"
                          }
                        >
                          {isTransfer ? "" : positive ? "+" : "-"}
                          {formatCurrency(transaction.amount, currency)}
                        </p>
                      </div>

                      <div className="text-xs text-[#7c9189]">
                        {isTransfer && transaction.toAccount ? (
                          <span className="font-medium text-cyan-300">
                            {transaction.account} ➔ {transaction.toAccount}
                          </span>
                        ) : (
                          <span>
                            {transaction.category ? `${transaction.category} • ` : ""}
                            {transaction.account}
                          </span>
                        )}
                        {isTransfer && transaction.charge && transaction.charge > 0 ? (
                          <span className="text-amber-400 ml-2 font-mono">
                            (Fee: {formatCurrency(transaction.charge, currency)})
                          </span>
                        ) : null}
                      </div>

                      {/* Notes incorporated on the bottom of each transaction in small text */}
                      {transaction.notes ? (
                        <div className="mt-2 pt-2 border-t border-[#23352f]/50 text-xs text-[#8ca39b] dark:text-[#7c9189] flex items-start gap-1.5">
                          <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#52796f]" />
                          <span className="break-words">{transaction.notes}</span>
                        </div>
                      ) : null}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          variant="ghost"
                          type="button"
                          className="h-7 text-xs text-[#7c9189] hover:text-slate-100"
                          onClick={() => startEditingTransaction(transaction)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          className="h-7 text-xs text-rose-400 hover:text-rose-300"
                          onClick={() => removeTransaction(transaction.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAccounts = () => (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Add account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAccount} className="grid gap-3 sm:grid-cols-3">
              <Input placeholder="Name" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} required />
              <Input placeholder="Type" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })} required />
              <Input type="number" placeholder="Balance" value={accountForm.balance} onChange={(event) => setAccountForm({ ...accountForm, balance: Number(event.target.value) })} required />
              <Button type="submit" className="sm:col-span-3">Create account</Button>
            </form>
          </CardContent>
        </Card>

        <Card id="transfer-funds-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-cyan-400" />
              Transfer between accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTransfer} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[#7c9189] mb-1 block">From Account</label>
                  <Select
                    value={transferForm.fromAccountId}
                    onChange={(event) => setTransferForm({ ...transferForm, fromAccountId: event.target.value })}
                    required
                  >
                    <option value="">Select source account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({formatCurrency(account.balance, currency)})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-[#7c9189] mb-1 block">To Account</label>
                  <Select
                    value={transferForm.toAccountId}
                    onChange={(event) => setTransferForm({ ...transferForm, toAccountId: event.target.value })}
                    required
                  >
                    <option value="">Select destination account</option>
                    {accounts
                      .filter((account) => account.id !== transferForm.fromAccountId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({formatCurrency(account.balance, currency)})
                        </option>
                      ))}
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs text-[#7c9189] mb-1 block">Amount</label>
                  <Input
                    type="number"
                    step="any"
                    min="0.01"
                    placeholder="0.00"
                    value={transferForm.amount}
                    onChange={(event) => setTransferForm({ ...transferForm, amount: event.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-[#7c9189] mb-1 block">Charge / Fee (optional)</label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={transferForm.charge}
                    onChange={(event) => setTransferForm({ ...transferForm, charge: event.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-[#7c9189] mb-1 block">Date</label>
                  <Input
                    type="date"
                    value={transferForm.date}
                    onChange={(event) => setTransferForm({ ...transferForm, date: event.target.value })}
                    required
                  />
                </div>
              </div>
              {Number(transferForm.amount) > 0 && (
                <p className="text-xs text-[#7c9189]">
                  Total deducted from source:{" "}
                  <span className="font-semibold text-rose-400">
                    {formatCurrency(Number(transferForm.amount) + (Number(transferForm.charge) || 0), currency)}
                  </span>
                  {Number(transferForm.charge) > 0 ? ` (${formatCurrency(Number(transferForm.amount), currency)} transfer + ${formatCurrency(Number(transferForm.charge), currency)} fee)` : ""}
                </p>
              )}
              <Input
                placeholder="Notes (optional, e.g. Monthly savings contribution)"
                value={transferForm.notes}
                onChange={(event) => setTransferForm({ ...transferForm, notes: event.target.value })}
              />
              {transferError && (
                <p className="text-sm text-rose-400 font-medium">{transferError}</p>
              )}
              <Button type="submit" disabled={isTransferring || accounts.length < 2} className="w-full">
                {isTransferring ? "Transferring..." : "Transfer Funds"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {accounts.map((account) => (
          <Card key={account.id}>
            {editingAccountId === account.id ? (
              <form onSubmit={(event) => void handleSaveEditAccount(event, account.id)} className="p-5 space-y-3">
                <CardTitle className="text-base">Edit Account</CardTitle>
                <div className="grid gap-2">
                  <Input
                    placeholder="Account name"
                    value={editAccountForm.name}
                    onChange={(event) => setEditAccountForm({ ...editAccountForm, name: event.target.value })}
                    required
                  />
                  <Input
                    placeholder="Account type (e.g. Bank, Wallet)"
                    value={editAccountForm.type}
                    onChange={(event) => setEditAccountForm({ ...editAccountForm, type: event.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={cancelEditingAccount}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            ) : (
              <>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{account.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => initiateTransferFromAccount(account.id)}>
                      Transfer
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => startEditingAccount(account)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-400 hover:text-rose-300"
                      onClick={() => void handleDeleteAccount(account.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-[#7c9189]">{account.type}</p>
                  <p className="text-2xl font-semibold">{formatCurrency(account.balance, currency)}</p>
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );

  const renderCategories = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateCategory} className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Name" value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required />
            <Select value={categoryForm.type} onChange={(event) => setCategoryForm({ ...categoryForm, type: event.target.value as TransactionType })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
            <Button type="submit">Create category</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        {categories.map((category) => (
          <Card key={category.id}>
            {editingCategoryId === category.id ? (
              <form onSubmit={(event) => void handleSaveEditCategory(event, category.id)} className="p-5 space-y-3">
                <CardTitle className="text-base">Edit Category</CardTitle>
                <div className="grid gap-2">
                  <Input
                    placeholder="Category name"
                    value={editCategoryForm.name}
                    onChange={(event) => setEditCategoryForm({ ...editCategoryForm, name: event.target.value })}
                    required
                  />
                  <Select
                    value={editCategoryForm.type}
                    onChange={(event) => setEditCategoryForm({ ...editCategoryForm, type: event.target.value as TransactionType })}
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </Select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={cancelEditingCategory}>
                    Cancel
                  </Button>
                  <Button type="submit">Save</Button>
                </div>
              </form>
            ) : (
              <>
                <CardHeader>
                  <CardTitle>{category.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="inline-flex rounded-full bg-[#1b2b24] px-3 py-1 text-sm">
                    {category.type}
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => startEditingCategory(category)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-400 hover:text-rose-300"
                      onClick={() => void handleDeleteCategory(category.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        ))}
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-2xl bg-[#1b2b24] p-4">
            <p className="text-sm text-[#7c9189]">Net savings</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.monthlyIncome - summary.monthlyExpenses, currency)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-[#7c9189]">Income</p>
              <p className="mt-1 font-semibold">{formatCurrency(summary.monthlyIncome, currency)}</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="text-sm text-[#7c9189]">Expenses</p>
              <p className="mt-1 font-semibold">{formatCurrency(summary.monthlyExpenses, currency)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Category Spending</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {summary.expenseByCategory.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between rounded-xl bg-[#1b2b24] p-3">
                <span>{entry.name}</span>
                <span className="font-semibold">{formatCurrency(entry.value, currency)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Trend Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-500">Tracked entries</p>
            <p className="mt-2 text-3xl font-semibold">{transactions.length}</p>
            <p className="mt-2 text-sm text-[#7c9189]">Your current cash flow remains healthy with {summary.savingsRate.toFixed(1)}% savings rate.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSettings = () => (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-[#dce5e1]">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="font-medium text-white">Currency</span>
            <Select value={currency} onChange={(event) => void handleCurrencyChange(event.target.value)}>
              <option value="BDT">BDT (৳)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </Select>
          </label>
          <label className="space-y-2">
            <span className="font-medium text-white">Dark mode</span>
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <Switch checked={darkMode} onChange={(event) => void handleThemeChange(event.target.checked)} />
              <span>{darkMode ? "Enabled" : "Disabled"}</span>
            </div>
          </label>
        </div>
        <Button type="button" onClick={() => downloadTransactionsCsv(transactions)}>
          Export transactions as CSV
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.15),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(20,184,166,0.15),_transparent_30%)] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-[32px] border border-[#2f463f] bg-[#101b18]/90 p-6 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.25em] text-[#7c9189]">Personal Finance</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">The Ace Finance</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#dce5e1]">
              Track your fiances, manage your accounts, and gain insights into your spending habits with ease.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["dashboard", "Overview"],
              ["transactions", "Transactions"],
              ["accounts", "Accounts"],
              ["categories", "Categories"],
              ["loans", "Loans"],
              ["investments", "Investments"],
              ["reports", "Reports"],
              ["settings", "Settings"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key as typeof view)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${view === key ? "bg-[#3fe0a5] text-[#101b18]" : "bg-[#1b2b24] text-white hover:bg-[#22332d]"}`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/login" })}
              className="rounded-full border border-[#2f463f] bg-[#1b2b24] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#22332d]"
            >
              Logout
            </button>
          </div>
        </header>

        <main>
          {view === "dashboard" && renderDashboard()}
          {view === "transactions" && renderTransactions()}
          {view === "accounts" && renderAccounts()}
          {view === "categories" && renderCategories()}
          {view === "loans" && <LoansView accounts={accounts} />}
          {view === "investments" && <InvestmentsView accounts={accounts} />}
          {view === "reports" && renderReports()}
          {view === "settings" && renderSettings()}
        </main>
      </div>
    </div>
  );
}
