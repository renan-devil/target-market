import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { claudeEnabled } from "@/lib/claude";
import { SignalAnalyzer } from "@/components/SignalAnalyzer";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const user = await getSessionUser();

  const profiles = user
    ? await prisma.icpProfile.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, analyzedAt: true, model: true },
      })
    : [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Signal Analyzer</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paste a company's website copy and/or describe your ICP. The tool
          surfaces the concrete, observable signals that indicate a strong fit —
          and can pre-filter the industrial map to match.
          {!claudeEnabled() && (
            <span className="ml-1 text-amber-600">
              (Running in heuristic mode — set ANTHROPIC_API_KEY for AI analysis.)
            </span>
          )}
        </p>
      </header>

      <SignalAnalyzer
        initialProfiles={profiles.map((p) => ({
          id: p.id,
          name: p.name,
          analyzedAt: p.analyzedAt ? p.analyzedAt.toISOString() : null,
          model: p.model,
        }))}
      />
    </div>
  );
}
