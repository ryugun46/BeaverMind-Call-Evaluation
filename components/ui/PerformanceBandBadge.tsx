import React from "react";
import { PerformanceBand } from "@/lib/types/evaluation";
import { formatPerformanceBand } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import { ShieldCheck, Award, AlertCircle, AlertOctagon, HelpCircle } from "lucide-react";

interface PerformanceBandBadgeProps {
  band?: PerformanceBand | null;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function PerformanceBandBadge({
  band,
  size = "md",
  showIcon = true,
  className,
}: PerformanceBandBadgeProps) {
  const info = formatPerformanceBand(band);

  const getIcon = () => {
    switch (band) {
      case "ELITE":
        return <Award className="w-3.5 h-3.5 shrink-0 text-emerald-700" aria-hidden="true" />;
      case "STRONG":
        return <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-blue-700" aria-hidden="true" />;
      case "INCONSISTENT":
        return <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-700" aria-hidden="true" />;
      case "AT_RISK":
        return <AlertCircle className="w-3.5 h-3.5 shrink-0 text-orange-700" aria-hidden="true" />;
      case "FAIL":
        return <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-700" aria-hidden="true" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 shrink-0 text-zinc-500" aria-hidden="true" />;
    }
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-xs font-semibold px-2.5 py-1 gap-1.5",
    lg: "text-sm font-semibold px-3 py-1.5 gap-2",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border tracking-wide uppercase font-mono shadow-2xs transition-colors",
        info.badgeClass,
        sizeClasses[size],
        className
      )}
      title={info.description}
    >
      {showIcon && getIcon()}
      <span>{info.label}</span>
    </span>
  );
}
