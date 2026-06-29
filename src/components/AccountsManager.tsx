"use client";

import { useState } from "react";
import { RELATIONSHIPS, relationshipMeta } from "@/lib/types";

interface Account {
  id: string;
  name: string;
  domain: string | null;
  ownerEmail: string | null;
  relationship: string;
  notes: string;
  siteCount: number;
}

export function AccountsManager({ initial }: { initial: Account[] }) {
  const [accounts, setAccounts] = useState<Account[]>(initial);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [relationship, setRelationship] = useState("prospect");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, domain, relationship }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account.");
        return;
      }
      setAccounts((a) =>
        [...a, { ...data.account, siteCount: 0 }].sort((x, y) =>
          x.name.localeCompare(y.name)
        )
      );
      setName("");
      setDomain("");
      setRelationship("prospect");
    } catch {
      setError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  async function updateRelationship(id: string, value: string) {
    setAccounts((a) =>
      a.map((acc) => (acc.id === id ? { ...acc, relationship: value } : acc))
    );
    await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relationship: value }),
    }).catch(() => null);
  }

  async function remove(id: string) {
    if (!confirm("Delete this account? Linked sites will be unlinked.")) return;
    setAccounts((a) => a.filter((acc) => acc.id !== id));
    await fetch(`/api/accounts/${id}`, { method: "DELETE" }).catch(() => null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Sites</th>
              <th className="px-4 py-3 font-medium">Relationship</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                  No accounts yet. Create one, or link a site to an account from
                  the map.
                </td>
              </tr>
            ) : (
              accounts.map((acc) => {
                const meta = relationshipMeta(acc.relationship);
                return (
                  <tr key={acc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{acc.name}</div>
                      {acc.domain && (
                        <div className="text-xs text-slate-400">{acc.domain}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{acc.siteCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <select
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          value={acc.relationship}
                          onChange={(e) =>
                            updateRelationship(acc.id, e.target.value)
                          }
                        >
                          {RELATIONSHIPS.filter((r) => r.value !== "none").map(
                            (r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => remove(acc.id)}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <aside>
        <form onSubmit={create} className="card space-y-3 p-5">
          <h3 className="text-sm font-semibold text-slate-700">New account</h3>
          <div>
            <label className="label text-xs">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Manufacturing"
              required
            />
          </div>
          <div>
            <label className="label text-xs">Domain</label>
            <input
              className="input"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="acme.com"
            />
          </div>
          <div>
            <label className="label text-xs">Relationship</label>
            <select
              className="input"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            >
              {RELATIONSHIPS.filter((r) => r.value !== "none").map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" disabled={creating}>
            {creating ? "Creating…" : "Create account"}
          </button>
        </form>
      </aside>
    </div>
  );
}
