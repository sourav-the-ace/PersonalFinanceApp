import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const profileId = await getSessionProfile();
    const categories = await prisma.category.findMany({ where: { profileId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json(categories);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json([]);
  }
}

export async function POST(request: Request) {
  try {
    const profileId = await getSessionProfile();
    const body = await request.json();

    const category = await prisma.category.create({
      data: {
        profileId,
        name: body.name,
        type: body.type,
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Unable to create category" }, { status: 500 });
  }
}
