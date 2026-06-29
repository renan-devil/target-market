"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const errorParam = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string>(
    errorParam === "invalid"
      ? "That sign-in link was invalid or expired. Request a new one."
      : errorParam === "missing"
        ? "No sign-in token was provided."
        : ""
  );
  const [devLink, setDevLink] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    setDevLink(null);
    try {
      const res = await fetch("/api/auth/magic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setStatus("sent");
      setMessage("Check your inbox for a sign-in link. It expires in 15 minutes.");
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">
          GTM
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">OSS GTM Tool</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in with your @oss.ventures account
        </p>
      </div>

      <div className="card p-6">
        {status === "sent" ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
              ✉️
            </div>
            <p className="text-sm text-slate-700">{message}</p>
            {devLink && (
              <div className="rounded-lg bg-slate-50 p-3 text-left text-xs">
                <p className="mb-1 font-medium text-slate-500">
                  Dev mode — your magic link:
                </p>
                <a
                  href={devLink}
                  className="break-all font-mono text-brand-600 hover:underline"
                >
                  {devLink}
                </a>
              </div>
            )}
            <button
              className="btn-secondary w-full"
              onClick={() => {
                setStatus("idle");
                setMessage("");
              }}
            >
              Use a different e-mail
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Work e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                placeholder="you@oss.ventures"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {message && (
              <p className="text-sm text-red-600" role="alert">
                {message}
              </p>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={status === "sending"}
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Access is limited to authorized OSS team members.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
