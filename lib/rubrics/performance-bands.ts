import type { PerformanceBandDefinition } from "./schema";

/** Shared by both source rubrics; kept once so band boundaries cannot drift. */
export const STANDARD_PERFORMANCE_BANDS = [
  {
    band: "FAIL",
    minInclusive: 0,
    maxExclusive: 60,
    description: "Core elements missing; immediate coaching intervention is required.",
  },
  {
    band: "AT_RISK",
    minInclusive: 60,
    maxExclusive: 70,
    description: "Weak client experience; the client may be doubting the process.",
  },
  {
    band: "INCONSISTENT",
    minInclusive: 70,
    maxExclusive: 80,
    description: "Technically present but generic, surface-level, or emotionally flat in key areas.",
  },
  {
    band: "STRONG",
    minInclusive: 80,
    maxExclusive: 90,
    description: "Clear and useful with isolated weaknesses or limited emotional depth.",
  },
  {
    band: "ELITE",
    minInclusive: 90,
    maxExclusive: null,
    description: "Deep, clear, and confirmed by the client; strong relationship and buy-in.",
  },
] as const satisfies readonly PerformanceBandDefinition[];

export function getPerformanceBandForScore(score: number) {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError(`Score must be between 0 and 100; received ${score}`);
  }

  const definition = STANDARD_PERFORMANCE_BANDS.find(
    (candidate) =>
      score >= candidate.minInclusive &&
      (candidate.maxExclusive === null || score < candidate.maxExclusive)
  );

  if (!definition) {
    throw new Error(`No performance band configured for score ${score}`);
  }

  return definition.band;
}
