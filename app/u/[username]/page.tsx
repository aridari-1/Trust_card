// app/u/[username]/page.tsx
import { createClient } from "@/lib/supabaseServer";
import { notFound } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Vouch {
  id: string;
  comment: string;
  rating_reliability: number;
  rating_communication: number;
  rating_teamwork: number;
  rating_work_again: number;
  created_at: string;
  relationship_type: string | null;
  relationship_duration: string | null;
  collaboration_context: string | null;
  credibility_weight: number | null;
  vouch_types: { name: string; slug: string } | null;
  giver: { full_name: string; username: string } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const VOUCH_ICONS: Record<string, string> = {
  reliability:   "🏠",
  work_ethic:    "💼",
  skill:         "🔧",
  character:     "💛",
  financial:     "💰",
  collaboration: "🤝",
};

const RELATIONSHIP_LABELS: Record<string, { label: string; icon: string }> = {
  professor:    { label: "Professor",    icon: "🎓" },
  manager:      { label: "Manager",      icon: "💼" },
  client:       { label: "Client",       icon: "🤝" },
  coworker:     { label: "Coworker",     icon: "👥" },
  collaborator: { label: "Collaborator", icon: "🔧" },
  classmate:    { label: "Classmate",    icon: "📚" },
  roommate:     { label: "Roommate",     icon: "🏠" },
  mentor:       { label: "Mentor",       icon: "⭐" },
  friend:       { label: "Friend",       icon: "💛" },
};

const DURATION_LABELS: Record<string, string> = {
  under_3mo: "< 3 months",
  "6_months": "~6 months",
  "1_year":   "~1 year",
  "2_years":  "2–3 years",
  "5_plus":   "5+ years",
};

function avg(vouch: Vouch) {
  const vals = [
    vouch.rating_reliability,
    vouch.rating_communication,
    vouch.rating_teamwork,
    vouch.rating_work_again,
  ].filter((v) => typeof v === "number" && v > 0);
  if (!vals.length) return 0;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function scoreColor(score: number) {
  if (score >= 70) return { ring: "#22c55e", glow: "rgba(34,197,94,0.15)"  };
  if (score >= 40) return { ring: "#a855f7", glow: "rgba(168,85,247,0.15)" };
  return               { ring: "#6b7280", glow: "rgba(107,114,128,0.15)" };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", year: "numeric",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {/* Fix: shortened label so 3-chip row doesn't clip at 375px */}
      <span className="text-[10px] uppercase tracking-widest text-white/30 font-medium truncate">
        {label}
      </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function MiniBar({ value, max = 5 }: { value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-white/40 w-5 text-right">{value}</span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const { ring } = scoreColor(score);
  return (
    // Fix: constrained size so ring doesn't overflow on small screens
    <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0">
      <svg className="-rotate-90 w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} strokeWidth="5"
          className="fill-none stroke-white/10" />
        <circle
          cx="50" cy="50" r={r} strokeWidth="5" fill="none"
          stroke={ring} strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (Math.min(score, 100) / 100) * c}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg sm:text-xl font-bold leading-none">{score}</span>
        <span className="text-[9px] tracking-widest uppercase text-white/30 mt-0.5">Score</span>
      </div>
    </div>
  );
}

function HoloStrip() {
  return (
    <div
      className="absolute inset-0 rounded-[2rem] pointer-events-none overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-[0.04]"
        style={{
          background:
            "repeating-linear-gradient(60deg, transparent, transparent 40px, rgba(255,255,255,0.6) 40px, rgba(255,255,255,0.6) 41px)",
        }}
      />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function CredibilityBadge({ weight }: { weight: number }) {
  const map: Record<number, { label: string; color: string }> = {
    1: { label: "Acquaintance",   color: "text-white/30 border-white/10"           },
    2: { label: "Known",          color: "text-blue-300/70 border-blue-400/20"     },
    3: { label: "Established",    color: "text-purple-300/80 border-purple-400/25" },
    4: { label: "Strong",         color: "text-cyan-300/80 border-cyan-400/25"     },
    5: { label: "High Authority", color: "text-green-300 border-green-400/30"      },
  };
  const entry = map[Math.min(weight, 5)] ?? map[1];
  return (
    <span
      className={`text-[10px] uppercase tracking-widest px-2.5 py-1
                  rounded-full border font-medium whitespace-nowrap ${entry.color}`}
    >
      {entry.label}
    </span>
  );
}

// ─── Identity card ────────────────────────────────────────────────────────────
function IdentityCard({
  profile,
  totalVouches,
  workAgainPct,
}: {
  profile: Record<string, any>;
  totalVouches: number;
  workAgainPct: number;
}) {
  const { ring, glow } = scoreColor(profile.trust_score ?? 0);

  return (
    <div
      className="relative rounded-[2rem] overflow-hidden p-6 sm:p-8 md:p-10"
      style={{
        background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #0f0f0f 100%)",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.08), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px ${glow}`,
      }}
    >
      <HoloStrip />

      {/* Top row — brand + chip */}
      <div className="relative flex items-start justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
          <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
            TrustCard
          </span>
        </div>
        {/* EMV chip */}
        <div
          className="w-10 h-8 rounded-md border border-white/10 opacity-40"
          style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,215,0,0.1))",
          }}
        >
          <div className="w-full h-[1px] bg-white/20 mt-[10px]" />
          <div className="w-full h-[1px] bg-white/20 mt-[4px]" />
        </div>
      </div>

      {/* Middle row — name + score ring */}
      {/*
        Fix: always flex-row so ring stays right-aligned on mobile.
        Name gets flex-1 + min-w-0 so long names truncate instead of
        pushing the ring off-screen.
      */}
      <div className="relative flex flex-row items-start justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
            {profile.full_name}
          </h1>
          <p className="text-white/40 text-sm mt-1.5 tracking-widest uppercase truncate">
            @{profile.username}
          </p>
          {(profile.school || profile.major) && (
            <p className="text-white/50 text-sm mt-2 truncate">
              {[profile.major, profile.school].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <ScoreRing score={profile.trust_score ?? 0} />
      </div>

      {/* Bottom row — data chips */}
      {/*
        Fix: gap-2 instead of gap-6 so the 3 chips have room at 375px.
        Labels shortened: "Endorse Rate" → "Endorse" to avoid clipping.
      */}
      <div className="relative grid grid-cols-3 gap-2 pt-5 border-t border-white/[0.08]">
        <Chip label="Vouches"  value={totalVouches} />
        <Chip label="Endorse"  value={`${workAgainPct}%`} />
        <Chip label="Since"    value={formatDate(profile.created_at)} />
      </div>

      {/* NFC icon */}
      <div className="absolute bottom-6 right-6 opacity-20">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5">
          <path d="M8.5 12a3.5 3.5 0 005 0" />
          <path d="M5.5 12a6.5 6.5 0 009 0" />
          <path d="M2.5 12a9.5 9.5 0 0013 0" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

// ─── Vouch card ───────────────────────────────────────────────────────────────
function VouchCard({ vouch }: { vouch: Vouch }) {
  const slug     = vouch.vouch_types?.slug ?? "";
  const average  = avg(vouch);
  const relInfo  = RELATIONSHIP_LABELS[vouch.relationship_type ?? ""] ?? null;
  const durLabel = DURATION_LABELS[vouch.relationship_duration ?? ""] ?? null;
  const weight   = vouch.credibility_weight ?? 1;

  const ratings = [
    { label: "Reliability",   value: vouch.rating_reliability   },
    { label: "Communication", value: vouch.rating_communication },
    { label: "Teamwork",      value: vouch.rating_teamwork      },
    { label: "Work Again",    value: vouch.rating_work_again    },
  ].filter((r) => r.value > 0);

  return (
    <div
      className="rounded-2xl border border-white/[0.08] p-5 sm:p-6 transition-colors
                 hover:border-white/15 hover:bg-white/[0.03]"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10
                        flex items-center justify-center text-lg shrink-0 mt-0.5"
          >
            {VOUCH_ICONS[slug] ?? "🤝"}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">
              {vouch.vouch_types?.name ?? "Vouch"}
            </p>
            {/* Relationship + duration + giver */}
            <p className="text-[11px] text-white/40 mt-0.5 flex items-center gap-1.5 flex-wrap">
              {relInfo && (
                <>
                  <span>{relInfo.icon}</span>
                  <span className="text-white/60 font-medium">{relInfo.label}</span>
                  {durLabel && (
                    <>
                      <span className="text-white/20">·</span>
                      <span>{durLabel}</span>
                    </>
                  )}
                  <span className="text-white/20">·</span>
                </>
              )}
              <span>
                {vouch.giver?.full_name ?? "Verified user"}
                {vouch.giver?.username && (
                  <span className="text-white/25"> @{vouch.giver.username}</span>
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Score + badge — stack vertically, right-aligned */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div
            className="text-lg font-bold"
            style={{
              background: "linear-gradient(90deg, #a855f7, #06b6d4)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {average}
          </div>
          <CredibilityBadge weight={weight} />
        </div>
      </div>

      {/* Collaboration context */}
      {vouch.collaboration_context && (
        <div
          className="mb-4 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08]
                      flex items-center gap-2"
        >
          <span className="text-white/30 text-xs">📋</span>
          <span className="text-xs text-white/50 font-medium">
            {vouch.collaboration_context}
          </span>
        </div>
      )}

      {/* Comment */}
      {vouch.comment && (
        <p className="text-sm text-white/60 leading-relaxed mb-5
                      border-l border-purple-500/30 pl-3 italic">
          "{vouch.comment}"
        </p>
      )}

      {/* Rating bars */}
      {/*
        Fix: grid-cols-[80px_1fr] instead of [110px_1fr] — 80px is enough
        for the label at 375px without squishing the bar.
      */}
      {ratings.length > 0 && (
        <div className="space-y-2.5">
          {ratings.map((r) => (
            <div key={r.label} className="grid grid-cols-[80px_1fr] items-center gap-3">
              <span className="text-[10px] text-white/30 uppercase tracking-wider truncate">
                {r.label}
              </span>
              <MiniBar value={r.value} />
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-white/20 uppercase tracking-widest">
          Verified · {formatDate(vouch.created_at)}
        </span>
        {weight >= 4 && (
          <span className="text-[10px] text-green-400/60 uppercase tracking-widest whitespace-nowrap">
            ✓ High credibility
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: vouches } = await supabase
    .from("vouches")
    .select(`
      *,
      vouch_types(name, slug),
      giver:profiles!vouches_giver_id_fkey(full_name, username)
    `)
    .eq("receiver_id", profile.id)
    .eq("is_public", true)
    .order("credibility_weight", { ascending: false })
    .order("created_at", { ascending: false });

  const totalVouches   = vouches?.length ?? 0;
  const workAgainCount = vouches?.filter((v) => v.rating_work_again >= 4).length ?? 0;
  const workAgainPct   = totalVouches
    ? Math.round((workAgainCount / totalVouches) * 100)
    : 0;

  return (
    <main
      className="min-h-screen text-white px-4 py-10 sm:py-12"
      style={{ background: "#080808" }}
    >
      {/* Ambient glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(139,92,246,0.1), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl">

        {/* Back link */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <a
            href="/"
            className="text-xs text-white/30 hover:text-white/60
                       transition-colors uppercase tracking-widest"
          >
            ← TrustCard
          </a>
          <span className="text-xs text-white/20 uppercase tracking-widest">
            Public Profile
          </span>
        </div>

        {/* The Card */}
        <IdentityCard
          profile={profile}
          totalVouches={totalVouches}
          workAgainPct={workAgainPct}
        />

        {/* Bio */}
        {profile.bio && (
          <p className="mt-6 sm:mt-8 text-white/50 text-sm leading-relaxed text-center px-2 sm:px-4">
            {profile.bio}
          </p>
        )}

        {/* Vouches */}
        <div className="mt-10 sm:mt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-semibold">Verified Vouches</h2>
              <p className="text-xs text-white/30 mt-0.5 uppercase tracking-widest">
                {totalVouches} on record
              </p>
            </div>
            {workAgainPct > 0 && (
              <div className="text-right">
                <div className="text-xl font-bold text-green-400">{workAgainPct}%</div>
                <div className="text-[10px] text-white/30 uppercase tracking-wide">
                  would endorse
                </div>
              </div>
            )}
          </div>

          {vouches?.length ? (
            <div className="space-y-4">
              {(vouches as Vouch[]).map((vouch) => (
                <VouchCard key={vouch.id} vouch={vouch} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 sm:p-12 text-center">
              <p className="text-white/20 text-sm uppercase tracking-widest">
                No public vouches yet
              </p>
              <p className="text-white/[0.15] text-xs mt-2">
                This TrustCard is just getting started.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-[11px] text-white/[0.15] uppercase tracking-widest">
            Powered by TrustCard · Reputation you own
          </p>
        </div>

      </div>
    </main>
  );
}
