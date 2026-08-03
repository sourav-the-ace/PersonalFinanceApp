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
