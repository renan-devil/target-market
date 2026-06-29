import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RELATIONSHIPS } from "@/lib/types";

const relationshipValues = RELATIONSHIPS.map((r) => r.value) as [string, ...string[]];

const schema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  domain: z.string().trim().max(160).nullable().optional(),
  ownerEmail: z.string().trim().email().nullable().optional().or(z.literal("")),
  relationship: z.enum(relationshipValues).optional(),
  notes: z.string().max(4000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const exists = await prisma.account.findUnique({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const account = await prisma.account.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name } : {}),
      ...(parsed.data.domain !== undefined ? { domain: parsed.data.domain || null } : {}),
      ...(parsed.data.ownerEmail !== undefined
        ? { ownerEmail: parsed.data.ownerEmail || null }
        : {}),
      ...(parsed.data.relationship ? { relationship: parsed.data.relationship } : {}),
      ...(parsed.data.notes != null ? { notes: parsed.data.notes } : {}),
    },
  });

  return NextResponse.json({ account });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  await prisma.account.delete({ where: { id: params.id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
