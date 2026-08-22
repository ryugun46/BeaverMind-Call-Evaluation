"use client";

import React from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileQuestion, PlusCircle, ArrowLeft } from "lucide-react";

interface NotFoundStateProps {
  id?: string;
}

export function NotFoundState({ id }: NotFoundStateProps) {
  return (
    <div className="py-12 px-4 max-w-xl mx-auto text-center animate-fade-in-up">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto mb-6 shadow-xs">
        <FileQuestion className="w-7 h-7 text-zinc-600" />
      </div>

      {id && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-mono text-zinc-500 mb-3">
          <span>Requested ID: {id}</span>
        </div>
      )}

      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mb-2">
        Evaluation not found
      </h1>

      <p className="text-sm text-zinc-600 max-w-md mx-auto mb-8 leading-relaxed">
        The requested evaluation run could not be found. The URL may be invalid, expired, or the evaluation does not exist.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/">
          <ActionButton
            variant="secondary"
            size="md"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Home
          </ActionButton>
        </Link>

        <Link href="/">
          <ActionButton
            variant="primary"
            size="md"
            leftIcon={<PlusCircle className="w-4 h-4" />}
          >
            Start New Evaluation
          </ActionButton>
        </Link>
      </div>
    </div>
  );
}
