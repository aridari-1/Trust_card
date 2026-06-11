// app/api/trust-resume/route.ts
// npm install pdf-lib

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts, PDFPage } from "pdf-lib";

// ─── Context filters ──────────────────────────────────────────────────────────
const CONTEXT_FILTERS: Record<string, string[]> = {
  all:      [],
  work:     ["manager", "coworker", "collaborator", "mentor"],
  academic: ["professor", "classmate", "mentor"],
  rental:   ["roommate", "friend"],
  freelance:["client", "collaborator"],
};

const CONTEXT_LABELS: Record<string, string> = {
  all:      "Full Profile",
  work:     "Work & Professional",
  academic: "Academic",
  rental:   "Rental & Housing",
  freelance:"Freelance & Client Work",
};

const CREDIBILITY_LABELS: Record<number, string> = {
  1: "Acquaintance",
  2: "Known",
  3: "Established",
  4: "Strong",
  5: "High Authority",
};

const DURATION_LABELS: Record<string, string> = {
  under_3mo: "< 3 months",
  "6_months": "~6 months",
  "1_year":   "~1 year",
  "2_years":  "2-3 years",
  "5_plus":   "5+ years",
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  professor:    "Professor",
  manager:      "Manager",
  client:       "Client",
  coworker:     "Coworker",
  collaborator: "Collaborator",
  classmate:    "Classmate",
  roommate:     "Roommate",
  mentor:       "Mentor",
  friend:       "Friend",
};

// ─── Color helper ─────────────────────────────────────────────────────────────
function hex(h: string) {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const C = {
  black:   hex("#0a0a0a"),
  cardBg:  hex("#141428"),
  purple:  hex("#a855f7"),
  white:   hex("#ffffff"),
  greyMid: hex("#9ca3af"),
  greyDrk: hex("#6b7280"),
  green:   hex("#22c55e"),
  border:  hex("#2a2a3a"),
  dark2:   hex("#1a1a2e"),
  badgeBg: [
    hex("#374151"), hex("#374151"), hex("#1e3a5f"),
    hex("#2e1a4a"), hex("#0f3040"), hex("#052e16"),
  ],
  badgeFg: [
    hex("#9ca3af"), hex("#9ca3af"), hex("#93c5fd"),
    hex("#d8b4fe"), hex("#67e8f9"), hex("#22c55e"),
  ],
};

// ─── Text wrap ────────────────────────────────────────────────────────────────
function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ─── Safe text (strips non-latin1 for StandardFonts) ─────────────────────────
function safeText(
  p: PDFPage, text: string, x: number, yPos: number,
  font: any, size: number, color: any
) {
  const safe = text.replace(/[^\x00-\xFF]/g, "");
  if (!safe.trim()) return;
  try {
    p.drawText(safe, { x, y: yPos, font, size, color });
  } catch {
    // silently skip characters that can't be encoded
  }
}

// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Simple per-user cooldown — resets on server restart (fine for serverless)
const lastGenerated = new Map<string, number>();
const RATE_LIMIT_MS = 30_000; // 30 seconds between generations

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const context = searchParams.get("context") ?? "all";
  const userId  = searchParams.get("userId");

  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  // ── Auth check ──────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Rate limit — max one PDF per 30 seconds per user ───────────────────────
  const last = lastGenerated.get(userId);
  if (last && Date.now() - last < RATE_LIMIT_MS) {
    const wait = Math.ceil((RATE_LIMIT_MS - (Date.now() - last)) / 1000);
    return NextResponse.json(
      { error: `Please wait ${wait} seconds before generating another PDF.` },
      { status: 429 }
    );
  }
  lastGenerated.set(userId, Date.now());

  // ── Fetch profile ───────────────────────────────────────────────────────────
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, username, school, major, bio, trust_score, created_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // ── Fetch vouches ───────────────────────────────────────────────────────────
  const relationshipFilter = CONTEXT_FILTERS[context] ?? [];
  let query = supabase
    .from("vouches")
    .select(`
      comment,
      rating_reliability,
      rating_communication,
      rating_teamwork,
      rating_work_again,
      relationship_type,
      relationship_duration,
      collaboration_context,
      credibility_weight,
      created_at,
      vouch_types(name, slug),
      giver:profiles!vouches_giver_id_fkey(full_name, username)
    `)
    .eq("receiver_id", userId)
    .eq("is_public", true)
    .order("credibility_weight", { ascending: false });

  if (relationshipFilter.length > 0) {
    query = query.in("relationship_type", relationshipFilter);
  }

  const { data: vouches } = await query;

  const totalVouches   = vouches?.length ?? 0;
  const workAgainCount = vouches?.filter((v: any) => v.rating_work_again >= 4).length ?? 0;
  const workAgainPct   = totalVouches ? Math.round((workAgainCount / totalVouches) * 100) : 0;
  const highCredCount  = vouches?.filter((v: any) => (v.credibility_weight ?? 1) >= 4).length ?? 0;
  const ctxLabel       = CONTEXT_LABELS[context] ?? "Full Profile";

  // ── PDF setup ──────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const PW = 595;
  const PH = 842;
  const M  = 50;
  const IW = PW - M * 2;

  function addPage(): PDFPage {
    const p = pdfDoc.addPage([PW, PH]);
    p.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: C.black });
    return p;
  }

  let page = addPage();
  let y    = PH - M;

  // ── Header strip ──────────────────────────────────────────────────────────
  const STRIP_H = 32;
  page.drawRectangle({ x: M, y: PH - M - STRIP_H, width: IW, height: STRIP_H, color: C.cardBg });
  page.drawRectangle({ x: M + 12, y: PH - M - STRIP_H / 2 - 4, width: 8, height: 8, color: C.purple });
  safeText(page, "TRUSTCARD", M + 26, PH - M - STRIP_H / 2 - 3, reg, 7, C.greyMid);
  const ctxW = reg.widthOfTextAtSize(ctxLabel.toUpperCase(), 7);
  safeText(page, ctxLabel.toUpperCase(), PW - M - ctxW - 6, PH - M - STRIP_H / 2 - 3, reg, 7, C.greyMid);

  y = PH - M - STRIP_H - 10;

  // ── Identity card ──────────────────────────────────────────────────────────
  const CARD_H = 110;
  page.drawRectangle({ x: M, y: y - CARD_H, width: IW, height: CARD_H, color: C.cardBg });
  const bx = M, by = y - CARD_H, bw = IW, bh = CARD_H, bl = 0.5;
  page.drawLine({ start: { x: bx,      y: by      }, end: { x: bx + bw, y: by      }, color: C.border, thickness: bl });
  page.drawLine({ start: { x: bx,      y: by + bh }, end: { x: bx + bw, y: by + bh }, color: C.border, thickness: bl });
  page.drawLine({ start: { x: bx,      y: by      }, end: { x: bx,      y: by + bh }, color: C.border, thickness: bl });
  page.drawLine({ start: { x: bx + bw, y: by      }, end: { x: bx + bw, y: by + bh }, color: C.border, thickness: bl });

  safeText(page, profile.full_name, M + 18, y - 32, bold, 22, C.white);
  safeText(page, `@${profile.username}`, M + 18, y - 50, reg, 9, C.greyDrk);
  const infoParts = [profile.major, profile.school].filter(Boolean).join("  .  ");
  if (infoParts) safeText(page, infoParts, M + 18, y - 66, reg, 9, C.greyMid);

  const score     = profile.trust_score ?? 0;
  const rCX       = PW - M - 55;
  const rCY       = y - CARD_H / 2;
  const rSize     = 26;
  const ringColor = score >= 70 ? C.green : score >= 40 ? C.purple : C.greyDrk;
  page.drawRectangle({ x: rCX - rSize - 4, y: rCY - rSize - 4,
    width: (rSize + 4) * 2, height: (rSize + 4) * 2, color: C.border });
  page.drawRectangle({ x: rCX - rSize, y: rCY - rSize,
    width: rSize * 2, height: rSize * 2, color: C.cardBg });
  const scoreBarW = Math.round((score / 100) * rSize * 2);
  page.drawRectangle({ x: rCX - rSize, y: rCY + rSize - 4,
    width: scoreBarW, height: 4, color: ringColor });
  const scoreStr  = String(score);
  const scoreW    = bold.widthOfTextAtSize(scoreStr, 14);
  safeText(page, scoreStr, rCX - scoreW / 2, rCY - 4, bold, 14, C.white);
  const scoreLblW = reg.widthOfTextAtSize("SCORE", 6);
  safeText(page, "SCORE", rCX - scoreLblW / 2, rCY - 14, reg, 6, C.greyDrk);

  const chipY = y - CARD_H + 20;
  const chips: [string, string][] = [
    [String(totalVouches), "VOUCHES"],
    [`${workAgainPct}%`,   "ENDORSE"],
    [String(highCredCount), "HIGH CRED"],
  ];
  chips.forEach(([val, chipLbl], i) => {
    const cx = M + 18 + i * 80;
    safeText(page, val,     cx, chipY + 10, bold, 11, C.white);
    safeText(page, chipLbl, cx, chipY,      reg,  6,  C.greyDrk);
  });

  y = y - CARD_H - 12;

  // ── Bio ────────────────────────────────────────────────────────────────────
  if (profile.bio) {
    const bioLines = wrapText(profile.bio.slice(0, 200), italic, 8.5, IW - 8);
    for (const line of bioLines) {
      safeText(page, line, M + 4, y, italic, 8.5, C.greyMid);
      y -= 13;
    }
    y -= 6;
  }

  // ── Section label ──────────────────────────────────────────────────────────
  const sectionText = `VERIFIED VOUCHES  (${totalVouches})`;
  safeText(page, sectionText, M, y, reg, 6, C.greyDrk);
  const sepX = M + reg.widthOfTextAtSize(sectionText, 6) + 8;
  page.drawLine({ start: { x: sepX, y: y + 2 }, end: { x: PW - M, y: y + 2 },
    color: C.border, thickness: 0.4 });
  y -= 14;

  // ── Vouch helpers ──────────────────────────────────────────────────────────
  function avgRating(v: any): number {
    const vals = [
      v.rating_reliability, v.rating_communication,
      v.rating_teamwork, v.rating_work_again,
    ].filter((x: any) => typeof x === "number" && x > 0) as number[];
    return vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      : 0;
  }

  let currentPage = page;

  function drawVouch(v: any, startY: number, p: PDFPage): number {
    const vtype   = v.vouch_types ?? {};
    const giver   = v.giver ?? {};
    const rtype   = (v.relationship_type ?? "") as string;
    const rdur    = (v.relationship_duration ?? "") as string;
    const collab  = (v.collaboration_context ?? "") as string;
    const weight  = Math.min(Math.max(Number(v.credibility_weight ?? 1), 1), 5);
    const comment = (v.comment ?? "") as string;
    const avgVal  = avgRating(v);

    const commentLines = comment
      ? wrapText(`"${comment}"`, italic, 8, IW - 20).length : 0;
    const estH = 70 + commentLines * 13 + (collab ? 18 : 0);

    // Page break
    if (startY - estH < M + 20) {
      p = addPage();
      currentPage = p;
      startY = PH - M - 10;
    }

    p.drawRectangle({ x: M, y: startY - estH, width: IW, height: estH, color: C.cardBg });
    const cx2 = M, cy2 = startY - estH;
    p.drawLine({ start: { x: cx2,      y: cy2        }, end: { x: cx2 + IW, y: cy2        }, color: C.border, thickness: 0.4 });
    p.drawLine({ start: { x: cx2,      y: cy2 + estH }, end: { x: cx2 + IW, y: cy2 + estH }, color: C.border, thickness: 0.4 });
    p.drawLine({ start: { x: cx2,      y: cy2        }, end: { x: cx2,      y: cy2 + estH }, color: C.border, thickness: 0.4 });
    p.drawLine({ start: { x: cx2 + IW, y: cy2        }, end: { x: cx2 + IW, y: cy2 + estH }, color: C.border, thickness: 0.4 });

    const ix = M + 14;
    let iy   = startY - 18;

    safeText(p, vtype.name ?? "Vouch", ix, iy, bold, 9, C.white);

    const avgStr = String(avgVal);
    const avgW   = bold.widthOfTextAtSize(avgStr, 11);
    safeText(p, avgStr, PW - M - 14 - avgW, iy, bold, 11, C.purple);

    const credLbl = CREDIBILITY_LABELS[weight] ?? "Known";
    const badgeW  = reg.widthOfTextAtSize(credLbl.toUpperCase(), 5.5) + 8;
    const badgeX  = PW - M - 14 - avgW - 6 - badgeW;
    const bgColor = C.badgeBg[weight] ?? C.badgeBg[1];
    const fgColor = C.badgeFg[weight] ?? C.badgeFg[1];
    p.drawRectangle({ x: badgeX, y: iy - 2, width: badgeW, height: 13, color: bgColor });
    safeText(p, credLbl.toUpperCase(), badgeX + 4, iy + 1, reg, 5.5, fgColor);

    iy -= 16;

    const relParts: string[] = [];
    if (rtype && RELATIONSHIP_LABELS[rtype]) relParts.push(RELATIONSHIP_LABELS[rtype]);
    if (rdur  && DURATION_LABELS[rdur])      relParts.push(DURATION_LABELS[rdur]);
    if (giver.full_name) relParts.push(String(giver.full_name));
    if (giver.username)  relParts.push(`@${giver.username}`);
    if (relParts.length) {
      let relStr = relParts.join("  .  ");
      while (reg.widthOfTextAtSize(relStr, 7.5) > IW - 28 && relStr.includes("  .  ")) {
        relStr = relStr.split("  .  ").slice(0, -1).join("  .  ") + "...";
      }
      safeText(p, relStr, ix, iy, reg, 7.5, C.greyMid);
      iy -= 14;
    }

    if (collab) {
      const collabStr = collab.slice(0, 90) + (collab.length > 90 ? "..." : "");
      p.drawRectangle({ x: ix, y: iy - 14, width: IW - 28, height: 16, color: C.dark2 });
      safeText(p, collabStr, ix + 6, iy - 8, reg, 7, C.greyMid);
      iy -= 20;
    }

    if (comment) {
      const lines = wrapText(`"${comment}"`, italic, 8, IW - 28);
      for (const line of lines) {
        safeText(p, line, ix, iy, italic, 8, C.greyMid);
        iy -= 13;
      }
      iy -= 4;
    }

    iy -= 6;

    const barData: [string, number][] = (
      [
        ["Reliability",   v.rating_reliability],
        ["Communication", v.rating_communication],
        ["Teamwork",      v.rating_teamwork],
        ["Work Again",    v.rating_work_again],
      ] as [string, number][]
    ).filter(([, val]) => typeof val === "number" && val > 0);

    const colW = (IW - 28) / 2;
    barData.forEach(([barLbl, val], i) => {
      const bxBar = ix + (i % 2) * colW;
      const byBar = iy - Math.floor(i / 2) * 14;
      safeText(p, barLbl.toUpperCase(), bxBar, byBar, reg, 6, C.greyDrk);
      const BAR_W = 55;
      p.drawRectangle({ x: bxBar + 62, y: byBar - 1, width: BAR_W,             height: 3, color: C.border });
      p.drawRectangle({ x: bxBar + 62, y: byBar - 1, width: BAR_W * (val / 5), height: 3, color: C.purple });
      safeText(p, `${val}/5`, bxBar + 120, byBar, reg, 6, C.greyMid);
    });

    return startY - estH - 10;
  }

  // ── Render vouches ─────────────────────────────────────────────────────────
  if (vouches && vouches.length > 0) {
    for (const v of vouches) {
      y = drawVouch(v, y, currentPage);
    }
  } else {
    page.drawRectangle({ x: M, y: y - 40, width: IW, height: 40, color: C.cardBg });
    const msg  = `No vouches found for the '${ctxLabel}' context.`;
    const msgW = reg.widthOfTextAtSize(msg, 8);
    safeText(page, msg, PW / 2 - msgW / 2, y - 22, reg, 8, C.greyDrk);
    y -= 50;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  const fp = currentPage;
  fp.drawLine({ start: { x: M, y: M + 18 }, end: { x: PW - M, y: M + 18 },
    color: C.border, thickness: 0.4 });

  const profileUrl = `trustcard.app/u/${profile.username}`;
  safeText(fp, profileUrl, M, M + 6, reg, 6.5, C.greyDrk);
  safeText(fp, "Verify live at:", PW - M - 120, M + 6, reg, 6.5, C.greyDrk);

  fp.drawRectangle({ x: PW - M - 36, y: M - 28, width: 36, height: 36, color: C.white });
  const urlW = reg.widthOfTextAtSize(profileUrl, 3.5);
  safeText(fp, profileUrl, PW - M - 36 + 18 - urlW / 2, M - 12, reg, 3.5, C.black);

  // ── Serialize & return ─────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const ctxSlug  = ctxLabel.toLowerCase().replace(/\s+/g, "-");
  const filename = `trustcard-${profile.username}-${ctxSlug}.pdf`;

  const arrayBuffer = pdfBytes.buffer.slice(
    pdfBytes.byteOffset,
    pdfBytes.byteOffset + pdfBytes.byteLength
  ) as ArrayBuffer;

  return new Response(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      pdfBytes.byteLength.toString(),
    },
  });
}