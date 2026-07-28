import type { Transaction } from "@/types/finance";

export function downloadTransactionsCsv(transactions: Transaction[]) {
  const rows = [
    ["id", "title", "amount", "type", "category", "account", "date", "notes"],
    ...transactions.map((transaction) => [
      transaction.id,
      transaction.title,
      transaction.amount.toString(),
      transaction.type,
      transaction.category,
      transaction.account,
      transaction.date,
      transaction.notes ?? "",
    ]),
  ];

  const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "transactions.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}
