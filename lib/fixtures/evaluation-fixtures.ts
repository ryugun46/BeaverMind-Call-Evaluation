/**
 * Development-only fixtures for every public lifecycle state.
 * Completed dimensions derive their names, maxima, precision, and score
 * buckets directly from the selected versioned rubric, then pass Zod parsing.
 */

import {
  DimensionResultSchema,
  EvaluationResultSchema,
  EvaluationPublicResponseSchema,
  EvaluationRunSchema,
  type CallType,
  type DimensionResult,
  type EvaluationResult,
  type EvaluationPublicResponse,
  type EvaluationRun,
  type PerformanceBand,
} from "@/lib/contracts/evaluation";
import { getRubricForCallType } from "@/lib/rubrics";

export const SAMPLE_KICKOFF_TRANSCRIPT = `Coach (Sarah): Thanks for meeting today, David. I reviewed your intake and the goal of reducing infrastructure spend before Q3 ends.
Client (David): Great. We especially need the Snowflake sync tested by week two.
Coach (Sarah): We have thirty minutes. First we will align on the outcome, then walk through the three program phases, and finally lock diagnostics and our next call. Does that work?
Client (David): Yes, that covers our priorities.
Coach (Sarah): What is the biggest business impact if we hit this launch date flawlessly?
Client (David): Leadership can decommission the legacy warehouse and save forty-five thousand dollars each month.
Coach (Sarah): Why does achieving that matter to you personally?
Client (David): It proves my team can lead the modernization program without another outside rescue.
Coach (Sarah): Our North Star is a reliable production cutover that your team owns. In thirty days, success means the Snowflake sync passes the agreed validation suite.
Client (David): That is exactly the outcome I want.
Coach (Sarah): Phase one is Movement Retraining, where we reset the core pattern. Phase two is Movement Remodeling, where we build capacity. Phase three is Movement Integrating, where the result holds under real life demands.
Client (David): The progression is clear.
Coach (Sarah): There may be an early dip while the new pattern becomes familiar. Normal training discomfort is expected, but sharp pain is a stop signal.
Client (David): Understood.
Coach (Sarah): Slack is the primary support channel, and you can expect a response within one business day. I will be direct when accountability slips.
Coach (Sarah): When stress rises, do you prefer written instructions or a live walkthrough?
Client (David): A written checklist first, then a short walkthrough.
Coach (Sarah): After this call you will film the diagnostic sequence, upload it by Wednesday, and I will build the first program by Friday.
Client (David): I can upload it by Wednesday at noon.
Coach (Sarah): Let us book Thursday at 10 AM Eastern for the diagnostic review.
Client (David): Booked.
Coach (Sarah): To recap, you upload Wednesday, I deliver Friday, and we meet Thursday at ten. You have a clear plan and the right team behind you.
Client (David): I feel confident about it.`;

export const SAMPLE_COACHING_TRANSCRIPT = `Coach (Marcus): Hi Jordan. How is your body feeling, and what was your best win and hardest struggle this week?
Client (Jordan): My back feels good. I trained four times, but travel made consistency difficult.
Coach (Marcus): You kept the habit alive under pressure. Today we will review the hinge, connect this block to your twelve-month goal, and leave with commitments from both of us.
Coach (Marcus): Your video shows the ribcage opening before the hips move. That is why the lower back takes over.
Client (Jordan): I can see that now.
Coach (Marcus): This block builds the control you need to travel without flare-ups and become the active parent you described for next year.
Client (Jordan): That makes the work feel worth it.
Coach (Marcus): Stand up for two live repetitions. Keep ribs stacked, breathe behind the brace, and push the hips back.
Client (Jordan): The second repetition feels much more stable.
Coach (Marcus): Good. We will reduce load this week so the new pattern stays clean; that protects the long game rather than setting you back.
Client (Jordan): I am comfortable with that adjustment.
Coach (Marcus): You will upload two form videos by Friday at noon. I will review them by Saturday at noon and unlock the next progression if control holds.
Client (Jordan): I commit to Friday at noon.
Coach (Marcus): Travel was the struggle. Which smaller action keeps the promise on travel days?
Client (Jordan): Ten minutes of mobility before breakfast, even if the full session moves.
Coach (Marcus): That is specific and achievable. You improved the hinge today and built a travel plan that serves your twelve-month vision.
Coach (Marcus): Our next call is booked for Tuesday at 2 PM. Please confirm that date.
Client (Jordan): Tuesday at 2 PM is confirmed.`;

const COACHING_STRATEGY_TRANSCRIPT = `Coach (Marcus): Hi Jordan. What was your best win and hardest struggle this week?
Client (Jordan): I completed four of five planned sessions, but travel disrupted my morning routine.
Coach (Marcus): You completed four of five sessions and sleep averaged seven hours. The pattern is strong except on travel mornings.
Coach (Marcus): This consistency block supports your twelve-month goal of staying active with your children without planning life around pain.
Client (Jordan): That is still the goal that matters most.
Coach (Marcus): No movement review is needed today. We will focus entirely on the travel strategy.
Coach (Marcus): Move the minimum session to ten minutes before breakfast; that protects the long game without treating travel as failure.
Client (Jordan): I can own ten minutes before breakfast.
Coach (Marcus): You will log the travel session by Friday at noon. I will review the log by Saturday and send the next progression.
Client (Jordan): I commit to Friday at noon.
Coach (Marcus): You said travel felt discouraging. What makes the smaller promise feel achievable?
Client (Jordan): It removes the pressure to find a full hour.
Coach (Marcus): You preserved consistency and leave with a strategy you chose.
Coach (Marcus): Our next call is booked for Tuesday at 2 PM. Please confirm that date.
Client (Jordan): Tuesday at 2 PM is confirmed.`;

const AT_RISK_KICKOFF_TRANSCRIPT = `Coach (Alex): Hi Rachel. I have some notes, so let us get started.
Client (Rachel): I want to understand what happens next and when the pain should improve.
Coach (Alex): We have about thirty minutes. We will discuss goals, review the program, and cover next steps.
Client (Rachel): Okay.
Coach (Alex): Your goal is to return to running, and the deeper reason is being active with your children.
Client (Rachel): Yes, that is the important part.
Coach (Alex): The program has three phases, and we build capacity as you progress.
Coach (Alex): Some discomfort can occur while adapting, but sharp pain means stop and contact me.
Coach (Alex): Use Slack for questions. I usually answer within one business day.
Coach (Alex): Upload the diagnostic video by Wednesday and I will review it Friday.
Client (Rachel): I can do Wednesday.
Coach (Alex): We should meet next Thursday afternoon.
Client (Rachel): I can probably make that work.
Coach (Alex): To recap, send the video Wednesday and I will respond Friday.
Client (Rachel): Thanks.`;

type ActiveDimensionFixture = {
  score: number;
  reasoning?: string;
  speaker?: string;
  quote?: string;
  quickFix?: string | null;
};

function makeActiveDimension(
  callType: CallType,
  dimensionNumber: number,
  fixture: ActiveDimensionFixture
): DimensionResult {
  const definition = getRubricForCallType(callType).dimensions.find(
    (dimension) => dimension.number === dimensionNumber
  );
  if (!definition) throw new Error(`Missing ${callType} D${dimensionNumber}`);

  const scoreBand = definition.scoring.scoreBands.find((candidate) =>
    candidate.scoreKind === "anchor"
      ? fixture.score === candidate.score
      : fixture.score >= candidate.minScore && fixture.score <= candidate.maxScore
  );
  if (!scoreBand) {
    throw new Error(
      `${callType} D${dimensionNumber} score ${fixture.score} is outside authored bands`
    );
  }
  if (
    definition.scoring.mode === "discrete" &&
    !definition.scoring.allowedScores.includes(fixture.score)
  ) {
    throw new Error(
      `${callType} D${dimensionNumber} score ${fixture.score} is not an allowed bucket`
    );
  }

  return DimensionResultSchema.parse({
    dimensionNumber,
    name: definition.name,
    score: fixture.score,
    maxScore: definition.maxScore,
    band: scoreBand.label,
    reasoning:
      fixture.reasoning ??
      `The transcript supports the authored ${scoreBand.label} criteria for this dimension.`,
    evidence: fixture.quote
      ? [{ speaker: fixture.speaker ?? "Coach", quote: fixture.quote }]
      : [],
    quickFix: fixture.quickFix ?? null,
    disabled: false,
    disabledReason: null,
  });
}

function makeDisabledDimension(
  callType: CallType,
  dimensionNumber: number,
  disabledReason: string
): DimensionResult {
  const definition = getRubricForCallType(callType).dimensions.find(
    (dimension) => dimension.number === dimensionNumber
  );
  if (!definition) throw new Error(`Missing ${callType} D${dimensionNumber}`);
  return DimensionResultSchema.parse({
    dimensionNumber,
    name: definition.name,
    score: null,
    maxScore: definition.maxScore,
    band: null,
    reasoning: disabledReason,
    evidence: [],
    quickFix: null,
    disabled: true,
    disabledReason,
  });
}

function makeDimensions(
  callType: CallType,
  scores: readonly (number | null)[],
  quotes: readonly (string | null)[],
  disabledReason?: string
) {
  if (scores.length !== 12 || quotes.length !== 12) {
    throw new Error("Fixture inputs must contain exactly 12 dimensions");
  }
  return scores.map((score, index) =>
    score === null
      ? makeDisabledDimension(
          callType,
          index + 1,
          disabledReason ?? "This dimension was not applicable to the call."
        )
      : makeActiveDimension(callType, index + 1, {
          score,
          quote: quotes[index] ?? undefined,
          reasoning:
            quotes[index] === null
              ? "Required behavior was not present in the transcript."
              : undefined,
          quickFix:
            quotes[index] === null
              ? "Add the required behavior explicitly and confirm it with the client."
              : null,
        })
  );
}

function makeResult(input: {
  rawScore: number;
  maxPossible: number;
  normalizedScore: number;
  finalScore: number;
  performanceBand: PerformanceBand;
  brief: string;
  oneThing: EvaluationResult["oneThing"];
  redFlags?: EvaluationResult["redFlags"];
  appliedRules?: EvaluationResult["appliedRules"];
  dimensions: DimensionResult[];
}) {
  return EvaluationResultSchema.parse({
    scoreSummary: {
      rawScore: input.rawScore,
      maxPossible: input.maxPossible,
      normalizedScore: input.normalizedScore,
      finalScore: input.finalScore,
      performanceBand: input.performanceBand,
    },
    brief: input.brief,
    oneThing: input.oneThing,
    redFlags: input.redFlags ?? [],
    appliedRules: input.appliedRules ?? [],
    dimensions: input.dimensions,
  });
}

const kickoffQuotes = [
  "I reviewed your intake and the goal of reducing infrastructure spend before Q3 ends.",
  "Thanks for meeting today, David.",
  "First we will align on the outcome, then walk through the three program phases, and finally lock diagnostics and our next call. Does that work?",
  "Our North Star is a reliable production cutover that your team owns.",
  "Phase one is Movement Retraining, where we reset the core pattern. Phase two is Movement Remodeling, where we build capacity. Phase three is Movement Integrating, where the result holds under real life demands.",
  "Normal training discomfort is expected, but sharp pain is a stop signal.",
  "Slack is the primary support channel, and you can expect a response within one business day.",
  "When stress rises, do you prefer written instructions or a live walkthrough?",
  "After this call you will film the diagnostic sequence, upload it by Wednesday, and I will build the first program by Friday.",
  "Let us book Thursday at 10 AM Eastern for the diagnostic review.",
  "To recap, you upload Wednesday, I deliver Friday, and we meet Thursday at ten.",
  "I will build the first program by Friday.",
] as const;

const coachingQuotes = [
  "How is your body feeling, and what was your best win and hardest struggle this week?",
  "Your video shows the ribcage opening before the hips move.",
  "This block builds the control you need to travel without flare-ups and become the active parent you described for next year.",
  "Keep ribs stacked, breathe behind the brace, and push the hips back.",
  "We will reduce load this week so the new pattern stays clean; that protects the long game rather than setting you back.",
  "You will upload two form videos by Friday at noon. I will review them by Saturday at noon and unlock the next progression if control holds.",
  "I commit to Friday at noon.",
  "Travel was the struggle. Which smaller action keeps the promise on travel days?",
  "You improved the hinge today and built a travel plan that serves your twelve-month vision.",
  "Our next call is booked for Tuesday at 2 PM. Please confirm that date.",
  "I will review them by Saturday at noon and unlock the next progression if control holds.",
  "Today we will review the hinge, connect this block to your twelve-month goal, and leave with commitments from both of us.",
] as const;

const coachingStrategyQuotes = [
  "What was your best win and hardest struggle this week?",
  "You completed four of five sessions and sleep averaged seven hours.",
  "This consistency block supports your twelve-month goal of staying active with your children without planning life around pain.",
  null,
  "Move the minimum session to ten minutes before breakfast; that protects the long game without treating travel as failure.",
  "You will log the travel session by Friday at noon. I will review the log by Saturday and send the next progression.",
  "I commit to Friday at noon.",
  "You said travel felt discouraging. What makes the smaller promise feel achievable?",
  "You preserved consistency and leave with a strategy you chose.",
  "Our next call is booked for Tuesday at 2 PM. Please confirm that date.",
  "I will review the log by Saturday and send the next progression.",
  "We will focus entirely on the travel strategy.",
] as const;

const kickoffEliteResult = makeResult({
  rawScore: 92,
  maxPossible: 100,
  normalizedScore: 92,
  finalScore: 92,
  performanceBand: "ELITE",
  brief:
    "A well-prepared Kick-off call with a clear North Star, three-phase explanation, explicit support expectations, diagnostics, and live booking.",
  oneThing: {
    title: "Deepen coaching-intelligence discovery",
    explanation:
      "Add a second behavioral follow-up so the initial program is personalized beyond the client's stated learning preference.",
    currentScore: 92,
    potentialScore: 95,
    affectedDimensionNumbers: [8],
  },
  dimensions: makeDimensions(
    "kickoff",
    [10, 10, 4.5, 15, 10, 10, 5, 7, 7, 4.5, 5, 4],
    kickoffQuotes
  ),
});

const kickoffAtRiskResult = makeResult({
  rawScore: 61.5,
  maxPossible: 100,
  normalizedScore: 61.5,
  finalScore: 61.5,
  performanceBand: "AT_RISK",
  brief:
    "The call establishes basic direction but lacks coaching-intelligence questions, full phase detail, and a firmly confirmed next appointment.",
  oneThing: {
    title: "Ask coaching-intelligence questions",
    explanation:
      "Explore consistency triggers, stress response, and learning preference before recommending the first plan.",
    currentScore: 61.5,
    potentialScore: 71.5,
    affectedDimensionNumbers: [8],
  },
  redFlags: [
    {
      title: "Next call not firmly booked",
      explanation: "A general afternoon was discussed without a confirmed date and time.",
      severity: "medium",
    },
  ],
  dimensions: makeDimensions(
    "kickoff",
    [8, 7, 3.5, 10, 6, 7, 3, 0, 7, 3.5, 3, 3.5],
    [
      "I have some notes, so let us get started.",
      "Hi Rachel.",
      "We will discuss goals, review the program, and cover next steps.",
      "Your goal is to return to running, and the deeper reason is being active with your children.",
      "The program has three phases, and we build capacity as you progress.",
      "Some discomfort can occur while adapting, but sharp pain means stop and contact me.",
      "Use Slack for questions. I usually answer within one business day.",
      null,
      "Upload the diagnostic video by Wednesday and I will review it Friday.",
      "We should meet next Thursday afternoon.",
      "To recap, send the video Wednesday and I will respond Friday.",
      "I will respond Friday.",
    ]
  ),
});

const coachingFullResult = makeResult({
  rawScore: 92,
  maxPossible: 100,
  normalizedScore: 92,
  finalScore: 92,
  performanceBand: "ELITE",
  brief:
    "A complete Coaching call with live movement work, long-term vision, an intelligent adjustment, concrete commitments, and live booking.",
  oneThing: {
    title: "Elicit one more reflective movement insight",
    explanation:
      "After the corrected repetition, ask the client to name the cue that produced the change before moving on.",
    currentScore: 92,
    potentialScore: 97,
    affectedDimensionNumbers: [4],
  },
  dimensions: makeDimensions(
    "coaching",
    [10, 10, 15, 10, 7, 10, 5, 5, 5, 5, 5, 5],
    coachingQuotes
  ),
});

const d4DisabledReason =
  "No live or recorded movement coaching occurred; the session focused entirely on strategy and accountability.";

const coachingDisabledResult = makeResult({
  rawScore: 71,
  maxPossible: 85,
  normalizedScore: 84,
  finalScore: 84,
  performanceBand: "STRONG",
  brief:
    "A strong strategy and accountability session. Movement Coaching Quality was correctly excluded because no movement work occurred.",
  oneThing: {
    title: "Strengthen the long-term vision connection",
    explanation:
      "Name the client's twelve-month identity outcome explicitly before finalizing this week's commitments.",
    currentScore: 84,
    potentialScore: 90,
    affectedDimensionNumbers: [3],
  },
  appliedRules: [
    {
      ruleId: "COACHING_D4_NO_MOVEMENT_COACHING",
      label: "Movement Coaching Quality Not Applicable",
      description: d4DisabledReason,
      scope: "applicability",
      affectedDimensionNumber: 4,
      effect: "Raw score 71 / 85; normalized score 84 / 100.",
      nonRecoverable: false,
    },
  ],
  dimensions: makeDimensions(
    "coaching",
    [7, 7, 10, null, 7, 10, 5, 5, 5, 5, 5, 5],
    coachingStrategyQuotes,
    d4DisabledReason
  ),
});

function parseRun(run: EvaluationRun): EvaluationRun {
  return EvaluationRunSchema.parse(run);
}

export const FIXTURE_EVALUATIONS: Record<string, EvaluationRun> = {
  "kickoff-elite": parseRun({
    id: "9842c6a0-2c3f-4a13-8b91-000000000001",
    callType: "kickoff",
    rubricVersion: "kickoff-v1",
    status: "completed",
    transcript: SAMPLE_KICKOFF_TRANSCRIPT,
    createdAt: "2026-08-22T11:15:00Z",
    updatedAt: "2026-08-22T11:15:42Z",
    processingStartedAt: "2026-08-22T11:15:02Z",
    completedAt: "2026-08-22T11:15:42Z",
    result: kickoffEliteResult,
    error: null,
    metadata: { repName: "Sarah Chen", clientName: "David Miller", callDuration: "28m 14s", wordCount: 3420 },
  }),
  "kickoff-at-risk": parseRun({
    id: "61a2f351-57db-4f90-8f60-000000000002",
    callType: "kickoff",
    rubricVersion: "kickoff-v1",
    status: "completed",
    transcript: AT_RISK_KICKOFF_TRANSCRIPT,
    createdAt: "2026-08-22T12:20:00Z",
    updatedAt: "2026-08-22T12:20:40Z",
    processingStartedAt: "2026-08-22T12:20:03Z",
    completedAt: "2026-08-22T12:20:40Z",
    result: kickoffAtRiskResult,
    error: null,
    metadata: { repName: "Alex Morgan", clientName: "Rachel Lee", callDuration: "24m 08s", wordCount: 2710 },
  }),
  "completed-coaching-full": parseRun({
    id: "8821ee9f-e8d7-47cf-9a61-000000000003",
    callType: "coaching",
    rubricVersion: "coaching-v1",
    status: "completed",
    transcript: SAMPLE_COACHING_TRANSCRIPT,
    createdAt: "2026-08-22T15:00:00Z",
    updatedAt: "2026-08-22T15:00:45Z",
    processingStartedAt: "2026-08-22T15:00:02Z",
    completedAt: "2026-08-22T15:00:45Z",
    result: coachingFullResult,
    error: null,
    metadata: { repName: "Marcus Vance", clientName: "Jordan Hayes", callDuration: "42m 18s", wordCount: 4580 },
  }),
  "coaching-d4-disabled": parseRun({
    id: "4491ab12-45f4-4d81-a8be-000000000004",
    callType: "coaching",
    rubricVersion: "coaching-v1",
    status: "completed",
    transcript: COACHING_STRATEGY_TRANSCRIPT,
    createdAt: "2026-08-22T14:30:00Z",
    updatedAt: "2026-08-22T14:30:38Z",
    processingStartedAt: "2026-08-22T14:30:02Z",
    completedAt: "2026-08-22T14:30:38Z",
    result: coachingDisabledResult,
    error: null,
    metadata: { repName: "Marcus Vance", clientName: "Jordan Hayes", callDuration: "31m 05s", wordCount: 2890 },
  }),
  "processing-coaching": parseRun({
    id: "7712d548-e501-4619-9b45-000000000005",
    callType: "coaching",
    rubricVersion: "coaching-v1",
    status: "processing",
    transcript: SAMPLE_COACHING_TRANSCRIPT,
    createdAt: "2026-08-22T17:58:10Z",
    updatedAt: "2026-08-22T17:58:14Z",
    processingStartedAt: "2026-08-22T17:58:14Z",
    completedAt: null,
    result: null,
    error: null,
    metadata: { repName: "Marcus Vance", clientName: "Jordan Hayes", wordCount: 3120 },
  }),
  "queued-kickoff": parseRun({
    id: "3301f8a1-e892-4f1e-886e-000000000006",
    callType: "kickoff",
    rubricVersion: "kickoff-v1",
    status: "queued",
    transcript: SAMPLE_KICKOFF_TRANSCRIPT,
    createdAt: "2026-08-22T18:02:45Z",
    updatedAt: "2026-08-22T18:02:45Z",
    processingStartedAt: null,
    completedAt: null,
    result: null,
    error: null,
    metadata: { repName: "Sarah Chen", clientName: "David Miller", wordCount: 3420 },
  }),
  "failed-kickoff": parseRun({
    id: "9011ce3c-e2df-4bb8-a170-000000000007",
    callType: "kickoff",
    rubricVersion: "kickoff-v1",
    status: "failed",
    transcript: "Unlabelled transcript fragment.",
    createdAt: "2026-08-22T16:12:00Z",
    updatedAt: "2026-08-22T16:12:15Z",
    processingStartedAt: "2026-08-22T16:12:02Z",
    completedAt: "2026-08-22T16:12:15Z",
    result: null,
    error: {
      code: "TRANSCRIPT_FORMAT_INVALID",
      message: "The transcript does not contain identifiable speaker turns.",
      details: { wordCount: 3, speakerTurnsDetected: 0 },
    },
    metadata: { wordCount: 3 },
  }),
};

const FIXTURE_ALIASES: Record<string, string> = {
  "demo-queued": "queued-kickoff",
  "demo-processing": "processing-coaching",
  "demo-failed": "failed-kickoff",
  "demo-completed-kickoff": "kickoff-elite",
  "demo-completed-coaching": "completed-coaching-full",
  "demo-coaching-d4-disabled": "coaching-d4-disabled",
};

export function getEvaluationById(id: string): EvaluationRun | null {
  const normalizedId = id.trim().toLowerCase();
  const direct = FIXTURE_EVALUATIONS[normalizedId];
  if (direct) return direct;
  const alias = FIXTURE_ALIASES[normalizedId];
  if (alias) return FIXTURE_EVALUATIONS[alias] ?? null;
  return (
    Object.values(FIXTURE_EVALUATIONS).find(
      (evaluation) => evaluation.id.toLowerCase() === normalizedId
    ) ?? null
  );
}

export function getPublicEvaluationById(id: string): EvaluationPublicResponse | null {
  const evaluation = getEvaluationById(id);
  if (!evaluation) return null;
  const { transcript: _privateTranscript, ...publicEvaluation } = evaluation;
  return EvaluationPublicResponseSchema.parse(publicEvaluation);
}
