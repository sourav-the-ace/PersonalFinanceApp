import assert from "node:assert/strict";
import test from "node:test";
import { resolveTransactionRelationIds } from "../lib/finance-relations";

test("resolveTransactionRelationIds creates missing category and account records for a transaction", async () => {
  const createdCategories: Array<{ id: string; name: string; type: string }> = [];
  const createdAccounts: Array<{ id: string; name: string; type: string; balance: number }> = [];

  const store = {
    category: {
      findFirst: async ({ where }: { where: { id?: string; profileId?: string; name?: string } }) => {
        if (where.id === "existing-cat") {
          return { id: "existing-cat", name: "Salary", type: "income" };
        }
        return null;
      },
      create: async ({ data }: { data: { profileId: string; name: string; type: string } }) => {
        const created = { id: `cat-${createdCategories.length + 1}`, ...data };
        createdCategories.push(created);
        return created;
      },
    },
    account: {
      findFirst: async ({ where }: { where: { id?: string; profileId?: string; name?: string } }) => {
        if (where.id === "existing-acc") {
          return { id: "existing-acc", name: "Checking", type: "Bank" };
        }
        return null;
      },
      create: async ({ data }: { data: { profileId: string; name: string; type: string; balance?: number } }) => {
        const created = { id: `acc-${createdAccounts.length + 1}`, ...data };
        createdAccounts.push(created);
        return created;
      },
    },
  };

  const result = await resolveTransactionRelationIds(store as never, "profile-1", {
    categoryId: "existing-cat",
    accountId: "missing-acc",
    category: "Freelance",
    account: "Business Checking",
    type: "income",
  });

  assert.equal(result.categoryId, "existing-cat");
  assert.equal(result.accountId, "acc-1");
  assert.equal(createdAccounts[0].name, "Business Checking");
  assert.equal(createdCategories.length, 0);
});
