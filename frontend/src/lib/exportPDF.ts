import { jsPDF } from "jspdf";
import type { PraxisPlan } from "@/lib/praxis-types";

const MARGIN = 20;            // mm
const PAGE_W = 210;           // A4
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Cursor {
  doc: jsPDF;
  y: number;
}

// jsPDF's default Helvetica is WinAnsi-encoded and can't render Unicode chars
// like the right-arrow (U+2192), em-dash (U+2014), smart quotes, etc. When it
// hits one, the PDF stream gets corrupted and every following character of
// that string renders interleaved with the literal `&` glyph (a known bug).
// Sanitize all strings to ASCII-friendly equivalents before drawing.
const UNICODE_REPLACEMENTS: [RegExp, string][] = [
  [/[\u2192\u279C\u27A4\u27F6\u21D2\u21A6]/g, "->"], // right arrows
  [/[\u2190\u27F5\u21D0]/g, "<-"],                   // left arrows
  [/[\u2194\u27F7]/g, "<->"],                        // bidirectional
  [/[\u2013\u2014]/g, "-"],                          // en-dash / em-dash
  [/[\u2018\u2019\u201A\u2032]/g, "'"],              // smart single quotes
  [/[\u201C\u201D\u201E\u2033]/g, '"'],              // smart double quotes
  [/\u2022/g, "\u2022"],                              // bullet (preserve, in WinAnsi)
  [/\u2026/g, "..."],                                // ellipsis
  [/[\u00A0\u202F\u2009\u200B]/g, " "],              // nbsp / thin space / zwsp
  [/\u00B7/g, "\u00B7"],                              // middle dot (preserve)
  [/[\u2212]/g, "-"],                                 // minus sign
  [/[\u00D7]/g, "x"],                                 // multiplication sign
  [/[\u00B0]/g, " deg"],                              // degree
  [/[\u00B1]/g, "+/-"],                               // plus-minus
  [/[\u03BC\u00B5]/g, "u"],                           // micro
  [/[\u2264]/g, "<="],                                // less-or-equal
  [/[\u2265]/g, ">="],                                // greater-or-equal
];

function t(text: unknown): string {
  let out = String(text ?? "");
  for (const [pat, rep] of UNICODE_REPLACEMENTS) out = out.replace(pat, rep);
  // Strip any remaining char outside the printable WinAnsi range so jsPDF
  // never receives a code point it can't encode.
  out = out.replace(/[^\x09\x0A\x0D\x20-\x7E\xA1-\xFF\u2022\u00B7]/g, "?");
  return out;
}

export async function exportPlanToPDF(plan: PraxisPlan): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const cur: Cursor = { doc, y: MARGIN };

  // ── PAGE 1: COVER ─────────────────────────────────────────────────
  drawCover(doc, plan);

  // ── PAGE 2: LITERATURE QC ─────────────────────────────────────────
  doc.addPage();
  cur.y = MARGIN;
  drawSectionHeader(cur, "Literature Quality Control");
  drawNoveltyBox(cur, plan);
  cur.y += 4;
  drawReferences(cur, plan);

  // ── PAGES 3+: PROTOCOL ────────────────────────────────────────────
  doc.addPage();
  cur.y = MARGIN;
  drawSectionHeader(cur, "Experimental Protocol");
  drawProtocol(cur, plan);

  // ── BUDGET ────────────────────────────────────────────────────────
  doc.addPage();
  cur.y = MARGIN;
  drawSectionHeader(cur, "Budget");
  drawBudget(cur, plan);

  // ── MATERIALS ─────────────────────────────────────────────────────
  doc.addPage();
  cur.y = MARGIN;
  drawSectionHeader(cur, "Materials");
  drawMaterials(cur, plan);

  // ── TIMELINE ──────────────────────────────────────────────────────
  doc.addPage();
  cur.y = MARGIN;
  drawSectionHeader(cur, "Timeline");
  drawTimeline(cur, plan);

  // ── VALIDATION ────────────────────────────────────────────────────
  doc.addPage();
  cur.y = MARGIN;
  drawSectionHeader(cur, "Validation Approach");
  drawValidation(cur, plan);

  // Footers on every page
  applyFooter(doc, plan);

  const expType = (plan.meta.experiment_type || "experiment").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`praxis-plan-${expType}-${dateStr}.pdf`);
}

// ──────────────────────────────────────────────────────────────────────
// Drawing helpers
// ──────────────────────────────────────────────────────────────────────

function drawCover(doc: jsPDF, plan: PraxisPlan) {
  doc.setFillColor(15, 15, 19);
  doc.rect(0, 0, PAGE_W, 80, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.text("PRAXIS", MARGIN, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(180, 180, 180);
  doc.text(t("Hypothesis to runnable experiment plan"), MARGIN, 36);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const title = plan.meta.plan_title || plan.meta.experiment_type || plan.meta.hypothesis;
  const wrappedTitle = doc.splitTextToSize(t(title), CONTENT_W);
  doc.text(wrappedTitle, MARGIN, 56);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 210);
  doc.text(
    t(`${plan.meta.domain} \u00B7 Generated ${new Date(plan.meta.generated_at).toLocaleDateString()}`),
    MARGIN,
    74,
  );

  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Hypothesis", MARGIN, 100);
  doc.setFont("helvetica", "normal");
  const hypoLines = doc.splitTextToSize(t(plan.meta.hypothesis), CONTENT_W);
  doc.text(hypoLines, MARGIN, 107);

  let y = 107 + hypoLines.length * 5 + 10;

  if (plan.meta.executive_summary) {
    doc.setFont("helvetica", "bold");
    doc.text("Executive summary", MARGIN, y);
    y += 7;
    doc.setFont("helvetica", "normal");
    const sumLines = doc.splitTextToSize(t(plan.meta.executive_summary), CONTENT_W);
    doc.text(sumLines, MARGIN, y);
    y += sumLines.length * 5 + 8;
  }

  const nov = plan.novelty.status;
  const novColor = nov === "Not Found" ? [22, 163, 74] : nov === "Similar Exists" ? [217, 119, 6] : [220, 38, 38];
  doc.setDrawColor(novColor[0], novColor[1], novColor[2]);
  doc.setFillColor(novColor[0], novColor[1], novColor[2], 0.08 as unknown as number);
  doc.roundedRect(MARGIN, y, CONTENT_W, 18, 2, 2, "S");
  doc.setTextColor(novColor[0], novColor[1], novColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(t(`Novelty: ${plan.novelty.status.toUpperCase()}`), MARGIN + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  const sumText = (plan.novelty.summary ?? "Literature checked.").trim();
  const sumLines2 = doc.splitTextToSize(t(sumText), CONTENT_W - 8);
  doc.text(sumLines2.slice(0, 2), MARGIN + 4, y + 13);
}

function drawSectionHeader(cur: Cursor, title: string) {
  const { doc } = cur;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(t(title), MARGIN, cur.y);
  cur.y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, cur.y + 2, PAGE_W - MARGIN, cur.y + 2);
  cur.y += 10;
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
}

function ensureSpace(cur: Cursor, needed: number) {
  if (cur.y + needed > PAGE_H - MARGIN - 6) {
    cur.doc.addPage();
    cur.y = MARGIN;
  }
}

function drawNoveltyBox(cur: Cursor, plan: PraxisPlan) {
  const nov = plan.novelty.status;
  const novColor = nov === "Not Found" ? [22, 163, 74] : nov === "Similar Exists" ? [217, 119, 6] : [220, 38, 38];
  const { doc } = cur;
  doc.setDrawColor(novColor[0], novColor[1], novColor[2]);
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(MARGIN, cur.y, CONTENT_W, 22, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(novColor[0], novColor[1], novColor[2]);
  doc.text(t(`Novelty signal: ${plan.novelty.status}`), MARGIN + 4, cur.y + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  const sum = (plan.novelty.summary || "Literature reviewed.").trim();
  const lines = doc.splitTextToSize(t(sum), CONTENT_W - 8);
  doc.text(lines.slice(0, 2), MARGIN + 4, cur.y + 14);
  cur.y += 28;
}

function drawReferences(cur: Cursor, plan: PraxisPlan) {
  const { doc } = cur;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("References", MARGIN, cur.y);
  cur.y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(
    t("Click any URL below to open the source in your browser."),
    MARGIN,
    cur.y,
  );
  cur.y += 6;
  doc.setFontSize(9);
  if (plan.novelty.references.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.text(t("No literature references attached."), MARGIN, cur.y);
    cur.y += 6;
    return;
  }
  plan.novelty.references.forEach((r, idx) => {
    ensureSpace(cur, 18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    const titleLines = doc.splitTextToSize(t(`${idx + 1}. ${r.title}`), CONTENT_W);
    doc.text(titleLines, MARGIN, cur.y);
    cur.y += titleLines.length * 4.4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    const meta: string[] = [];
    if (r.source) meta.push(String(r.source));
    if (r.authors && r.authors !== "Literature match") meta.push(String(r.authors));
    if (r.year) meta.push(String(r.year));
    if (r.doi && r.doi !== "n/a" && !r.doi.startsWith("http")) meta.push(`DOI: ${r.doi}`);
    if (meta.length) {
      doc.text(t(meta.join(" \u00B7 ")), MARGIN, cur.y);
      cur.y += 4.5;
    }
    if (r.url) {
      const urlText = t(r.url);
      doc.setTextColor(79, 70, 229);
      doc.setFont("helvetica", "normal");
      // Compute text width for an underline so the link is obviously clickable
      const w =
        (doc.getStringUnitWidth(urlText) * (doc.getFontSize() as number)) /
        (doc.internal.scaleFactor as number);
      doc.textWithLink(urlText, MARGIN, cur.y, { url: r.url });
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, cur.y + 0.6, MARGIN + Math.min(w, CONTENT_W), cur.y + 0.6);
      cur.y += 5;
    } else {
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(8);
      doc.text(t("(No URL available for this reference)"), MARGIN, cur.y);
      doc.setFontSize(9);
      cur.y += 4.5;
    }
    cur.y += 3;
  });
}

function drawProtocol(cur: Cursor, plan: PraxisPlan) {
  const { doc } = cur;
  plan.protocol.forEach((step, i) => {
    ensureSpace(cur, 30);

    doc.setTextColor(220, 220, 220);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(40);
    doc.text(t(String(step.step).padStart(2, "0")), MARGIN, cur.y + 2);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(13);
    doc.text(t(step.title), MARGIN + 18, cur.y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(t(step.description), CONTENT_W - 18);
    doc.text(lines, MARGIN + 18, cur.y + 6);
    cur.y += 6 + lines.length * 4.7;

    if (step.duration_min > 0) {
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(t(`Duration: ${formatDuration(step.duration_min)}`), MARGIN + 18, cur.y);
      cur.y += 4;
    }

    if (step.critical_note) {
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(217, 119, 6);
      const noteLines = doc.splitTextToSize(t(step.critical_note), CONTENT_W - 22);
      const h = noteLines.length * 4.5 + 6;
      doc.roundedRect(MARGIN + 18, cur.y, CONTENT_W - 18, h, 1.5, 1.5, "FD");
      doc.setTextColor(120, 70, 0);
      doc.setFontSize(9);
      doc.text(noteLines, MARGIN + 22, cur.y + 5);
      cur.y += h;
    }

    cur.y += 6;
    if (i < plan.protocol.length - 1) {
      doc.setDrawColor(230, 230, 230);
      doc.line(MARGIN, cur.y, PAGE_W - MARGIN, cur.y);
      cur.y += 6;
    }
  });
}

function drawBudget(cur: Cursor, plan: PraxisPlan) {
  const { doc } = cur;
  const b = plan.budget;
  const total = b.grand_total > 0 ? b.grand_total : b.labor + b.materials + b.contingency;

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(t("Estimated total"), MARGIN, cur.y);
  doc.setFontSize(28);
  doc.setTextColor(79, 70, 229);
  doc.setFont("helvetica", "bold");
  doc.text(t(formatMoney(total, b.currency)), MARGIN, cur.y + 12);
  cur.y += 22;

  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.setFont("helvetica", "bold");
  doc.text(t("Breakdown"), MARGIN, cur.y);
  cur.y += 6;

  const segs = [
    ["Materials", b.materials],
    ["Labor", b.labor],
    ["Equipment", b.equipment ?? 0],
    ["Contingency", b.contingency],
  ] as const;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  segs.forEach(([label, value]) => {
    if (value <= 0) return;
    const pct = total > 0 ? (value / total) * 100 : 0;
    const barW = (CONTENT_W - 60) * (pct / 100);
    ensureSpace(cur, 8);

    doc.setTextColor(40, 40, 40);
    doc.text(t(label), MARGIN, cur.y);

    doc.setFillColor(238, 242, 255);
    doc.rect(MARGIN + 35, cur.y - 3, CONTENT_W - 60, 5, "F");
    doc.setFillColor(79, 70, 229);
    doc.rect(MARGIN + 35, cur.y - 3, barW, 5, "F");

    doc.setTextColor(80, 80, 80);
    doc.text(t(`${formatMoney(value, b.currency)} (${pct.toFixed(0)}%)`), PAGE_W - MARGIN, cur.y, { align: "right" });
    cur.y += 8;
  });

  if (b.breakdown_notes) {
    cur.y += 4;
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const notesLines = doc.splitTextToSize(t(b.breakdown_notes), CONTENT_W);
    doc.text(notesLines, MARGIN, cur.y);
  }
}

function drawMaterials(cur: Cursor, plan: PraxisPlan) {
  const { doc } = cur;
  const groups: Record<string, typeof plan.materials> = {};
  plan.materials.forEach((m) => {
    const k = m.category || "Other";
    if (!groups[k]) groups[k] = [];
    groups[k].push(m);
  });

  Object.entries(groups).forEach(([cat, mats]) => {
    ensureSpace(cur, 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(t(cat.toUpperCase()), MARGIN, cur.y);
    cur.y += 5;
    doc.setDrawColor(230, 230, 230);
    doc.line(MARGIN, cur.y, PAGE_W - MARGIN, cur.y);
    cur.y += 4;

    mats.forEach((m) => {
      ensureSpace(cur, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      const nameLines = doc.splitTextToSize(t(`${m.name}  (x${m.quantity} ${m.unit})`), CONTENT_W - 30);
      doc.text(nameLines, MARGIN, cur.y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(t(formatMoney(m.cost, plan.budget.currency)), PAGE_W - MARGIN, cur.y, { align: "right" });
      cur.y += nameLines.length * 4.5;
      doc.setTextColor(140, 140, 140);
      doc.setFontSize(8);
      doc.text(t(`${m.supplier} \u00B7 ${m.catalog}`), MARGIN, cur.y);
      cur.y += 6;
    });

    cur.y += 4;
  });

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  ensureSpace(cur, 8);
  doc.text(t("Catalog numbers are AI-estimated. Verify all items with suppliers before ordering."), MARGIN, cur.y);
}

function drawTimeline(cur: Cursor, plan: PraxisPlan) {
  const { doc } = cur;
  const phases = plan.timeline;
  if (phases.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(t("No timeline phases provided."), MARGIN, cur.y);
    return;
  }
  const totalWeeks = Math.max(...phases.map((p) => p.start_week + p.weeks - 1));
  const labelW = 50;
  const trackW = CONTENT_W - labelW;

  phases.forEach((p, i) => {
    ensureSpace(cur, 10);
    const left = MARGIN + labelW + (trackW * (p.start_week - 1)) / totalWeeks;
    const w = (trackW * p.weeks) / totalWeeks;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    const labelLines = doc.splitTextToSize(t(p.phase), labelW - 4);
    doc.text(labelLines, MARGIN, cur.y + 4);

    doc.setFillColor(238, 242, 255);
    doc.roundedRect(MARGIN + labelW, cur.y, trackW, 6, 1.5, 1.5, "F");
    const shade = Math.max(60, 235 - i * 30);
    doc.setFillColor(79, 70, 229);
    doc.roundedRect(left, cur.y, w, 6, 1.5, 1.5, "F");

    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(t(`W${p.start_week}-W${p.start_week + p.weeks - 1}`), PAGE_W - MARGIN, cur.y + 4, { align: "right" });

    cur.y += 10;
    void shade;
  });
}

function drawValidation(cur: Cursor, plan: PraxisPlan) {
  const { doc } = cur;
  const v = plan.validation;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(t(`Statistical power: ${(v.statistical_power * 100).toFixed(0)}%`), MARGIN, cur.y);
  cur.y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const just = doc.splitTextToSize(t(v.sample_size_justification), CONTENT_W);
  doc.text(just, MARGIN, cur.y);
  cur.y += just.length * 4.5 + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  doc.text("Controls", MARGIN, cur.y);
  cur.y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  v.controls.forEach((c) => {
    ensureSpace(cur, 6);
    const lines = doc.splitTextToSize(t(`\u2022 ${c}`), CONTENT_W);
    doc.text(lines, MARGIN, cur.y);
    cur.y += lines.length * 4.5;
  });
  cur.y += 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 40);
  ensureSpace(cur, 14);
  doc.text("Failure modes & mitigations", MARGIN, cur.y);
  cur.y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  v.risks.forEach((r) => {
    ensureSpace(cur, 12);
    doc.setTextColor(40, 40, 40);
    const riskLines = doc.splitTextToSize(t(`\u2022 ${r.risk}`), CONTENT_W);
    doc.text(riskLines, MARGIN, cur.y);
    cur.y += riskLines.length * 4.5;
    doc.setTextColor(110, 110, 110);
    // The literal Unicode arrow (U+2192) here is what produced the mojibake
    // ('& ' interleaved between every char) in jsPDF's WinAnsi helvetica.
    // sanitize() rewrites it to ASCII '->' before it ever reaches the PDF.
    const mitLines = doc.splitTextToSize(t(`  -> ${r.mitigation}`), CONTENT_W - 4);
    doc.text(mitLines, MARGIN, cur.y);
    cur.y += mitLines.length * 4.5 + 1;
  });

  if (v.primary_success_criterion) {
    cur.y += 4;
    ensureSpace(cur, 22);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(22, 163, 74);
    doc.roundedRect(MARGIN, cur.y, CONTENT_W, 18, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(22, 163, 74);
    doc.text(t("Primary success criterion"), MARGIN + 4, cur.y + 6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(t(v.primary_success_criterion), CONTENT_W - 8);
    doc.text(lines.slice(0, 2), MARGIN + 4, cur.y + 12);
    cur.y += 22;
  }
}

function applyFooter(doc: jsPDF, plan: PraxisPlan) {
  const total = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const titleShort = (plan.meta.plan_title || plan.meta.experiment_type || "Plan").slice(0, 60);
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    if (p > 1) {
      doc.text(t(`Praxis \u00B7 ${titleShort}`), MARGIN, PAGE_H - 8);
    }
    doc.text(t(`${p} / ${total}`), PAGE_W - MARGIN, PAGE_H - 8, { align: "right" });
  }
}

function formatMoney(n: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${n.toFixed(0)}`;
  }
}

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const hours = min / 60;
  if (hours < 24) return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} h`;
  const days = hours / 24;
  return `${days % 1 === 0 ? days.toFixed(0) : days.toFixed(1)} d`;
}
