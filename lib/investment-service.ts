import { prisma } from "@/lib/prisma";

export async function getInvestmentTotals(investmentId: string) {
  const inSum = await prisma.transaction.aggregate({
    where: { investmentId, type: "investment_in" },
    _sum: { amount: true },
  });
  const outSum = await prisma.transaction.aggregate({
    where: { investmentId, type: "investment_out" },
    _sum: { amount: true },
  });
  const totalInvested = inSum._sum.amount ?? 0;
  const totalReturned = outSum._sum.amount ?? 0;
  return {
    totalInvested,
    totalReturned,
    netInvested: totalInvested - totalReturned,
    realizedPnL: totalReturned - totalInvested,
  };
}

export function validateWithdrawal(netInvested: number, amount: number) {
  if (amount > netInvested) {
    throw new Error(`Withdrawal ${amount} exceeds net invested ${netInvested}`);
  }
}
