type CategoryRecord = { id: string; name: string; type: string };
type AccountRecord = { id: string; name: string; type: string };

type CategoryStore = {
  findFirst: (args: { where: { id?: string; profileId?: string; name?: string } }) => Promise<CategoryRecord | null>;
  create: (args: { data: { profileId: string; name: string; type: string } }) => Promise<CategoryRecord>;
};

type AccountStore = {
  findFirst: (args: { where: { id?: string; profileId?: string; name?: string } }) => Promise<AccountRecord | null>;
  create: (args: { data: { profileId: string; name: string; type: string; balance?: number } }) => Promise<AccountRecord>;
};

type RelationStore = {
  category: CategoryStore;
  account: AccountStore;
};

export type FinanceRelationPayload = {
  categoryId?: string;
  accountId?: string;
  category?: string;
  account?: string;
  type?: string;
};

export async function resolveTransactionRelationIds(
  store: RelationStore,
  profileId: string,
  payload: FinanceRelationPayload,
) {
  const categoryType = payload.type === "income" ? "income" : "expense";
  const categoryName = typeof payload.category === "string" ? payload.category : undefined;
  const accountName = typeof payload.account === "string" ? payload.account : undefined;

  let categoryId: string | undefined;
  if (payload.categoryId) {
    const existingCategory = await store.category.findFirst({ where: { id: payload.categoryId, profileId } });
    if (existingCategory) {
      categoryId = existingCategory.id;
    }
  }

  if (!categoryId && categoryName) {
    const existingCategory = await store.category.findFirst({ where: { profileId, name: categoryName } });
    if (existingCategory) {
      categoryId = existingCategory.id;
    } else {
      const createdCategory = await store.category.create({
        data: {
          profileId,
          name: categoryName,
          type: categoryType,
        },
      });
      categoryId = createdCategory.id;
    }
  }

  let accountId: string | undefined;
  if (payload.accountId) {
    const existingAccount = await store.account.findFirst({ where: { id: payload.accountId, profileId } });
    if (existingAccount) {
      accountId = existingAccount.id;
    }
  }

  if (!accountId && accountName) {
    const existingAccount = await store.account.findFirst({ where: { profileId, name: accountName } });
    if (existingAccount) {
      accountId = existingAccount.id;
    } else {
      const createdAccount = await store.account.create({
        data: {
          profileId,
          name: accountName,
          type: "Bank",
          balance: 0,
        },
      });
      accountId = createdAccount.id;
    }
  }

  return { categoryId, accountId };
}
