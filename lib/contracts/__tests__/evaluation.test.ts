import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CallTypeSchema,
  CreateEvaluationInputSchema,
  DimensionResultSchema,
  EvaluationResultSchema,
  EvaluationRunSchema,
  PerformanceBandSchema,
} from "../evaluation";
import { FIXTURE_EVALUATIONS } from "@/lib/fixtures/evaluation-fixtures";
import { getRubricForCallType } from "@/lib/rubrics";

const validDimension = {
  dimensionNumber: 1,
  name: "Pre-Call Preparation",
  score: 8,
  maxScore: 10,
  band: "STRONG" as const,
  reasoning: "The behavior is visible in the transcript.",
  evidence: [{ speaker: "Coach", quote: "I reviewed your intake." }],
  quickFix: null,
  disabled: false,
  disabledReason: null,
};

describe("fixture contract integration", () => {
  it("runtime-validates every lifecycle fixture", () => {
    for (const [key, fixture] of Object.entries(FIXTURE_EVALUATIONS)) {
      assert.equal(
        EvaluationRunSchema.safeParse(fixture).success,
        true,
        `${key} must pass EvaluationRunSchema`
      );
    }
  });

  it("contains valid completed Kick-off, full Coaching, and disabled-D4 Coaching results", () => {
    for (const key of ["kickoff-elite", "completed-coaching-full", "coaching-d4-disabled"]) {
      const result = FIXTURE_EVALUATIONS[key].result;
      assert.ok(result, `${key} must contain its authoritative result`);
      assert.equal(EvaluationResultSchema.safeParse(result).success, true);
      assert.ok(result.clientName, `${key} must identify the client`);
      assert.ok(result.coachName, `${key} must identify the coach`);
    }
    assert.equal(
      FIXTURE_EVALUATIONS["coaching-d4-disabled"].result?.dimensions[3].score,
      null
    );
  });

  it("keeps completed dimensions aligned with rubric names, maxima, buckets, and transcripts", () => {
    for (const fixture of Object.values(FIXTURE_EVALUATIONS).filter(
      (candidate) => candidate.status === "completed"
    )) {
      assert.ok(fixture.result);
      const rubric = getRubricForCallType(fixture.callType);
      fixture.result.dimensions.forEach((dimension, index) => {
        const definition = rubric.dimensions[index];
        assert.equal(dimension.dimensionNumber, definition.number);
        assert.equal(dimension.name, definition.name);
        assert.equal(dimension.maxScore, definition.maxScore);
        if (!dimension.disabled && definition.scoring.mode === "discrete") {
          assert.ok(definition.scoring.allowedScores.includes(dimension.score as number));
        }
        for (const evidence of dimension.evidence) {
          assert.ok(
            fixture.transcript.includes(evidence.quote),
            `${fixture.id} D${dimension.dimensionNumber} evidence must be verbatim`
          );
        }
      });
    }
  });
});

describe("DimensionResultSchema", () => {
  it("accepts a valid Kick-off half-point score", () => {
    assert.equal(
      DimensionResultSchema.safeParse({
        ...validDimension,
        dimensionNumber: 3,
        name: "Agenda Framing",
        score: 4.5,
        maxScore: 5,
        band: "ELITE",
      }).success,
      true
    );
  });

  it("rejects negative scores and scores above maxScore", () => {
    assert.equal(DimensionResultSchema.safeParse({ ...validDimension, score: -0.5 }).success, false);
    assert.equal(DimensionResultSchema.safeParse({ ...validDimension, score: 10.5 }).success, false);
  });

  it("requires disabled dimensions to use null score/band and a reason", () => {
    assert.equal(
      DimensionResultSchema.safeParse({
        ...validDimension,
        score: null,
        band: null,
        disabled: true,
        disabledReason: "No movement coaching occurred.",
        evidence: [],
      }).success,
      true
    );
    assert.equal(
      DimensionResultSchema.safeParse({
        ...validDimension,
        score: 0,
        band: null,
        disabled: true,
        disabledReason: "No movement coaching occurred.",
      }).success,
      false
    );
  });

  it("rejects null scores on active dimensions", () => {
    assert.equal(
      DimensionResultSchema.safeParse({ ...validDimension, score: null }).success,
      false
    );
  });
});

describe("EvaluationRunSchema lifecycle", () => {
  it("accepts the valid queued fixture", () => {
    assert.equal(
      EvaluationRunSchema.safeParse(FIXTURE_EVALUATIONS["queued-kickoff"]).success,
      true
    );
  });

  it("rejects completed runs without a result", () => {
    const completed = FIXTURE_EVALUATIONS["kickoff-elite"];
    assert.equal(EvaluationRunSchema.safeParse({ ...completed, result: null }).success, false);
  });

  it("rejects failed runs without a structured error", () => {
    const failed = FIXTURE_EVALUATIONS["failed-kickoff"];
    assert.equal(EvaluationRunSchema.safeParse({ ...failed, error: null }).success, false);
  });

  it("rejects invalid call types, non-UUID IDs, and missing rubric versions", () => {
    const queued = FIXTURE_EVALUATIONS["queued-kickoff"];
    assert.equal(EvaluationRunSchema.safeParse({ ...queued, callType: "discovery" }).success, false);
    assert.equal(EvaluationRunSchema.safeParse({ ...queued, id: "demo-queued" }).success, false);
    assert.equal(EvaluationRunSchema.safeParse({ ...queued, rubricVersion: "" }).success, false);
  });
});

describe("API input and enums", () => {
  it("accepts both call types and rejects unsupported values", () => {
    assert.equal(CallTypeSchema.safeParse("kickoff").success, true);
    assert.equal(CallTypeSchema.safeParse("coaching").success, true);
    assert.equal(CallTypeSchema.safeParse("discovery").success, false);
  });

  it("rejects empty transcripts and accepts approximately 65 KB", () => {
    assert.equal(
      CreateEvaluationInputSchema.safeParse({
        reportName: "David's August Kick-off",
        callType: "kickoff",
        modelSlug: "openai/gpt-4.1-mini",
        transcript: "   ",
      }).success,
      false
    );
    assert.equal(
      CreateEvaluationInputSchema.safeParse({
        reportName: "Jordan's Coaching Review",
        callType: "coaching",
        modelSlug: "openai/gpt-5.6-terra",
        transcript: "x".repeat(65 * 1024),
      }).success,
      true
    );
  });

  it("accepts allowlisted GPT models and rejects other model slugs", () => {
    assert.equal(
      CreateEvaluationInputSchema.safeParse({
        reportName: "David's Kick-off",
        callType: "kickoff",
        modelSlug: "openai/gpt-5.6-sol",
        transcript: "A sufficiently detailed coaching transcript.",
      }).success,
      true
    );
    assert.equal(
      CreateEvaluationInputSchema.safeParse({
        reportName: "David's Kick-off",
        callType: "kickoff",
        modelSlug: "anthropic/claude-sonnet-4.6",
        transcript: "A sufficiently detailed coaching transcript.",
      }).success,
      false
    );
    assert.equal(
      CreateEvaluationInputSchema.safeParse({
        reportName: "David's Kick-off",
        callType: "kickoff",
        modelSlug: "google/gemini-2.5-pro",
        transcript: "A sufficiently detailed coaching transcript.",
      }).success,
      false
    );
    assert.equal(
      CreateEvaluationInputSchema.safeParse({
        reportName: "David's Kick-off",
        callType: "kickoff",
        modelSlug: "openai/unreviewed-expensive-model",
        transcript: "A sufficiently detailed coaching transcript.",
      }).success,
      false
    );
  });

  it("requires only a report name for report context input", () => {
    const validInput = {
      reportName: "David's Kick-off",
      callType: "kickoff",
      modelSlug: "openai/gpt-4.1-mini",
      transcript: "A sufficiently detailed coaching transcript.",
    } as const;

    assert.equal(CreateEvaluationInputSchema.safeParse(validInput).success, true);
    assert.equal(
      CreateEvaluationInputSchema.safeParse({ ...validInput, reportName: " " }).success,
      false
    );
  });

  it("rejects invalid performance bands", () => {
    assert.equal(PerformanceBandSchema.safeParse("AVERAGE").success, false);
    assert.equal(PerformanceBandSchema.safeParse("AT_RISK").success, true);
  });
});
