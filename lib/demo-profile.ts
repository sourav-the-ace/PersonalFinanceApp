import { prisma } from "@/lib/prisma";

type DemoProfileRow = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
};

async function getProfileByEmail(email: string): Promise<DemoProfileRow | null> {
  const rows = await prisma.$queryRaw<DemoProfileRow[]>`
    SELECT id, "userId", email, name
    FROM "Profile"
    WHERE email = ${email}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getDemoProfile() {
  const demoEmail = "demo@northstar.finance";
  const existingProfile = await getProfileByEmail(demoEmail);

  if (existingProfile?.userId) {
    return existingProfile;
  }

  let fallbackUser = await prisma.user.findFirst({ where: { email: demoEmail } });
  if (!fallbackUser) {
    fallbackUser = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash: "demo-hash",
      },
    });
  }

  if (existingProfile && !existingProfile.userId) {
    await prisma.$executeRaw`
      UPDATE "Profile"
      SET "userId" = ${fallbackUser.id}
      WHERE id = ${existingProfile.id}
    `;
    return {
      ...existingProfile,
      userId: fallbackUser.id,
    };
  }

  return prisma.profile.create({
    data: {
      userId: fallbackUser.id,
      email: demoEmail,
      name: "Demo User",
    },
  });
}
