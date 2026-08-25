import "server-only";

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from "pdf-lib";

import type {
  EvaluationPublicResponse,
  EvidenceItem,
} from "@/lib/contracts/evaluation";
import {
  locateTranscriptQuote,
  parseTranscript,
  type ParsedTranscript,
} from "@/lib/server/evaluation/transcript-structure";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const CONTENT_TOP = PAGE_HEIGHT - 60;
const CONTENT_BOTTOM = 48;

const COLORS = {
  ink: rgb(0.09, 0.09, 0.11),
  muted: rgb(0.39, 0.39, 0.42),
  light: rgb(0.95, 0.95, 0.96),
  line: rgb(0.86, 0.86, 0.88),
  white: rgb(1, 1, 1),
  green: rgb(0.02, 0.48, 0.34),
  greenSoft: rgb(0.91, 0.98, 0.95),
  amber: rgb(0.71, 0.38, 0.04),
  amberSoft: rgb(1, 0.97, 0.88),
  rose: rgb(0.73, 0.07, 0.2),
  roseSoft: rgb(1, 0.94, 0.95),
  blue: rgb(0.12, 0.35, 0.72),
} as const;

type TextColor = ReturnType<typeof rgb>;

function printableText(value: string): string {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u2022/g, "*")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const paragraphs = printableText(text).split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line) lines.push(line);
      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        line = word;
        continue;
      }

      let fragment = "";
      for (const character of word) {
        if (font.widthOfTextAtSize(fragment + character, size) > maxWidth) {
          if (fragment) lines.push(fragment);
          fragment = character;
        } else {
          fragment += character;
        }
      }
      line = fragment;
    }
    if (line) lines.push(line);
  }

  return lines;
}

function formatCallType(callType: EvaluationPublicResponse["callType"]): string {
  return callType === "kickoff" ? "Kick-off" : "Coaching";
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function displayBand(value: string | null): string {
  return value ? value.replaceAll("_", " ") : "N/A";
}

function normalizedParticipantLabel(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveEvidenceSpeakerName(
  speaker: string,
  participants: { clientName?: string | null; coachName?: string | null }
): string {
  const label = normalizedParticipantLabel(speaker);
  const coachName = participants.coachName?.trim();
  const clientName = participants.clientName?.trim();

  if (/\b(?:coach|rep|advisor|consultant)\b/.test(label) && coachName) {
    return coachName;
  }
  if (/\b(?:client|customer|member)\b/.test(label) && clientName) {
    return clientName;
  }

  const matchesName = (name: string | undefined) => {
    if (!name || !label) return false;
    const normalizedName = normalizedParticipantLabel(name);
    return (
      label === normalizedName ||
      normalizedName.startsWith(`${label} `) ||
      label.startsWith(`${normalizedName} `)
    );
  };
  const matchesCoach = matchesName(coachName);
  const matchesClient = matchesName(clientName);
  if (matchesCoach !== matchesClient) {
    return matchesCoach ? coachName! : clientName!;
  }

  return speaker;
}

export function resolveEvidenceAttribution(
  evidence: EvidenceItem,
  participants: { clientName?: string | null; coachName?: string | null },
  transcript?: string,
  parsedTranscript: ParsedTranscript | undefined = transcript
    ? parseTranscript(transcript)
    : undefined
) {
  let speaker = evidence.speaker;
  let turnIndex = evidence.turnIndex;
  let timestamp = evidence.timestamp;

  if (/^unknown$/i.test(speaker.trim()) && transcript && parsedTranscript) {
    const located = locateTranscriptQuote(
      transcript,
      evidence.quote,
      undefined,
      parsedTranscript
    );
    if (located && !/^unknown$/i.test(located.speaker.trim())) {
      speaker = located.speaker;
      turnIndex = located.turnIndex;
      timestamp = located.timestamp;
    }
  }

  return {
    speaker: resolveEvidenceSpeakerName(speaker, participants),
    turnIndex,
    timestamp,
  };
}

function bandColor(value: string): TextColor {
  if (value === "ELITE" || value === "STRONG") return COLORS.green;
  if (value === "INCONSISTENT") return COLORS.amber;
  return COLORS.rose;
}

class ReportComposer {
  private page!: PDFPage;
  private y = CONTENT_TOP;

  constructor(
    private readonly document: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont
  ) {
    this.addPage();
  }

  private addPage() {
    this.page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = CONTENT_TOP;

    if (this.document.getPageCount() > 1) {
      this.page.drawText("BEAVERMIND  /  CALL EVALUATION", {
        x: MARGIN_X,
        y: PAGE_HEIGHT - 32,
        size: 7.5,
        font: this.bold,
        color: COLORS.muted,
      });
      this.page.drawLine({
        start: { x: MARGIN_X, y: PAGE_HEIGHT - 42 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: PAGE_HEIGHT - 42 },
        thickness: 0.6,
        color: COLORS.line,
      });
    }
  }

  ensureSpace(height: number) {
    if (this.y - height < CONTENT_BOTTOM) this.addPage();
  }

  space(height: number) {
    this.ensureSpace(height);
    this.y -= height;
  }

  text(
    value: string,
    options: {
      size?: number;
      lineHeight?: number;
      font?: PDFFont;
      color?: TextColor;
      x?: number;
      width?: number;
    } = {}
  ) {
    const size = options.size ?? 9.5;
    const lineHeight = options.lineHeight ?? size * 1.38;
    const font = options.font ?? this.regular;
    const color = options.color ?? COLORS.ink;
    const x = options.x ?? MARGIN_X;
    const width = options.width ?? PAGE_WIDTH - MARGIN_X - x;
    const lines = wrapText(value, font, size, width);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      if (line) {
        this.page.drawText(line, { x, y: this.y, size, font, color });
      }
      this.y -= lineHeight;
    }
  }

  label(value: string) {
    this.text(value.toUpperCase(), {
      size: 7.5,
      lineHeight: 11,
      font: this.bold,
      color: COLORS.muted,
    });
  }

  section(title: string) {
    this.ensureSpace(38);
    this.y -= 10;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: this.y - 14,
      width: 3,
      height: 18,
      color: COLORS.ink,
    });
    this.page.drawText(printableText(title), {
      x: MARGIN_X + 11,
      y: this.y - 10,
      size: 14,
      font: this.bold,
      color: COLORS.ink,
    });
    this.y -= 30;
  }

  callout(title: string, body: string, tone: "neutral" | "green" | "rose" = "neutral") {
    const background = tone === "green" ? COLORS.greenSoft : tone === "rose" ? COLORS.roseSoft : COLORS.light;
    const accent = tone === "green" ? COLORS.green : tone === "rose" ? COLORS.rose : COLORS.ink;
    const bodyLines = wrapText(body, this.regular, 9.5, CONTENT_WIDTH - 30);
    const height = 45 + bodyLines.length * 13;

    if (height <= PAGE_HEIGHT - CONTENT_BOTTOM - 70) {
      this.ensureSpace(height + 8);
      const top = this.y;
      this.page.drawRectangle({
        x: MARGIN_X,
        y: top - height,
        width: CONTENT_WIDTH,
        height,
        color: background,
        borderColor: COLORS.line,
        borderWidth: 0.5,
      });
      this.page.drawRectangle({ x: MARGIN_X, y: top - height, width: 4, height, color: accent });
      this.page.drawText(printableText(title), {
        x: MARGIN_X + 16,
        y: top - 22,
        size: 10.5,
        font: this.bold,
        color: accent,
      });
      let bodyY = top - 42;
      for (const line of bodyLines) {
        if (line) {
          this.page.drawText(line, {
            x: MARGIN_X + 16,
            y: bodyY,
            size: 9.5,
            font: this.regular,
            color: COLORS.ink,
          });
        }
        bodyY -= 13;
      }
      this.y = top - height - 8;
      return;
    }

    this.label(title);
    this.text(body);
    this.space(8);
  }

  dimensionHeader(dimensionNumber: number, name: string, score: string, band: string | null) {
    this.ensureSpace(105);
    const top = this.y;
    this.page.drawRectangle({
      x: MARGIN_X,
      y: top - 42,
      width: CONTENT_WIDTH,
      height: 42,
      color: COLORS.light,
      borderColor: COLORS.line,
      borderWidth: 0.5,
    });
    this.page.drawText(`D${dimensionNumber}`, {
      x: MARGIN_X + 13,
      y: top - 25,
      size: 10,
      font: this.bold,
      color: COLORS.blue,
    });
    this.page.drawText(printableText(name), {
      x: MARGIN_X + 46,
      y: top - 25,
      size: 11,
      font: this.bold,
      color: COLORS.ink,
    });
    const scoreText = band ? `${score}  /  ${displayBand(band)}` : score;
    const scoreWidth = this.bold.widthOfTextAtSize(scoreText, 9);
    this.page.drawText(scoreText, {
      x: PAGE_WIDTH - MARGIN_X - 13 - scoreWidth,
      y: top - 24,
      size: 9,
      font: this.bold,
      color: band ? bandColor(band) : COLORS.muted,
    });
    this.y = top - 56;
  }

  finish() {
    const pages = this.document.getPages();
    pages.forEach((page, index) => {
      page.drawLine({
        start: { x: MARGIN_X, y: 34 },
        end: { x: PAGE_WIDTH - MARGIN_X, y: 34 },
        thickness: 0.5,
        color: COLORS.line,
      });
      page.drawText("Evidence-grounded QA report", {
        x: MARGIN_X,
        y: 20,
        size: 7,
        font: this.regular,
        color: COLORS.muted,
      });
      const pageLabel = `${index + 1} / ${pages.length}`;
      const width = this.regular.widthOfTextAtSize(pageLabel, 7);
      page.drawText(pageLabel, {
        x: PAGE_WIDTH - MARGIN_X - width,
        y: 20,
        size: 7,
        font: this.regular,
        color: COLORS.muted,
      });
    });
  }
}

export function buildEvaluationPdfFilename(evaluation: EvaluationPublicResponse): string {
  const base = evaluation.reportName ?? `${formatCallType(evaluation.callType)} Evaluation Report`;
  const safeBase = printableText(base)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${safeBase || "evaluation-report"}.pdf`;
}

export async function createEvaluationReportPdf(
  evaluation: EvaluationPublicResponse,
  options: { transcript?: string } = {}
): Promise<Uint8Array> {
  if (evaluation.status !== "completed" || !evaluation.result) {
    throw new Error("A completed evaluation result is required to create a PDF");
  }

  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const composer = new ReportComposer(document, regular, bold);
  const { result } = evaluation;
  const parsedTranscript = options.transcript
    ? parseTranscript(options.transcript)
    : undefined;
  const title = evaluation.reportName ?? `${formatCallType(evaluation.callType)} Evaluation Report`;

  document.setTitle(printableText(title));
  document.setAuthor("BeaverMind");
  document.setSubject("Call evaluation report");
  document.setCreator("BeaverMind Call Evaluation");
  document.setProducer("BeaverMind Call Evaluation");

  composer.text("BEAVERMIND", { size: 8, lineHeight: 15, font: bold, color: COLORS.green });
  composer.text(title, { size: 24, lineHeight: 29, font: bold, width: CONTENT_WIDTH });
  composer.space(4);
  composer.text(
    [
      `${formatCallType(evaluation.callType)} call`,
      `Completed ${formatDate(evaluation.completedAt)}`,
      `Rubric ${evaluation.rubricVersion}`,
    ].join("  |  "),
    { size: 8.5, lineHeight: 13, color: COLORS.muted }
  );
  const clientName = result.clientName ?? evaluation.metadata?.clientName;
  const coachName = result.coachName ?? evaluation.metadata?.repName;
  if (clientName || coachName) {
    composer.text(
      [clientName ? `Client: ${clientName}` : null, coachName ? `Coach: ${coachName}` : null]
        .filter(Boolean)
        .join("  |  "),
      { size: 9.5, lineHeight: 15, font: bold }
    );
  }
  composer.space(12);

  const summary = result.scoreSummary;
  composer.callout(
    `${summary.finalScore.toFixed(1).replace(/\.0$/, "")} / 100  -  ${displayBand(summary.performanceBand)}`,
    `Raw score ${summary.rawScore} / ${summary.maxPossible}. Normalized score ${summary.normalizedScore}.`,
    summary.performanceBand === "ELITE" || summary.performanceBand === "STRONG"
      ? "green"
      : summary.performanceBand === "INCONSISTENT"
        ? "neutral"
        : "rose"
  );

  composer.section("Executive summary");
  composer.text(result.brief, { size: 10, lineHeight: 14.5 });
  composer.space(8);
  composer.callout(
    `The one thing: ${result.oneThing.title}`,
    `${result.oneThing.explanation} Current ${result.oneThing.currentScore}; potential ${result.oneThing.potentialScore}.`,
    "green"
  );

  composer.section("Risk and scoring rules");
  if (result.redFlags.length === 0) {
    composer.text("No red flags were identified.", { color: COLORS.muted });
  } else {
    for (const redFlag of result.redFlags) {
      composer.callout(
        `${redFlag.severity ? `${redFlag.severity.toUpperCase()}: ` : ""}${redFlag.title}`,
        redFlag.explanation,
        "rose"
      );
    }
  }
  if (result.appliedRules.length === 0) {
    composer.space(5);
    composer.text("No scoring caps or applicability rules were applied.", { color: COLORS.muted });
  } else {
    composer.space(6);
    composer.label("Applied scoring rules");
    for (const rule of result.appliedRules) {
      composer.callout(rule.label, `${rule.description} Effect: ${rule.effect}.`);
    }
  }

  composer.section("Dimension breakdown");
  for (const dimension of result.dimensions) {
    const score = dimension.disabled
      ? "N/A"
      : `${dimension.score ?? 0} / ${dimension.maxScore}`;
    composer.dimensionHeader(
      dimension.dimensionNumber,
      dimension.name,
      score,
      dimension.band
    );

    composer.label(dimension.disabled ? "Why this dimension is not applicable" : "Assessment");
    composer.text(dimension.disabledReason ?? dimension.reasoning);

    if (!dimension.disabled) {
      composer.space(5);
      composer.label("Transcript evidence");
      if (dimension.evidence.length === 0) {
        composer.text("No qualifying transcript evidence was found.", { color: COLORS.muted });
      } else {
        for (const evidence of dimension.evidence) {
          const attribution = resolveEvidenceAttribution(
            evidence,
            { clientName, coachName },
            options.transcript,
            parsedTranscript
          );
          const evidenceLocation = attribution.timestamp
            ? ` [${attribution.timestamp}]`
            : attribution.turnIndex !== undefined
              ? ` [Turn ${attribution.turnIndex + 1}]`
              : "";
          composer.text(`${attribution.speaker}${evidenceLocation}: "${evidence.quote}"`, {
            size: 9,
            lineHeight: 13,
            color: COLORS.muted,
            x: MARGIN_X + 12,
            width: CONTENT_WIDTH - 12,
          });
        }
      }

      if (dimension.quickFix) {
        composer.space(5);
        composer.label("Quick fix");
        composer.text(dimension.quickFix, {
          color: COLORS.blue,
          x: MARGIN_X + 12,
          width: CONTENT_WIDTH - 12,
        });
      }
    }
    composer.space(15);
  }

  composer.section("Report details");
  composer.text(`Evaluation ID: ${evaluation.id}`, { size: 8.5, color: COLORS.muted });
  composer.text(`Created: ${formatDate(evaluation.createdAt)}`, { size: 8.5, color: COLORS.muted });
  if (evaluation.metadata?.callDuration) {
    composer.text(`Call duration: ${evaluation.metadata.callDuration}`, { size: 8.5, color: COLORS.muted });
  }
  if (evaluation.metadata?.wordCount !== undefined) {
    composer.text(`Transcript word count: ${evaluation.metadata.wordCount}`, { size: 8.5, color: COLORS.muted });
  }

  composer.finish();
  return document.save({ useObjectStreams: true });
}
