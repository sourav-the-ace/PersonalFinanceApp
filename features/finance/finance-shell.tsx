"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { BriefcaseBusiness, CreditCard, Landmark, PiggyBank, Plus, Search, Wallet } from "lucide-react";
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
import { createFinanceTransaction, deleteFinanceTransaction, fetchFinanceData, updateFinanceTransaction } from "@/features/finance/finance-api";
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
    case "loan_borrow":
      return <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400 font-medium">Loan Borrow</span>;
    case "loan_lend":
      return <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400 font-medium">Loan Lent</span>;
    case "loan_repayment":
      return <span className="inline-flex items-center rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400 font-medium">Loan Repayment</span>;
    case "loan_receive_repayment":
      return <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400 font-medium">Loan Repaid</span>;
    case "investment_in":
      return <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-400 font-medium">Investment In</span>;
    case "investment_out":
      return <span className="inline-flex items-center rounded-full bg-teal-500/20 px-2 py-0.5 text-xs text-teal-400 font-medium">Investment Out</span>;
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
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [form, setForm] = useState(emptyTransactionForm);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountForm, setEditAccountForm] = useState({ name: "", type: "Bank" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryForm, setEditCategoryForm] = useState<{ name: string; type: TransactionType }>({ name: "", type: "expense" });
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
    return filterTransactionsBySearch(transactions, search, typeFilter);
  }, [transactions, search, typeFilter]);

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
    setForm({ ...emptyTransactionForm, date: new Date().toISOString().slice(0, 10) });
  };

  const removeTransaction = async (id: string) => {
    setTransactions((current) => current.filter((item) => item.id !== id));
    try {
      await deleteFinanceTransaction(id);
    } catch {
      // Keep the local fallback behavior if the API is unavailable.
    }
  };

  const startEditingTransaction = (transaction: Transaction) => {
    setEditingTransactionId(transaction.id);
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
                  const positive = isPositiveFlow(transaction.type);
                  return (
                    <div key={transaction.id} className="flex items-center justify-between rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{transaction.title}</p>
                          {renderTransactionBadge(transaction.type)}
                        </div>
                        <p className="text-sm text-[#7c9189]">{transaction.category || transaction.account} • {transaction.date}</p>
                      </div>
                      <div className="text-right">
                        <p className={positive ? "font-semibold text-[#3fe0a5]" : "font-semibold text-[#F2545B]"}>
                          {positive ? "+" : "-"}{formatCurrency(transaction.amount, currency)}
                        </p>
                        <p className="text-sm text-[#7c9189]">{transaction.account}</p>
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
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Transactions</CardTitle>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="flex items-center gap-2 rounded-xl border border-[#2f463f] bg-[#101b18]/70 px-3 py-2">
              <Search className="h-4 w-4 text-[#7c9189]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="border-0 bg-transparent p-0 shadow-none"
              />
            </label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TransactionType | "all")}
              className="rounded-xl border border-[#2f463f] bg-[#101b18] px-3 py-2 text-sm"
            >
              <option value="all">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
              <option value="loan_borrow">Loan Borrow</option>
              <option value="loan_repayment">Loan Repayment</option>
              <option value="loan_lend">Loan Lend</option>
              <option value="loan_receive_repayment">Loan Receive Repayment</option>
              <option value="investment_in">Investment In</option>
              <option value="investment_out">Investment Out</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="mb-6 grid gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:grid-cols-2 lg:grid-cols-4">
            <Input placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <Input type="number" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} required />
            <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as TransactionType })}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
            <Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required />
            <Select value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value, category: categories.find((item) => item.id === event.target.value)?.name ?? "" })}>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
            <Select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value, account: accounts.find((item) => item.id === event.target.value)?.name ?? "" })}>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
            <Textarea placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="md:col-span-2 lg:col-span-3" />
            <div className="flex gap-2 md:col-span-2 lg:col-span-1">
              <Button type="submit" className="h-10 flex-1">{editingTransactionId ? "Save" : "Add transaction"}</Button>
              {editingTransactionId ? (
                <Button type="button" variant="outline" className="h-10" onClick={cancelEditingTransaction}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </form>

          <div className="space-y-3">
            {filteredTransactions.map((transaction) => {
              const positive = isPositiveFlow(transaction.type);
              return (
                <div key={transaction.id} className="flex flex-col gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{transaction.title}</p>
                      {renderTransactionBadge(transaction.type)}
                    </div>
                    <p className="text-sm text-[#7c9189]">
                      {transaction.category ? `${transaction.category} • ` : ""}{transaction.account ? `${transaction.account} • ` : ""}{transaction.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className={positive ? "font-semibold text-[#3fe0a5]" : "font-semibold text-[#F2545B]"}>
                      {positive ? "+" : "-"}{formatCurrency(transaction.amount, currency)}
                    </p>
                    <Button variant="ghost" type="button" onClick={() => startEditingTransaction(transaction)}>
                      Edit
                    </Button>
                    <Button variant="ghost" type="button" className="text-rose-400 hover:text-rose-300" onClick={() => removeTransaction(transaction.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAccounts = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateAccount} className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Name" value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} required />
            <Input placeholder="Type" value={accountForm.type} onChange={(event) => setAccountForm({ ...accountForm, type: event.target.value })} required />
            <Input type="number" placeholder="Balance" value={accountForm.balance} onChange={(event) => setAccountForm({ ...accountForm, balance: Number(event.target.value) })} required />
            <Button type="submit" className="md:col-span-3">Create account</Button>
          </form>
        </CardContent>
      </Card>
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
