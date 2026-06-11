"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

// ─── Username sanitizer ───────────────────────────────────────────────────────
function sanitizeUsername(raw: string) {
  return raw.toLowerCase().trim().replace(/\s+/g, "").replace(/[^a-z0-9_]/g, "");
}

// ─── Suggested first vouchers ─────────────────────────────────────────────────
const VOUCH_SUGGESTIONS = [
  { icon: "🎓", label: "A professor",        placeholder: "professor@university.edu" },
  { icon: "💼", label: "A manager or boss",  placeholder: "manager@company.com"      },
  { icon: "👥", label: "A teammate",         placeholder: "teammate@email.com"        },
  { icon: "🤝", label: "A client",           placeholder: "client@company.com"        },
];

// ─── Shared styles ────────────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3.5 text-sm " +
  "text-white placeholder-white/20 outline-none focus:border-purple-500/60 transition-colors";

// ─── Step bar ─────────────────────────────────────────────────────────────────
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

// ─── Nav buttons ─────────────────────────────────────────────────────────────
function NavButtons({
  onBack,
  onNext,
  nextLabel = "Continue →",
  canNext = true,
  loading = false,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  canNext?: boolean;
  loading?: boolean;
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
          disabled={!canNext || loading}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                     text-sm font-semibold text-white transition-opacity
                     disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90
                     flex items-center gap-2"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10"
                stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {nextLabel}
        </button>
      )}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({
  step,
  total = 4,
  children,
}: {
  step: number;
  total?: number;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#080808] text-white flex items-center justify-center px-4 py-12">
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(139,92,246,0.15), transparent)",
        }}
      />
      <div className="relative z-10 w-full max-w-lg">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
          <span className="text-xs font-semibold tracking-widest uppercase text-white/50">
            TrustCard
          </span>
        </div>
        <StepBar current={step} total={total} />
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          {children}
        </div>
      </div>
    </main>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const supabase = useRef(createClient()).current;
  const router   = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [step, setStep] = useState(0);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [school,   setSchool]   = useState("");
  const [major,    setMajor]    = useState("");
  const [bio,      setBio]      = useState("");

  // First vouch request fields
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null);
  const [voucherEmail,  setVoucherEmail]  = useState("");
  const [vouchTypeId,   setVouchTypeId]   = useState<number | null>(null);
  const [vouchTypes,    setVouchTypes]    = useState<{ id: number; name: string; slug: string }[]>([]);
  const [vouchSending,  setVouchSending]  = useState(false);
  const [vouchLink,     setVouchLink]     = useState("");
  const [vouchCopied,   setVouchCopied]   = useState(false);

  // Username status
  const [usernameError,     setUsernameError]     = useState("");
  const [usernameChecking,  setUsernameChecking]  = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Submit status
  const [submitError, setSubmitError] = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  // ── Username ───────────────────────────────────────────────────────────────
  function handleUsernameChange(raw: string) {
    setUsername(sanitizeUsername(raw));
    setUsernameAvailable(null);
    setUsernameError("");
  }

  async function checkUsername() {
    if (username.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return false;
    }
    setUsernameChecking(true);
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    setUsernameChecking(false);
    if (data) {
      setUsernameError("This username is already taken.");
      setUsernameAvailable(false);
      return false;
    }
    setUsernameAvailable(true);
    return true;
  }

  async function advanceFromStep1() {
    const ok = await checkUsername();
    if (ok) setStep(2);
  }

  // ── Create profile ─────────────────────────────────────────────────────────
  async function createProfile() {
    setSubmitError("");
    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSubmitError("You need to sign in first.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: fullName,
      username,
      school,
      major,
      bio,
    });

    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }

    // Load vouch types for the next step
    const { data: types } = await supabase
      .from("vouch_types")
      .select("id, name, slug")
      .order("id")
      .limit(1); // just pick the first type as default for the nudge

    if (types && types.length > 0) {
      setVouchTypes(types);
      setVouchTypeId(types[0].id);
    }

    setSubmitting(false);
    setStep(3); // go to first vouch nudge
  }

  // ── Send first vouch request ───────────────────────────────────────────────
  async function sendFirstVouch() {
    if (!voucherEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voucherEmail)) return;

    setVouchSending(true);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { setVouchSending(false); return; }

    const { data, error } = await supabase
      .from("vouch_requests")
      .insert({
        requester_id:   userData.user.id,
        receiver_email: voucherEmail.toLowerCase().trim(),
        vouch_type_id:  vouchTypeId,
        message: `Hey! I just created my TrustCard profile — it's a reputation page that lets people verify who I am before we work together. Would you be willing to give me a quick vouch? It only takes 2 minutes.`,
      })
      .select()
      .single();

    setVouchSending(false);

    if (error || !data) return;

    const link = `${location.origin}/vouch/${data.public_token}`;
    setVouchLink(link);
  }

  async function copyVouchLink() {
    await navigator.clipboard.writeText(vouchLink);
    setVouchCopied(true);
    setTimeout(() => setVouchCopied(false), 2500);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 0 — Full name
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <Shell step={0}>
        <h2 className="text-xl font-bold mb-1">What's your name?</h2>
        <p className="text-sm text-white/40 mb-6">
          This is how you'll appear on your TrustCard.
        </p>
        <input
          className={inputCls}
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fullName.trim() && setStep(1)}
          autoFocus
        />
        <NavButtons onNext={() => setStep(1)} canNext={fullName.trim().length >= 2} />
      </Shell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 1 — Username
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <Shell step={1}>
        <h2 className="text-xl font-bold mb-1">Choose your username</h2>
        <p className="text-sm text-white/40 mb-6">
          Your public TrustCard will live at{" "}
          <span className="text-white/60">trustcard.app/u/</span>
          <span className="text-purple-400">{username || "username"}</span>
        </p>
        <div className="relative">
          <input
            className={`${inputCls} pr-10 ${
              usernameError
                ? "border-red-500/60 focus:border-red-400"
                : usernameAvailable
                ? "border-green-500/60"
                : ""
            }`}
            placeholder="username"
            value={username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            autoFocus
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameChecking && (
              <svg className="w-4 h-4 animate-spin text-white/30" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            {!usernameChecking && usernameAvailable === true && (
              <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {!usernameChecking && usernameAvailable === false && (
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>
        <p className="text-[11px] text-white/20 mt-1.5">
          Only lowercase letters, numbers, and underscores.
        </p>
        {usernameError && (
          <p className="text-sm text-red-400 mt-2">{usernameError}</p>
        )}
        <NavButtons
          onBack={() => setStep(0)}
          onNext={advanceFromStep1}
          nextLabel={usernameChecking ? "Checking…" : "Continue →"}
          canNext={username.length >= 3 && !usernameChecking}
          loading={usernameChecking}
        />
      </Shell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 2 — School, major, bio
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Shell step={2}>
        <h2 className="text-xl font-bold mb-1">A little more about you</h2>
        <p className="text-sm text-white/40 mb-6">
          All optional — you can fill this in later from your dashboard.
        </p>
        <div className="space-y-3">
          <input
            className={inputCls}
            placeholder="School or university"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Major or field"
            value={major}
            onChange={(e) => setMajor(e.target.value)}
          />
          <textarea
            className={`${inputCls} min-h-24 resize-none`}
            placeholder="Short bio — what do you want people to know about you?"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
          />
          {bio.length > 0 && (
            <p className="text-[11px] text-white/20 text-right">{bio.length} / 200</p>
          )}
        </div>
        {submitError && <p className="text-sm text-red-400 mt-4">{submitError}</p>}
        <NavButtons
          onBack={() => setStep(1)}
          onNext={createProfile}
          nextLabel={submitting ? "Creating profile…" : "Create my TrustCard →"}
          loading={submitting}
        />
      </Shell>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Step 3 — First vouch nudge
  // ─────────────────────────────────────────────────────────────────────────────
  if (step === 3) {

    // ── Sub-state: link generated — show share screen ─────────────────────────
    if (vouchLink) {
      return (
        <Shell step={3}>
          {/* Success icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400
                       flex items-center justify-center mx-auto mb-6"
          >
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </motion.div>

          <h2 className="text-2xl font-bold text-center mb-2">Request created!</h2>
          <p className="text-white/40 text-sm text-center mb-6 leading-relaxed">
            Copy this link and send it to{" "}
            <span className="text-white/70 font-medium">{voucherEmail}</span>.
            <br />They don't need an account to vouch for you.
          </p>

          {/* Link box */}
          <div className="rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 py-3 mb-4">
            <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1">Vouch link</p>
            <p className="text-sm text-purple-300 break-all">{vouchLink}</p>
          </div>

          {/* Copy button */}
          <button
            onClick={copyVouchLink}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                       py-3.5 text-sm font-semibold text-white hover:opacity-90
                       transition-opacity flex items-center justify-center gap-2 mb-3"
          >
            <AnimatePresence mode="wait">
              {vouchCopied ? (
                <motion.span key="copied"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </motion.span>
              ) : (
                <motion.span key="copy"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  Copy Link
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Share shortcuts */}
          <div className="grid grid-cols-2 gap-2 mb-6">
            {/* WhatsApp */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `Hey! I just set up my TrustCard — would you vouch for me? Takes 2 min: ${vouchLink}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border
                         border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60
                         hover:text-white hover:border-white/20 transition-colors"
            >
              <span>💬</span> WhatsApp
            </a>
            {/* Email */}
            <a
              href={`mailto:${voucherEmail}?subject=${encodeURIComponent(
                "Can you vouch for me on TrustCard?"
              )}&body=${encodeURIComponent(
                `Hey,\n\nI just set up my TrustCard profile — it's a reputation page that shows verified vouches from people I've worked with.\n\nWould you be willing to give me a quick vouch? It only takes 2 minutes:\n\n${vouchLink}\n\nThanks!`
              )}`}
              className="flex items-center justify-center gap-2 rounded-xl border
                         border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60
                         hover:text-white hover:border-white/20 transition-colors"
            >
              <span>✉️</span> Email
            </a>
          </div>

          {/* Go to dashboard */}
          <button
            onClick={() => router.push(next)}
            className="w-full text-sm text-white/30 hover:text-white/60
                       transition-colors text-center"
          >
            Go to my dashboard →
          </button>
        </Shell>
      );
    }

    // ── Sub-state: picking who to ask ─────────────────────────────────────────
    return (
      <Shell step={3}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-bold">Your card is ready.</h2>
          {/* Skip */}
          <button
            onClick={() => router.push(next)}
            className="text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            Skip for now
          </button>
        </div>

        <p className="text-sm text-white/40 mb-6 leading-relaxed">
          One vouch turns an empty card into a credible one.
          Who is the <span className="text-white/70 font-medium">one person</span> you'd
          most want to vouch for you?
        </p>

        {/* Suggestion pills */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {VOUCH_SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setSelectedSuggestion(i);
                setVoucherEmail("");
              }}
              className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm
                font-medium transition-all duration-200 text-left
                ${selectedSuggestion === i
                  ? "border-purple-500 bg-purple-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:text-white/70"
                }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Email input — shown once a suggestion is picked */}
        <AnimatePresence>
          {selectedSuggestion !== null && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mb-2"
            >
              <label className="text-xs text-white/30 uppercase tracking-widest block mb-2">
                Their email
              </label>
              <input
                type="email"
                className={inputCls}
                placeholder={VOUCH_SUGGESTIONS[selectedSuggestion].placeholder}
                value={voucherEmail}
                onChange={(e) => setVoucherEmail(e.target.value)}
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* What happens note */}
        <p className="text-[11px] text-white/20 leading-relaxed mb-1">
          They'll get a link — no account needed. The vouch takes 2 minutes and
          immediately appears on your public card.
        </p>

        <NavButtons
          onNext={sendFirstVouch}
          nextLabel={
            vouchSending
              ? "Sending…"
              : "Send vouch request →"
          }
          canNext={
            selectedSuggestion !== null &&
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(voucherEmail) &&
            !vouchSending
          }
          loading={vouchSending}
        />
      </Shell>
    );
  }

  return null;
}