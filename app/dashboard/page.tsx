// app/dashboard/page.tsx
import { createClient } from "@/lib/supabaseServer";
import Link from "next/link";
import CopyButton from "@/components/CopyButton";
import { redirect } from "next/navigation";

// ─── Trust Score Ring ─────────────────────────────────────────────────────────
function TrustRing({ score }: { score: number }) {
  const radius       = 40;
  const circumference = 2 * Math.PI * radius;
  const offset       = circumference - (Math.min(score, 100) / 100) * circumference;
  const color        = score >= 70 ? "#22c55e" : score >= 40 ? "#a855f7" : "#6b7280";

  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} strokeWidth="7"
          className="fill-none stroke-white/10" />
        <circle cx="48" cy="48" r={radius} strokeWidth="7"
          fill="none" stroke={color} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{score}</span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wide">Trust</span>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-green-500/15 text-green-300 border-green-500/20",
    pending:   "bg-yellow-500/15 text-yellow-300 border-yellow-500/20",
    expired:   "bg-red-500/15 text-red-300 border-red-500/20",
  };
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize
                      ${map[status] ?? "bg-white/10 text-gray-300 border-white/10"}`}>
      {status}
    </span>
  );
}

// ─── Star rating ──────────────────────────────────────────────────────────────
function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i}
          className={`w-3.5 h-3.5 ${i < value ? "text-purple-400" : "text-white/15"}`}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969
            0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755
            1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197
            -1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81
            .588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Vouch icons ──────────────────────────────────────────────────────────────
const VOUCH_ICONS: Record<string, string> = {
  reliability:   "🏠",
  work_ethic:    "💼",
  skill:         "🔧",
  character:     "💛",
  financial:     "💰",
  collaboration: "🤝",
};

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ message, cta, href }: {
  message: string; cta?: string; href?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center">
      <p className="text-gray-500 text-sm">{message}</p>
      {cta && href && (
        <Link href={href}
          className="mt-4 inline-block text-sm text-purple-400
                     hover:text-purple-300 transition-colors">
          {cta} →
        </Link>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (!profile) redirect("/onboarding");

  const [{ data: sentRequests }, { data: receivedVouches }] = await Promise.all([
    supabase
      .from("vouch_requests")
      .select("*, vouch_types(name, slug)")
      .eq("requester_id", userData.user.id)
      .order("created_at", { ascending: false }),

    supabase
      .from("vouches")
      .select(`
        *,
        vouch_types(name, slug),
        giver:profiles!vouches_giver_id_fkey(full_name, username)
      `)
      .eq("receiver_id", userData.user.id)
      .order("created_at", { ascending: false }),
  ]);

  const completedVouches = sentRequests?.filter(r => r.status === "completed").length ?? 0;
  const pendingVouches   = sentRequests?.filter(r => r.status === "pending").length ?? 0;
  const siteUrl          = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <main className="relative min-h-screen bg-[#080808] text-white">

      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(139,92,246,0.12), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-10">

        {/* ── Top nav ────────────────────────────────────────────────────────── */}
        <nav className="flex items-center justify-between mb-10">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
            <span className="font-semibold text-sm">TrustCard</span>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Fix: copy the public card URL */}
            <CopyButton
              text={`${siteUrl}/u/${profile.username}`}
            />
            <Link
              href={`/u/${profile.username}`}
              className="text-sm rounded-full border border-white/10 bg-white/5
                         hover:bg-white/10 px-4 py-2 transition-colors hidden sm:block"
            >
              View Card →
            </Link>
          </div>
        </nav>

        {/* ── Profile header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-8">
          <TrustRing score={profile.trust_score ?? 0} />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">
              {profile.full_name}
            </h1>
            <p className="text-gray-400 mt-0.5">@{profile.username}</p>
            {/* Fix: was profile.headline — correct field is profile.bio */}
            {profile.bio && (
              <p className="mt-2 text-sm text-gray-300 italic">
                "{profile.bio}"
              </p>
            )}
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {[
            {
              label: "Trust Score",
              value: profile.trust_score ?? 0,
              sub:   "out of 100",
              color: "text-purple-400",
            },
            {
              label: "Vouches",
              value: receivedVouches?.length ?? 0,
              sub:   "received",
              color: "text-cyan-400",
            },
            {
              label: "Requests",
              value: sentRequests?.length ?? 0,
              sub:   `${completedVouches} completed`,
              color: "text-white",
            },
            {
              label: "Pending",
              value: pendingVouches,
              sub:   "awaiting reply",
              color: "text-yellow-400",
            },
          ].map((s) => (
            <div key={s.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                {s.label}
              </p>
              <p className={`text-3xl sm:text-4xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── CTAs ────────────────────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {/* Request a vouch */}
          <Link
            href="/request-vouch"
            className="flex items-center justify-between rounded-2xl
                       bg-gradient-to-r from-purple-600/80 to-cyan-600/80
                       border border-purple-500/30 p-5 sm:p-6
                       hover:opacity-90 transition-opacity group"
          >
            <div>
              <h2 className="text-base font-bold">Request a Vouch</h2>
              <p className="text-purple-100/70 text-sm mt-0.5">
                Ask someone to verify your reputation.
              </p>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform shrink-0 ml-3">
              →
            </span>
          </Link>

          {/* Trust Resume */}
          <Link
            href="/trust-resume"
            className="flex items-center justify-between rounded-2xl
                       border border-white/10 bg-white/5 p-5 sm:p-6
                       hover:bg-white/[0.07] transition-colors group"
          >
            <div>
              <h2 className="text-base font-bold">Trust Resume PDF</h2>
              <p className="text-gray-400 text-sm mt-0.5">
                Download your vouches as a shareable PDF.
              </p>
            </div>
            <span className="text-xl group-hover:translate-x-1 transition-transform shrink-0 ml-3">
              →
            </span>
          </Link>
        </div>

        {/* ── Two-column section ───────────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-8">

          {/* Sent Requests */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Sent Requests</h2>
              <span className="text-xs text-gray-500">
                {sentRequests?.length ?? 0} total
              </span>
            </div>

            <div className="space-y-3">
              {sentRequests?.length ? (
                sentRequests.map((request) => {
                  const slug = request.vouch_types?.slug ?? "";
                  // Fix: use public_token not id for the vouch link
                  const vouchUrl = `${siteUrl}/vouch/${request.public_token}`;
                  return (
                    <div key={request.id}
                      className="rounded-2xl border border-white/10 bg-white/5
                                 p-4 sm:p-5 hover:bg-white/[0.07] transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xl shrink-0">
                            {VOUCH_ICONS[slug] ?? "🤝"}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {request.vouch_types?.name ?? "Vouch"}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                              {request.receiver_email}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={request.status} />
                      </div>

                      {request.status === "pending" && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Link
                            href={`/vouch/${request.public_token}`}
                            className="rounded-full bg-white/10 hover:bg-white/20
                                       text-white px-3 py-1.5 text-xs font-medium
                                       transition-colors"
                          >
                            Open link
                          </Link>
                          <CopyButton text={vouchUrl} />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  message="No vouch requests sent yet."
                  cta="Request your first vouch"
                  href="/request-vouch"
                />
              )}
            </div>
          </div>

          {/* Received Vouches */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Received Vouches</h2>
              <span className="text-xs text-gray-500">
                {receivedVouches?.length ?? 0} verified
              </span>
            </div>

            <div className="space-y-3">
              {receivedVouches?.length ? (
                receivedVouches.map((vouch) => {
                  const slug = vouch.vouch_types?.slug ?? "";
                  return (
                    <div key={vouch.id}
                      className="rounded-2xl border border-white/10 bg-white/5
                                 p-4 sm:p-5 hover:bg-white/[0.07] transition-colors">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-xl mt-0.5 shrink-0">
                          {VOUCH_ICONS[slug] ?? "🤝"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-sm truncate">
                              {vouch.vouch_types?.name ?? "Vouch"}
                            </p>
                            <Stars value={vouch.rating_work_again ?? 0} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            From{" "}
                            <span className="text-gray-300">
                              {vouch.giver?.full_name ?? "Verified user"}
                            </span>
                            {vouch.giver?.username && (
                              <span className="text-gray-500">
                                {" "}· @{vouch.giver.username}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {vouch.comment && (
                        <p className="text-sm text-gray-300 leading-relaxed
                                      border-l-2 border-purple-500/40 pl-3 italic">
                          "{vouch.comment}"
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  message="No vouches received yet. Request one to get started."
                  cta="Request a vouch"
                  href="/request-vouch"
                />
              )}
            </div>
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row
                        items-center justify-between gap-4">
          <p className="text-xs text-gray-600 uppercase tracking-widest">
            TrustCard · Reputation you own
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <Link href={`/u/${profile.username}`}
              className="hover:text-white transition-colors">
              Public card
            </Link>
            <Link href="/trust-resume"
              className="hover:text-white transition-colors">
              Trust resume
            </Link>
            <Link href="/request-vouch"
              className="hover:text-white transition-colors">
              Request vouch
            </Link>
          </div>
        </div>

      </div>
    </main>
  );
}
