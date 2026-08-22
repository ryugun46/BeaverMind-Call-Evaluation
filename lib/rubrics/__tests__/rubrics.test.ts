import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  COACHING_RUBRIC,
  KICKOFF_RUBRIC,
  RubricDefinitionSchema,
  STANDARD_PERFORMANCE_BANDS,
  getPerformanceBandForScore,
  getRubricForCallType,
} from "../index";

const totalMaximum = (dimensions: typeof KICKOFF_RUBRIC.dimensions) =>
  dimensions.reduce((sum, dimension) => sum + dimension.maxScore, 0);

describe("rubric structure", () => {
  it("Kick-off has exactly 12 uniquely numbered dimensions totaling 100", () => {
    assert.equal(KICKOFF_RUBRIC.dimensions.length, 12);
    assert.equal(new Set(KICKOFF_RUBRIC.dimensions.map((dimension) => dimension.number)).size, 12);
    assert.equal(totalMaximum(KICKOFF_RUBRIC.dimensions), 100);
  });

  it("Coaching has exactly 12 uniquely numbered dimensions and preserves its declared 100 maximum", () => {
    assert.equal(COACHING_RUBRIC.dimensions.length, 12);
    assert.equal(new Set(COACHING_RUBRIC.dimensions.map((dimension) => dimension.number)).size, 12);
    assert.equal(COACHING_RUBRIC.maxScore, 100);
  });

  it("records the source's 105-versus-100 Coaching conflict without altering dimension weights", () => {
    assert.equal(totalMaximum(COACHING_RUBRIC.dimensions), 105);
    assert.deepEqual(COACHING_RUBRIC.maximumReconciliation, {
      status: "unresolved_source_conflict",
      declaredMaximum: 100,
      dimensionMaximumTotal: 105,
      explanation:
        "The source headings and bucket tables total 105, but the source also repeatedly declares 100 full points and 85 when the 15-point D4 is disabled. No dimension weight is changed without an authoritative correction.",
    });
  });

  it("both authoritative definitions pass runtime schema validation", () => {
    assert.equal(RubricDefinitionSchema.safeParse(KICKOFF_RUBRIC).success, true);
    assert.equal(RubricDefinitionSchema.safeParse(COACHING_RUBRIC).success, true);
  });
});

describe("scoring-model differences", () => {
  it("does not accidentally impose discrete Coaching scoring on Kick-off", () => {
    assert.equal(KICKOFF_RUBRIC.scoreMode, "banded");
    for (const dimension of KICKOFF_RUBRIC.dimensions) {
      assert.equal(dimension.scoring.mode, "banded");
      assert.equal("allowedScores" in dimension.scoring, false);
      assert.equal(dimension.scoring.increment, dimension.maxScore <= 5 ? 0.5 : 1);
    }
  });

  it("defines valid exact buckets for every Coaching dimension", () => {
    for (const dimension of COACHING_RUBRIC.dimensions) {
      assert.equal(dimension.scoring.mode, "discrete");
      if (dimension.scoring.mode !== "discrete") assert.fail("Expected discrete scoring");

      const values = dimension.scoring.allowedScores;
      assert.equal(new Set(values).size, values.length);
      assert.equal(values.includes(0), true);
      assert.equal(values.includes(dimension.maxScore), true);
      assert.equal(values.every((score) => score >= 0 && score <= dimension.maxScore), true);

      const authoredBuckets = dimension.scoring.scoreBands.map((band) => {
        assert.equal(band.scoreKind, "anchor");
        if (band.scoreKind !== "anchor") assert.fail("Coaching band must be an anchor");
        return band.score;
      });
      assert.deepEqual(values, authoredBuckets);
    }
  });

  it("preserves representative Coaching bucket sets exactly", () => {
    const getScores = (dimensionNumber: number) => {
      const dimension = COACHING_RUBRIC.dimensions.find((item) => item.number === dimensionNumber);
      assert.ok(dimension && dimension.scoring.mode === "discrete");
      return dimension.scoring.allowedScores;
    };

    assert.deepEqual(getScores(1), [10, 7, 3, 0]);
    assert.deepEqual(getScores(3), [15, 10, 5, 0]);
    assert.deepEqual(getScores(10), [5, 0]);
  });
});

describe("Coaching applicability", () => {
  it("models D4 disabled/N/A and reduced-maximum normalization", () => {
    const dimension = COACHING_RUBRIC.dimensions.find((item) => item.number === 4);
    assert.ok(dimension);
    const rule = dimension.applicabilityRules?.[0];
    assert.ok(rule);
    assert.deepEqual(rule.disabledOutcome, { disabled: true, score: null, band: "N/A" });
    assert.deepEqual(rule.weightAdjustment, {
      mode: "reduce_raw_maximum",
      reducedRawMaximum: 85,
      normalizeTo: 100,
    });
    assert.equal(rule.detectionCriteria?.length, 4);
  });

  it("models D2 redistribution as unresolved instead of inventing an algorithm", () => {
    const dimension = COACHING_RUBRIC.dimensions.find((item) => item.number === 2);
    assert.ok(dimension);
    const rule = dimension.applicabilityRules?.[0];
    assert.ok(rule);
    assert.equal(rule.weightAdjustment.mode, "requires_resolution");
    if (rule.weightAdjustment.mode !== "requires_resolution") assert.fail("Expected unresolved adjustment");
    assert.deepEqual(rule.weightAdjustment.targetDimensionNumbers, [3, 4]);
    assert.ok(rule.weightAdjustment.unresolvedReason.length > 0);
  });
});

describe("rubric lookup", () => {
  it("returns the correct versioned rubric for each call type", () => {
    assert.strictEqual(getRubricForCallType("kickoff"), KICKOFF_RUBRIC);
    assert.strictEqual(getRubricForCallType("coaching"), COACHING_RUBRIC);
    assert.equal(getRubricForCallType("kickoff").version, "kickoff-v1");
    assert.equal(getRubricForCallType("coaching").version, "coaching-v1");
  });

  it("safely rejects an unknown runtime call type", () => {
    assert.throws(
      () => getRubricForCallType("discovery" as never),
      /Unsupported call type: discovery/
    );
  });
});

describe("shared performance bands", () => {
  it("covers integer, half-point, and decimal boundaries without gaps", () => {
    for (let score = 0; score <= 100; score += 0.5) {
      assert.doesNotThrow(() => getPerformanceBandForScore(score));
    }

    assert.equal(getPerformanceBandForScore(59.999), "FAIL");
    assert.equal(getPerformanceBandForScore(60), "AT_RISK");
    assert.equal(getPerformanceBandForScore(69.999), "AT_RISK");
    assert.equal(getPerformanceBandForScore(70), "INCONSISTENT");
    assert.equal(getPerformanceBandForScore(79.999), "INCONSISTENT");
    assert.equal(getPerformanceBandForScore(80), "STRONG");
    assert.equal(getPerformanceBandForScore(89.999), "STRONG");
    assert.equal(getPerformanceBandForScore(90), "ELITE");
    assert.equal(getPerformanceBandForScore(100), "ELITE");
  });

  it("uses the source-authored band boundaries", () => {
    assert.deepEqual(
      STANDARD_PERFORMANCE_BANDS.map(({ band, minInclusive, maxExclusive }) => ({
        band,
        minInclusive,
        maxExclusive,
      })),
      [
        { band: "FAIL", minInclusive: 0, maxExclusive: 60 },
        { band: "AT_RISK", minInclusive: 60, maxExclusive: 70 },
        { band: "INCONSISTENT", minInclusive: 70, maxExclusive: 80 },
        { band: "STRONG", minInclusive: 80, maxExclusive: 90 },
        { band: "ELITE", minInclusive: 90, maxExclusive: null },
      ]
    );
  });

  it("rejects scores outside the 0-100 domain", () => {
    assert.throws(() => getPerformanceBandForScore(-0.5), RangeError);
    assert.throws(() => getPerformanceBandForScore(100.5), RangeError);
  });
});
