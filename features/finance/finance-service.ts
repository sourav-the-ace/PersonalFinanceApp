import type { Account, Category, Transaction } from "@/types/finance";

export type FinanceState = {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
};

export function isFinanceStateSyncPayload(payload: unknown): payload is FinanceState {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<FinanceState> & Record<string, unknown>;
  return Array.isArray(candidate.transactions)
    && Array.isArray(candidate.accounts)
    && Array.isArray(candidate.categories);
}

export { createDefaultFinanceState } from "@/features/finance/data";
export { filterTransactionsBySearch } from "@/features/finance/data";
