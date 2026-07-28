import test from "node:test";
import assert from "node:assert/strict";
import { isFinanceStateSyncPayload } from "./finance-service";

test("detects finance state-sync payloads before creating transactions", () => {
  assert.equal(isFinanceStateSyncPayload({ transactions: [], accounts: [], categories: [] }), true);
  assert.equal(isFinanceStateSyncPayload({ title: "Rent", amount: 1200, type: "expense" }), false);
  assert.equal(isFinanceStateSyncPayload({ foo: "bar" }), false);
});
