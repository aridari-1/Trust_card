"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";

// ─── Data ─────────────────────────────────────────────────────────────────────
const VOUCHES = [
  { icon: "💼", label: "Work Ethic",  name: "Sarah K.", role: "Former Manager"  },
  { icon: "🏠", label: "Reliability", name: "James T.", role: "Past Roommate"   },
  { icon: "🔧", label: "Skill",       name: "Priya M.", role: "Collaborator"    },
  { icon: "💛", label: "Character",   name: "Leo R.",   role: "Professor"       },
  { icon: "🤝", label: "Teamwork",    name: "Nina W.",  role: "Teammate"        },
  { icon: "💰", label: "Financial",   name: "Omar S.",  role: "Landlord"        },
];

const VOUCH_TILES_DEMO = [
  { icon: "🎓", label: "Professor vouch",  who: "Dr. Chen · 1 year"           },
  { icon: "💼", label: "Manager vouch",    who: "Stripe internship · 6 months" },
  { icon: "🏠", label: "Roommate vouch",   who: "James T. · 1 year"            },
];

const REL_OPTIONS = [
  { value: "professor",    label: "🎓 Professor",    high: true  },
  { value: "manager",      label: "💼 Manager",      high: true  },
  { value: "classmate",    label: "📚 Classmate",    high: false },
  { value: "roommate",     label: "🏠 Roommate",     high: false },
  { value: "collaborator", label: "🔧 Collaborator", high: false },
  { value: "mentor",       label: "⭐ Mentor",       high: true  },
];

const DUR_OPTIONS = [
  { value: "under_3mo", label: "Under 3 months", long: false },
  { value: "6_months",  label: "About 6 months", long: false },
  { value: "1_year",    label: "Around 1 year",  long: true  },
  { value: "2_years",   label: "2–3 years",      long: true  },
  { value: "5_plus",    label: "5+ years",        long: true  },
];

const DEMO_VOUCHES = [
  {
    icon: "🎓", type: "Work Ethic",
    meta: "Professor · ~1 year · Dr. Chen @drchen",
    ctx:  "Senior Capstone Project · NYU · Spring 2024",
    comment: "Alex delivered every milestone on time and elevated the work of everyone around him.",
    badge: "High authority", badgeCls: "high", avg: 4.8,
    bars: [
      { label: "Reliability", w: 100, val: 5 },
      { label: "Teamwork",    w: 100, val: 5 },
      { label: "Work again",  w: 100, val: 5 },
    ],
  },
  {
    icon: "💼", type: "Reliability",
    meta: "Manager · ~6 months · Sarah K. @sarahk",
    ctx:  "Summer Internship · Stripe · 2023",
    comment: "Proactive, clear communicator, and never needed to be asked twice.",
    badge: "Strong", badgeCls: "strong", avg: 4.7,
    bars: [
      { label: "Reliability",   w: 100, val: 5 },
      { label: "Communication", w: 80,  val: 4 },
      { label: "Work again",    w: 100, val: 5 },
    ],
  },
  {
    icon: "🏠", type: "Character",
    meta: "Roommate · ~1 year · James T. @jamest",
    ctx:  null,
    comment: "Paid rent on time every month, kept shared spaces clean, easy to communicate with.",
    badge: "Established", badgeCls: "estab", avg: 4.5,
    bars: [
      { label: "Reliability",   w: 100, val: 5 },
      { label: "Communication", w: 80,  val: 4 },
      { label: "Work again",    w: 80,  val: 4 },
    ],
  },
];

const TILE_DURATIONS = [4, 5, 4.5, 5.5, 4.2, 5.2];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeWeightLabel(rel: string | null, dur: string | null): string | null {
  if (!rel || !dur) return null;
  const relObj = REL_OPTIONS.find((r) => r.value === rel);
  const durObj = DUR_OPTIONS.find((d) => d.value === dur);
  if (!relObj || !durObj) return null;
  if (relObj.high && durObj.long)  return "High authority · 5× weight in trust score";
  if (relObj.high)                 return "Authority vouch · 3× weight in trust score";
  if (durObj.long)                 return "Established contact · 2× weight in trust score";
  return "Standard weight in trust score";
}

// ─── VouchTile — desktop only ─────────────────────────────────────────────────
function VouchTile({ vouch, style, delay, duration }: {
  vouch: (typeof VOUCHES)[0];
  style: React.CSSProperties;
  delay: number;
  duration: number;
}) {
  return (
    <motion.div
      className="absolute bg-white/5 border border-white/10 backdrop-blur-md
                 rounded-2xl px-4 py-3 flex items-center gap-3 w-52 shadow-xl"
      style={style}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: [0, -10, 0] }}
      transition={{
        opacity: { delay, duration: 0.6 },
        y: { delay, duration, repeat: Infinity, ease: "easeInOut" },
      }}
    >
      <span className="text-2xl">{vouch.icon}</span>
      <div>
        <p className="text-xs font-semibold text-white">{vouch.label}</p>
        <p className="text-xs text-gray-400">{vouch.name} · {vouch.role}</p>
      </div>
      <span className="ml-auto text-green-400 text-xs font-bold">✓</span>
    </motion.div>
  );
}

// ─── CursorGlow — desktop only, no SSR issues ─────────────────────────────────
function CursorGlow() {
  const x  = useMotionValue(-9999);
  const y  = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 80, damping: 20 });
  const sy = useSpring(y, { stiffness: 80, damping: 20 });
  useEffect(() => {
    const move = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [x, y]);
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-0 hidden lg:block">
      <motion.div
        className="pointer-events-none fixed z-0"
        style={{
          left: sx, top: sy,
          width: 600, height: 600,
          marginLeft: -300, marginTop: -300,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)",
        }}
      />
    </motion.div>
  );
}

// ─── TrustRing ────────────────────────────────────────────────────────────────
function TrustRing() {
  const [score, setScore] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      let c = 0;
      const iv = setInterval(() => { c++; setScore(c); if (c >= 74) clearInterval(iv); }, 18);
      return () => clearInterval(iv);
    }, 800);
    return () => clearTimeout(t);
  }, []);
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <div className="relative w-20 h-20 mx-auto mb-5">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} strokeWidth="6" className="stroke-white/10 fill-none" />
        <circle cx="44" cy="44" r={r} strokeWidth="6" fill="none" stroke="url(#rg)"
          strokeLinecap="round" strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          style={{ transition: "stroke-dashoffset 0.05s linear" }} />
        <defs>
          <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-white">{score}</span>
        <span className="text-[9px] text-gray-400 uppercase tracking-wide">Trust</span>
      </div>
    </div>
  );
}

// ─── Counter ──────────────────────────────────────────────────────────────────
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      let s = 0;
      const step = Math.ceil(to / 60);
      const iv = setInterval(() => { s = Math.min(s + step, to); setVal(s); if (s >= to) clearInterval(iv); }, 20);
      obs.disconnect();
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Demo Modal ───────────────────────────────────────────────────────────────
function DemoModal({ onClose }: { onClose: () => void }) {
  const [step, setStep]             = useState(0);
  const [selRel, setSelRel]         = useState<string | null>(null);
  const [selDur, setSelDur]         = useState<string | null>(null);
  const [barsReady, setBarsReady]   = useState(false);
  const [scoreCount, setScoreCount] = useState(66);
  const STEPS = 4;

  useEffect(() => {
    if (step === 2) { setTimeout(() => setBarsReady(true), 300); }
    if (step === 3) {
      let s = 66;
      const iv = setInterval(() => { s++; setScoreCount(s); if (s >= 78) clearInterval(iv); }, 40);
      return () => clearInterval(iv);
    }
  }, [step]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const weightLabel = computeWeightLabel(selRel, selDur);
  const STEP_LABELS = ["Overview", "Request vouch", "Public card", "Score updated"];
  const badgeStyle: Record<string, string> = {
    high:   "text-emerald-300 border-emerald-400/30",
    strong: "text-cyan-300 border-cyan-400/30",
    estab:  "text-purple-300 border-purple-400/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-0 sm:px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="w-full sm:max-w-md bg-[#0a0a0f] border border-white/10
                   rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ maxHeight: "92vh", overflowY: "auto" }}
      >
        {/* Progress */}
        <div className="flex gap-1.5 px-5 pt-5">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400
                             transition-all duration-500"
                style={{ width: i < step ? "100%" : i === step ? "50%" : "0%" }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="tc-modal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7"/>
                  <stop offset="100%" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
              <circle cx="24" cy="24" r="23" fill="url(#tc-modal)" fillOpacity="0.12"/>
              <circle cx="24" cy="24" r="23" stroke="url(#tc-modal)" strokeWidth="1.8"/>
              <rect x="9" y="14" width="22" height="4" rx="2" fill="url(#tc-modal)"/>
              <rect x="18" y="14" width="4" height="22" rx="2" fill="url(#tc-modal)"/>
              <path d="M33 17 A11 11 0 0 1 33 33" stroke="url(#tc-modal)" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-white/40">TrustCard</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/20 uppercase tracking-widest hidden sm:block">
              {String(step + 1).padStart(2, "0")} / {String(STEPS).padStart(2, "0")} — {STEP_LABELS[step]}
            </span>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full
                         bg-white/5 text-white/40 hover:text-white transition-colors text-lg">
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}
            className="px-5 pb-3">

            {/* Step 0 */}
            {step === 0 && (
              <div>
                <h2 className="text-xl font-bold text-white leading-tight mb-2">
                  Your reputation starts before your resume.
                </h2>
                <p className="text-sm text-white/35 leading-relaxed mb-4">
                  Collect verified vouches from professors, managers, and teammates —
                  then share one link that proves who you are.
                </p>
                <div className="flex flex-col gap-2">
                  {VOUCH_TILES_DEMO.map((t, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.15 }}
                      className="flex items-center gap-3 bg-white/[0.04] border border-white/[0.08]
                                 rounded-xl px-4 py-3">
                      <span className="text-lg">{t.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-white/80">{t.label}</p>
                        <p className="text-[11px] text-white/35">{t.who}</p>
                      </div>
                      <span className="text-[10px] text-green-400 font-semibold">✓</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 1 */}
            {step === 1 && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Requesting a vouch</p>
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">How do they know you?</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {REL_OPTIONS.map((r) => (
                      <button key={r.value} onClick={() => setSelRel(r.value)}
                        className={`px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-200
                          ${selRel === r.value
                            ? "border-purple-500 bg-purple-500/20 text-purple-200"
                            : "border-white/10 bg-white/5 text-white/40 hover:border-white/20 hover:text-white/70"
                          }`}>
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">How long?</p>
                  <div className="flex flex-col gap-1.5 mb-3">
                    {DUR_OPTIONS.map((d) => (
                      <button key={d.value} onClick={() => setSelDur(d.value)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border text-xs
                          font-medium transition-all duration-200
                          ${selDur === d.value
                            ? "border-purple-500 bg-purple-500/20 text-purple-200"
                            : "border-white/10 bg-white/[0.03] text-white/35 hover:border-white/20 hover:text-white/60"
                          }`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {weightLabel && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                      className="px-3 py-2.5 bg-purple-500/[0.08] border border-purple-500/20
                                 rounded-lg text-[11px] text-purple-300">
                      {weightLabel}
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div>
                <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Public TrustCard</p>
                <div className="rounded-2xl p-4 mb-3 relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg,#0f0f0f 0%,#1a1a2e 50%,#0f0f0f 100%)",
                    boxShadow: "0 0 0 1px rgba(255,255,255,0.08),0 0 40px rgba(168,85,247,0.12)",
                  }}>
                  <div className="absolute inset-0 rounded-2xl pointer-events-none"
                    style={{ background: "repeating-linear-gradient(60deg,transparent,transparent 40px,rgba(255,255,255,0.015) 40px,rgba(255,255,255,0.015) 41px)" }} />
                  <div className="relative flex justify-between items-start mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400" />
                      <span className="text-[9px] tracking-widest uppercase text-white/35">TrustCard</span>
                    </div>
                    <div className="w-7 h-5 rounded border border-white/10 opacity-40"
                      style={{ background: "linear-gradient(135deg,rgba(255,215,0,0.25),rgba(255,215,0,0.08))" }} />
                  </div>
                  <div className="relative flex justify-between items-center mb-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold text-white">Alex Rivera</p>
                      <p className="text-[9px] tracking-widest uppercase text-white/30">@alexrivera</p>
                      <p className="text-[10px] text-white/40 mt-1">Computer Science · NYU</p>
                    </div>
                    <div className="relative w-10 h-10 shrink-0 ml-3">
                      <svg className="-rotate-90 w-full h-full" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" strokeWidth="3.5" fill="none" className="stroke-white/10" />
                        <circle cx="24" cy="24" r="20" strokeWidth="3.5" fill="none"
                          stroke="url(#cr)" strokeLinecap="round"
                          strokeDasharray="125.7" strokeDashoffset="27.7" />
                        <defs>
                          <linearGradient id="cr" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#22d3ee" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold text-white leading-none">78</span>
                        <span className="text-[6px] text-white/30 uppercase tracking-wide">score</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative grid grid-cols-3 gap-2 pt-3 border-t border-white/[0.07]">
                    {[["Vouches","3"],["Endorse","100%"],["Since","Oct '24"]].map(([l,v]) => (
                      <div key={l}>
                        <p className="text-[8px] uppercase tracking-widest text-white/25">{l}</p>
                        <p className="text-[11px] font-semibold text-white mt-0.5">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {DEMO_VOUCHES.map((v, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: barsReady ? 1 : 0, y: barsReady ? 0 : 6 }}
                      transition={{ delay: i * 0.15 }}
                      className="rounded-xl border border-white/[0.07] p-3"
                      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.025),rgba(255,255,255,0.01))" }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10
                                          flex items-center justify-center text-sm shrink-0">
                            {v.icon}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-white/85 truncate">{v.type}</p>
                            <p className="text-[9px] text-white/35 truncate">{v.meta}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5 shrink-0">
                          <span className="text-xs font-bold"
                            style={{ background: "linear-gradient(90deg,#a78bfa,#22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                            {v.avg}
                          </span>
                          <span className={`text-[8px] uppercase tracking-widest px-1.5 py-0.5
                                           rounded-full border font-medium ${badgeStyle[v.badgeCls]}`}>
                            {v.badge}
                          </span>
                        </div>
                      </div>
                      {v.ctx && (
                        <div className="mb-2 px-2 py-1.5 rounded-lg bg-white/[0.035]
                                        border border-white/[0.07] text-[9px] text-white/40 truncate">
                          {v.ctx}
                        </div>
                      )}
                      <p className="text-[10px] text-white/45 italic leading-relaxed mb-2
                                    border-l border-purple-500/30 pl-2">
                        "{v.comment}"
                      </p>
                      <div className="flex flex-col gap-1">
                        {v.bars.map((b) => (
                          <div key={b.label} className="grid items-center gap-1.5"
                            style={{ gridTemplateColumns: "72px 1fr 14px" }}>
                            <span className="text-[8px] uppercase tracking-wider text-white/25 truncate">
                              {b.label}
                            </span>
                            <div className="h-[2px] rounded-full bg-white/[0.08] overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400
                                             transition-all duration-700"
                                style={{ width: barsReady ? `${b.w}%` : "0%" }} />
                            </div>
                            <span className="text-[8px] text-white/30 text-right">{b.val}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="flex flex-col items-center text-center pt-2">
                <div className="relative w-24 h-24 mb-4">
                  <svg className="-rotate-90 w-full h-full" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" strokeWidth="5" fill="none" className="stroke-white/10" />
                    <circle cx="48" cy="48" r="40" strokeWidth="5" fill="none"
                      stroke="url(#br)" strokeLinecap="round"
                      strokeDasharray="251.3"
                      strokeDashoffset={251.3 - (scoreCount / 100) * 251.3}
                      style={{ transition: "stroke-dashoffset 0.05s linear" }} />
                    <defs>
                      <linearGradient id="br" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-white">{scoreCount}</span>
                    <span className="text-[9px] text-white/30 uppercase tracking-widest">trust score</span>
                  </div>
                </div>
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="inline-flex items-center gap-1.5 bg-emerald-400/10 border
                             border-emerald-400/25 rounded-full px-3 py-1.5 text-xs text-emerald-300 mb-4">
                  +12 from new professor vouch
                </motion.div>
                <div className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mb-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Score breakdown</p>
                  {[
                    { label: "Depth",     pct: 82 },
                    { label: "Diversity", pct: 67 },
                    { label: "Recency",   pct: 91 },
                    { label: "Authority", pct: 78 },
                  ].map((b, i) => (
                    <div key={b.label} className="flex items-center gap-2.5 mb-2 last:mb-0">
                      <span className="text-[11px] text-white/40 w-16 text-left shrink-0">{b.label}</span>
                      <div className="flex-1 h-[3px] bg-white/[0.08] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
                          initial={{ width: "0%" }}
                          animate={{ width: `${b.pct}%` }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.7 }}
                        />
                      </div>
                      <span className="text-[11px] text-white/40 w-7 text-right shrink-0">{b.pct}%</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/25 leading-relaxed">
                  A professor vouch after 1 year carries 4× more weight than a friend vouch.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav */}
        <div className={`flex px-5 py-4 gap-3 border-t border-white/5 ${step > 0 ? "justify-between" : "justify-end"}`}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="px-5 py-2.5 rounded-xl border border-white/10 bg-white/5
                         text-sm text-white/45 hover:text-white transition-colors">
              ← Back
            </button>
          )}
          {step < STEPS - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                         text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              {step === 0 ? "See how it works" : step === 1 ? "View the card" : "See score update"}
            </button>
          ) : (
            <button onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500
                         text-sm font-semibold text-white hover:opacity-90 transition-opacity">
              Start building mine →
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingClient({ ctaHref }: { ctaHref: string }) {
  const [showDemo, setShowDemo] = useState(false);

  const tilePositions: React.CSSProperties[] = [
    { top: "12%", left: "4%"  },
    { top: "28%", left: "2%"  },
    { top: "58%", left: "5%"  },
    { top: "10%", right: "3%" },
    { top: "38%", right: "2%" },
    { top: "64%", right: "4%" },
  ];

  const isLoggedIn = ctaHref !== "/auth";
  const ctaLabel   = isLoggedIn ? "Go to Dashboard" : "Build My TrustCard";

  return (
    <main className="relative min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <CursorGlow />

      {/* Background grid */}
      <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "60px 60px" }} />

      {/* Purple glow */}
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% -10%,rgba(139,92,246,0.25),transparent)" }} />

      {/* Floating tiles — desktop only */}
      <div className="hidden lg:block">
        {VOUCHES.map((v, i) => (
          <VouchTile key={i} vouch={v} style={tilePositions[i]}
            delay={0.4 + i * 0.15} duration={TILE_DURATIONS[i]} />
        ))}
      </div>

      {/* ── Hero ── */}
      <section className="relative z-10 flex flex-col items-center justify-center
                          min-h-screen px-5 text-center pt-16 pb-10">

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-purple-500/30
                     bg-purple-500/10 px-3 py-1.5 text-xs text-purple-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shrink-0" />
          Now in early access · 17–29 only
        </motion.div>

        {/* Headline — smaller on mobile so it doesn't wrap weirdly */}
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1]
                     max-w-3xl bg-gradient-to-b from-white to-white/60
                     bg-clip-text text-transparent">
          Your reputation starts
          <br className="hidden sm:block" />
          {" "}
          <span className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            before your résumé.
          </span>
        </motion.h1>

        {/* Subheading */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-5 text-base text-gray-400 max-w-sm leading-relaxed">
          Collect verified vouches from classmates, professors, and landlords —
          then share one link that proves who you are.
        </motion.p>

        {/* CTAs — stack on mobile, row on larger screens */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Link href={ctaHref}
            className="group relative rounded-full bg-white text-black px-7 py-3.5
                       font-semibold text-center overflow-hidden transition-transform hover:scale-105
                       active:scale-95">
            <span className="relative z-10">{ctaLabel}</span>
            <span className="absolute inset-0 bg-gradient-to-r from-purple-400 to-cyan-400
                             opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </Link>
          <button onClick={() => setShowDemo(true)}
            className="rounded-full border border-white/15 bg-white/5
                       px-7 py-3.5 font-semibold hover:bg-white/10 transition-colors
                       active:scale-95">
            See a live example →
          </button>
        </motion.div>

        {/* Social proof */}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
          className="mt-5 text-sm text-gray-500">
          Join <span className="text-white font-medium">2,400+</span> people already building their trust profile
        </motion.p>
      </section>

      {/* ── Mini card preview ── */}
      <section className="relative z-10 flex justify-center pb-20 px-5">
        <motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.7 }}
          className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl
                     p-6 backdrop-blur-xl shadow-2xl">
          <TrustRing />
          <div className="text-center mb-5">
            <p className="font-semibold text-white text-base">Alex Rivera</p>
            <p className="text-sm text-gray-400">Computer Science · NYU</p>
            <p className="text-xs text-purple-300 mt-1 italic">"Building things that matter"</p>
          </div>
          <div className="space-y-2">
            {VOUCHES.slice(0, 3).map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2.5">
                <span className="text-base">{v.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{v.label}</p>
                  <p className="text-[11px] text-gray-400 truncate">{v.name} · {v.role}</p>
                </div>
                <span className="text-green-400 text-xs shrink-0">✓</span>
              </motion.div>
            ))}
          </div>
          <Link href={ctaHref}
            className="mt-5 block w-full rounded-xl bg-gradient-to-r from-purple-600
                       to-cyan-500 py-3 text-sm font-semibold text-white text-center
                       hover:opacity-90 transition-opacity active:scale-95">
            {isLoggedIn ? "Go to Dashboard" : "Start Building Mine →"}
          </Link>
        </motion.div>
      </section>

      {/* ── Stats bar ── */}
      <section className="relative z-10 border-t border-white/5 py-14 px-5">
        <div className="max-w-2xl mx-auto grid grid-cols-3 gap-4 text-center">
          {[
            { value: 2400,  suffix: "+", label: "Profiles built"      },
            { value: 11000, suffix: "+", label: "Vouches verified"    },
            { value: 98,    suffix: "%", label: "Response rate"       },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r
                            from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                <Counter to={s.value} suffix={s.suffix} />
              </p>
              {/* Shorter labels so they don't wrap at 375px */}
              <p className="text-xs text-gray-500 mt-1 leading-tight">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Demo modal ── */}
      <AnimatePresence>
        {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}
      </AnimatePresence>
    </main>
  );
}
