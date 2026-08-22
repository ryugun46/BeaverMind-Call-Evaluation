"use client";

import React from "react";
import { CallType } from "@/lib/types/evaluation";
import { cn } from "@/lib/utils/cn";
import { Users, Sparkles, Check } from "lucide-react";

interface CallTypeSelectorProps {
  value: CallType;
  onChange: (type: CallType) => void;
  disabled?: boolean;
}

export function CallTypeSelector({
  value,
  onChange,
  disabled = false,
}: CallTypeSelectorProps) {
  const options = [
    {
      id: "kickoff" as CallType,
      title: "Kick-off Call",
      description:
        "Evaluate onboarding, goal alignment, expectations, support clarity and next steps.",
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: "coaching" as CallType,
      title: "Coaching Call",
      description:
        "Evaluate connection, coaching quality, strategy, accountability and continuity.",
      icon: <Sparkles className="w-4 h-4" />,
    },
  ];

  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono mb-2">
        Select Call Type
      </legend>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        role="radiogroup"
        aria-label="Call Type Selection"
      >
        {options.map((opt) => {
          const isSelected = value === opt.id;
          return (
            <label
              key={opt.id}
              className={cn(
                "relative flex flex-col p-4 rounded-xl border transition-all duration-150 cursor-pointer select-none text-left focus-within:ring-2 focus-within:ring-zinc-900 focus-within:ring-offset-2",
                isSelected
                  ? "bg-zinc-900 border-zinc-900 text-white shadow-xs"
                  : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/70 text-zinc-900",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <input
                type="radio"
                name="callType"
                value={opt.id}
                checked={isSelected}
                onChange={() => onChange(opt.id)}
                disabled={disabled}
                className="sr-only"
                aria-label={opt.title}
              />

              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <span
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      isSelected
                        ? "bg-zinc-800 text-zinc-100"
                        : "bg-zinc-100 text-zinc-600"
                    )}
                  >
                    {opt.icon}
                  </span>
                  <span>{opt.title}</span>
                </div>

                <div
                  className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center transition-all",
                    isSelected
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "border border-zinc-300 bg-white"
                  )}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                </div>
              </div>

              <p
                className={cn(
                  "text-xs leading-relaxed mt-0.5 font-normal",
                  isSelected ? "text-zinc-300" : "text-zinc-500"
                )}
              >
                {opt.description}
              </p>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
