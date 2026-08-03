import { NextResponse } from "next/server";
import { getDemoProfile } from "@/lib/demo-profile";
import { prisma } from "@/lib/prisma";
import { getLoanOutstanding, validateRepayment } from "@/lib/loan-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { loanId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      loan: {
        ...loan,
        outstanding: await getLoanOutstanding(id, loan.direction as "borrowed" | "lent"),
      },
      transactions,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load loan" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existingLoan = await prisma.loan.findUnique({ where: { id } });
    if (!existingLoan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    if (body.status === "closed") {
      const outstanding = await getLoanOutstanding(id, existingLoan.direction as "borrowed" | "lent");
      if (outstanding !== 0) {
        return NextResponse.json({ error: `Loan has outstanding balance ${outstanding}` }, { status: 400 });
      }
    }

    const loan = await prisma.loan.update({
      where: { id },
      data: {
        title: body.title ?? existingLoan.title,
        counterparty: body.counterparty ?? existingLoan.counterparty,
        notes: body.notes ?? existingLoan.notes,
        status: body.status ?? existingLoan.status,
      },
    });

    return NextResponse.json(loan);
  } catch {
    return NextResponse.json({ error: "Unable to update loan" }, { status: 500 });
  }
}
