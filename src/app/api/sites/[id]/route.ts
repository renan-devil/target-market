import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeSite } from "@/lib/serialize";
import { RELATIONSHIPS } from "@/lib/types";

const relationshipValues = RELATIONSHIPS.map((r) => r.value) as [string, ...string[]];

const schema = z.object({
  // Link to an existing account by id, or create/attach one by name.
  accountId: z.string().nullable().optional(),
  accountName: z.string().trim().min(1).max(160).optional(),
  relationship: z.enum(relationshipValues).optional(),
  tags: z.array(z.string()).optional(),
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

  const site = await prisma.industrialSite.findUnique({ where: { id: params.id } });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const body = parsed.data;

  const data: Record<string, unknown> = {};

  // Resolve account linkage.
  if (body.accountId === null) {
    data.accountId = null;
  } else if (body.accountId) {
    const acc = await prisma.account.findUnique({ where: { id: body.accountId } });
    if (!acc) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    data.accountId = acc.id;
    if (body.relationship) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { relationship: body.relationship },
      });
    }
  } else if (body.accountName) {
    // Find-or-create an account with this name, then link it.
    const existing = await prisma.account.findFirst({
      where: { name: body.accountName },
    });
    const acc =
      existing ??
      (await prisma.account.create({
        data: {
          name: body.accountName,
          relationship: body.relationship || "prospect",
        },
      }));
    if (existing && body.relationship) {
      await prisma.account.update({
        where: { id: acc.id },
        data: { relationship: body.relationship },
      });
    }
    data.accountId = acc.id;
  } else if (body.relationship && site.accountId) {
    // Just changing the relationship on the already-linked account.
    await prisma.account.update({
      where: { id: site.accountId },
      data: { relationship: body.relationship },
    });
  }

  if (body.tags) {
    data.tagsJson = JSON.stringify(body.tags.slice(0, 12));
  }

  const updated = await prisma.industrialSite.update({
    where: { id: site.id },
    data,
    include: { account: true },
  });

  return NextResponse.json({ site: serializeSite(updated) });
}
