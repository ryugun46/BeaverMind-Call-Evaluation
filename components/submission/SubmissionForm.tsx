"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CallType } from "@/lib/types/evaluation";
import { CallTypeSelector } from "./CallTypeSelector";
import { TranscriptInput } from "./TranscriptInput";
import { ActionButton } from "@/components/ui/ActionButton";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { CreateEvaluationResponseSchema } from "@/lib/contracts/evaluation";
import {
  DEFAULT_EVALUATION_MODEL,
  type EvaluationModelSlug,
} from "@/lib/evaluation-models";
import { ModelSelector } from "./ModelSelector";
import { trackEvaluation } from "@/lib/client/evaluation-tracker";

export function SubmissionForm() {
  const router = useRouter();
  const [reportName, setReportName] = useState("");
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [modelSlug, setModelSlug] = useState<EvaluationModelSlug>(
    DEFAULT_EVALUATION_MODEL
  );
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClear = () => {
    setTranscript("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedReportName = reportName.trim();

    if (!trimmedReportName) {
      setError("Please name this report so it can be identified later.");
      return;
    }

    if (!callType) {
      setError("Please select a call type to proceed.");
      return;
    }

    const trimmed = transcript.trim();
    if (!trimmed) {
      setError("Please paste a call transcript to begin evaluation.");
      return;
    }

    // Meaningful content check (ensure not just punctuation/whitespace or trivial noise)
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 5 || trimmed.length < 20) {
      setError("Transcript is too short. Please provide meaningful dialogue content.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/evaluations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportName: trimmedReportName,
          callType,
          modelSlug,
          transcript: trimmed,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body
            ? String(body.error)
            : "Could not create evaluation.";
        throw new Error(message);
      }

      const created = CreateEvaluationResponseSchema.parse(body);
      trackEvaluation({
        id: created.id,
        evaluationUrl: created.evaluationUrl,
        reportName: trimmedReportName,
        callType,
      });
      router.push(new URL(created.evaluationUrl).pathname);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Could not create evaluation. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up">
      <fieldset className="space-y-4">
        <div>
          <legend className="text-sm font-semibold text-zinc-900">
            Report details
          </legend>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            Give this evaluation a recognizable name. Client and coach names
            will be identified from the transcript.
          </p>
        </div>

        <div>
          <label
            htmlFor="report-name"
            className="mb-1.5 block text-xs font-medium text-zinc-700"
          >
            Report name
          </label>
          <input
            id="report-name"
            name="reportName"
            type="text"
            required
            maxLength={120}
            value={reportName}
            onChange={(event) => {
              setReportName(event.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            placeholder="e.g. David's August Kick-off"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 shadow-2xs outline-hidden transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
          />
        </div>

      </fieldset>

      {/* 1. Call Type Selection */}
      <CallTypeSelector
        value={callType}
        onChange={(type) => {
          setCallType(type);
          if (error) setError(null);
        }}
        disabled={isSubmitting}
      />

      {/* 2. Model Selection */}
      <ModelSelector
        value={modelSlug}
        onChange={(model) => {
          setModelSlug(model);
          if (error) setError(null);
        }}
        disabled={isSubmitting}
      />

      {/* 3. Transcript Input Area */}
      <TranscriptInput
        value={transcript}
        onChange={(val) => {
          setTranscript(val);
          if (error) setError(null);
        }}
        onClear={handleClear}
        error={error}
        disabled={isSubmitting}
      />

      {/* 4. Action Submission Row & Reassurance */}
      <div className="pt-3 border-t border-zinc-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="text-xs text-zinc-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Submitting creates a permanent evaluation URL. You can close this page while processing continues.</span>
        </div>

        <ActionButton
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isSubmitting}
          rightIcon={<ArrowRight className="w-4 h-4" />}
          className="w-full sm:w-auto px-8 shrink-0 font-semibold"
        >
          {isSubmitting ? "Creating Evaluation..." : "Evaluate Call"}
        </ActionButton>
      </div>
    </form>
  );
}
