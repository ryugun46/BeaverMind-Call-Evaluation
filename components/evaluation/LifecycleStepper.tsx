import React from "react";
import { LifecycleStepId, LifecycleStepState } from "@/lib/types/evaluation";
import { cn } from "@/lib/utils/cn";
import { Check, Loader2, Clock, X } from "lucide-react";

interface StepConfig {
  id: LifecycleStepId;
  label: string;
}

const STEPS: StepConfig[] = [
  { id: "created", label: "Run created" },
  { id: "evaluation", label: "Evaluation" },
  { id: "validation", label: "Validation" },
  { id: "report", label: "Report" },
];

interface LifecycleStepperProps {
  stepStates: Record<LifecycleStepId, LifecycleStepState>;
  className?: string;
}

export function LifecycleStepper({ stepStates, className }: LifecycleStepperProps) {
  return (
    <nav
      aria-label="Evaluation Lifecycle Progress"
      className={cn("w-full py-2", className)}
    >
      <ol className="grid grid-cols-1 sm:grid-cols-4 gap-2 sm:gap-3">
        {STEPS.map((step, index) => {
          const state = stepStates[step.id] || "waiting";

          const stateConfigs = {
            complete: {
              containerClass: "bg-emerald-50/70 border-emerald-200/80 text-emerald-950",
              badgeClass: "bg-emerald-600 text-white",
              badgeIcon: <Check className="w-3.5 h-3.5 stroke-[2.5]" />,
              statusText: "Complete",
              statusTextClass: "text-emerald-700 font-medium",
            },
            active: {
              containerClass: "bg-blue-50/80 border-blue-200 text-blue-950 ring-1 ring-blue-500/20",
              badgeClass: "bg-blue-600 text-white",
              badgeIcon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
              statusText: "Active",
              statusTextClass: "text-blue-700 font-medium",
            },
            waiting: {
              containerClass: "bg-zinc-50/80 border-zinc-200 text-zinc-500",
              badgeClass: "bg-zinc-200 text-zinc-600",
              badgeIcon: <Clock className="w-3.5 h-3.5" />,
              statusText: "Waiting",
              statusTextClass: "text-zinc-400",
            },
            failed: {
              containerClass: "bg-rose-50/70 border-rose-200 text-rose-950",
              badgeClass: "bg-rose-600 text-white",
              badgeIcon: <X className="w-3.5 h-3.5 stroke-[2.5]" />,
              statusText: "Failed",
              statusTextClass: "text-rose-700 font-medium",
            },
          };

          const config = stateConfigs[state];

          return (
            <li
              key={step.id}
              className={cn(
                "relative flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 text-left",
                config.containerClass
              )}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs",
                  config.badgeClass
                )}
                aria-hidden="true"
              >
                {config.badgeIcon}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold tracking-tight text-zinc-900 truncate">
                    {index + 1}. {step.label}
                  </span>
                </div>
                <span className={cn("text-[11px] block mt-0.5", config.statusTextClass)}>
                  {config.statusText}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
