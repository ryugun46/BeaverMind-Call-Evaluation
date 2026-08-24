import { STANDARD_PERFORMANCE_BANDS } from "./performance-bands";
import { RubricDefinitionSchema, type DimensionBandLabel, type ScoreBandDefinition } from "./schema";

const bucket = (
  label: DimensionBandLabel,
  score: number,
  criteria: string
): ScoreBandDefinition => ({ label, scoreKind: "anchor", score, criteria });

const discrete = (scoreBands: ScoreBandDefinition[]) => ({
  mode: "discrete" as const,
  allowedScores: scoreBands.map((band) => {
    if (band.scoreKind !== "anchor") throw new Error("Coaching buckets must be exact score anchors");
    return band.score;
  }),
  scoreBands,
});

const disabledOutcome = { disabled: true as const, score: null, band: "N/A" as const };

/**
 * Coaching rubric transcribed from coaching-call-rubric.md, with the
 * source-owner-approved D2 maximum and N/A policy recorded in v2.
 */
export const COACHING_RUBRIC = RubricDefinitionSchema.parse({
  id: "coaching",
  version: "coaching-v2",
  callType: "coaching",
  name: "Coaching Call",
  sourceReference: {
    fileName: "coaching-call-rubric.md",
    title: "Coaching call — scoring rubric",
  },
  scope:
    "Transcript only. Strengthen Connection, Confidence, and Continuity. Post-call delivery is outside scope; only in-call promises are scored. Full maximum is 100 when D4 is active and 85 when D4 is disabled.",
  maxScore: 100,
  scoreMode: "discrete",
  dimensions: [
    {
      number: 1,
      name: "Check-In & Connection",
      maxScore: 10,
      pillar: "CONNECTION",
      sopTimeMinutes: "3",
      guidance:
        "Assess genuine curiosity about body, wins, and struggles; listening and reflection; an explicit call intention; and adjustment to the client's real state.",
      scoring: discrete([
        bucket("ELITE", 10, "Checks body, wins, and struggles; listens and reflects; states a tailored intention and adjusts the call approach."),
        bucket("STRONG", 7, "Good check-in with limited depth or reflection; intention is present but generic."),
        bucket("SURFACE", 3, "Surface check-in, no reflection, rapid move to program topics, and no intention."),
        bucket("FAIL", 0, "Check-in skipped or rushed with no acknowledgment of client state."),
      ]),
      notes: ["The framework is a container, not a script; meeting an emotional client where they are is correct framework use."],
    },
    {
      number: 2,
      name: "Diagnostics Review",
      maxScore: 5,
      pillar: "VALUE",
      sopTimeMinutes: "3–4; applicable at weeks 8, 16, and 24",
      guidance:
        "When applicable, review one or two movements with anatomically specific feedback tied to the client's pain points, goals, and why.",
      scoring: discrete([
        bucket("ELITE", 5, "Reviews one or two movements with precise observations, direct goal linkage, and clear client understanding."),
        bucket("STRONG", 3.5, "Good observations and correct review scope, but goal context is incomplete."),
        bucket("SURFACE", 1.5, "Generic movement feedback with no goal link or too many movements reviewed."),
        bucket("FAIL", 0, "Applicable diagnostics are skipped, rushed, unclear, or not personalized."),
      ]),
      applicabilityRules: [
        {
          id: "COACHING_D2_DIAGNOSTICS_NOT_APPLICABLE",
          dimensionNumber: 2,
          condition: "Diagnostics are not applicable this cycle, such as a non-milestone call with no video submitted.",
          disabledReasonTemplate: "Diagnostics were not applicable for this cycle.",
          disabledOutcome,
          weightAdjustment: {
            mode: "exclude_dimension_weight",
            excludedWeight: 5,
            normalizeTo: 100,
          },
        },
      ],
      notes: [
        "Version 2 corrects D2 from 10 to 5 points while preserving the original bucket proportions.",
        "When D2 is N/A, exclude its five points from maxPossible and normalize the active raw score to 100; do not redistribute weight.",
      ],
    },
    {
      number: 3,
      name: "Program Focus + Vision",
      maxScore: 15,
      pillar: "EMOTION — Belief + Long-Term Buy-In",
      sopTimeMinutes: "4–5",
      guidance:
        "Assess explanation of the current block and an explicit connection to the client's named 12-month vision, identity, and reason for this phase now.",
      scoring: discrete([
        bucket("ELITE", 15, "Explains the block, ties it to the named 12-month vision and method, and elicits client belief or insight."),
        bucket("STRONG", 10, "Explains the block and connects it to goals, but the vision tie is generic."),
        bucket("MID", 5, "Explains current logistics without long-term why or a 12-month vision."),
        bucket("FAIL", 0, "No block explanation or vision connection."),
      ]),
    },
    {
      number: 4,
      name: "Movement Coaching Quality",
      maxScore: 15,
      pillar: "SUPPORT — Real Coaching, Not Commentary",
      sopTimeMinutes: "8–10",
      guidance:
        "When applicable, assess live or reviewed movement coaching, specific setup/breathing/control cues, reflective questions, observable improvement, and goal linkage.",
      scoring: discrete([
        bucket("ELITE", 15, "Coaches one or two movements with specific cues, reflection, observable learning, goal linkage, and redirection from talk to movement when needed."),
        bucket("STRONG", 10, "Clear relevant coaching, but reflection, breakthrough, goal link, or talker redirection is missing."),
        bucket("MID", 5, "Mostly one-way telling with no reflective questions or coaching exchange."),
        bucket("FAIL", 0, "Applicable movement work receives only commentary; client remains passive."),
      ]),
      applicabilityRules: [
        {
          id: "COACHING_D4_NO_MOVEMENT_COACHING",
          dimensionNumber: 4,
          condition: "All four movement-coaching presence criteria are absent from the call.",
          disabledReasonTemplate: "No movement coaching occurred; the session was entirely strategy/accountability.",
          disabledOutcome,
          weightAdjustment: {
            mode: "exclude_dimension_weight",
            excludedWeight: 15,
            normalizeTo: 100,
          },
          detectionCriteria: [
            "Client performed any live movement during the call.",
            "Coach gave setup, breathing, or control cues in response to a movement.",
            "Coach reviewed a recorded movement attempt and gave real-time feedback.",
            "Coach gave real-time form correction while the client moved.",
          ],
        },
      ],
      notes: ["Disable only when every detection criterion is absent; if any one is present, score D4 normally."],
    },
    {
      number: 5,
      name: "Adjustments & Strategy",
      maxScore: 10,
      pillar: "GOALS — Adaptability + Confidence",
      sopTimeMinutes: "3–4",
      guidance:
        "Assess whether training and lifestyle adjustments are explained as intelligent protection of the client's long game rather than a backward step.",
      scoring: discrete([
        bucket("ELITE", 10, "Adjustment rationale is clear, strategically framed, tied to the long game, and leaves the client more confident."),
        bucket("STRONG", 7, "Adjustments are explained with brief framing; client is not discouraged but not fully empowered."),
        bucket("SURFACE", 3, "Adjustments lack clear rationale and may leave subtle discouragement."),
        bucket("FAIL", 0, "Reactive, unexplained changes leave the client confused or demoralized."),
      ]),
    },
    {
      number: 6,
      name: "Action Steps & Accountability",
      maxScore: 15,
      pillar: "JOURNEY — Clarity + Ownership",
      sopTimeMinutes: "2–3",
      guidance:
        "Assess specific, measurable, time-bound coach and client commitments, verbal client ownership, weekly theme, and micro-commitments when slipping.",
      scoring: discrete([
        bucket("ELITE", 15, "Both sides own specific commitments and timing; client verbalizes ownership and micro-commitments are used when appropriate."),
        bucket("STRONG", 10, "Commitments are clear but deadlines, measurability, or one side's ownership is incomplete."),
        bucket("MID", 5, "Action steps are vague, non-measurable, or lack verbal ownership."),
        bucket("FAIL", 0, "No clear next steps for either party."),
      ]),
      notes: ["Score the live promise, not verification of post-call delivery."],
    },
    {
      number: 7,
      name: "Accountability Anchor",
      maxScore: 5,
      pillar: "JOURNEY — Single-Point Focus",
      guidance:
        "Assess a client-owned, verbally confirmed, verifiable commitment gated to the coach's next action. One named anchor or a progression-gated deliverable can qualify.",
      scoring: discrete([
        bucket("ELITE", 5, "A confirmed, time-bound client deliverable has a clear chain of consequence and unlocks the coach's next action."),
        bucket("MID", 3, "Accountability is present but not clearly gated, confirmed, or connected to a consequence."),
        bucket("FAIL", 0, "No accountability anchor; only vague tasks or no commitment."),
      ]),
      notes: ["Several tasks are not a downgrade when the deliverable is gated to progression and confirmed."],
    },
    {
      number: 8,
      name: "Struggle Handling",
      maxScore: 5,
      pillar: "CONNECTION — Emotional Safety + Problem Solving",
      guidance:
        "When struggle is present, assess grounded inquiry, reconnection to why, reframing, options, and whether the client leaves more capable.",
      scoring: discrete([
        bucket("ELITE", 5, "Coach explores the struggle without defensiveness, reconnects to why, reframes, offers options, and restores capability."),
        bucket("MID", 3, "Acknowledges and supports the struggle but coaching remains surface-level or does not reconnect to why."),
        bucket("FAIL", 0, "Struggle is ignored, minimized, avoided, or met defensively."),
      ]),
    },
    {
      number: 9,
      name: "Close Quality",
      maxScore: 5,
      pillar: "CONFIDENCE — Earned Reinforcement",
      guidance:
        "Assess celebration of a specific progress from this call, reiterated direction, warmth, and whether the client leaves energized.",
      scoring: discrete([
        bucket("ELITE", 5, "Celebrates named progress from this call and connects it to the next milestone in a warm, earned close."),
        bucket("MID", 3, "Positive but generic celebration or flat close without direction."),
        bucket("FAIL", 0, "Abrupt end with no emotional reinforcement or directional clarity."),
      ]),
    },
    {
      number: 10,
      name: "Next Call Booking",
      maxScore: 5,
      pillar: "CONTINUITY — Non-Negotiable",
      sopTimeMinutes: "Before the close",
      guidance: "Assess whether the next call is booked live and the date is confirmed verbally before closing.",
      scoring: discrete([
        bucket("ELITE", 5, "Booking is completed live and the date is verbally confirmed before the close."),
        bucket("FAIL", 0, "Call ends without the next call locked in live."),
      ]),
    },
    {
      number: 11,
      name: "Continuity & Follow-Up Clarity",
      maxScore: 5,
      pillar: "CONTINUITY",
      guidance:
        "Assess whether the client knows the client-action → coach-response chain, including deliverables and timing, based only on in-call statements.",
      scoring: discrete([
        bucket("ELITE", 5, "Anchor is restated and a specific client X-by-Y → coach Z-by-W chain is clear."),
        bucket("MID", 3, "Follow-up or anchor is mentioned but timing and expectations remain vague."),
        bucket("FAIL", 0, "No visible post-call structure."),
      ]),
      notes: ["Actual post-call delivery is not transcript-verifiable and remains outside this score."],
    },
    {
      number: 12,
      name: "Structure & Time Management",
      maxScore: 5,
      pillar: "FLOW",
      sopTimeMinutes: "25–30 total",
      guidance:
        "Assess natural flow through applicable sections, controlled pacing, unrushed booking and close, and whether the client can follow the call.",
      scoring: discrete([
        bucket("ELITE", 5, "All applicable sections flow naturally with smooth pacing and no client confusion."),
        bucket("MID", 3, "Mostly complete but uneven; one section is rushed, bloated, or compressed."),
        bucket("FAIL", 0, "Disorganized with missing core sections or unclear flow."),
      ]),
      notes: [
        "Robotic section announcements are a Mid signal, not Elite.",
        "At weeks 8, 16, and 24, evaluate pacing relative to the expected additional D2/D3 time.",
      ],
    },
  ],
  automaticRules: [
    {
      id: "COACHING_NEXT_CALL_NOT_BOOKED_D10_ZERO",
      label: "Next Call Not Booked Live",
      condition: "The next call is not booked live during the call.",
      effect: { kind: "force_dimension_score", dimensionNumber: 10, score: 0 },
      nonRecoverable: true,
    },
    {
      id: "COACHING_NO_LONG_TERM_VISION_D3_CAP",
      label: "No Long-Term Vision Connection",
      condition: "No connection to long-term vision occurs anywhere in the call.",
      effect: { kind: "dimension_cap", dimensionNumber: 3, maxScore: 10 },
    },
    {
      id: "COACHING_COACH_TALK_RATIO_TOTAL_CAP",
      label: "Coach Monologue",
      condition: "Coach speaks more than 75% of the call and the client is passive.",
      effect: { kind: "total_cap", maxTotal: 75 },
      deterministicGuard: {
        kind: "speaker_word_share_above",
        speakerLabelIncludes: "coach",
        thresholdPercent: 75,
      },
    },
    {
      id: "COACHING_NO_ACCOUNTABILITY_COMMITMENT_D6_CAP",
      label: "No Concrete Client Accountability Commitment",
      condition:
        "Before close, the client does not confirm a specific, verifiable deliverable, named anchor, or progression-gated ask.",
      effect: { kind: "dimension_cap", dimensionNumber: 6, maxScore: 10 },
    },
    {
      id: "COACHING_IGNORED_STRUGGLE_D8_ZERO",
      label: "Client Struggle Ignored",
      condition: "A client struggle is present but ignored or avoided.",
      effect: { kind: "force_dimension_score", dimensionNumber: 8, score: 0 },
      nonRecoverable: true,
    },
    {
      id: "COACHING_NO_ACTION_STEPS_TOTAL_CAP",
      label: "No Action Steps",
      condition: "No action steps are stated for either party before close.",
      effect: { kind: "total_cap", maxTotal: 70 },
    },
    {
      id: "COACHING_NO_ADJUSTMENTS_NEEDED_D5_DEFAULT",
      label: "No Adjustments Needed",
      condition: "No adjustments are needed this cycle and strategic awareness remains visible.",
      effect: { kind: "force_dimension_score", dimensionNumber: 5, score: 7 },
    },
    {
      id: "COACHING_NO_STRUGGLE_D8_DEFAULT",
      label: "No Struggle Present",
      condition: "No client struggle is present in the call.",
      effect: { kind: "force_dimension_score", dimensionNumber: 8, score: 5 },
    },
  ],
  performanceBands: [...STANDARD_PERFORMANCE_BANDS],
  scoringPrinciples: [
    "Every active dimension score must exactly match one authored bucket; never interpolate.",
    "Ground every score in specific transcript evidence and score conservatively when behavior is not verifiable.",
    "Judge depth, clarity, and client response; an explanation that does not land cannot be Elite.",
    "Use quote-first rationale and never score from general impressions.",
    "The framework is a natural container, not a script; robotic completeness is not Elite execution.",
    "When D4 is disabled, report raw score over 85 and normalize it to 100.",
    "When D2 is disabled, exclude its five-point weight rather than redistributing it; maxPossible is 95 with D4 active and 80 when D4 is also disabled.",
  ],
  unresolvedRules: [],
});
