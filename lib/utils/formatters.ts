import { DimensionBand, EvaluationStatus, CallType } from "@/lib/types/evaluation";

export function formatCallType(type: CallType): string {
  switch (type) {
    case "kickoff":
      return "Kick-off Call";
    case "coaching":
      return "Coaching Call";
    default:
      return type;
  }
}

export function formatPerformanceBand(band?: DimensionBand | null): {
  label: string;
  badgeClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  description: string;
} {
  switch (band) {
    case "ELITE":
      return {
        label: "ELITE",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 ring-emerald-600/10",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-800",
        borderClass: "border-emerald-200",
        description: "Exceeds all standard benchmarks with exceptional execution.",
      };
    case "STRONG":
      return {
        label: "STRONG",
        badgeClass: "bg-blue-50 text-blue-800 border-blue-300 ring-blue-600/10",
        bgClass: "bg-blue-50",
        textClass: "text-blue-800",
        borderClass: "border-blue-200",
        description: "Consistently meets quality standards with minor areas for refinement.",
      };
    case "INCONSISTENT":
    case "MID":
      return {
        label: band === "MID" ? "MID" : "INCONSISTENT",
        badgeClass: "bg-amber-50 text-amber-900 border-amber-300 ring-amber-600/10",
        bgClass: "bg-amber-50",
        textClass: "text-amber-900",
        borderClass: "border-amber-200",
        description: "Demonstrates core skills unevenly across call dimensions.",
      };
    case "AT_RISK":
    case "SURFACE":
    case "WEAK":
      return {
        label: band === "AT_RISK" ? "AT RISK" : band,
        badgeClass: "bg-orange-50 text-orange-900 border-orange-300 ring-orange-600/10",
        bgClass: "bg-orange-50",
        textClass: "text-orange-900",
        borderClass: "border-orange-200",
        description: "Notable deficits in key dimensions requiring immediate coaching.",
      };
    case "FAIL":
      return {
        label: "FAIL",
        badgeClass: "bg-rose-50 text-rose-900 border-rose-300 ring-rose-600/10",
        bgClass: "bg-rose-50",
        textClass: "text-rose-900",
        borderClass: "border-rose-200",
        description: "Critical breakdowns or compliance violations detected.",
      };
    default:
      return {
        label: "Pending",
        badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200 ring-zinc-600/10",
        bgClass: "bg-zinc-100",
        textClass: "text-zinc-700",
        borderClass: "border-zinc-200",
        description: "Evaluation band not yet determined.",
      };
  }
}

export function formatEvaluationStatus(status: EvaluationStatus): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case "queued":
      return {
        label: "Queued in Pipeline",
        badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
        dotClass: "bg-zinc-400",
      };
    case "processing":
      return {
        label: "Evaluating Transcript",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
        dotClass: "bg-blue-500 animate-pulse",
      };
    case "completed":
      return {
        label: "Evaluation Complete",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
        dotClass: "bg-emerald-500",
      };
    case "failed":
      return {
        label: "Evaluation Failed",
        badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
        dotClass: "bg-rose-500",
      };
  }
}

export function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}
