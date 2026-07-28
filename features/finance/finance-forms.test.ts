import test from "node:test";
import assert from "node:assert/strict";
import { createTransactionFromForm, emptyTransactionForm } from "./finance-forms";

test("createTransactionFromForm uses the provided category and account names", () => {
  const form = {
    ...emptyTransactionForm,
    title: "Rent",
    amount: 1200,
    categoryId: "cat-1",
    accountId: "acc-1",
  };

  const transaction = createTransactionFromForm(form, "Housing", "Checking");

  assert.equal(transaction.title, "Rent");
  assert.equal(transaction.amount, 1200);
  assert.equal(transaction.category, "Housing");
  assert.equal(transaction.account, "Checking");
});
