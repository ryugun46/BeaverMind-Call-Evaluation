"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { CallType } from "@/lib/types/evaluation";
import { CallTypeSelector } from "./CallTypeSelector";
import { TranscriptInput } from "./TranscriptInput";
import { ActionButton } from "@/components/ui/ActionButton";
import { ArrowRight, ShieldCheck } from "lucide-react";

export function SubmissionForm() {
  const router = useRouter();
  const [callType, setCallType] = useState<CallType>("kickoff");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClear = () => {
    setTranscript("");
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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

    // Determine target permanent evaluation run ID based on selection / content
    let targetId = "demo-completed-kickoff";
    if (callType === "coaching") {
      targetId = "demo-coaching-d4-disabled";
    }

    // In a real backend, this creates a record in the database and returns a UUID
    setTimeout(() => {
      router.push(`/evaluation/${targetId}`);
    }, 450);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in-up">
      {/* 1. Call Type Selection */}
      <CallTypeSelector
        value={callType}
        onChange={(type) => {
          setCallType(type);
          if (error) setError(null);
        }}
        disabled={isSubmitting}
      />

      {/* 2. Transcript Input Area */}
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

      {/* 3. Action Submission Row & Reassurance */}
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
