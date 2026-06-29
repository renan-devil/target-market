import { prisma } from "@/lib/db";
import { AccountsManager } from "@/components/AccountsManager";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sites: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Accounts</h1>
        <p className="mt-1 text-sm text-slate-500">
          OSS accounts and their relationship status. Link sites to accounts from
          the map to track penetration.
        </p>
      </header>

      <AccountsManager
        initial={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          domain: a.domain,
          ownerEmail: a.ownerEmail,
          relationship: a.relationship,
          notes: a.notes,
          siteCount: a._count.sites,
        }))}
      />
    </div>
  );
}
