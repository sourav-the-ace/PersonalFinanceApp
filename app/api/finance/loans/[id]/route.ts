import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLoanOutstanding, validateRepayment } from "@/lib/loan-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const loan = await prisma.loan.findFirst({ where: { id, profileId } });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const transactions = await prisma.transaction.findMany({
      where: { loanId: id, profileId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      loan: {
        ...loan,
        outstanding: await getLoanOutstanding(id, loan.direction as "borrowed" | "lent"),
      },
      transactions,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to load loan" }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const body = await request.json();
    const existingLoan = await prisma.loan.findFirst({ where: { id, profileId } });
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
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to update loan" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profileId = await getSessionProfile();
    const { id } = await params;
    const loan = await prisma.loan.findFirst({ where: { id, profileId } });
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    const outstanding = await getLoanOutstanding(id, loan.direction as "borrowed" | "lent");
    if (outstanding !== 0) {
      return NextResponse.json(
        { error: `Cannot delete a loan with an active balance (${outstanding}). Settle the balance first.` },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({ where: { loanId: id, profileId } });
      await tx.loan.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to delete loan" }, { status: 500 });
  }
}
