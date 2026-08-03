# Build Spec: User Accounts, Full CRUD, and Cleanup

This spec is written in priority order. **Phase 0 must be done first** — it's an
active bug (not a latent one) that will keep corrupting data while you build
everything else on top of it. Phase 1 (auth) is the biggest structural change
and should land before Phase 2 (CRUD), since every new route in Phase 2 needs
to be scoped to the authenticated profile from the start rather than retrofitted.

---

## Phase 0 — Fix the sync endpoint (do this first, it's live data corruption)

**Problem:** `features/finance/finance-service.ts` → `syncFinanceStateToSupabase`
fires on every transactions/accounts/categories state change and POSTs
`{ transactions, accounts, categories }` to `/api/finance`. The `POST` handler
in `app/api/finance/route.ts` imports `isFinanceStateSyncPayload` but never
calls it — it unconditionally treats the body as a single transaction and
creates one via `resolveTransactionRelationIds` + `prisma.transaction.create`.
Every sync call is therefore creating a junk `Transaction` row with
`title: undefined`, `type: undefined`, `amount: 0`.

**Task:**
1. In `app/api/finance/route.ts`, at the top of `POST`, check
   `isFinanceStateSyncPayload(body)`. If true, return
   `NextResponse.json({ ok: true })` immediately without touching the database
   (restores the originally-intended no-op behavior) — **or**, preferably,
   delete `syncFinanceStateToSupabase` and its call site in
   `finance-shell.tsx` entirely, since every mutation already round-trips
   through dedicated create/update/delete calls and this bulk sync serves no
   purpose. Prefer deletion over the no-op guard if nothing depends on it.
2. Rename anything referencing "Supabase" once the decision above is made
   (`syncFinanceStateToSupabase`, and drop the `@supabase/supabase-js`
   dependency from `package.json` if it's confirmed unused elsewhere).
3. Write a quick regression test asserting that calling `POST /api/finance`
   with a `{transactions, accounts, categories}` shaped body does **not**
   create a `Transaction` row.

**Acceptance criteria:**
- [ ] No transaction rows with `title: null`/`type: null` are created during
      normal app usage.
- [ ] `@supabase/supabase-js` is either removed or there's a documented reason
      it's still a dependency.

---

## Phase 1 — User accounts (login, registration, per-user data isolation)

**Problem:** Every route calls `getDemoProfile()` (or hardcodes
`demo@northstar.finance`). There is exactly one `Profile` in the whole system;
every visitor sees and can modify the same data. This needs to become a real
multi-tenant app.

### 1.1 — Data model

Add a `User` model and tie `Profile` to it 1:1 (keep `Profile` as the
domain-owner of finance data, since `Account`/`Category`/`Transaction`/`Loan`/
`Investment` all already key off `profileId`):

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  profile       Profile?
}
```

Add to `Profile`:
```prisma
userId String @unique
user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
```

Run `npx prisma migrate dev --name add_user_auth`.

**Migration note:** the existing demo profile/data won't have a `userId`.
Either (a) delete seed/demo data as part of this migration since real accounts
are coming, or (b) create one throwaway `User` row and backfill
`Profile.userId` for the existing demo profile so existing local dev data
isn't lost. Pick (a) unless you specifically want to keep poking at the demo
data after this change.

### 1.2 — Auth mechanism

Use `next-auth` (Auth.js) with the Credentials provider and `bcrypt` for
password hashing — no need for OAuth/social login unless you want it later.

```bash
npm install next-auth bcryptjs
npm install --save-dev @types/bcryptjs
```

Create `app/api/auth/[...nextauth]/route.ts` with a Credentials provider that:
1. Looks up `User` by email.
2. Compares `bcrypt.compare(password, user.passwordHash)`.
3. On success, returns a session object containing `userId`.

Add a `session` callback that also resolves and attaches `profileId` (fetch
`Profile.findUnique({ where: { userId } })`) so every server route can pull
`session.user.profileId` directly without a repeated lookup.

Create `app/api/auth/register/route.ts` (`POST`, plain REST — not part of
NextAuth) that:
1. Validates email/password (basic format + minimum length; use `zod`, which
   is already a dependency).
2. Hashes the password with `bcrypt.hash(password, 10)`.
3. Creates the `User` **and** its `Profile` in one `prisma.$transaction`
   (mirroring the pattern already used in `app/api/finance/route.ts`).
4. Returns a success response — do not log the user in automatically inside
   this route; let the client call NextAuth's `signIn` after a successful
   registration.

### 1.3 — Pages

Create `app/login/page.tsx` and `app/register/page.tsx` — simple client
components with `Input`/`Button` from the existing `components/ui/*`
primitives (no new design system needed, match the existing dark theme). Use
NextAuth's `signIn("credentials", { email, password })` for login.

### 1.4 — Route protection

Add `middleware.ts` at the repo root that checks for a valid NextAuth session
and redirects unauthenticated requests to `/login` for all `app/(dashboard)`
routes (or wrap `FinanceShell` — pick whichever matches how you structure the
route groups). All `/api/finance/**` routes must reject unauthenticated
requests with `401`.

### 1.5 — Replace `getDemoProfile()` everywhere

Delete `lib/demo-profile.ts`'s hardcoded email lookup. Replace every call site
(`app/api/finance/route.ts`, `app/api/finance/accounts/route.ts`,
`app/api/finance/categories/route.ts`, `app/api/finance/loans/route.ts`,
`app/api/finance/loans/[id]/route.ts`,
`app/api/finance/loans/[id]/transactions/route.ts`,
`app/api/finance/investments/route.ts`,
`app/api/finance/investments/[id]/route.ts`,
`app/api/finance/investments/[id]/transactions/route.ts`, and any new routes
from Phase 2) with a `getSessionProfile(request)` helper that:
1. Reads the NextAuth session (`getServerSession(authOptions)`).
2. Returns `401` if there's no session.
3. Returns `session.user.profileId` for use in `where: { profileId }` clauses.

**This is the important part:** every existing `findFirst`/`findMany`/
`create` call that currently scopes by the demo profile's id must be
re-scoped to the authenticated user's profile id, and every record fetch
by id (loan, investment, transaction) must also verify `profileId` matches
before returning/mutating it — otherwise user A can read/edit user B's data
by guessing an id.

**Acceptance criteria:**
- [ ] A new visitor is redirected to `/login`/`/register` and cannot see any
      finance data until they authenticate.
- [ ] Two different registered users see completely separate transactions,
      accounts, categories, loans, and investments.
- [ ] Every `/api/finance/**` route returns `401` when called without a
      session, and `404` (not another user's data) when a valid session tries
      to access an id belonging to a different profile.
- [ ] Passwords are never stored or logged in plaintext.

---

## Phase 2 — Complete CRUD (edit + delete everywhere)

**Problem:** Only plain Transactions have edit + delete. Categories, Accounts,
Loans, Investments, and Loan/Investment transactions only support create
(+ "close" for Loan/Investment status). This phase closes that gap.

### 2.1 — Categories

**`app/api/finance/categories/[id]/route.ts`** (new file):
- `PUT` — update `name`/`type`. Scope by `profileId` from session.
- `DELETE` — delete the category. Since `Transaction.categoryId` is
  `ON DELETE SET NULL`, existing transactions referencing it will just lose
  their category label — confirm this is the desired behavior (recommended),
  or add a "reassign transactions to X before deleting" step if not.

Add edit/delete buttons to the category cards in
`features/finance/finance-shell.tsx` (`renderCategories`).

### 2.2 — Accounts

**`app/api/finance/accounts/[id]/route.ts`** (new file):
- `PUT` — update `name`/`type`. **Do not** allow direct `balance` edits here
  once Phase 0/prior balance-sync work is in place — balance should only ever
  move via transaction create/edit/delete, or you'll fight the balance-service
  math. If you want a manual "adjust balance" feature, model it as an explicit
  adjustment transaction instead of a raw field edit.
- `DELETE` — decide the policy: either block deletion if the account has any
  transactions (safest), or delete and let `ON DELETE SET NULL` clear
  `Transaction.accountId`. Recommend blocking deletion when a nonzero balance
  or existing transactions are present, similar to the Loan/Investment closure
  validation pattern already used in `lib/loan-service.ts` /
  `lib/investment-service.ts`.

Add edit/delete buttons to account cards in `renderAccounts`.

### 2.3 — Loans (head record)

**Modify `app/api/finance/loans/[id]/route.ts`:**
- Add `DELETE`. Block deletion unless `outstanding === 0` (reuse
  `getLoanOutstanding`), same rule as closing. On delete, the loan's
  transactions have `ON DELETE SET NULL` on `loanId` per
  `prisma/migrations/20260802122945_add_loan_investment/migration.sql` — but
  those transactions still carry balance effects already applied to the
  account, so this is safe to allow once outstanding is 0.

Add a delete button to the loan detail view in
`features/finance/loans-view.tsx`, next to "Close loan."

### 2.4 — Investments (head record)

**Modify `app/api/finance/investments/[id]/route.ts`:**
- Add `DELETE`, same pattern: block unless `netInvested === 0`.

Add a delete button to `features/finance/investments-view.tsx`.

### 2.5 — Loan transactions (the tricky one)

**Modify `app/api/finance/loans/[id]/transactions/route.ts`** — add
`PUT`/`DELETE` for an individual loan transaction (new file:
`app/api/finance/loans/[id]/transactions/[transactionId]/route.ts`):

- `DELETE`: inside `prisma.$transaction`, before deleting the row, compute the
  original balance delta this transaction applied (mirror the
  `loan_borrow`/`loan_receive_repayment` → `+amount`,
  `loan_lend`/`loan_repayment` → `-amount` rule from the original creation
  route) and apply the inverse via `applyBalanceDelta`. Then delete the row.
  **Do not** route this through the generic
  `app/api/finance/[id]/route.ts DELETE` — that endpoint only knows
  income/expense deltas and will silently skip the reversal, which is exactly
  today's bug (see Gap Analysis above).
- `PUT`: same reverse-then-reapply pattern used in the Phase 0 (pre-existing)
  balance-service work for plain transactions — reverse the old delta based
  on old type/amount/accountId, then apply the new delta based on new
  type/amount/accountId, both inside one `prisma.$transaction`. Re-run
  `validateRepayment` if the edited row is a repayment type and the principal
  changed.

Add edit/delete controls to each transaction row in the loan detail view.

### 2.6 — Investment transactions

Same shape as 2.5, mirrored for investments
(`app/api/finance/investments/[id]/transactions/[transactionId]/route.ts`):
- `DELETE`: reverse `investment_in` → `+amount` back, `investment_out` →
  `-amount` back (inverse of the `-amount`/`+amount` rule in the existing
  creation route), inside `prisma.$transaction`.
- `PUT`: reverse-then-reapply, re-run `validateWithdrawal` if the edited row
  is `investment_out` and the amount increased.

Add edit/delete controls to each transaction row in
`features/finance/investments-view.tsx`.

### 2.7 — Fix the generic transaction routes' blind spot

While in this area: `app/api/finance/[id]/route.ts` (`PUT`/`DELETE`) computes
balance deltas only for `type === "income"`/`"expense"`. Make sure nothing in
the UI can reach these generic routes for loan/investment-typed rows (the
transactions list "Edit"/"Remove" buttons in `finance-shell.tsx` currently
call `updateFinanceTransaction`/`deleteFinanceTransaction`, which hit this
generic endpoint for **every** row, including loan/investment ones shown in
the unified Transactions list). Either:
- (a) detect `loanId`/`investmentId` on the row in the UI and route
  edit/delete through the Phase 2.5/2.6 endpoints instead, or
- (b) teach the generic `PUT`/`DELETE` routes the full delta rules for all
  eight transaction types (more centralized, but duplicates logic already
  needed in the dedicated loan/investment transaction routes).

Prefer (a) — it keeps the balance-delta rules co-located with the
loan/investment domain logic where the create routes already live.

**Acceptance criteria for Phase 2:**
- [ ] Every entity (Category, Account, Loan, Investment) has working edit and
      delete in the UI, matching the existing Transaction edit/delete pattern.
- [ ] Deleting or editing a loan/investment transaction correctly reverses/
      reapplies its account balance effect — verify by checking
      `Account.balance` before and after in a test.
- [ ] Deletion of a Loan/Investment/Account is blocked with a clear error
      when it would leave dangling non-zero balances (as already required for
      "close" status changes).

---

## Phase 3 — Dashboard wiring (fell through the cracks in the Loan/Investment build)

**Problem:** `FinanceShell` calls
`buildDashboardSummary(transactions, accounts, selectedMonth)` — it never
fetches or passes `loans`/`investments`, so the "Outstanding Borrowed,"
"Outstanding Lent," "Open Loans," and "Net Invested" dashboard cards always
render as zero/empty no matter what real data exists.

**Task:**
1. Add `loans`/`investments` state to `FinanceShell` (fetch via
   `fetchLoans()` / `fetchInvestments()` from `loan-api.ts`/
   `investment-api.ts` in the same `useEffect` that currently loads
   accounts/categories).
2. Pass them into `buildDashboardSummary(transactions, accounts,
   selectedMonth, loans, investments)`.
3. Verify the dashboard cards added in the original Loan/Investment spec
   (Phase 6) now show real, non-zero numbers when loans/investments exist.

**Acceptance criteria:**
- [ ] Creating a borrowed loan with a nonzero outstanding balance updates the
      "Outstanding Borrowed" dashboard card without a page reload.
- [ ] Same for lent loans, and for Net Invested/Realized P/L on the
      investments side.

---

## Carried-forward items (still open, lower priority than the above)

These were flagged before Loan/Investment work started and remain unresolved.
Not blocking, but should be picked up once Phases 0–3 are done:

- **Misleading Supabase naming/dependency** — see Phase 0, task 2.
- **Income vs Expense chart is still mocked** outside the selected-month view
  (`buildDashboardSummary`'s `incomeVsExpense` hardcodes Jan–Jun numbers
  rather than deriving history from real transaction dates).
- **PUT vs POST inconsistency in category/account resolution** — creating a
  transaction can auto-create a category/account by name
  (`resolveTransactionRelationIds`); editing one only connects/disconnects by
  id. Harmless today since the UI only offers `<Select>` pickers, but worth
  aligning if a free-text entry path is ever added.
- **Settings are cosmetic** — `currency` and `darkMode` state in
  `FinanceShell` don't do anything (`formatCurrency` is hardcoded to USD, no
  dark-mode class toggle exists). Low priority relative to auth/CRUD, but
  flag if a user-facing settings page is expected soon — it'll need real
  per-profile persistence once Phase 1 lands anyway (currency should probably
  live on `Profile`, which already has a `currency` column that's currently
  unused by the app logic).
- **No distinct icon per transaction type / miscolored amounts** for the six
  loan/investment transaction types in the unified Transactions list —
  cosmetic, but was an explicit acceptance criterion in the original
  Loan/Investment spec that didn't get implemented.

---

## File Manifest

| Path | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | modify | `User` model, `Profile.userId` |
| `lib/demo-profile.ts` | delete/replace | Replaced by session-scoped profile lookup |
| `lib/auth.ts` | create | `authOptions`, `getSessionProfile` helper |
| `app/api/auth/[...nextauth]/route.ts` | create | NextAuth handler |
| `app/api/auth/register/route.ts` | create | Registration endpoint |
| `app/login/page.tsx` | create | Login page |
| `app/register/page.tsx` | create | Registration page |
| `middleware.ts` | create | Route protection |
| `app/api/finance/route.ts` | modify | Fix sync no-op (Phase 0); session scoping |
| `app/api/finance/[id]/route.ts` | modify | Session scoping |
| `app/api/finance/accounts/route.ts` | modify | Session scoping |
| `app/api/finance/accounts/[id]/route.ts` | create | Edit/delete account |
| `app/api/finance/categories/route.ts` | modify | Session scoping |
| `app/api/finance/categories/[id]/route.ts` | create | Edit/delete category |
| `app/api/finance/loans/route.ts` | modify | Session scoping |
| `app/api/finance/loans/[id]/route.ts` | modify | Add delete |
| `app/api/finance/loans/[id]/transactions/[transactionId]/route.ts` | create | Edit/delete loan transaction |
| `app/api/finance/investments/route.ts` | modify | Session scoping |
| `app/api/finance/investments/[id]/route.ts` | modify | Add delete |
| `app/api/finance/investments/[id]/transactions/[transactionId]/route.ts` | create | Edit/delete investment transaction |
| `features/finance/finance-shell.tsx` | modify | Loans/investments fetch + dashboard wiring; edit/delete UI for categories/accounts |
| `features/finance/loans-view.tsx` | modify | Edit/delete UI for loan + loan transactions |
| `features/finance/investments-view.tsx` | modify | Edit/delete UI for investment + investment transactions |
| `features/finance/finance-service.ts` | modify | Remove/guard `syncFinanceStateToSupabase` |
| `package.json` | modify | Add `next-auth`, `bcryptjs`; remove `@supabase/supabase-js` if unused |