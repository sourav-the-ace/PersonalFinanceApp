# Build Spec: Loan & Investment Module

This document is a complete implementation spec. Follow it in order. Do not
skip the prerequisite in Phase 0 — every effect described later depends on it.

---

## Phase 0 — Prerequisite: Account balance sync

**Problem:** `Account.balance` currently never updates when a Transaction is
created, edited, or deleted. Every rule in this spec ("increase/reduce
account balance") depends on this working, for both the existing
Income/Expense flow and the new Loan/Investment flow.

**Task:** Create `lib/balance-service.ts`:

```ts
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

// Positive delta = money in, negative = money out.
export function directionalDelta(amount: number, direction: "in" | "out") {
  return direction === "in" ? amount : -amount;
}
```

**Modify `app/api/finance/route.ts` (POST):**
Wrap the transaction create in `prisma.$transaction(async (tx) => { ... })`.
After creating the `Transaction` row, call `applyBalanceDelta`:
- `type === "income"` → `+amount` on the transaction's `accountId`
- `type === "expense"` → `-amount` on the transaction's `accountId`

**Modify `app/api/finance/[id]/route.ts` (PUT):**
Before applying the update, load the existing transaction. Inside
`prisma.$transaction`:
1. Reverse the old effect: apply the inverse delta to the **old**
   `accountId` based on the **old** `type`/`amount`.
2. Apply the new effect: apply the delta to the **new** `accountId` based
   on the **new** `type`/`amount`.
(If `accountId` didn't change, this nets out to the difference — but doing
it as reverse-then-reapply is simpler to get right and easier to extend to
Loan/Investment types later.)

**Modify `app/api/finance/[id]/route.ts` (DELETE):**
Before deleting, load the transaction and reverse its effect on the
account inside `prisma.$transaction`.

**Acceptance criteria:**
- [ ] Creating an income transaction increases the linked account's balance
      by `amount`.
- [ ] Creating an expense transaction decreases it by `amount`.
- [ ] Editing a transaction's amount, type, or account correctly leaves the
      old account/amount reversed and the new one applied.
- [ ] Deleting a transaction reverses its effect.
- [ ] Dashboard "Total Balance" reflects real transaction activity, not
      just seeded values.

---

## Phase 1 — Data model

**Modify `prisma/schema.prisma`:**

Add two new models:

```prisma
model Loan {
  id           String   @id @default(cuid())
  profileId    String
  title        String
  direction    String   // "borrowed" | "lent"
  counterparty String?
  status       String   @default("open") // "open" | "closed"
  notes        String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  profile      Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  transactions Transaction[]
}

model Investment {
  id          String   @id @default(cuid())
  profileId   String
  name        String
  assetType   String
  institution String?
  status      String   @default("open") // "open" | "closed"
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  profile      Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  transactions Transaction[]
}
```

Add to `Profile`:
```prisma
loans       Loan[]
investments Investment[]
```

Add to `Transaction`:
```prisma
loanId          String?
investmentId    String?
principalAmount Float?
interestAmount  Float?

loan       Loan?       @relation(fields: [loanId], references: [id])
investment Investment? @relation(fields: [investmentId], references: [id])
```

Run:
```bash
npx prisma migrate dev --name add_loan_investment
```

**Acceptance criteria:**
- [ ] `npx prisma migrate dev` runs clean with no manual SQL edits needed.
- [ ] `npx prisma generate` produces `Loan` and `Investment` client types.

---

## Phase 2 — Shared TypeScript types

**Modify `types/finance.ts`.** Add:

```ts
export type LoanDirection = "borrowed" | "lent";
export type EntityStatus = "open" | "closed";

export type LoanTransactionType =
  | "loan_borrow"
  | "loan_repayment"
  | "loan_lend"
  | "loan_receive_repayment";

export type InvestmentTransactionType = "investment_in" | "investment_out";

export type TransactionType =
  | "income"
  | "expense"
  | LoanTransactionType
  | InvestmentTransactionType;

export interface Loan {
  id: string;
  title: string;
  direction: LoanDirection;
  counterparty?: string;
  status: EntityStatus;
  notes?: string;
  outstanding: number; // computed, see Phase 3
}

export interface Investment {
  id: string;
  name: string;
  assetType: string;
  institution?: string;
  status: EntityStatus;
  notes?: string;
  totalInvested: number;  // computed
  totalReturned: number;  // computed
  netInvested: number;    // computed
  realizedPnL: number;    // computed
}
```

Extend the existing `Transaction` interface with:
```ts
loanId?: string;
investmentId?: string;
principalAmount?: number;
interestAmount?: number;
```

**Do not** add these six new types to any flat "all transaction types"
dropdown list used for plain Income/Expense entry — they are only ever
created through the Loan/Investment transaction forms (Phase 5), each of
which requires picking a parent `Loan`/`Investment` first.

---

## Phase 3 — Aggregate & validation logic

**Create `lib/loan-service.ts`:**

```ts
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
```

**Create `lib/investment-service.ts`:**

```ts
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
```

**Investment Withdrawals & Profits:**
- Withdrawals (`investment_out`) can exceed invested amount when an investment yields profit (`realizedPnL > 0`). Withdrawals are therefore not capped at `netInvested`.

**Closure validation** (call before allowing `status: "closed"` on PUT):
- Loan: reject unless `getLoanOutstanding(...) === 0`.
- Investment: reject if `netInvested > 0` (all invested principal should be returned before closing).

**Acceptance criteria:**
- [ ] A repayment/withdrawal exceeding the outstanding/invested amount
      returns a 400 with a clear error message, and no DB write happens.
- [ ] Attempting to close a Loan/Investment with nonzero
      outstanding/net-invested returns a 400.

---

## Phase 4 — API routes

### Loans

**`app/api/finance/loans/route.ts`**
- `GET` → list all loans for the demo profile, each with `outstanding`
  computed via `lib/loan-service.ts`.
- `POST` body: `{ title, direction, counterparty?, notes? }` → create Loan.

**`app/api/finance/loans/[id]/route.ts`**
- `GET` → loan detail + its transaction history (`prisma.transaction.findMany({ where: { loanId } })`).
- `PUT` body: `{ title?, counterparty?, notes?, status? }` → update; if
  `status === "closed"`, run the closure validation first.

**`app/api/finance/loans/[id]/transactions/route.ts`**
- `POST` body:
  ```ts
  // Borrow / Lend
  { type: "loan_borrow" | "loan_lend", amount, accountId, date, title, notes? }
  // Repayment / Receive Repayment
  { type: "loan_repayment" | "loan_receive_repayment", principalAmount, interestAmount?, accountId, date, title, notes? }
  ```
  Server derives `amount = principalAmount + (interestAmount ?? 0)` for
  repayment types. Inside `prisma.$transaction`:
  1. Validate (Phase 3) for repayment types.
  2. Create the `Transaction` row with `loanId` set.
  3. Apply balance delta: `loan_borrow`/`loan_receive_repayment` → `+amount`;
     `loan_lend`/`loan_repayment` → `-amount`.
  4. If `interestAmount` is present, it separately feeds Income/Expense
     reporting (Phase 6) — no separate transaction row, just the
     `interestAmount` column on this same row.

### Investments

**`app/api/finance/investments/route.ts`**
- `GET` → list all investments with computed totals via
  `lib/investment-service.ts`.
- `POST` body: `{ name, assetType, institution?, notes? }` → create.

**`app/api/finance/investments/[id]/route.ts`**
- `GET` → investment detail + transaction history.
- `PUT` body: `{ name?, institution?, notes?, status? }` → update; validate
  closure per Phase 3 if closing.

**`app/api/finance/investments/[id]/transactions/route.ts`**
- `POST` body: `{ type: "investment_in" | "investment_out", amount, accountId, date, title, notes? }`
  Inside `prisma.$transaction`:
  1. If `investment_out`, validate against `netInvested` (Phase 3).
  2. Create the `Transaction` row with `investmentId` set.
  3. Apply balance delta: `investment_in` → `-amount`; `investment_out` →
     `+amount`.

**Acceptance criteria:**
- [ ] All six new transaction types are only ever created via these
      nested routes, never via `app/api/finance/route.ts`.
- [ ] Every write path here uses `prisma.$transaction` — no partial writes
      where the ledger row exists but the balance/validation didn't run.

---

## Phase 5 — Client & UI

**Create `features/finance/loan-api.ts`** — `fetchLoans`, `createLoan`,
`fetchLoan(id)`, `updateLoan`, `createLoanTransaction`. Mirror the existing
pattern in `features/finance/finance-api.ts`.

**Create `features/finance/investment-api.ts`** — same pattern for
investments.

**Create `features/finance/loans-view.tsx`:**
- List of loans (title, direction, counterparty, status, outstanding).
- "New Loan" form (title, direction select, counterparty, notes).
- Selecting a loan opens its detail: transaction history + a form to add
  Borrow/Repayment (if `direction === "borrowed"`) or
  Lend/Receive-Repayment (if `direction === "lent"`). Repayment forms show
  separate Principal and Interest (optional) fields, an Account picker, and
  a Date field — not a single Amount field.

**Create `features/finance/investments-view.tsx`:**
- List of investments (name, asset type, institution, status, totals).
- "New Investment" form (name, asset type, institution, notes).
- Selecting an investment opens its detail: transaction history + a form
  to add Investment In / Investment Out (amount, account, date, notes).

**Modify `features/finance/finance-shell.tsx`:**
- Add two new tab entries: `"loans"` and `"investments"`, rendering the
  components above, following the existing `view` state pattern used for
  `dashboard`/`transactions`/`accounts`/`categories`/`reports`/`settings`.
- Add icons + labels for the six new transaction types wherever the main
  transaction history renders a type badge, and add them as filter options
  in the transactions view's type filter — **read-only display/filter
  only**; do not let them be created from the plain transaction form.

**Acceptance criteria:**
- [ ] A loan/investment transaction cannot be created without first
      selecting its parent Loan/Investment.
- [ ] The main Transactions view shows loan/investment rows with a
      distinct icon and can filter by any of the six new types.
- [ ] Repayment forms never show a single combined "Amount" field.

---

## Phase 6 — Reporting

**Modify `features/finance/data.ts`** (`buildDashboardSummary`):

```
monthlyIncome  += sum(interestAmount where type === "loan_receive_repayment")
monthlyExpense += sum(interestAmount where type === "loan_repayment")
```

No other transaction types (`loan_borrow`, `loan_lend`,
`investment_in`, `investment_out`, or the principal portion of any
repayment) contribute to `monthlyIncome`/`monthlyExpense`.

**Add to the Dashboard** (`renderDashboard` in `finance-shell.tsx`) new
summary cards:
- Outstanding Borrowed (sum across all `direction: "borrowed"` loans)
- Outstanding Lent (sum across all `direction: "lent"` loans)
- Open Loans / Closed Loans (counts)
- Investment summary: Net Invested, Realized P/L (sum across investments)

**Acceptance criteria:**
- [ ] A `loan_borrow` transaction does not change `monthlyIncome`.
- [ ] A `loan_lend` transaction does not change `monthlyExpense`.
- [ ] An `investment_in`/`investment_out` transaction does not change
      `monthlyIncome`/`monthlyExpense`.
- [ ] Only the `interestAmount` field on repayment rows affects
      Income/Expense totals.

---

## Non-Goals (explicitly out of scope for this phase)

- No mark-to-market / current market value tracking for open investments —
  only cash-flow totals.
- No multi-currency support.
- No `Contact`/`Person` entity — `counterparty` stays a free-text field on
  `Loan`.
- No auto-closing of loans/investments — closure is a manual user action,
  gated by the validation in Phase 3.
- No "Transfer" transaction type — not present in this app; do not add it
  as part of this module.

---

## File Manifest

| Path | Action | Purpose |
|---|---|---|
| `lib/balance-service.ts` | create | Shared balance-delta helper |
| `prisma/schema.prisma` | modify | `Loan`, `Investment` models + `Transaction` columns |
| `types/finance.ts` | modify | New types, extended `Transaction`/`TransactionType` |
| `lib/loan-service.ts` | create | Outstanding calc + repayment validation |
| `lib/investment-service.ts` | create | Totals calc + withdrawal validation |
| `app/api/finance/route.ts` | modify | Wire balance sync into POST |
| `app/api/finance/[id]/route.ts` | modify | Reverse/reapply balance on PUT/DELETE |
| `app/api/finance/loans/route.ts` | create | List/create loans |
| `app/api/finance/loans/[id]/route.ts` | create | Loan detail/update |
| `app/api/finance/loans/[id]/transactions/route.ts` | create | Add loan transaction |
| `app/api/finance/investments/route.ts` | create | List/create investments |
| `app/api/finance/investments/[id]/route.ts` | create | Investment detail/update |
| `app/api/finance/investments/[id]/transactions/route.ts` | create | Add investment transaction |
| `features/finance/loan-api.ts` | create | Client fetch helpers |
| `features/finance/investment-api.ts` | create | Client fetch helpers |
| `features/finance/loans-view.tsx` | create | Loans tab UI |
| `features/finance/investments-view.tsx` | create | Investments tab UI |
| `features/finance/finance-shell.tsx` | modify | New tabs, icons, filters |
| `features/finance/data.ts` | modify | Reporting formulas |