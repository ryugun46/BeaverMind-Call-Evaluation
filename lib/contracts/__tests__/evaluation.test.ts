/**
 * @file lib/contracts/__tests__/evaluation.test.ts
 *
 * Lightweight schema tests for the shared evaluation domain contract.
 * Uses Node's built-in test runner (node:test) + assert — zero extra deps.
 *
 * Run:  npm run test:contracts
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  EvaluationRunSchema,
  EvaluationResultSchema,
  CreateEvaluationInputSchema,
  DimensionResultSchema,
  PerformanceBandSchema,
  CallTypeSchema,
} from "../../contracts/evaluation";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns 12 valid active dimension stubs with sequential numbers. */
function makeActiveDimensions(count = 12) {
  return Array.from({ length: count }, (_, i) => ({
    dimensionNumber: i + 1,
    name: `Dimension ${i + 1}`,
    score: 8,
    maxScore: 10,
    band: "STRONG" as const,
    reasoning: "Well executed.",
    evidence: [{ speaker: "Rep", quote: "This is a direct quote." }],
    quickFix: null,
  }));
}

/** Minimal valid queued run. */
const validQueuedRun = {
  id: "eval-queue-0001",
  callType: "kickoff",
  status: "queued",
  createdAt: "2026-08-22T10:00:00Z",
  result: null,
  error: null,
};

/** Minimal valid EvaluationResult for a kickoff call. */
const validKickoffResult = {
  scoreSummary: {
    rawScore: 84,
    maxPossible: 100,
    normalizedScore: 84,
    finalScore: 84,
    performanceBand: "STRONG" as const,
  },
  brief: "Strong kickoff call with good agenda framing and next-step clarity.",
  oneThing: {
    title: "Pre-send diagnostic form",
    explanation: "Send the schema mapping form 48h before the next session.",
    currentScore: 84,
    potentialScore: 91,
    affectedDimensionNumbers: [9],
  },
  redFlags: [],
  appliedRules: [],
  dimensions: makeActiveDimensions(12),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("EvaluationRunSchema", () => {
  it("1. accepts a valid queued run", () => {
    const parsed = EvaluationRunSchema.safeParse(validQueuedRun);
    assert.equal(parsed.success, true, "Queued run should be valid");
  });

  it("5. rejects an invalid call type", () => {
    const parsed = EvaluationRunSchema.safeParse({
      ...validQueuedRun,
      callType: "discovery", // not a valid CallType
    });
    assert.equal(parsed.success, false, "Invalid call type should be rejected");
  });
});

describe("EvaluationResultSchema", () => {
  it("2. accepts a valid completed kickoff result (12 active dimensions)", () => {
    const parsed = EvaluationResultSchema.safeParse(validKickoffResult);
    assert.equal(parsed.success, true, "Valid kickoff result should parse");
  });

  it("3. accepts a valid completed coaching result with a disabled D4 dimension", () => {
    const dims = makeActiveDimensions(12);
    // Replace D4 with a disabled/N/A dimension
    dims[3] = {
      dimensionNumber: 4,
      name: "Movement Coaching Quality",
      score: null as unknown as number, // null is valid for disabled dims
      maxScore: 15,
      band: null as unknown as "STRONG",
      reasoning: "Not applicable on this call.",
      evidence: [],
      quickFix: null,
      disabled: true,
      disabledReason: "No physical movement coaching conducted.",
    } as typeof dims[0];

    const coachingResult = {
      ...validKickoffResult,
      scoreSummary: {
        rawScore: 71,
        maxPossible: 85,
        normalizedScore: 84,
        finalScore: 84,
        performanceBand: "STRONG" as const,
      },
      appliedRules: [
        {
          ruleId: "DIM_APPLICABILITY_NORMALIZATION",
          label: "D4 Non-Applicability Normalization",
          description: "D4 excluded; scored out of 85 and normalized to 100.",
          scope: "applicability" as const,
          affectedDimensionNumber: 4,
          effect: "71 / 85 normalized to 84 / 100.",
        },
      ],
      dimensions: dims,
    };

    const parsed = EvaluationResultSchema.safeParse(coachingResult);
    assert.equal(parsed.success, true, "Coaching result with disabled D4 should parse");
  });

  it("4. accepts a disabled dimension with score: null", () => {
    const disabledDim = {
      dimensionNumber: 4,
      name: "Movement Coaching Quality",
      score: null,
      maxScore: 15,
      band: null,
      reasoning: "Not applicable.",
      evidence: [],
      disabled: true,
      disabledReason: "Physical coaching not conducted.",
    };

    const parsed = DimensionResultSchema.safeParse(disabledDim);
    assert.equal(parsed.success, true, "Disabled dimension with score=null should be valid");
  });

  it("7. rejects a negative score on a dimension", () => {
    const parsed = DimensionResultSchema.safeParse({
      dimensionNumber: 1,
      name: "Pre-Call Preparation",
      score: -5, // invalid — must be nonnegative
      maxScore: 10,
      reasoning: "Some reasoning.",
      evidence: [],
    });
    assert.equal(parsed.success, false, "Negative score should be rejected");
  });

  it("8. rejects an invalid performance band", () => {
    const parsed = PerformanceBandSchema.safeParse("AVERAGE"); // not a valid band
    assert.equal(parsed.success, false, "Invalid performance band should be rejected");
  });

  it("rejects result with wrong dimension count (not 12)", () => {
    const result = {
      ...validKickoffResult,
      dimensions: makeActiveDimensions(11), // only 11 — should fail
    };
    const parsed = EvaluationResultSchema.safeParse(result);
    assert.equal(parsed.success, false, "Result with 11 dimensions should be rejected");
  });
});

describe("CreateEvaluationInputSchema", () => {
  it("6. rejects an empty transcript", () => {
    const parsed = CreateEvaluationInputSchema.safeParse({
      callType: "kickoff",
      transcript: "   ", // whitespace only — trims to empty string
    });
    assert.equal(parsed.success, false, "Whitespace-only transcript should be rejected");
  });

  it("accepts a valid create input", () => {
    const parsed = CreateEvaluationInputSchema.safeParse({
      callType: "coaching",
      transcript: "Coach: Great work today. Client: Thanks for the session.",
    });
    assert.equal(parsed.success, true, "Valid create input should be accepted");
  });

  it("rejects an unsupported call type in create input", () => {
    const parsed = CreateEvaluationInputSchema.safeParse({
      callType: "discovery",
      transcript: "Some valid transcript content.",
    });
    assert.equal(parsed.success, false, "Invalid call type in create input should be rejected");
  });
});

describe("CallTypeSchema", () => {
  it("accepts 'kickoff'", () => {
    assert.equal(CallTypeSchema.safeParse("kickoff").success, true);
  });
  it("accepts 'coaching'", () => {
    assert.equal(CallTypeSchema.safeParse("coaching").success, true);
  });
  it("rejects 'discovery'", () => {
    assert.equal(CallTypeSchema.safeParse("discovery").success, false);
  });
  it("rejects 'AT RISK' as a band (canonical form is AT_RISK)", () => {
    assert.equal(PerformanceBandSchema.safeParse("AT RISK").success, false);
  });
  it("accepts 'AT_RISK' as a band", () => {
    assert.equal(PerformanceBandSchema.safeParse("AT_RISK").success, true);
  });
});
