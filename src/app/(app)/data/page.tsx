import { prisma } from "@/lib/db";
import { DataSync } from "@/components/DataSync";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const [grouped, total] = await Promise.all([
    prisma.industrialSite.groupBy({
      by: ["source"],
      _count: { _all: true },
    }),
    prisma.industrialSite.count(),
  ]);

  const counts: Record<string, number> = {};
  for (const g of grouped) counts[g.source] = g._count._all;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Data sources</h1>
        <p className="mt-1 text-sm text-slate-500">
          Populate the industrial map with real sites from OpenStreetMap, or
          manage the sample data.
        </p>
      </header>

      <DataSync initialCounts={counts} initialTotal={total} />
    </div>
  );
}
