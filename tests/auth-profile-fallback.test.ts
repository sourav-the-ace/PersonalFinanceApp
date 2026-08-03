import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { ensureProfileForUser } from "../lib/auth";

test("ensureProfileForUser creates a usable profile for a user", async () => {
  const email = `profile-fallback-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "test-hash",
    },
  });

  try {
    const profile = await ensureProfileForUser(user.id, email);

    assert.equal(profile.userId, user.id);
    assert.equal(profile.email, email);
    assert.equal(profile.name, email.split("@")[0]);
  } finally {
    await prisma.profile.deleteMany({ where: { email } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});
