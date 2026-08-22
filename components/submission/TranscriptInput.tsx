"use client";

import React from "react";
import { Trash2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface TranscriptInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  error?: string | null;
  disabled?: boolean;
}

export function TranscriptInput({
  value,
  onChange,
  onClear,
  error,
  disabled = false,
}: TranscriptInputProps) {
  const charCount = value.length;
  const trimmed = value.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const lineCount = trimmed ? trimmed.split(/\n+/).length : 0;

  return (
    <div className="space-y-2">
      {/* Label and Helper Header */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="transcript-textarea"
          className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Call transcript</span>
        </label>

        {value && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-xs text-zinc-400 hover:text-rose-600 inline-flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Clear transcript"
          >
            <Trash2 className="w-3 h-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Helper copy & Example format banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs text-zinc-500 bg-zinc-50 border border-zinc-200/80 px-3 py-2 rounded-lg">
        <span>Paste the full transcript using speaker-labelled turns.</span>
        <span className="text-[11px] font-mono text-zinc-600 bg-white border border-zinc-200 px-1.5 py-0.5 rounded shrink-0">
          e.g. <span className="font-semibold text-zinc-800">[Coach Name]: What felt hardest this week?</span>
        </span>
      </div>

      {/* Large Monospace Textarea */}
      <div className="relative">
        <textarea
          id="transcript-textarea"
          rows={14}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`[Coach Name]: What felt hardest this week?\n[Client Name]: Staying consistent with the routine on travel days.\n[Coach Name]: Let's look at what specific friction points came up...`}
          disabled={disabled}
          className={cn(
            "w-full rounded-xl border bg-white px-4 py-3.5 text-sm leading-relaxed text-zinc-900 font-mono transition-all duration-150 focus:outline-hidden focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 shadow-2xs resize-y min-h-[300px]",
            error
              ? "border-rose-400 focus:ring-rose-500 focus:border-rose-500 bg-rose-50/20"
              : "border-zinc-200 hover:border-zinc-300",
            disabled && "bg-zinc-50 text-zinc-400 cursor-not-allowed"
          )}
          aria-invalid={!!error}
          aria-describedby={error ? "transcript-error" : "transcript-metrics"}
        />
      </div>

      {/* Live Metrics & Inline Error */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        {error ? (
          <p
            id="transcript-error"
            className="text-xs text-rose-600 flex items-center gap-1.5 font-medium animate-fade-in"
            role="alert"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : (
          <span className="text-xs text-zinc-400 font-normal">
            Timestamps are optional. Longer transcripts are fully supported.
          </span>
        )}

        <div
          id="transcript-metrics"
          className="text-xs font-mono text-zinc-400 flex items-center gap-2.5 ml-auto"
        >
          <span>{charCount.toLocaleString()} chars</span>
          <span>·</span>
          <span>{wordCount.toLocaleString()} words</span>
          {lineCount > 1 && (
            <>
              <span>·</span>
              <span>{lineCount} lines</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
