"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type VouchType = {
  id: number;
  slug: string;
  name: string;
  description: string;
};

const VOUCH_ICONS: Record<string, string> = {
  reliability:   "🏠",
  work_ethic:    "💼",
  skill:         "🔧",
  character:     "💛",
  financial:     "💰",
  collaboration: "🤝",
};

const inputCls =
  "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 text-sm " +
  "text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-colors";

export default function RequestVouchPage() {
  // createClient is stable — store it in a ref to avoid useEffect re-runs
  const supabase = useRef(createClient()).current;

  const [receiverEmail, setReceiverEmail] = useState("");
  const [message, setMessage]             = useState("");
  const [vouchTypes, setVouchTypes]       = useState<VouchType[]>([]);
  const [vouchTypeId, setVouchTypeId]     = useState<number | null>(null);
  const [shareLink, setShareLink]         = useState("");
  const [error, setError]                 = useState("");
  const [success, setSuccess]             = useState("");
  const [loading, setLoading]             = useState(false);
  const [copied, setCopied]               = useState(false);

  // ── Load vouch types once ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadTypes() {
      const { data } = await supabase
        .from("vouch_types")
        .select("*")
        .order("id");

      if (data) {
        setVouchTypes(data);
        setVouchTypeId(data[0]?.id ?? null);
      }
    }
    loadTypes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Send request ───────────────────────────────────────────────────────────
  async function sendRequest() {
    setError("");
    setSuccess("");
    setShareLink("");

    // Basic email validation
    if (!receiverEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiverEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!vouchTypeId) {
      setError("Please choose a vouch type.");
      return;
    }

    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("You need to sign in first.");
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("vouch_requests")
      .insert({
        requester_id:   userData.user.id,
        receiver_email: receiverEmail.toLowerCase().trim(),
        vouch_type_id:  vouchTypeId,
        message,
      })
      .select()
      .single();

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const link = `${location.origin}/vouch/${data.public_token}`;
    setShareLink(link);
    setSuccess("Request created! Copy the link below and send it directly.");
  }

  // ── Copy link ──────────────────────────────────────────────────────────────
  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  // ── Reset to send another ──────────────────────────────────────────────────
  function reset() {
    setShareLink("");
    setSuccess("");
    setError("");
    setReceiverEmail("");
    setMessage("");
    setCopied(false);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Success state
  // ─────────────────────────────────────────────────────────────────────────────
  if (shareLink) {
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
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-lg"
        >
          <div className="flex items-center gap-2 mb-8">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
            <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
              TrustCard
            </span>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 text-center">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400
                         flex items-center justify-center mx-auto mb-6"
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.102-1.101" />
              </svg>
            </motion.div>

            <h2 className="text-2xl font-bold mb-2">Link ready to send</h2>
            <p className="text-white/40 text-sm mb-6 leading-relaxed">
              Copy this link and send it to{" "}
              <span className="text-white/70 font-medium">{receiverEmail}</span>.
              <br />They don't need an account to give the vouch.
            </p>

            {/* Link display */}
            <div className="rounded-xl bg-white/[0.04] border border-white/8 px-4 py-3 mb-4 text-left">
              <p className="text-xs text-white/20 uppercase tracking-widest mb-1">Vouch link</p>
              <p className="text-sm text-purple-300 break-all">{shareLink}</p>
            </div>

            {/* Copy button */}
            <button
              onClick={copyLink}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                         py-3.5 text-sm font-semibold text-white hover:opacity-90
                         transition-all flex items-center justify-center gap-2"
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Copy Link
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between text-sm">
              <button
                onClick={reset}
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                Request another →
              </button>
              <Link
                href="/dashboard"
                className="text-white/30 hover:text-white/60 transition-colors"
              >
                Dashboard →
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Form state
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-[#080808] text-white px-4 py-12">
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

        <h1 className="text-3xl font-bold mb-1">Request a Vouch</h1>
        <p className="text-white/40 text-sm mb-8 leading-relaxed">
          Ask someone who worked, studied, lived, or collaborated with you to
          verify your reputation. They'll get a link — no app required.
        </p>

        <div className="space-y-6">

          {/* Email */}
          <div>
            <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">
              Their email
            </label>
            <input
              type="email"
              className={`${inputCls} ${
                error && error.includes("email") ? "border-red-500/60" : ""
              }`}
              placeholder="friend@email.com"
              value={receiverEmail}
              onChange={(e) => {
                setReceiverEmail(e.target.value);
                setError("");
              }}
            />
          </div>

          {/* Vouch type */}
          <div>
            <label className="text-xs text-white/30 uppercase tracking-widest block mb-3">
              What kind of vouch?
            </label>
            <div className="grid gap-2">
              {vouchTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setVouchTypeId(type.id)}
                  className={`rounded-2xl border p-4 text-left transition-all duration-200
                    flex items-start gap-3
                    ${vouchTypeId === type.id
                      ? "border-purple-500 bg-purple-500/15"
                      : "border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/5"
                    }`}
                >
                  <span className="text-xl mt-0.5">
                    {VOUCH_ICONS[type.slug] ?? "🤝"}
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{type.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">{type.description}</p>
                  </div>
                  {vouchTypeId === type.id && (
                    <svg className="w-4 h-4 text-purple-400 ml-auto shrink-0 mt-0.5"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Personal note */}
          <div>
            <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">
              Personal note{" "}
              <span className="text-white/20 normal-case">(optional)</span>
            </label>
            <textarea
              className={`${inputCls} min-h-28 resize-none`}
              placeholder="e.g. We worked together on our senior project — could you vouch for my reliability and teamwork?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={300}
            />
            {message.length > 0 && (
              <p className="text-[11px] text-white/20 mt-1 text-right">
                {message.length} / 300
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Submit */}
          <button
            onClick={sendRequest}
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                       py-3.5 text-sm font-semibold text-white hover:opacity-90
                       transition-opacity disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {loading ? "Creating request…" : "Create Vouch Request →"}
          </button>

        </div>
      </div>
    </main>
  );
}
