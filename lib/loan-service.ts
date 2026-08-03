import { prisma } from "@/lib/prisma";

export async function getLoanOutstanding(loanId: string, direction: "borrowed" | "lent") {
  const borrowSum = await prisma.transaction.aggregate({
    where: { loanId, type: direction === "borrowed" ? "loan_borrow" : "loan_lend" },
    _sum: { amount: true },
  });
  const repaySum = await prisma.transaction.aggregate({
    where: { loanId, type: direction === "borrowed" ? "loan_repayment" : "loan_receive_repayment" },
    _sum: { principalAmount: true },
  });
  return (borrowSum._sum.amount ?? 0) - (repaySum._sum.principalAmount ?? 0);
}

export function validateRepayment(outstanding: number, principalAmount: number) {
  if (principalAmount > outstanding) {
    throw new Error(`Principal ${principalAmount} exceeds outstanding balance ${outstanding}`);
  }
}
