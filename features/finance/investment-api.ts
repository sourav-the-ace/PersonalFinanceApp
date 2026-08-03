import type { EntityStatus, Investment, Transaction } from "@/types/finance";

type InvestmentPayload = {
  name: string;
  assetType: string;
  institution?: string;
  notes?: string;
};

type InvestmentUpdatePayload = Partial<InvestmentPayload> & { status?: EntityStatus };

type InvestmentTransactionPayload = {
  type: "investment_in" | "investment_out";
  title: string;
  amount: number;
  accountId: string;
  date: string;
  notes?: string;
};

export async function fetchInvestments() {
  const response = await fetch("/api/finance/investments", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load investments");
  }
  return response.json() as Promise<Investment[]>;
}

export async function createInvestment(payload: InvestmentPayload) {
  const response = await fetch("/api/finance/investments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to create investment");
  }
  return response.json() as Promise<Investment>;
}

export async function fetchInvestment(id: string) {
  const response = await fetch(`/api/finance/investments/${id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load investment");
  }
  return response.json() as Promise<{ investment: Investment; transactions: Transaction[] }>;
}

export async function updateInvestment(id: string, payload: InvestmentUpdatePayload) {
  const response = await fetch(`/api/finance/investments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to update investment");
  }
  return response.json() as Promise<Investment>;
}

export async function createInvestmentTransaction(id: string, payload: InvestmentTransactionPayload) {
  const response = await fetch(`/api/finance/investments/${id}/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to create investment transaction");
  }
  return response.json() as Promise<Transaction>;
}
