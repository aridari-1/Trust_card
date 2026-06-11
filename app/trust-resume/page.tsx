// app/trust-resume/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
type Profile = {
  full_name: string;
  username: string;
  school: string | null;
  major: string | null;
  bio: string | null;
  trust_score: number;
};

// ─── Context options ──────────────────────────────────────────────────────────
const CONTEXTS = [
  {
    id: "all",
    label: "Full Profile",
    icon: "🪪",
    description: "All vouches — complete picture of who you are",
  },
  {
    id: "work",
    label: "Work / Internship",
    icon: "💼",
    description: "Manager, coworker, collaborator, and mentor vouches only",
  },
  {
    id: "academic",
    label: "Academic / Scholarship",
    icon: "🎓",
    description: "Professor, classmate, and mentor vouches only",
  },
  {
    id: "rental",
    label: "Rental / Housing",
    icon: "🏠",
    description: "Roommate and reliability vouches only",
  },
  {
    id: "freelance",
    label: "Freelance / Client Work",
    icon: "🔧",
    description: "Client, collaborator, and skill vouches only",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TrustResumePage() {
  const supabase = useRef(createClient()).current;
  const router   = useRouter();

  const [profile, setProfile]       = useState<Profile | null>(null);
  const [context, setContext]       = useState("all");
  const [loading, setLoading]       = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError]           = useState("");

  // ── Load current user profile ──────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { router.push("/auth"); return; }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username, school, major, bio, trust_score")
        .eq("id", userData.user.id)
        .single();

      if (!profileData) { router.push("/onboarding"); return; }

      setProfile(profileData);
      setLoading(false);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Generate PDF ───────────────────────────────────────────────────────────
  async function generatePDF() {
    setError("");
    setGenerating(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");

      // Get the session token to pass to the API route
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("No session");

      const res = await fetch(
        `/api/trust-resume?context=${context}&userId=${userData.user.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to generate PDF");
      }

      // Download the PDF
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `trustcard-${profile?.username ?? "resume"}-${context}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
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
          <span className="text-sm">Loading your profile…</span>
        </div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Main UI
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080808] text-white px-4 py-12">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.15), transparent)",
        }}
      />

      <div className="relative z-10 mx-auto max-w-2xl">

        {/* Nav */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
            <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
              TrustCard
            </span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-white/30 hover:text-white/60 transition-colors uppercase tracking-widest"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Trust Resume</h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Generate a one-page PDF showing your verified reputation.
            Choose what to include based on who you're sending it to.
          </p>
        </div>

        {/* Profile preview */}
        {profile && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 mb-8
                          flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/30
                            to-cyan-400/30 border border-white/10 flex items-center
                            justify-center text-lg font-bold text-white/60 shrink-0">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{profile.full_name}</p>
              <p className="text-xs text-white/40 mt-0.5">
                @{profile.username}
                {profile.school && ` · ${profile.school}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-white">{profile.trust_score}</div>
              <div className="text-[10px] text-white/30 uppercase tracking-widest">Trust Score</div>
            </div>
          </div>
        )}

        {/* Context picker */}
        <div className="mb-8">
          <label className="text-xs text-white/30 uppercase tracking-widest block mb-3">
            Who are you sending this to?
          </label>
          <div className="space-y-2">
            {CONTEXTS.map((ctx) => (
              <button
                key={ctx.id}
                onClick={() => setContext(ctx.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-all duration-200
                  flex items-start gap-3
                  ${context === ctx.id
                    ? "border-purple-500 bg-purple-500/15"
                    : "border-white/[0.08] bg-white/[0.03] hover:border-white/15 hover:bg-white/5"
                  }`}
              >
                <span className="text-xl mt-0.5 shrink-0">{ctx.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{ctx.label}</p>
                  <p className="text-xs text-white/40 mt-0.5">{ctx.description}</p>
                </div>
                {context === ctx.id && (
                  <svg
                    className="w-4 h-4 text-purple-400 shrink-0 mt-0.5"
                    fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* What's included note */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 mb-8">
          <p className="text-xs text-white/30 leading-relaxed">
            <span className="text-white/50 font-medium">What's included: </span>
            Your name, trust score, vouch summary, and the vouches matching this context —
            each with the voucher's relationship, duration, and credibility level.
            A QR code links to your live public card.
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}

        {/* Generate button */}
        <button
          onClick={generatePDF}
          disabled={generating}
          className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                     py-4 text-sm font-semibold text-white hover:opacity-90
                     transition-opacity disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Generating PDF…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Trust Resume PDF
            </>
          )}
        </button>

        <p className="text-center text-xs text-white/20 mt-4">
          The PDF is generated fresh each time — always reflects your latest vouches.
        </p>

      </div>
    </main>
  );
}
