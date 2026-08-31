import type { EntityStatus, Loan, LoanDirection, Transaction } from "@/types/finance";

type LoanPayload = {
  title: string;
  direction: LoanDirection;
  counterparty?: string;
  notes?: string;
};

type LoanUpdatePayload = Partial<LoanPayload> & { status?: EntityStatus };

type LoanTransactionPayload = {
  type: "loan_borrow" | "loan_lend" | "loan_repayment" | "loan_receive_repayment";
  title: string;
  amount?: number;
  principalAmount?: number;
  interestAmount?: number;
  accountId: string;
  date: string;
  notes?: string;
};

export async function fetchLoans() {
  const response = await fetch("/api/finance/loans", { cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Failed to load loans");
  }
  return response.json() as Promise<Loan[]>;
}

export async function createLoan(payload: LoanPayload) {
  const response = await fetch("/api/finance/loans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Failed to create loan");
  }
  return response.json() as Promise<Loan>;
}

export async function fetchLoan(id: string) {
  const response = await fetch(`/api/finance/loans/${id}`, { cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Failed to load loan");
  }
  return response.json() as Promise<{ loan: Loan; transactions: Transaction[] }>;
}

export async function updateLoan(id: string, payload: LoanUpdatePayload) {
  const response = await fetch(`/api/finance/loans/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Failed to update loan");
  }
  return response.json() as Promise<Loan>;
}

export async function createLoanTransaction(id: string, payload: LoanTransactionPayload) {
  const response = await fetch(`/api/finance/loans/${id}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Failed to create loan transaction");
  }
  return response.json() as Promise<Transaction>;
}
