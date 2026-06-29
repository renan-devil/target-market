import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { NavLink } from "@/components/NavLink";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const initials = (user.name || user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            G
          </div>
          <span className="font-semibold text-slate-900">GTM Tool</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          <NavLink href="/dashboard" icon="🏠">
            Dashboard
          </NavLink>
          <NavLink href="/signals" icon="🎯">
            Signal Analyzer
          </NavLink>
          <NavLink href="/map" icon="🗺️">
            Industrial Map
          </NavLink>
          <NavLink href="/accounts" icon="🤝">
            Accounts
          </NavLink>
          <NavLink href="/data" icon="🛰️">
            Data
          </NavLink>
        </nav>

        <div className="mt-auto border-t border-slate-200 pt-3">
          <div className="flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
              {initials || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700">
                {user.email}
              </p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post" className="mt-2">
            <button className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
