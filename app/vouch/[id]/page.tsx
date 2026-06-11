"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ─── Constants ────────────────────────────────────────────────────────────────
const RELATIONSHIP_TYPES = [
  { value: "professor",    label: "Professor / Teacher",  icon: "🎓" },
  { value: "manager",      label: "Manager / Supervisor", icon: "💼" },
  { value: "client",       label: "Client",               icon: "🤝" },
  { value: "coworker",     label: "Coworker",             icon: "👥" },
  { value: "collaborator", label: "Collaborator",         icon: "🔧" },
  { value: "classmate",    label: "Classmate",            icon: "📚" },
  { value: "roommate",     label: "Roommate",             icon: "🏠" },
  { value: "mentor",       label: "Mentor / Coach",       icon: "⭐" },
  { value: "friend",       label: "Friend",               icon: "💛" },
];

const DURATIONS = [
  { value: "under_3mo", label: "Under 3 months" },
  { value: "6_months",  label: "About 6 months" },
  { value: "1_year",    label: "Around 1 year"  },
  { value: "2_years",   label: "2–3 years"      },
  { value: "5_plus",    label: "5+ years"       },
];

// ─── Credibility weight ───────────────────────────────────────────────────────
function computeWeight(type: string, duration: string): number {
  const highAuth = ["professor", "manager", "client", "mentor"];
  const midAuth  = ["coworker", "collaborator"];
  const longTerm = ["2_years", "5_plus"];
  const medTerm  = ["1_year"];

  if (highAuth.includes(type) && longTerm.includes(duration)) return 5;
  if (highAuth.includes(type) && medTerm.includes(duration))  return 4;
  if (midAuth.includes(type)  && (longTerm.includes(duration) || medTerm.includes(duration))) return 3;
  if (["classmate", "roommate"].includes(type))               return 2;
  return 1;
}

// ─── Trust score update (your existing logic, unchanged) ─────────────────────
async function updateTrustScore(
  supabase: ReturnType<typeof createClient>,
  receiverId: string
) {
  const { data: vouches } = await supabase
    .from("vouches")
    .select("rating_reliability, rating_communication, rating_teamwork, rating_work_again, credibility_weight")
    .eq("receiver_id", receiverId)
    .eq("is_public", true);

  if (!vouches || vouches.length === 0) return;

  // Weighted average — higher-authority vouches count more
  const totalWeight = vouches.reduce((sum, v) => sum + (v.credibility_weight ?? 1), 0);
  const weightedSum = vouches.reduce((sum, v) => {
    const avg =
      (v.rating_reliability + v.rating_communication +
       v.rating_teamwork + v.rating_work_again) / 4;
    return sum + avg * (v.credibility_weight ?? 1);
  }, 0);

  const averageOutOfFive = weightedSum / totalWeight;
  const trustScore = Math.round(averageOutOfFive * 20);

  await supabase
    .from("profiles")
    .update({ trust_score: trustScore })
    .eq("id", receiverId);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function StepBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i < current
              ? "bg-purple-500"
              : i === current
              ? "bg-purple-400"
              : "bg-white/10"
          }`}
        />
      ))}
    </div>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue →",
  canNext = true,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  canNext?: boolean;
}) {
  return (
    <div className={`flex mt-8 gap-3 ${onBack ? "justify-between" : "justify-end"}`}>
      {onBack && (
        <button
          onClick={onBack}
          className="px-5 py-3 rounded-xl border border-white/10 bg-white/5
                     text-sm text-white/50 hover:text-white transition-colors"
        >
          ← Back
        </button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          disabled={!canNext}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                     text-sm font-semibold text-white transition-opacity
                     disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-[130px_1fr_24px] items-center gap-3">
      <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-purple-500 cursor-pointer"
      />
      <span className="text-sm font-semibold text-white text-right">{value}</span>
    </div>
  );
}

function FormShell({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.15), transparent)",
        }}
      />
      <div className="relative z-10 w-full max-w-lg">
        {/* Brand */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
          <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
            TrustCard
          </span>
        </div>

        {step < 3 && <StepBar current={step} total={3} />}

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GiveVouchPage() {
  const supabase    = createClient();
  const router      = useRouter();
  const params      = useParams();
  const publicToken = params.id as string;

  // ── Data state ──────────────────────────────────────────────────────────────
  const [request, setRequest]           = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn]     = useState(false);
  const [loading, setLoading]           = useState(true);
  const [notice, setNotice]             = useState("");

  // ── Form state ──────────────────────────────────────────────────────────────
  const [step, setStep]         = useState(0);
  const [relType, setRelType]   = useState("");
  const [duration, setDuration] = useState("");
  const [context, setContext]   = useState("");
  const [comment, setComment]   = useState("");
  const [ratings, setRatings]   = useState({
    reliability: 3,
    communication: 3,
    teamwork: 3,
    workAgain: 3,
  });
  const [submitting, setSubmitting] = useState(false);

  // ── Load request ────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: requestData, error: requestError } = await supabase
        .from("vouch_requests")
        .select(`
          *,
          requester:profiles!vouch_requests_requester_id_fkey (
            id,
            full_name,
            username,
            school,
            major
          ),
          vouch_types (
            id,
            name,
            description
          )
        `)
        .eq("public_token", publicToken)
        .maybeSingle();

      if (requestError || !requestData) {
        setNotice("This vouch request was not found or has expired.");
        setLoading(false);
        return;
      }

      setRequest(requestData);

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        setIsSignedIn(false);
        setLoading(false);
        return;
      }

      setCurrentUserId(userData.user.id);

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (!existingProfile) {
        router.push(`/onboarding?next=/vouch/${publicToken}`);
        return;
      }

      setIsSignedIn(true);
      setLoading(false);
    }

    load();
  }, [publicToken]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submitVouch() {
    setNotice("");
    setSubmitting(true);

    if (!currentUserId || !request) {
      setNotice("Please sign in first.");
      setSubmitting(false);
      return;
    }

    if (currentUserId === request.requester_id) {
      setNotice("You cannot vouch for yourself.");
      setSubmitting(false);
      return;
    }

    const weight = computeWeight(relType, duration);

    const { error } = await supabase.from("vouches").insert({
      giver_id:              currentUserId,
      receiver_id:           request.requester_id,
      vouch_type_id:         request.vouch_type_id,
      // credibility fields
   
      relationship_type:     relType,
      relationship_duration: duration,
      collaboration_context: context || null,
      credibility_weight:    weight,
      // ratings
      rating_reliability:    ratings.reliability,
      rating_communication:  ratings.communication,
      rating_teamwork:       ratings.teamwork,
      rating_work_again:     ratings.workAgain,
      comment,
      is_public: true,
    });

    if (error) {
      setNotice(error.message);
      setSubmitting(false);
      return;
    }

    await supabase
      .from("vouch_requests")
      .update({ status: "completed" })
      .eq("public_token", publicToken);

    await updateTrustScore(supabase, request.requester_id);

    setStep(3); // success screen
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Loading
  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-white/40">
          <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">Loading vouch request…</span>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Error — no request found
  // ─────────────────────────────────────────────────────────────────────────────
  if (notice && !request) {
    return (
      <FormShell step={-1}>
        <p className="text-white/60 text-sm text-center">{notice}</p>
      </FormShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Not signed in — show gate screen (your existing design, upgraded)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.15), transparent)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="flex items-center gap-2 mb-8">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
            <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
              TrustCard
            </span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
            <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold mb-4">
              Vouch Request
            </p>
            <h1 className="text-3xl font-bold leading-tight">
              {request.requester?.full_name} is asking for your vouch.
            </h1>
            <p className="mt-3 text-white/40 text-sm leading-relaxed">
              Your vouch helps them prove their reputation before they have a long résumé.
              It takes about 2 minutes.
            </p>

            {request.message && (
              <div className="mt-6 rounded-xl bg-white/5 border border-white/8 p-4">
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">
                  Their note
                </p>
                <p className="text-sm text-white/60">{request.message}</p>
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-white/5">
              <p className="text-xs text-white/30 mb-4">
                Sign in to keep TrustCard vouches trustworthy — anonymous vouches aren't accepted.
              </p>
              <button
                onClick={() => router.push(`/auth?next=/vouch/${publicToken}`)}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                           py-3.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Sign in to give vouch →
              </button>
            </div>
          </div>
        </motion.div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 0 — Relationship type
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <FormShell step={0}>
        <h2 className="text-xl font-bold mb-1">
          How do you know {request.requester?.full_name}?
        </h2>
        <p className="text-sm text-white/40 mb-6">
          This gives your vouch context and weight.
        </p>
        <div className="flex flex-wrap gap-2">
          {RELATIONSHIP_TYPES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRelType(r.value)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm
                font-medium transition-all duration-200
                ${relType === r.value
                  ? "border-purple-500 bg-purple-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
            >
              <span>{r.icon}</span>
              <span>{r.label}</span>
            </button>
          ))}
        </div>
        <NavButtons onNext={() => setStep(1)} canNext={!!relType} />
      </FormShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 1 — Duration
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <FormShell step={1}>
        <h2 className="text-xl font-bold mb-1">How long have you known them?</h2>
        <p className="text-sm text-white/40 mb-6">
          Longer relationships carry more weight in the trust score.
        </p>
        <div className="flex flex-col gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={`w-full text-left px-5 py-4 rounded-xl border text-sm
                font-medium transition-all duration-200
                ${duration === d.value
                  ? "border-purple-500 bg-purple-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <NavButtons onBack={() => setStep(0)} onNext={() => setStep(2)} canNext={!!duration} />
      </FormShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 2 — Context, ratings, comment
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <FormShell step={2}>
        <h2 className="text-xl font-bold mb-1">
          Your vouch for {request.requester?.full_name}
        </h2>
        <p className="text-sm text-white/40 mb-6">
          Be specific — a detailed vouch is far more convincing.
        </p>

        {/* Collaboration context */}
        <div className="mb-6">
          <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">
            What did you do together?{" "}
            <span className="text-white/20 normal-case">(optional)</span>
          </label>
          <input
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="e.g. Senior Design Project · NYU · Fall 2024"
            maxLength={100}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3
                       text-sm text-white placeholder-white/20 outline-none
                       focus:border-purple-500/60 transition-colors"
          />
          <p className="text-[11px] text-white/20 mt-1.5">
            A project, class, company, or role. Adds specificity that ratings alone can't.
          </p>
        </div>

        {/* Ratings */}
        <div className="space-y-4 mb-6 p-4 rounded-xl bg-white/[0.03] border border-white/5">
          <RatingRow
            label="Reliability"
            value={ratings.reliability}
            onChange={(v) => setRatings((r) => ({ ...r, reliability: v }))}
          />
          <RatingRow
            label="Communication"
            value={ratings.communication}
            onChange={(v) => setRatings((r) => ({ ...r, communication: v }))}
          />
          <RatingRow
            label="Teamwork"
            value={ratings.teamwork}
            onChange={(v) => setRatings((r) => ({ ...r, teamwork: v }))}
          />
          <RatingRow
            label="Work Again"
            value={ratings.workAgain}
            onChange={(v) => setRatings((r) => ({ ...r, workAgain: v }))}
          />
        </div>

        {/* Comment */}
        <div className="mb-2">
          <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">
            Write your vouch
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={`What would you want someone to know about ${request.requester?.full_name}?`}
            rows={4}
            maxLength={400}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3
                       text-sm text-white placeholder-white/20 outline-none resize-none
                       focus:border-purple-500/60 transition-colors"
          />
          <p className="text-[11px] text-white/20 mt-1 text-right">
            {comment.length} / 400
          </p>
        </div>

        {notice && (
          <p className="text-sm text-red-400 mb-2">{notice}</p>
        )}

        <NavButtons
          onBack={() => setStep(1)}
          onNext={submitVouch}
          nextLabel={submitting ? "Submitting…" : "Submit Vouch"}
          canNext={comment.trim().length >= 20 && !submitting}
        />
      </FormShell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 3 — Success
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <FormShell step={3}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500
                   to-cyan-400 flex items-center justify-center mx-auto mb-6"
      >
        <svg
          className="w-8 h-8 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>

      <h2 className="text-2xl font-bold text-center">Vouch submitted</h2>
      <p className="text-white/40 text-sm text-center mt-3 leading-relaxed">
        Your vouch is now part of {request.requester?.full_name}'s TrustCard.
        <br />
        It carries your name and your word — that matters.
      </p>

      <div className="mt-8 pt-6 border-t border-white/5 text-center">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-white/30 hover:text-white/60 transition-colors"
        >
          Go to your dashboard →
        </button>
      </div>
    </FormShell>
  );
}
