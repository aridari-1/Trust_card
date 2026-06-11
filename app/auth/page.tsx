"use client";

import { useState, Suspense } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

// ─── Inner component — uses useSearchParams so must be inside Suspense ────────
function AuthForm() {
  const supabase     = createClient();
  const searchParams = useSearchParams();
  const next         = searchParams.get("next") || "/onboarding";

  const [email,   setEmail]   = useState("");
  const [message, setMessage] = useState("");
  const [status,  setStatus]  = useState<"idle" | "loading" | "sent" | "error">("idle");

  async function signIn() {
    if (!email || status === "loading") return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMessage("Enter a valid email address.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("");

    // Fix: use NEXT_PUBLIC_SITE_URL env var when available so magic links
    // redirect to the deployed URL instead of localhost on mobile devices
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (typeof window !== "undefined" ? window.location.origin : "");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteUrl}${next}`,
      },
    });

    if (error) {
      setMessage(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") signIn();
  }

  return (
    <AnimatePresence mode="wait">

      {/* ── State: idle / loading / error ────────────────────────────────── */}
      {status !== "sent" && (
        <motion.div
          key="form"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -10 }}
          className="rounded-3xl border border-white/10 bg-white/5
                     backdrop-blur-xl p-8 shadow-2xl"
        >
          {/* Logo mark */}
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
            <span className="font-semibold text-white">TrustCard</span>
          </div>

          <h1 className="text-3xl font-bold leading-tight">
            Build your trust
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-cyan-400
                             bg-clip-text text-transparent">
              profile.
            </span>
          </h1>

          <p className="mt-3 text-gray-400 text-sm leading-relaxed">
            Enter your email and we'll send you a secure login link.
            No password needed.
          </p>

          {/* Input */}
          <div className="mt-8 relative">
            <input
              type="email"
              autoComplete="email"
              className={`w-full rounded-xl bg-white/5 border px-4 py-3.5
                         outline-none text-white placeholder-gray-500
                         transition-all duration-200 focus:bg-white/8
                         ${status === "error"
                           ? "border-red-500/60 focus:border-red-400"
                           : "border-white/10 focus:border-purple-500/60"
                         }`}
              placeholder="you@email.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              onKeyDown={handleKeyDown}
              disabled={status === "loading"}
            />
          </div>

          {/* Error message */}
          <AnimatePresence>
            {status === "error" && message && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 text-sm text-red-400"
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Submit */}
          <button
            onClick={signIn}
            disabled={status === "loading" || !email}
            className="mt-4 w-full rounded-xl py-3.5 font-semibold text-sm
                       transition-all duration-200 relative overflow-hidden
                       disabled:opacity-50 disabled:cursor-not-allowed
                       bg-gradient-to-r from-purple-600 to-cyan-500
                       hover:opacity-90 active:scale-[0.98]"
          >
            <AnimatePresence mode="wait">
              {status === "loading" ? (
                <motion.span
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Sending link...
                </motion.span>
              ) : (
                <motion.span
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Send Login Link →
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Trust nudge */}
          <p className="mt-6 text-center text-xs text-gray-600">
            No password stored. No spam. Unsubscribe anytime.
          </p>

          <div className="mt-8 pt-6 border-t border-white/5 flex items-center
                          justify-center gap-6 text-xs text-gray-600">
            <span>Free to join</span>
            <span>Ages 17–29</span>
            <span>2,400+ members</span>
          </div>
        </motion.div>
      )}

      {/* ── State: sent ──────────────────────────────────────────────────── */}
      {status === "sent" && (
        <motion.div
          key="sent"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-white/10 bg-white/5
                     backdrop-blur-xl p-10 shadow-2xl text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500
                       to-cyan-400 flex items-center justify-center mx-auto mb-6"
          >
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>

          <h2 className="text-2xl font-bold">Check your inbox</h2>
          <p className="mt-3 text-gray-400 text-sm leading-relaxed">
            We sent a secure login link to
            <br />
            <span className="text-white font-medium">{email}</span>
          </p>

          <p className="mt-6 text-xs text-gray-600 leading-relaxed">
            Didn't get it? Check your spam folder, or{" "}
            <button
              onClick={() => { setStatus("idle"); setMessage(""); }}
              className="text-purple-400 hover:text-purple-300 underline
                         underline-offset-2 transition-colors"
            >
              try again
            </button>
            .
          </p>
        </motion.div>
      )}

    </AnimatePresence>
  );
}

// ─── Page — wraps AuthForm in Suspense (required by Next.js for useSearchParams) ──
export default function AuthPage() {
  return (
    <main className="relative min-h-screen bg-[#080808] text-white flex items-center
                     justify-center px-6 overflow-hidden">

      {/* Background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.2), transparent)",
        }}
      />

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm text-gray-500 hover:text-white
                   transition-colors flex items-center gap-1.5"
      >
        ← TrustCard
      </Link>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Suspense
          fallback={
            <div className="rounded-3xl border border-white/10 bg-white/5
                            backdrop-blur-xl p-8 flex items-center justify-center min-h-[320px]">
              <svg className="w-5 h-5 animate-spin text-white/30" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </motion.div>
    </main>
  );
}
