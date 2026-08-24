"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileSearch,
  History,
  RefreshCw,
  Loader2,
} from "lucide-react";

import { EvaluationReport } from "@/components/report/EvaluationReport";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EvaluationPublicResponseSchema } from "@/lib/contracts/evaluation";
import type { EvaluationPublicResponse } from "@/lib/types/evaluation";
import { cn } from "@/lib/utils/cn";
import { formatCallType, formatDate } from "@/lib/utils/formatters";

type HistoryFilter = "all" | "completed" | "failed";

export interface EvaluationHistoryEntry {
  publicToken: string;
  evaluation: {
    id: string;
    reportName?: string;
    callType: EvaluationPublicResponse["callType"];
    rubricVersion: string;
    status: "completed" | "failed";
    createdAt: string;
    updatedAt: string;
    processingStartedAt: string;
    completedAt: string;
    error: EvaluationPublicResponse["error"];
  };
}

interface EvaluationHistoryProps {
  entries: EvaluationHistoryEntry[];
  loadError?: boolean;
}

const filters: Array<{ id: HistoryFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "completed", label: "Successful" },
  { id: "failed", label: "Failed" },
];

export function EvaluationHistory({
  entries,
  loadError = false,
}: EvaluationHistoryProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, EvaluationPublicResponse>>(
    {}
  );
  const [loadingToken, setLoadingToken] = useState<string | null>(null);
  const [reportErrors, setReportErrors] = useState<Record<string, string>>({});

  const successfulCount = entries.filter(
    ({ evaluation }) => evaluation.status === "completed"
  ).length;
  const failedCount = entries.filter(
    ({ evaluation }) => evaluation.status === "failed"
  ).length;

  const visibleEntries = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter(({ evaluation }) => evaluation.status === filter),
    [entries, filter]
  );

  const changeFilter = (nextFilter: HistoryFilter) => {
    setFilter(nextFilter);
    if (
      expandedToken &&
      nextFilter !== "all" &&
      !entries.some(
        ({ publicToken, evaluation }) =>
          publicToken === expandedToken && evaluation.status === nextFilter
      )
    ) {
      setExpandedToken(null);
    }
  };

  const refresh = () => startRefresh(() => router.refresh());

  const toggleReport = async (publicToken: string) => {
    if (expandedToken === publicToken) {
      setExpandedToken(null);
      return;
    }
    if (reports[publicToken]) {
      setExpandedToken(publicToken);
      return;
    }

    setLoadingToken(publicToken);
    setReportErrors((current) => {
      const next = { ...current };
      delete next[publicToken];
      return next;
    });

    try {
      const response = await fetch(`/api/evaluations/${publicToken}`, {
        cache: "no-store",
      });
      const body: unknown = await response.json();
      if (!response.ok) throw new Error("The report could not be loaded.");

      const report = EvaluationPublicResponseSchema.parse(body);
      if (report.status !== "completed" || !report.result) {
        throw new Error("This evaluation does not have a completed report.");
      }
      setReports((current) => ({ ...current, [publicToken]: report }));
      setExpandedToken(publicToken);
    } catch (error) {
      setReportErrors((current) => ({
        ...current,
        [publicToken]:
          error instanceof Error ? error.message : "The report could not be loaded.",
      }));
    } finally {
      setLoadingToken(null);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-mono text-xs font-medium text-zinc-600 shadow-2xs">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Evaluation archive
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Evaluation history
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600">
            Review successful and failed evaluations. Successful runs include
            their permanent report link and a complete inline report preview.
          </p>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={isRefreshing}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-2xs transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-wait disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
            aria-hidden="true"
          />
          {isRefreshing ? "Refreshing" : "Refresh"}
        </button>
      </header>

      <section
        aria-label="Evaluation history summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <SummaryCard label="Total finalized" value={entries.length} tone="neutral" />
        <SummaryCard label="Successful" value={successfulCount} tone="success" />
        <SummaryCard label="Failed" value={failedCount} tone="danger" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div
            className="inline-flex w-full rounded-lg bg-zinc-100 p-1 sm:w-auto"
            role="group"
            aria-label="Filter evaluation history"
          >
            {filters.map((option) => {
              const count =
                option.id === "all"
                  ? entries.length
                  : option.id === "completed"
                    ? successfulCount
                    : failedCount;
              const selected = filter === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => changeFilter(option.id)}
                  aria-pressed={selected}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:flex-none",
                    selected
                      ? "bg-white text-zinc-900 shadow-2xs"
                      : "text-zinc-500 hover:text-zinc-800"
                  )}
                >
                  {option.label}
                  <span className="font-mono text-[10px] text-zinc-400">{count}</span>
                </button>
              );
            })}
          </div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
            Newest first · up to 100 runs
          </span>
        </div>

        {loadError ? (
          <HistoryMessage
            icon={<AlertTriangle className="h-5 w-5 text-rose-600" />}
            title="History is temporarily unavailable"
            description="The evaluation archive could not be loaded. Refresh the page to try again."
          />
        ) : visibleEntries.length === 0 ? (
          <HistoryMessage
            icon={<FileSearch className="h-5 w-5 text-zinc-500" />}
            title={entries.length === 0 ? "No finalized evaluations yet" : `No ${filter} evaluations`}
            description={
              entries.length === 0
                ? "Completed and failed evaluations will appear here automatically."
                : "Choose a different filter to see the other evaluation runs."
            }
          />
        ) : (
          <div className="divide-y divide-zinc-200">
            {visibleEntries.map(({ publicToken, evaluation }) => {
              const isCompleted = evaluation.status === "completed";
              const isExpanded = expandedToken === publicToken;
              const reportUrl = `/evaluation/${publicToken}`;
              const isLoadingReport = loadingToken === publicToken;
              const loadedReport = reports[publicToken];

              return (
                <article key={publicToken} className="px-4 py-5 sm:px-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={evaluation.status} size="sm" />
                        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-[11px] font-medium text-zinc-600">
                          {formatCallType(evaluation.callType)}
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {evaluation.reportName ??
                            (isCompleted
                              ? `${formatCallType(evaluation.callType)} evaluation report`
                              : evaluation.error?.message ?? "Evaluation could not be completed")}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {formatDate(evaluation.createdAt)}
                          <span className="mx-1.5 text-zinc-300">·</span>
                          <span className="font-mono">Run {evaluation.id.slice(0, 8)}</span>
                          {!isCompleted && evaluation.error?.code && (
                            <>
                              <span className="mx-1.5 text-zinc-300">·</span>
                              <span className="font-mono text-rose-700">
                                {evaluation.error.code}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {isCompleted && (
                      <div className="flex flex-wrap items-center gap-2 no-print">
                        <Link
                          href={reportUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-2xs transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          Report link
                        </Link>
                        <a
                          href={`/api/evaluations/${publicToken}/pdf`}
                          download
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-2xs transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          PDF
                        </a>
                        <button
                          type="button"
                          onClick={() => void toggleReport(publicToken)}
                          disabled={isLoadingReport}
                          aria-expanded={isExpanded}
                          aria-controls={`report-${publicToken}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-zinc-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
                        >
                          {isLoadingReport ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {isLoadingReport
                            ? "Loading report"
                            : isExpanded
                              ? "Hide report"
                              : "Preview report"}
                        </button>
                      </div>
                    )}
                  </div>

                  {reportErrors[publicToken] && (
                    <p role="alert" className="mt-3 text-xs text-rose-700">
                      {reportErrors[publicToken]}
                    </p>
                  )}

                  {isCompleted && isExpanded && loadedReport && (
                    <div
                      id={`report-${publicToken}`}
                      className="mt-5 border-t border-zinc-200 pt-6"
                    >
                      <EvaluationReport
                        evaluation={loadedReport}
                        reportUrl={reportUrl}
                        pdfUrl={`/api/evaluations/${publicToken}/pdf`}
                        embedded
                      />
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "danger";
}) {
  const icon =
    tone === "success" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
    ) : tone === "danger" ? (
      <AlertTriangle className="h-4 w-4 text-rose-600" aria-hidden="true" />
    ) : (
      <History className="h-4 w-4 text-zinc-500" aria-hidden="true" />
    );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        {icon}
      </div>
      <strong className="mt-2 block font-mono text-2xl font-bold tracking-tight text-zinc-900">
        {value}
      </strong>
    </div>
  );
}

function HistoryMessage({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
        {icon}
      </div>
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">
        {description}
      </p>
    </div>
  );
}
