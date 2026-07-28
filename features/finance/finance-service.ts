import type { Account, Category, Transaction } from "@/types/finance";
import { createDefaultFinanceState } from "@/features/finance/data";

export type FinanceState = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
};

const STORAGE_KEY = "northstar-finance-state";

export function loadPersistedFinanceState(): FinanceState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    return JSON.parse(stored) as FinanceState;
  } catch {
    return null;
  }
}

export function savePersistedFinanceState(state: FinanceState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isFinanceStateSyncPayload(payload: unknown): payload is FinanceState {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<FinanceState> & Record<string, unknown>;
  return Array.isArray(candidate.transactions)
    && Array.isArray(candidate.accounts)
    && Array.isArray(candidate.categories);
}

export function syncFinanceStateToSupabase(state: FinanceState) {
  if (typeof window === "undefined") {
    return;
  }

  void fetch("/api/finance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactions: state.transactions,
      accounts: state.accounts,
      categories: state.categories,
    }),
  }).catch(() => undefined);
}

export { createDefaultFinanceState } from "@/features/finance/data";
export { filterTransactionsBySearch } from "@/features/finance/data";
