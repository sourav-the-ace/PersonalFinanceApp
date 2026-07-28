import type { Account, Category, Transaction } from "@/types/finance";

export async function fetchFinanceData() {
  try {
    const response = await fetch("/api/finance", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load finance data");
    }

    return (await response.json()) as {
      transactions: Transaction[];
      accounts: Account[];
      categories: Category[];
    };
  } catch {
    return { transactions: [], accounts: [], categories: [] };
  }
}

export async function createFinanceTransaction(payload: Partial<Transaction> & { categoryId?: string; accountId?: string }) {
  const response = await fetch("/api/finance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create transaction");
  }

  return response.json();
}

export async function updateFinanceTransaction(payload: { id: string } & Partial<Transaction> & { categoryId?: string; accountId?: string }) {
  const response = await fetch(`/api/finance/${payload.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update transaction");
  }

  return response.json();
}

export async function deleteFinanceTransaction(id: string) {
  const response = await fetch(`/api/finance/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to delete transaction");
  }

  return response.json();
}
