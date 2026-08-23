import React from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { SubmissionForm } from "@/components/submission/SubmissionForm";
import { Sparkles, Layers, ArrowRight } from "lucide-react";

export default function HomePage() {
  const showDevelopmentFixtures = process.env.NODE_ENV !== "production";
  const steps = [
    {
      num: "1",
      title: "Run created",
      desc: "A unique evaluation run ID and permanent report URL are created.",
    },
    {
      num: "2",
      title: "Transcript evaluated",
      desc: "Transcript dialogue turns are scored against the selected rubric.",
    },
    {
      num: "3",
      title: "Results validated and stored",
      desc: "Guardrail caps, evidence quotes, and scores are verified and saved.",
    },
    {
      num: "4",
      title: "Permanent report available",
      desc: "Full evidence-grounded report with export options becomes accessible.",
    },
  ];

  const demoFixtures = [
    { label: "Queued State", href: "/evaluation/demo-queued", badge: "Queued" },
    { label: "Processing State", href: "/evaluation/demo-processing", badge: "Processing" },
    { label: "Failed State", href: "/evaluation/demo-failed", badge: "Failed" },
    { label: "Completed Kick-off (100 pts)", href: "/evaluation/demo-completed-kickoff", badge: "Elite" },
    { label: "Kick-off (At Risk · Caps Applied)", href: "/evaluation/kickoff-at-risk", badge: "At Risk" },
    { label: "Completed Coaching (100 pts)", href: "/evaluation/demo-completed-coaching", badge: "Strong" },
    { label: "Coaching (D4 Disabled · 85 pts)", href: "/evaluation/demo-coaching-d4-disabled", badge: "Normalized" },
    { label: "Not Found State", href: "/evaluation/unknown-sample-id", badge: "404" },
  ];

  return (
    <PageContainer size="md" className="py-6 sm:py-8 space-y-8">
      {/* 1. Concise Header Area */}
      <div className="max-w-2xl">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-700 mb-3 font-mono">
          <Sparkles className="w-3.5 h-3.5 text-zinc-600" />
          <span>Call Evaluation Engine</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
          Evaluate a coaching call
        </h1>

        <p className="mt-2 text-sm text-zinc-600 leading-relaxed font-normal">
          Score a call against the appropriate rubric using transcript-grounded evidence.
        </p>
      </div>

      {/* 2. Primary Submission Card */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 sm:p-8 shadow-xs">
        <SubmissionForm />
      </div>

      {/* 3. Compact Informational "What happens next" section */}
      <section
        aria-labelledby="what-happens-next-heading"
        className="bg-white rounded-2xl border border-zinc-200 p-6 sm:p-7 shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
          <Layers className="w-4 h-4 text-zinc-500" />
          <h2
            id="what-happens-next-heading"
            className="text-xs font-semibold uppercase tracking-wider text-zinc-600 font-mono"
          >
            What happens next
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {steps.map((s) => (
            <div key={s.num} className="flex flex-col space-y-1 text-xs">
              <span className="w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200/80 text-zinc-700 font-mono font-semibold flex items-center justify-center mb-1 text-[11px]">
                {s.num}
              </span>
              <strong className="text-zinc-900 font-medium">{s.title}</strong>
              <p className="text-zinc-500 leading-relaxed font-normal">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Development-only fixture inspector */}
      {showDevelopmentFixtures && (
      <div className="pt-2 border-t border-zinc-200/60">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-medium">
            Development State Inspector
          </span>
          <span className="text-[11px] text-zinc-400">
            Click any fixture to preview lifecycle states
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {demoFixtures.map((fixture) => (
            <Link
              key={fixture.href}
              href={fixture.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-zinc-100/90 hover:bg-zinc-200/80 text-zinc-700 hover:text-zinc-900 border border-zinc-200/70 transition-all font-mono group"
            >
              <span>{fixture.label}</span>
              <span className="text-[10px] bg-white border border-zinc-200 px-1 py-0.2 rounded text-zinc-500 group-hover:text-zinc-800">
                {fixture.badge}
              </span>
              <ArrowRight className="w-3 h-3 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          ))}
        </div>
      </div>
      )}
    </PageContainer>
  );
}
