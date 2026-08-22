import React from "react";
import { EvaluationStatus } from "@/lib/types/evaluation";
import { formatEvaluationStatus } from "@/lib/utils/formatters";
import { cn } from "@/lib/utils/cn";
import { Clock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

interface StatusBadgeProps {
  status: EvaluationStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function StatusBadge({ status, size = "md", className }: StatusBadgeProps) {
  const info = formatEvaluationStatus(status);

  const icons = {
    queued: <Clock className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />,
    processing: <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" aria-hidden="true" />,
    completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />,
    failed: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />,
  };

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1.5",
    md: "text-xs font-medium px-2.5 py-1 gap-1.5",
    lg: "text-sm font-medium px-3 py-1.5 gap-2",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border shadow-xs transition-colors",
        info.badgeClass,
        sizeClasses[size],
        className
      )}
      role="status"
    >
      {icons[status]}
      <span>{info.label}</span>
    </span>
  );
}
