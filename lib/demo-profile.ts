import { prisma } from "@/lib/prisma";

export async function getDemoProfile() {
  const existingProfile = await prisma.profile.findFirst({
    where: { email: "demo@northstar.finance" },
  });

  if (existingProfile) {
    return existingProfile;
  }

  return prisma.profile.create({
    data: {
      email: "demo@northstar.finance",
      name: "Demo User",
    },
  });
}
