import { getServerSession } from "next-auth";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getDemoProfile } from "@/lib/demo-profile";

type SessionUserWithProfile = {
  id?: string;
  userId?: string | null;
  profileId?: string | null;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type ProfileRow = {
  id: string;
  userId: string | null;
  email: string;
  name: string | null;
};

async function getProfileById(profileId: string): Promise<ProfileRow | null> {
  const rows = await prisma.$queryRaw<ProfileRow[]>`
    SELECT id, "userId", email, name
    FROM "Profile"
    WHERE id = ${profileId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const rows = await prisma.$queryRaw<ProfileRow[]>`
    SELECT id, "userId", email, name
    FROM "Profile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function getProfileByEmail(email: string): Promise<ProfileRow | null> {
  const normalizedEmail = String(email).toLowerCase();
  const rows = await prisma.$queryRaw<ProfileRow[]>`
    SELECT id, "userId", email, name
    FROM "Profile"
    WHERE email = ${normalizedEmail}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function ensureProfileForUser(userId: string, email: string) {
  const normalizedEmail = String(email).toLowerCase();
  const existingByUser = await getProfileByUserId(userId);
  if (existingByUser) {
    return existingByUser;
  }

  const existingByEmail = await getProfileByEmail(normalizedEmail);
  if (existingByEmail) {
    if (!existingByEmail.userId) {
      await prisma.$executeRaw`
        UPDATE "Profile"
        SET "userId" = ${userId}
        WHERE id = ${existingByEmail.id}
      `;
    }

    return {
      ...existingByEmail,
      userId,
    };
  }

  return prisma.profile.create({
    data: {
      userId,
      email: normalizedEmail,
      name: normalizedEmail.split("@")[0],
    },
  });
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: String(credentials.email).toLowerCase() },
        });

        if (!user) {
          return null;
        }

        const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        const profile = await ensureProfileForUser(user.id, user.email ?? `${user.id}@local`);
        token.profileId = profile.id;
      }
      return token;
    },
    async session({ session, token }) {
      const profile = token.profileId ? await getProfileById(token.profileId as string) : null;
      return {
        ...session,
        user: {
          ...session.user,
          id: token.userId as string,
          userId: token.userId as string,
          profileId: profile?.id ?? null,
        } as SessionUserWithProfile,
      };
    },
  },
};

export async function getSessionProfile() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user as SessionUserWithProfile | undefined;
  const userId = sessionUser?.userId ?? sessionUser?.id ?? null;
  const email = sessionUser?.email ?? null;

  if (userId) {
    const profile = await ensureProfileForUser(userId, email ?? `${userId}@local`);
    return profile.id;
  }

  const demoProfile = await getDemoProfile();
  if (!demoProfile) {
    throw new Error("Unauthorized");
  }

  return demoProfile.id;
}
