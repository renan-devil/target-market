import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { countryLabel } from "@/lib/industries";
import { relationshipMeta } from "@/lib/types";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getSessionUser();

  const [
    siteCount,
    accountCount,
    linkedCount,
    profileCount,
    byCountry,
    byIndustry,
    byRelationship,
  ] = await Promise.all([
    prisma.industrialSite.count(),
    prisma.account.count(),
    prisma.industrialSite.count({ where: { accountId: { not: null } } }),
    prisma.icpProfile.count({ where: { userId: user?.id } }),
    prisma.industrialSite.groupBy({
      by: ["country"],
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 8,
    }),
    prisma.industrialSite.groupBy({
      by: ["industry"],
      _count: { _all: true },
      orderBy: { _count: { industry: "desc" } },
      take: 8,
    }),
    prisma.account.groupBy({
      by: ["relationship"],
      _count: { _all: true },
    }),
  ]);

  const penetration =
    siteCount > 0 ? Math.round((linkedCount / siteCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Welcome back{user?.email ? `, ${user.email}` : ""}. Here's your GTM
          landscape at a glance.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Industrial sites" value={siteCount.toLocaleString()} />
        <StatCard label="OSS accounts" value={accountCount} />
        <StatCard
          label="Account penetration"
          value={`${penetration}%`}
          hint={`${linkedCount.toLocaleString()} sites linked to an account`}
        />
        <StatCard label="Your ICP profiles" value={profileCount} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Sites by country
          </h2>
          <BarList
            items={byCountry.map((c) => ({
              label: countryLabel(c.country),
              value: c._count._all,
            }))}
            color="bg-brand-500"
          />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">
            Sites by industry
          </h2>
          <BarList
            items={byIndustry.map((c) => ({
              label: c.industry,
              value: c._count._all,
            }))}
            color="bg-emerald-500"
          />
        </section>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Account relationships
        </h2>
        {byRelationship.length === 0 ? (
          <p className="text-sm text-slate-400">No accounts yet.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {byRelationship.map((r) => {
              const meta = relationshipMeta(r.relationship);
              return (
                <div
                  key={r.relationship}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="text-sm text-slate-700">{meta.label}</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {r._count._all}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/signals"
          className="card flex items-center justify-between p-5 transition-shadow hover:shadow-md"
        >
          <div>
            <p className="font-medium text-slate-900">🎯 Analyze an ICP</p>
            <p className="mt-1 text-sm text-slate-500">
              Paste a website or ICP and surface the buying signals.
            </p>
          </div>
          <span className="text-slate-300">→</span>
        </Link>
        <Link
          href="/map"
          className="card flex items-center justify-between p-5 transition-shadow hover:shadow-md"
        >
          <div>
            <p className="font-medium text-slate-900">🗺️ Explore the map</p>
            <p className="mt-1 text-sm text-slate-500">
              Filter industrial sites, tag fit, and export a CSV.
            </p>
          </div>
          <span className="text-slate-300">→</span>
        </Link>
      </div>
    </div>
  );
}

function BarList({
  items,
  color,
}: {
  items: { label: string; value: number }[];
  color: string;
}) {
  if (!items.length) return <p className="text-sm text-slate-400">No data yet.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-slate-600">
            {i.label}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-sm font-medium text-slate-700">
            {i.value}
          </span>
        </div>
      ))}
    </div>
  );
}
