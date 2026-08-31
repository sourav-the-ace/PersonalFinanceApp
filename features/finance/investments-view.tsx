"use client";

import { useEffect, useState } from "react";
import { BriefcaseBusiness, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInvestment, createInvestmentTransaction, fetchInvestment, fetchInvestments } from "@/features/finance/investment-api";
import type { Account, Investment, Transaction } from "@/types/finance";
import { formatCurrency } from "@/utils/format";

type InvestmentsViewProps = {
  accounts: Account[];
};

export function InvestmentsView({ accounts }: InvestmentsViewProps) {
  const router = useRouter();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState({ name: "", assetType: "", institution: "", notes: "" });
  const [txForm, setTxForm] = useState({ type: "investment_in" as "investment_in" | "investment_out", title: "", amount: "", accountId: "", date: new Date().toISOString().slice(0, 10), notes: "" });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadInvestments();
  }, []);

  async function loadInvestments() {
    setLoading(true);
    try {
      const nextInvestments = await fetchInvestments();
      setInvestments(nextInvestments);
      if (!selectedInvestmentId && nextInvestments[0]) {
        setSelectedInvestmentId(nextInvestments[0].id);
      }
    } catch {
      // Gracefully handle load error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedInvestmentId) {
      return;
    }
    void loadSelectedInvestment(selectedInvestmentId);
  }, [selectedInvestmentId]);

  async function loadSelectedInvestment(investmentId: string) {
    try {
      const result = await fetchInvestment(investmentId);
      setSelectedInvestment(result.investment);
      setTransactions(result.transactions);
    } catch {
      // Gracefully handle load error
    }
  }

  useEffect(() => {
    if (accounts.length > 0 && !txForm.accountId) {
      setTxForm((prev) => ({ ...prev, accountId: accounts[0].id }));
    }
  }, [accounts, txForm.accountId]);

  async function handleCreateInvestment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createInvestment(form);
    const createdWithTotals: Investment = {
      ...created,
      totalInvested: created.totalInvested ?? 0,
      totalReturned: created.totalReturned ?? 0,
      netInvested: created.netInvested ?? 0,
      realizedPnL: created.realizedPnL ?? 0,
    };
    setInvestments((current) => [createdWithTotals, ...current]);
    setSelectedInvestmentId(created.id);
    setSelectedInvestment(createdWithTotals);
    setForm({ name: "", assetType: "", institution: "", notes: "" });
  }

  async function handleCreateTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvestmentId) return;
    if (!txForm.accountId) {
      alert("Please select an account for this transaction");
      return;
    }
    try {
      const created = await createInvestmentTransaction(selectedInvestmentId, { ...txForm, amount: Number(txForm.amount) });
      setTransactions((current) => [created, ...current]);
      setTxForm({ type: "investment_in", title: "", amount: "", accountId: txForm.accountId, date: new Date().toISOString().slice(0, 10), notes: "" });
      const refreshed = await fetchInvestment(selectedInvestmentId);
      setSelectedInvestment(refreshed.investment);
      const nextInvestments = await fetchInvestments();
      setInvestments(nextInvestments);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create investment transaction");
    }
  }

  async function handleDeleteInvestment() {
    if (!selectedInvestmentId) return;
    if (!confirm("Are you sure you want to delete this investment?")) return;
    try {
      const response = await fetch(`/api/finance/investments/${selectedInvestmentId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete investment");
      }
      setInvestments((current) => current.filter((investment) => investment.id !== selectedInvestmentId));
      setSelectedInvestmentId(null);
      setSelectedInvestment(null);
      setTransactions([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete investment");
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    if (!selectedInvestmentId) return;
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const response = await fetch(`/api/finance/investments/${selectedInvestmentId}/transactions/${transactionId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete transaction");
      }
      setTransactions((current) => current.filter((tx) => tx.id !== transactionId));
      const refreshed = await fetchInvestment(selectedInvestmentId);
      setSelectedInvestment(refreshed.investment);
      const nextInvestments = await fetchInvestments();
      setInvestments(nextInvestments);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete transaction");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Investments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateInvestment} className="grid gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:grid-cols-2">
            <Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <Input placeholder="Asset type" value={form.assetType} onChange={(event) => setForm({ ...form, assetType: event.target.value })} required />
            <Input placeholder="Institution" value={form.institution} onChange={(event) => setForm({ ...form, institution: event.target.value })} />
            <Textarea placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <Button type="submit" className="md:col-span-2">Create investment</Button>
          </form>
          {loading ? (
            <p className="text-sm text-[#7c9189]">Loading investments…</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {investments.map((investment) => (
                <button key={investment.id} type="button" onClick={() => setSelectedInvestmentId(investment.id)} className={`rounded-2xl border p-4 text-left ${selectedInvestmentId === investment.id ? "border-[#3fe0a5] bg-[#1b2b24]" : "border-[#2f463f] bg-[#101b18]/70"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{investment.name}</p>
                    <p className="text-sm text-[#7c9189]">{investment.assetType}</p>
                  </div>
                  <div className="rounded-full bg-[#22332d] p-2">
                    <BriefcaseBusiness className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-[#7c9189]">
                  <span>{investment.institution ?? "No institution"}</span>
                  <span>{investment.status}</span>
                </div>
                <p className="mt-3 font-semibold">Net invested: {formatCurrency(investment.netInvested)}</p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
      </Card>

      {selectedInvestment ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>{selectedInvestment.name}</CardTitle>
            <Button type="button" variant="outline" onClick={() => void handleDeleteInvestment()}>Delete investment</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:grid-cols-3">
              <div className="rounded-xl bg-[#1b2b24] p-3">
                <p className="text-sm text-[#7c9189]">Net invested</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(selectedInvestment.netInvested)}</p>
              </div>
              <div className="rounded-xl bg-[#1b2b24] p-3">
                <p className="text-sm text-[#7c9189]">Realized P/L</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(selectedInvestment.realizedPnL)}</p>
              </div>
              <div className="rounded-xl bg-[#1b2b24] p-3">
                <p className="text-sm text-[#7c9189]">Status</p>
                <p className="mt-1 text-xl font-semibold">{selectedInvestment.status}</p>
              </div>
            </div>

            <form onSubmit={handleCreateTransaction} className="grid gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:grid-cols-2">
              {accounts.length === 0 ? (
                <div className="md:col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
                  ⚠️ No accounts found. Please create an account in the <strong>Accounts</strong> tab before recording investment transactions.
                </div>
              ) : null}
              <Select value={txForm.type} onChange={(event) => setTxForm({ ...txForm, type: event.target.value as "investment_in" | "investment_out" })}>
                <option value="investment_in">Deposit (Invest money)</option>
                <option value="investment_out">Withdraw (Take returns / capital)</option>
              </Select>
              <Input placeholder="Title" value={txForm.title} onChange={(event) => setTxForm({ ...txForm, title: event.target.value })} required />
              <Input type="number" placeholder="Amount" value={txForm.amount} onChange={(event) => setTxForm({ ...txForm, amount: event.target.value })} required />
              <Select value={txForm.accountId} onChange={(event) => setTxForm({ ...txForm, accountId: event.target.value })} required>
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name} ({formatCurrency(account.balance)})</option>
                ))}
              </Select>
              <Input type="date" value={txForm.date} onChange={(event) => setTxForm({ ...txForm, date: event.target.value })} required />
              <Textarea placeholder="Notes" value={txForm.notes} onChange={(event) => setTxForm({ ...txForm, notes: event.target.value })} className="md:col-span-2" />
              <Button type="submit" className="md:col-span-2">Add transaction</Button>
            </form>

            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4">
                  <div>
                    <p className="font-medium">{transaction.title}</p>
                    <p className="text-sm text-[#7c9189]">{transaction.date}</p>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-semibold">{formatCurrency(transaction.amount)}</p>
                      <p className="text-sm text-[#7c9189]">{transaction.type === "investment_in" ? "Deposit" : "Withdraw"}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-rose-400 hover:text-rose-300"
                      onClick={() => void handleDeleteTransaction(transaction.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
