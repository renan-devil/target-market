import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RELATIONSHIPS } from "@/lib/types";

const relationshipValues = RELATIONSHIPS.map((r) => r.value) as [string, ...string[]];

export async function GET() {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const accounts = await prisma.account.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sites: true } } },
  });

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      domain: a.domain,
      ownerEmail: a.ownerEmail,
      relationship: a.relationship,
      notes: a.notes,
      siteCount: a._count.sites,
    })),
  });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  domain: z.string().trim().max(160).optional(),
  ownerEmail: z.string().trim().email().optional().or(z.literal("")),
  relationship: z.enum(relationshipValues).default("prospect"),
  notes: z.string().max(4000).optional(),
});

export async function POST(req: Request) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const account = await prisma.account.create({
    data: {
      name: parsed.data.name,
      domain: parsed.data.domain || null,
      ownerEmail: parsed.data.ownerEmail || null,
      relationship: parsed.data.relationship,
      notes: parsed.data.notes || "",
    },
  });

  return NextResponse.json({ account });
}
