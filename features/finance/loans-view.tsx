"use client";

import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Landmark, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createLoan, createLoanTransaction, fetchLoan, fetchLoans, updateLoan } from "@/features/finance/loan-api";
import type { Account, Loan, LoanDirection, Transaction } from "@/types/finance";
import { formatCurrency } from "@/utils/format";

type LoansViewProps = {
  accounts: Account[];
};

export function LoansView({ accounts }: LoansViewProps) {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState({ title: "", direction: "borrowed" as LoanDirection, counterparty: "", notes: "" });
  const [txForm, setTxForm] = useState({ type: "loan_borrow" as "loan_borrow" | "loan_lend" | "loan_repayment" | "loan_receive_repayment", title: "", principalAmount: "", interestAmount: "", accountId: "", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadLoans();
  }, []);

  async function loadLoans() {
    setLoading(true);
    try {
      const nextLoans = await fetchLoans();
      setLoans(nextLoans);
      if (!selectedLoanId && nextLoans[0]) {
        setSelectedLoanId(nextLoans[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedLoanId) {
      return;
    }
    void loadSelectedLoan(selectedLoanId);
  }, [selectedLoanId]);

  async function loadSelectedLoan(loanId: string) {
    const result = await fetchLoan(loanId);
    setSelectedLoan(result.loan);
    setTransactions(result.transactions);
  }

  async function handleCreateLoan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const created = await createLoan(form);
    setLoans((current) => [created, ...current]);
    setSelectedLoanId(created.id);
    setForm({ title: "", direction: "borrowed", counterparty: "", notes: "" });
  }

  async function handleCreateTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLoanId) return;
    const payload = {
      ...txForm,
      principalAmount: txForm.principalAmount ? Number(txForm.principalAmount) : undefined,
      interestAmount: txForm.interestAmount ? Number(txForm.interestAmount) : undefined,
      accountId: txForm.accountId,
    };
    const created = await createLoanTransaction(selectedLoanId, payload as never);
    setTransactions((current) => [created, ...current]);
    setTxForm({ type: selectedLoan?.direction === "borrowed" ? "loan_borrow" : "loan_lend", title: "", principalAmount: "", interestAmount: "", accountId: "", date: new Date().toISOString().slice(0, 10), notes: "" });
    const nextLoans = await fetchLoans();
    setLoans(nextLoans);
    if (selectedLoan) {
      const refreshed = await fetchLoan(selectedLoanId);
      setSelectedLoan(refreshed.loan);
    }
  }

  async function handleCloseLoan() {
    if (!selectedLoanId) return;
    const updated = await updateLoan(selectedLoanId, { status: "closed" });
    setSelectedLoan(updated);
    const nextLoans = await fetchLoans();
    setLoans(nextLoans);
  }

  async function handleDeleteLoan() {
    if (!selectedLoanId) return;
    const response = await fetch(`/api/finance/loans/${selectedLoanId}`, { method: "DELETE" });
    if (response.ok) {
      setLoans((current) => current.filter((loan) => loan.id !== selectedLoanId));
      setSelectedLoanId(null);
      setSelectedLoan(null);
      setTransactions([]);
    }
  }

  const selectedLoanLabel = useMemo(() => selectedLoan?.direction === "borrowed" ? "borrowed" : "lent", [selectedLoan]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Loans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateLoan} className="grid gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:grid-cols-2">
            <Input placeholder="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <Select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as LoanDirection })}>
              <option value="borrowed">Borrowed</option>
              <option value="lent">Lent</option>
            </Select>
            <Input placeholder="Counterparty" value={form.counterparty} onChange={(event) => setForm({ ...form, counterparty: event.target.value })} />
            <Textarea placeholder="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
            <Button type="submit" className="md:col-span-2">Create loan</Button>
          </form>
          {loading ? <p className="text-sm text-[#7c9189]">Loading loans…</p> : (
            <div className="grid gap-3 md:grid-cols-2">
              {loans.map((loan) => (
                <button key={loan.id} type="button" onClick={() => setSelectedLoanId(loan.id)} className={`rounded-2xl border p-4 text-left ${selectedLoanId === loan.id ? "border-[#3fe0a5] bg-[#1b2b24]" : "border-[#2f463f] bg-[#101b18]/70"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{loan.title}</p>
                      <p className="text-sm text-[#7c9189]">{loan.counterparty ?? "No counterparty"}</p>
                    </div>
                    <div className="rounded-full bg-[#22332d] p-2">
                      <BriefcaseBusiness className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm text-[#7c9189]">
                    <span>{loan.direction}</span>
                    <span>{loan.status}</span>
                  </div>
                  <p className="mt-3 font-semibold">Outstanding: {formatCurrency(loan.outstanding)}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLoan ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{selectedLoan.title}</CardTitle>
              <p className="text-sm text-[#7c9189]">{selectedLoan.direction} • {selectedLoan.counterparty ?? "No counterparty"}</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCloseLoan}>Close loan</Button>
              <Button type="button" variant="outline" onClick={() => void handleDeleteLoan()}>Delete loan</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:grid-cols-2">
              <div className="rounded-xl bg-[#1b2b24] p-3">
                <p className="text-sm text-[#7c9189]">Outstanding</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(selectedLoan.outstanding)}</p>
              </div>
              <div className="rounded-xl bg-[#1b2b24] p-3">
                <p className="text-sm text-[#7c9189]">Status</p>
                <p className="mt-1 text-xl font-semibold">{selectedLoan.status}</p>
              </div>
            </div>

            <form onSubmit={handleCreateTransaction} className="grid gap-3 rounded-2xl border border-[#2f463f] bg-[#101b18]/70 p-4 md:grid-cols-2">
              <Select value={txForm.type} onChange={(event) => setTxForm({ ...txForm, type: event.target.value as "loan_borrow" | "loan_lend" | "loan_repayment" | "loan_receive_repayment" })}>
                <option value={selectedLoanLabel === "borrowed" ? "loan_borrow" : "loan_lend"}>{selectedLoanLabel === "borrowed" ? "Borrow" : "Lend"}</option>
                <option value={selectedLoanLabel === "borrowed" ? "loan_repayment" : "loan_receive_repayment"}>{selectedLoanLabel === "borrowed" ? "Repayment" : "Receive repayment"}</option>
              </Select>
              <Input placeholder="Title" value={txForm.title} onChange={(event) => setTxForm({ ...txForm, title: event.target.value })} required />
              {txForm.type.endsWith("repayment") ? (
                <>
                  <Input type="number" placeholder="Principal" value={txForm.principalAmount} onChange={(event) => setTxForm({ ...txForm, principalAmount: event.target.value })} required />
                  <Input type="number" placeholder="Interest (optional)" value={txForm.interestAmount} onChange={(event) => setTxForm({ ...txForm, interestAmount: event.target.value })} />
                </>
              ) : (
                <Input type="number" placeholder="Amount" value={txForm.principalAmount} onChange={(event) => setTxForm({ ...txForm, principalAmount: event.target.value })} required />
              )}
              <Select value={txForm.accountId} onChange={(event) => setTxForm({ ...txForm, accountId: event.target.value })}>
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
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
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(transaction.amount)}</p>
                    <p className="text-sm text-[#7c9189]">{transaction.type}</p>
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
