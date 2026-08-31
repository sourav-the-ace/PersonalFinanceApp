import { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

export async function applyBalanceDelta(
  db: TxClient,
  accountId: string | null | undefined,
  delta: number,
) {
  if (!accountId || delta === 0) return;
  await db.account.update({
    where: { id: accountId },
    data: { balance: { increment: delta } },
  });
}

export function directionalDelta(amount: number, direction: "in" | "out") {
  return direction === "in" ? amount : -amount;
}

export function getTransactionBalanceDelta(type: string, amount: number): number {
  switch (type) {
    case "income":
    case "loan_borrow":
    case "loan_receive_repayment":
    case "investment_out":
      return amount;
    case "expense":
    case "loan_lend":
    case "loan_repayment":
    case "investment_in":
      return -amount;
    default:
      return 0;
  }
}
