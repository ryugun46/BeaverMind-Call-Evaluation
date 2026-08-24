import { STANDARD_PERFORMANCE_BANDS } from "./performance-bands";
import { RubricDefinitionSchema, type ScoreBandDefinition } from "./schema";

const range = (
  label: ScoreBandDefinition["label"],
  minScore: number,
  maxScore: number,
  criteria: string
): ScoreBandDefinition => ({ label, scoreKind: "range", minScore, maxScore, criteria });

const anchor = (
  label: ScoreBandDefinition["label"],
  score: number,
  criteria: string
): ScoreBandDefinition => ({ label, scoreKind: "anchor", score, criteria });

const banded = (increment: 1 | 0.5, scoreBands: ScoreBandDefinition[]) => ({
  mode: "banded" as const,
  increment,
  scoreBands,
});

/**
 * Kick-off rubric transcribed from kickoff-call-rubric.md.
 * Exact-score table rows remain authored anchors; explicit ranges remain
 * ranges. The rubric-level mode is banded, so these must never be treated as
 * Coaching-style global discrete buckets.
 */
export const KICKOFF_RUBRIC = RubricDefinitionSchema.parse({
  id: "kickoff",
  version: "kickoff-v1",
  callType: "kickoff",
  name: "Kick-off Call",
  sourceReference: {
    fileName: "kickoff-call-rubric.md",
    title: "Kick-off call — scoring rubric",
  },
  scope:
    "Transcript only. All 12 dimensions are active. D7 and D12 score what is communicated during the call, not whether follow-up landed afterward.",
  maxScore: 100,
  scoreMode: "banded",
  dimensions: [
    {
      number: 1,
      name: "Pre-Call Preparation",
      maxScore: 10,
      guidance:
        "Assess whether the coach demonstrably reviewed sales notes before the call and naturally uses the client's name, goals, injuries, and context. Score conduct, not whether the coach announces that notes were read.",
      scoring: banded(1, [
        range("ELITE", 9, 10, "Fully reviewed intake; naturally references at least two specific details early, avoids repetition, and delivers seamlessly."),
        range("STRONG", 6, 8, "Clear content evidence of preparation with only a small factual, timing, or redundancy gap."),
        range("MID", 4, 5, "Partial preparation; thin personalization, mechanical note use, or several redundant questions."),
        range("WEAK", 1, 3, "Minimal preparation visible; the client performs most context-setting."),
        anchor("FAIL", 0, "Clearly unprepared, resets the sale, or asks for foundational information already collected."),
      ]),
      positiveSignals: [
        "Specific goals, pain, or history surfaced naturally in the opening",
        "Coach tells the client they need not repeat the sales call",
      ],
      negativeSignals: ["Multiple redundant intake questions", "Generic opening with no client-specific context"],
      notes: [
        "Do not default to Mid merely because the coach did not say they read the notes.",
        "One factual misstep in an otherwise prepared opening belongs in Strong, not Mid.",
        "Letting a client voluntarily share context for relational warmth is not a deduction.",
      ],
    },
    {
      number: 2,
      name: "Rapport & Tone",
      maxScore: 10,
      guidance: "Assess whether genuine human connection forms and the coach adapts energy to the client.",
      scoring: banded(1, [
        anchor("ELITE", 10, "Warm, calm, personalized, natural, and non-scripted; client opens up spontaneously."),
        anchor("STRONG", 7, "Friendly and conversational but limited in personal or emotional depth."),
        anchor("MID", 3, "Mechanical or scripted; friendly but transactional."),
        anchor("FAIL", 0, "Cold, rushed, transactional, or skips rapport entirely."),
      ]),
    },
    {
      number: 3,
      name: "Agenda Framing",
      maxScore: 5,
      guidance: "Assess explicit time framing, at least three sequenced phases, and client consent.",
      scoring: banded(0.5, [
        range("ELITE", 4.5, 5, "Time framing, at least three sequenced phases, and client verbal consent are all present."),
        range("MID", 2.5, 3.5, "Agenda is partial: timing, sequencing depth, or client buy-in is missing."),
        range("WEAK", 1, 2, "Brief or fragmented preview without meaningful sequencing."),
        anchor("FAIL", 0, "No up-front structure."),
      ]),
      notes: ["Natural-language sequencing qualifies; numbered enumeration is not required."],
    },
    {
      number: 4,
      name: "Goal Alignment & Deep Why",
      maxScore: 15,
      guidance:
        "Assess emotional drivers, follow-up depth, a constructed North Star, a specific 30-day success measure, and client confirmation.",
      scoring: banded(1, [
        anchor("ELITE", 15, "At least two why follow-ups, emotional or identity driver, explicit North Star, measurable 30-day success, and client confirmation."),
        anchor("STRONG", 10, "Goals understood with one follow-up and some emotional context, but the North Star or 30-day target remains incomplete."),
        anchor("MID", 5, "Physical goals repeated without probing, emotional depth, or a North Star."),
        anchor("FAIL", 0, "No meaningful alignment; generic answer accepted or dimension skipped."),
      ]),
    },
    {
      number: 5,
      name: "Program Explanation (3 Phases)",
      maxScore: 10,
      guidance:
        "Assess whether the three-stage progression is clear, correctly ordered, connected to client goals, and understood. Accept canonical or equivalent names.",
      scoring: banded(1, [
        range("ELITE", 9, 10, "All phases and outcomes are clear, supported by analogy or reassessment cadence, tied to goals, and transfer belief."),
        range("STRONG", 6, 8, "All phases appear in order but explanation, personalization, analogy, cadence, or understanding check is incomplete."),
        range("MID", 3, 5, "Only one or two phases or a fragmented progression is communicated."),
        range("WEAK", 1, 2, "Phases or steps referenced without names or sequence."),
        anchor("FAIL", 0, "Program phases skipped or misrepresented."),
      ]),
      notes: [
        "Movement Retraining → Movement Remodeling → Movement Integrating is canonical and must receive full phase-identification credit.",
        "Equivalent ordered language such as Reset/Build/Freedom is accepted.",
      ],
    },
    {
      number: 6,
      name: "Journey & Expectation Setting",
      maxScore: 10,
      guidance: "Assess milestones, timeline, challenges, emotional friction, pain distinction, and North Star linkage.",
      scoring: banded(1, [
        anchor("ELITE", 10, "Explains timeline and challenges, normalizes emotional valleys, distinguishes discomfort from pain, and links expectations to the North Star."),
        anchor("STRONG", 7, "Covers timeline and physical expectations but misses emotional preparation."),
        anchor("MID", 3, "Vague or instructional expectations that omit how the journey may feel."),
        anchor("FAIL", 0, "No expectation setting or unrealistic expectations are left unchallenged."),
      ]),
    },
    {
      number: 7,
      name: "Support System Clarity",
      maxScore: 5,
      guidance:
        "Score what is said in-call about primary channel, usage, response expectations, community access, and accountability style.",
      scoring: banded(0.5, [
        anchor("ELITE", 5, "All channels and uses, response timing, community access, and accountability style are made clear and understood."),
        anchor("MID", 3, "Support is mentioned but usage, response timing, or accountability framing remains vague."),
        anchor("FAIL", 0, "No channel or support expectations are explained."),
      ]),
      notes: ["External message history is not required; this dimension is transcript-only and remains active."],
    },
    {
      number: 8,
      name: "Coaching Intelligence Questions",
      maxScore: 10,
      guidance:
        "Assess behavioral patterns, consistency triggers, learning style, stress response, and whether answers personalize the coaching approach.",
      scoring: banded(1, [
        anchor("ELITE", 10, "Deep behavioral and self-awareness questions are used to personalize coaching and identify archetype signals."),
        anchor("STRONG", 7, "One or two useful questions are asked but depth or adaptation is limited."),
        anchor("MID", 3, "Only generic logistics, availability, or equipment questions are asked."),
        anchor("FAIL", 0, "No coaching-intelligence questions."),
      ]),
    },
    {
      number: 9,
      name: "Next Steps & Diagnostics",
      maxScore: 10,
      guidance:
        "Assess clarity of the diagnostics → film → upload → program → start-date pipeline, filming instructions, timing, and client confirmation.",
      scoring: banded(1, [
        anchor("ELITE", 10, "Complete pipeline, filming guidance, timeline, confusion removal, and client confirmation."),
        anchor("STRONG", 7, "Instructions and timeline are mostly clear with minor ambiguity or no demonstration."),
        anchor("MID", 3, "Partial instructions, gaps, unresolved doubts, or no specific timeline."),
        anchor("FAIL", 0, "No clear next steps."),
      ]),
    },
    {
      number: 10,
      name: "Booking Next Call",
      maxScore: 5,
      guidance: "Assess live verbal confirmation of a specific date and time, including resolution of scheduling constraints.",
      scoring: banded(0.5, [
        range("ELITE", 4.5, 5, "Date and time confirmed verbally during the call; scheduling constraints handled live."),
        range("MID", 2.5, 3.5, "Booking attempted but not fully secured; excessive flexibility remains."),
        range("WEAK", 1, 2, "Booking referenced without a concrete live attempt."),
        anchor("FAIL", 0, "Next call not addressed."),
      ]),
      notes: ["Verbal confirmation is substantive; technical calendar-invite timing is not a deduction."],
    },
    {
      number: 11,
      name: "Close, Recap & Confidence",
      maxScore: 5,
      guidance: "Assess structured recap, confidence anchoring, emotional reinforcement, and an energetic close.",
      scoring: banded(0.5, [
        anchor("ELITE", 5, "Structured recap, confidence anchor, and emotional reinforcement; close is more than logistics."),
        anchor("MID", 3, "Positive or logistical close without structured recap or an emotional anchor."),
        anchor("FAIL", 0, "Abrupt, unclear, flat, or disappointing ending."),
      ]),
    },
    {
      number: 12,
      name: "Post-Call Execution",
      maxScore: 5,
      guidance:
        "Score in-call promises of post-call deliverables and their timing; actual delivery is outside transcript QC scope.",
      scoring: banded(0.5, [
        range("ELITE", 4.5, 5, "At least two explicit commitments with precise timing; top score requires three or more crisp commitments."),
        range("STRONG", 3.5, 4, "At least two commitments with mostly precise timing and only minor gaps."),
        range("MID", 2, 3, "At least one specific commitment, but timing is rough or commitments are limited."),
        anchor("WEAK", 1, "Vague follow-up reference without a concrete deliverable or timing."),
        anchor("FAIL", 0, "No post-call commitment stated."),
      ]),
      notes: ["An informal promise with rough timing is Mid, not Fail."],
    },
  ],
  automaticRules: [
    {
      id: "KICKOFF_NO_FOLLOW_UP_QUESTIONS_TOTAL_CAP",
      label: "No Follow-Up Questions",
      condition: "No follow-up questions occur anywhere in the call.",
      effect: { kind: "total_cap", maxTotal: 70 },
    },
    {
      id: "KICKOFF_COACH_TALK_RATIO_TOTAL_CAP",
      label: "Coach Monologue",
      condition: "Coach speaks more than 70% of the time without client engagement.",
      effect: { kind: "total_cap", maxTotal: 80 },
      deterministicGuard: {
        kind: "speaker_word_share_above",
        speakerLabelIncludes: "coach",
        thresholdPercent: 70,
      },
    },
    {
      id: "KICKOFF_UNRESOLVED_CONFUSION_TOTAL_CAP",
      label: "Unresolved Client Confusion",
      condition: "The client shows unresolved confusion at any point.",
      effect: { kind: "total_cap", maxTotal: 75 },
    },
    {
      id: "KICKOFF_NO_NORTH_STAR_D4_CAP",
      label: "No North Star Statement",
      condition: "No North Star statement is constructed.",
      effect: { kind: "dimension_cap", dimensionNumber: 4, maxScore: 10 },
    },
    {
      id: "KICKOFF_NO_STRUCTURED_RECAP_D11_CAP",
      label: "No Structured Recap",
      condition: "The close contains no structured recap.",
      effect: { kind: "dimension_cap", dimensionNumber: 11, maxScore: 3 },
    },
  ],
  performanceBands: [...STANDARD_PERFORMANCE_BANDS],
  scoringPrinciples: [
    "Ground every score in direct transcript evidence; never score assumptions or general impressions.",
    "Judge depth, clarity, and client response; an explanation that does not land cannot be Elite.",
    "Use quote-first rationale for every dimension.",
    "Be conservative on missing evidence within the appropriate band; do not collapse a clearly above-Mid call into Mid without a stated reason.",
    "Within authored bands, use integer scores or half steps for dimensions worth five points or less.",
  ],
  unresolvedRules: [],
});
