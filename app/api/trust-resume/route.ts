// app/api/trust-resume/route.ts
// PDF generated with pdf-lib (pure JS — no Python/reportlab needed)
// Install: npm install pdf-lib

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

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

// ─── Color helpers (pdf-lib uses 0-1 RGB) ────────────────────────────────────
const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const C = {
  black:   hex("#0a0a0a"),
  cardBg:  hex("#141428"),
  purple:  hex("#a855f7"),
  cyan:    hex("#06b6d4"),
  white:   hex("#ffffff"),
  greyMid: hex("#9ca3af"),
  greyDrk: hex("#6b7280"),
  green:   hex("#22c55e"),
  border:  hex("#2a2a3a"),
  badgeBg: [
    hex("#374151"), hex("#374151"), hex("#1e3a5f"),
    hex("#2e1a4a"), hex("#0f3040"), hex("#052e16"),
  ] as const,
  badgeFg: [
    hex("#9ca3af"), hex("#9ca3af"), hex("#93c5fd"),
    hex("#d8b4fe"), hex("#67e8f9"), hex("#22c55e"),
  ] as const,
};

// ─── Text wrap helper ─────────────────────────────────────────────────────────
function wrapText(
  text: string,
  font: any,
  size: number,
  maxWidth: number
): string[] {
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

// ─── Draw rounded rect (pdf-lib doesn't have one built-in) ───────────────────
function roundedRect(
  page: any,
  x: number, y: number, w: number, h: number,
  r: number,
  fillColor?: any,
  strokeColor?: any,
  strokeWidth = 0.5
) {
  const ops: string[] = [];
  // Move to start
  ops.push(`${x + r} ${y} m`);
  ops.push(`${x + w - r} ${y} l`);
  ops.push(`${x + w} ${y} ${x + w} ${y + r} ${r} y`);
  ops.push(`${x + w} ${y + h - r} l`);
  ops.push(`${x + w} ${y + h} ${x + w - r} ${y + h} ${r} y`);
  ops.push(`${x + r} ${y + h} l`);
  ops.push(`${x} ${y + h} ${x} ${y + h - r} ${r} y`);
  ops.push(`${x} ${y + r} l`);
  ops.push(`${x} ${y} ${x + r} ${y} ${r} y`);

  if (fillColor && strokeColor) {
    page.drawSvgPath(ops.join(" "), {
      x: 0, y: 0, color: fillColor,
      borderColor: strokeColor, borderWidth: strokeWidth,
    });
  } else if (fillColor) {
    page.drawSvgPath(ops.join(" "), { x: 0, y: 0, color: fillColor });
  } else if (strokeColor) {
    page.drawSvgPath(ops.join(" "), {
      x: 0, y: 0, color: undefined,
      borderColor: strokeColor, borderWidth: strokeWidth,
    });
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const context = searchParams.get("context") ?? "all";
  const userId  = searchParams.get("userId");

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, username, school, major, bio, trust_score, created_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

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

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const bold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const reg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_W = 595;  // A4 pts
  const PAGE_H = 842;
  const M      = 50;   // margin
  const INNER  = PAGE_W - M * 2;

  function addPage() {
    const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
    // Dark background
    p.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: C.black });
    return p;
  }

  let page = addPage();
  let y    = PAGE_H - M; // current Y (pdf-lib: 0 = bottom)

  // ── Helper: draw text safely (strips non-latin1 chars) ──────────────────
  function safeText(
    p: any, text: string, x: number, yPos: number,
    font: any, size: number, color: any
  ) {
    // pdf-lib StandardFonts only support latin-1; strip anything outside
    const safe = text.replace(/[^\x00-\xFF]/g, "");
    if (!safe.trim()) return;
    p.drawText(safe, { x, y: yPos, font, size, color });
  }

  // ── Header strip ──────────────────────────────────────────────────────────
  const STRIP_H = 32;
  page.drawRectangle({ x: M, y: PAGE_H - M - STRIP_H, width: INNER, height: STRIP_H, color: C.cardBg });
  // Purple dot
  page.drawEllipse({ cx: M + 18, cy: PAGE_H - M - STRIP_H / 2, xScale: 7, yScale: 7, color: C.purple });
  safeText(page, "TRUSTCARD", M + 30, PAGE_H - M - STRIP_H / 2 - 3.5, reg, 7, C.greyMid);
  const ctxW = reg.widthOfTextAtSize(ctxLabel.toUpperCase(), 7);
  safeText(page, ctxLabel.toUpperCase(), PAGE_W - M - ctxW - 6, PAGE_H - M - STRIP_H / 2 - 3.5, reg, 7, C.greyMid);

  y = PAGE_H - M - STRIP_H - 10;

  // ── Identity card ──────────────────────────────────────────────────────────
  const CARD_H = 110;
  page.drawRectangle({ x: M, y: y - CARD_H, width: INNER, height: CARD_H, color: C.cardBg });
  // Border
  page.drawRectangle({ x: M, y: y - CARD_H, width: INNER, height: CARD_H,
    borderColor: C.border, borderWidth: 0.5, color: undefined as any });

  // Name
  safeText(page, profile.full_name, M + 18, y - 32, bold, 22, C.white);
  safeText(page, `@${profile.username}`, M + 18, y - 50, reg, 9, C.greyDrk);
  const infoParts = [profile.major, profile.school].filter(Boolean).join("  .  ");
  if (infoParts) safeText(page, infoParts, M + 18, y - 66, reg, 9, C.greyMid);

  // Score ring (drawn as concentric circles)
  const score   = profile.trust_score ?? 0;
  const ringCX  = PAGE_W - M - 60;
  const ringCY  = y - CARD_H / 2;
  const ringR   = 26;
  page.drawEllipse({ cx: ringCX, cy: ringCY, xScale: ringR + 4, yScale: ringR + 4,
    borderColor: C.border, borderWidth: 3, color: undefined as any });
  const ringColor = score >= 70 ? C.green : score >= 40 ? C.purple : C.greyDrk;
  page.drawEllipse({ cx: ringCX, cy: ringCY, xScale: ringR, yScale: ringR,
    borderColor: ringColor, borderWidth: 3, color: undefined as any });
  const scoreStr = String(score);
  const scoreW   = bold.widthOfTextAtSize(scoreStr, 14);
  safeText(page, scoreStr, ringCX - scoreW / 2, ringCY - 4, bold, 14, C.white);
  const lbl = "SCORE";
  const lblW = reg.widthOfTextAtSize(lbl, 6);
  safeText(page, lbl, ringCX - lblW / 2, ringCY - 14, reg, 6, C.greyDrk);

  // Bottom chips
  const chipY = y - CARD_H + 20;
  const chips = [
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
    const bioLines = wrapText(profile.bio.slice(0, 200), italic, 8.5, INNER - 8);
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
  page.drawLine({ start: { x: sepX, y: y + 2 }, end: { x: PAGE_W - M, y: y + 2 },
    color: C.border, thickness: 0.4 });
  y -= 14;

  // ── Vouches ────────────────────────────────────────────────────────────────
  function avgRating(v: any) {
    const vals = [v.rating_reliability, v.rating_communication,
                  v.rating_teamwork, v.rating_work_again].filter(Boolean);
    return vals.length ? Math.round((vals.reduce((a: number, b: number) => a + b, 0) / vals.length) * 10) / 10 : 0;
  }

  function drawVouch(v: any, startY: number, p: any): number {
    const vtype   = v.vouch_types ?? {};
    const giver   = v.giver ?? {};
    const rtype   = v.relationship_type ?? "";
    const rdur    = v.relationship_duration ?? "";
    const collab  = v.collaboration_context ?? "";
    const weight  = Math.min(Math.max(v.credibility_weight ?? 1, 1), 5);
    const comment = v.comment ?? "";
    const avg     = avgRating(v);

    // Estimate height
    const commentLines = comment
      ? wrapText(`"${comment}"`, italic, 8, INNER - 20).length
      : 0;
    const estH = 70 + commentLines * 13 + (collab ? 18 : 0);

    // Page break
    if (startY - estH < M + 20) {
      p = addPage();
      startY = PAGE_H - M - 10;
    }

    // Card box
    p.drawRectangle({ x: M, y: startY - estH, width: INNER, height: estH, color: C.cardBg });
    p.drawRectangle({ x: M, y: startY - estH, width: INNER, height: estH,
      borderColor: C.border, borderWidth: 0.4, color: undefined as any });

    const ix = M + 14;
    let iy   = startY - 18;

    // Vouch type
    safeText(p, vtype.name ?? "Vouch", ix, iy, bold, 9, C.white);

    // Average score
    const avgStr = String(avg);
    const avgW   = bold.widthOfTextAtSize(avgStr, 11);
    safeText(p, avgStr, PAGE_W - M - 14 - avgW, iy, bold, 11, C.purple);

    // Credibility badge
    const credLbl = CREDIBILITY_LABELS[weight] ?? "Known";
    const badgeW  = reg.widthOfTextAtSize(credLbl.toUpperCase(), 5.5) + 8;
    const badgeX  = PAGE_W - M - 14 - avgW - 6 - badgeW;
    const badgeBg = C.badgeBg[weight] ?? C.badgeBg[1];
    const badgeFg = C.badgeFg[weight] ?? C.badgeFg[1];
    p.drawRectangle({ x: badgeX, y: iy - 2, width: badgeW, height: 13, color: badgeBg });
    safeText(p, credLbl.toUpperCase(), badgeX + 4, iy + 1, reg, 5.5, badgeFg);

    iy -= 16;

    // Relationship line
    const relParts: string[] = [];
    if (rtype && RELATIONSHIP_LABELS[rtype]) relParts.push(RELATIONSHIP_LABELS[rtype]);
    if (rdur  && DURATION_LABELS[rdur])      relParts.push(DURATION_LABELS[rdur]);
    if (giver.full_name) relParts.push(giver.full_name);
    if (giver.username)  relParts.push(`@${giver.username}`);
    if (relParts.length) {
      let relStr = relParts.join("  .  ");
      while (reg.widthOfTextAtSize(relStr, 7.5) > INNER - 28 && relStr.includes("  .  ")) {
        relStr = relStr.split("  .  ").slice(0, -1).join("  .  ") + "...";
      }
      safeText(p, relStr, ix, iy, reg, 7.5, C.greyMid);
      iy -= 14;
    }

    // Collaboration context
    if (collab) {
      const collabStr = collab.slice(0, 90) + (collab.length > 90 ? "..." : "");
      p.drawRectangle({ x: ix, y: iy - 14, width: INNER - 28, height: 16, color: hex("#1a1a2e") });
      safeText(p, collabStr, ix + 6, iy - 8, reg, 7, C.greyMid);
      iy -= 20;
    }

    // Comment
    if (comment) {
      const lines = wrapText(`"${comment}"`, italic, 8, INNER - 28);
      for (const line of lines) {
        safeText(p, line, ix, iy, italic, 8, C.greyMid);
        iy -= 13;
      }
      iy -= 4;
    }

    iy -= 6;

    // Rating bars (2 col)
    const barData = [
      ["Reliability",   v.rating_reliability],
      ["Communication", v.rating_communication],
      ["Teamwork",      v.rating_teamwork],
      ["Work Again",    v.rating_work_again],
    ].filter(([, val]) => val);

    const colW = (INNER - 28) / 2;
    barData.forEach(([lbl, val], i) => {
      const bx = ix + (i % 2) * colW;
      const by = iy - Math.floor(i / 2) * 14;
      safeText(p, String(lbl).toUpperCase(), bx, by, reg, 6, C.greyDrk);
      const BAR_W = 55;
      p.drawRectangle({ x: bx + 62, y: by - 1, width: BAR_W, height: 3, color: C.border });
      p.drawRectangle({ x: bx + 62, y: by - 1, width: BAR_W * ((val as number) / 5), height: 3, color: C.purple });
      safeText(p, `${val}/5`, bx + 120, by, reg, 6, C.greyMid);
    });

    const usedRows = Math.ceil(barData.length / 2);
    currentPage = p;
    return startY - estH - 10;
  }

  let currentPage = page;

  if (vouches && vouches.length > 0) {
    for (const v of vouches) {
      y = drawVouch(v, y, currentPage);
    }
  } else {
    page.drawRectangle({ x: M, y: y - 40, width: INNER, height: 40, color: C.cardBg });
    const msg = `No vouches found for the '${ctxLabel}' context.`;
    const msgW = reg.widthOfTextAtSize(msg, 8);
    safeText(page, msg, PAGE_W / 2 - msgW / 2, y - 22, reg, 8, C.greyDrk);
    y -= 50;
  }

  // ── Footer on last page ────────────────────────────────────────────────────
  const fp = currentPage;
  fp.drawLine({
    start: { x: M, y: M + 18 }, end: { x: PAGE_W - M, y: M + 18 },
    color: C.border, thickness: 0.4,
  });
  const profileUrl = `trustcard.app/u/${profile.username}`;
  safeText(fp, profileUrl, M, M + 6, reg, 6.5, C.greyDrk);
  safeText(fp, "Verify live at:", PAGE_W - M - 120, M + 6, reg, 6.5, C.greyDrk);

  // QR placeholder box
  fp.drawRectangle({ x: PAGE_W - M - 36, y: M - 28, width: 36, height: 36, color: C.white });
  const urlW = reg.widthOfTextAtSize(profileUrl, 3.5);
  safeText(fp, profileUrl, PAGE_W - M - 36 + 18 - urlW / 2, M - 12, reg, 3.5, C.black);

  // ── Serialize ──────────────────────────────────────────────────────────────
  const pdfBytes  = await pdfDoc.save();
  const ctxSlug   = ctxLabel.toLowerCase().replace(/\s+/g, "-");
  const filename  = `trustcard-${profile.username}-${ctxSlug}.pdf`;

  return new Response(pdfBytes, {
    status: 200,
    headers: {
      "Content-Type":        "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length":      pdfBytes.byteLength.toString(),
    },
  });
}