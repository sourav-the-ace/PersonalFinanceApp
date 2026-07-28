import type { Account, Category, Transaction } from "@/types/finance";

export async function fetchAccounts() {
  const response = await fetch("/api/finance/accounts", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load accounts");
  }
  return response.json() as Promise<Account[]>;
}

export async function createAccount(payload: Omit<Account, "id">) {
  const response = await fetch("/api/finance/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to create account");
  }
  return response.json() as Promise<Account>;
}

export async function fetchCategories() {
  const response = await fetch("/api/finance/categories", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load categories");
  }
  return response.json() as Promise<Category[]>;
}

export async function createCategory(payload: Omit<Category, "id">) {
  const response = await fetch("/api/finance/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error("Failed to create category");
  }
  return response.json() as Promise<Category>;
}

export async function updateTransaction(payload: Transaction) {
  return payload;
}
