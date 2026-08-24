"use client";

import type { EvaluationModelSlug } from "@/lib/evaluation-models";
import { EVALUATION_MODEL_OPTIONS } from "@/lib/evaluation-models";

type ModelSelectorProps = {
  value: EvaluationModelSlug;
  onChange: (model: EvaluationModelSlug) => void;
  disabled?: boolean;
};

export function ModelSelector({
  value,
  onChange,
  disabled = false,
}: ModelSelectorProps) {
  const selected = EVALUATION_MODEL_OPTIONS.find((model) => model.slug === value);

  return (
    <div className="space-y-2">
      <label
        htmlFor="evaluation-model"
        className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono"
      >
        Evaluation Model
      </label>
      <select
        id="evaluation-model"
        name="modelSlug"
        value={value}
        onChange={(event) => onChange(event.target.value as EvaluationModelSlug)}
        disabled={disabled}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-900 shadow-xs outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {EVALUATION_MODEL_OPTIONS.map((model) => (
          <option key={model.slug} value={model.slug}>
            {model.name} — {model.tier}
          </option>
        ))}
      </select>
      <p className="text-xs leading-relaxed text-zinc-500">
        {selected?.description} The selection applies only to this evaluation.
      </p>
    </div>
  );
}
