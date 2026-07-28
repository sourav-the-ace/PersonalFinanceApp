import type { Transaction, TransactionType } from "@/types/finance";

export const emptyTransactionForm = {
  title: "",
  amount: 0,
  type: "expense" as TransactionType,
  category: "",
  account: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
  categoryId: "",
  accountId: "",
};

export function createTransactionFromForm(
  form: typeof emptyTransactionForm,
  categoryName = form.category,
  accountName = form.account,
): Transaction {
  return {
    id: `tx-${Date.now()}`,
    title: form.title,
    amount: Number(form.amount),
    type: form.type,
    category: categoryName,
    account: accountName,
    date: form.date,
    notes: form.notes,
  };
}
