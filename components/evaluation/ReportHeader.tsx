"use client";

import React, { useState } from "react";
import Link from "next/link";
import { EvaluationPublicResponse } from "@/lib/types/evaluation";
import { formatCallType, formatDate } from "@/lib/utils/formatters";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionButton } from "@/components/ui/ActionButton";
import {
  Share2,
  Download,
  Check,
  Calendar,
  Hash,
  PlusCircle,
  ExternalLink,
} from "lucide-react";

interface ReportHeaderProps {
  evaluation: EvaluationPublicResponse;
  onDownloadPdf?: () => void;
  reportUrl?: string;
  pdfUrl?: string;
  embedded?: boolean;
}

export function ReportHeader({
  evaluation,
  onDownloadPdf,
  reportUrl,
  pdfUrl,
  embedded = false,
}: ReportHeaderProps) {
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleShare = async () => {
    try {
      if (typeof window !== "undefined" && navigator.clipboard) {
        const shareUrl = reportUrl
          ? new URL(reportUrl, window.location.origin).toString()
          : window.location.href;
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setShowToast(true);
        setTimeout(() => {
          setCopied(false);
          setShowToast(false);
        }, 3000);
      }
    } catch {
      // Fallback
    }
  };

  const isCompleted = evaluation.status === "completed";
  const Heading = embedded ? "h2" : "h1";
  const clientName = evaluation.result?.clientName ?? evaluation.metadata?.clientName;
  const coachName = evaluation.result?.coachName ?? evaluation.metadata?.repName;

  return (
    <header className="mb-6 pb-6 border-b border-zinc-200/80 relative">
      {/* Toast Notification when permalink is copied */}
      {showToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-zinc-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-fade-in border border-zinc-700"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>Report link copied to clipboard</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Identifiers & Metadata */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5 mb-2.5">
            {/* Call type badge */}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 text-white shadow-2xs font-mono">
              {formatCallType(evaluation.callType)}
            </span>

            {/* Status Badge: "Evaluation Complete" */}
            <StatusBadge status={evaluation.status} size="sm" />

            {/* Evaluation Run ID */}
            <span className="text-xs font-mono text-zinc-500 font-medium flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200/60">
              <Hash className="w-3 h-3 text-zinc-400" />
              <span>{evaluation.id}</span>
            </span>
          </div>

          <Heading className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            {evaluation.reportName ?? `${formatCallType(evaluation.callType)} Evaluation${isCompleted ? " Report" : ""}`}
          </Heading>

          {clientName && coachName && (
            <p className="mt-1.5 text-base font-medium text-zinc-700 sm:text-lg">
              {clientName} coached by {coachName}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 mt-2">
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Created {formatDate(evaluation.createdAt)}
            </span>
            {evaluation.completedAt && (
              <>
                <span>·</span>
                <span className="font-mono text-zinc-700 font-medium">
                  Completed {formatDate(evaluation.completedAt)}
                </span>
              </>
            )}
            {evaluation.metadata?.callDuration && (
              <>
                <span>·</span>
                <span>
                  Duration:{" "}
                  <strong className="text-zinc-700 font-medium">
                    {evaluation.metadata.callDuration}
                  </strong>
                </span>
              </>
            )}
            {evaluation.metadata?.wordCount && (
              <>
                <span>·</span>
                <span>{evaluation.metadata.wordCount.toLocaleString()} words</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 no-print">
          {/* Completed State Actions */}
          {isCompleted && (
            <>
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={handleShare}
                leftIcon={
                  copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Share2 className="w-3.5 h-3.5" />
                  )
                }
              >
                {copied ? "Report Link Copied" : "Share Report"}
              </ActionButton>

              {embedded && reportUrl && (
                <Link
                  href={reportUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Open report
                </Link>
              )}

              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  download
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white shadow-xs transition-colors hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  Download PDF
                </a>
              ) : onDownloadPdf ? (
                <ActionButton
                  variant="primary"
                  size="sm"
                  onClick={onDownloadPdf}
                  leftIcon={<Download className="w-3.5 h-3.5" />}
                >
                  Download PDF
                </ActionButton>
              ) : null}
            </>
          )}

          {/* Universal "New Evaluation" action */}
          {!embedded && <Link href="/">
            <ActionButton
              variant={isCompleted ? "secondary" : "primary"}
              size="sm"
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
            >
              New Evaluation
            </ActionButton>
          </Link>}
        </div>
      </div>
    </header>
  );
}

export { ReportHeader as EvaluationHeader };
