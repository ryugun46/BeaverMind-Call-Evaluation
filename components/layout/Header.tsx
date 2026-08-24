"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PlusCircle, FileCheck2, History } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { cn } from "@/lib/utils/cn";

export function Header() {
  const pathname = usePathname();
  const isEvaluationPage = pathname.startsWith("/evaluation/");
  const isHistoryPage = pathname === "/history";

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-200/80 transition-all no-print">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Product Brand */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 rounded-md py-1 px-1.5 -ml-1.5 transition-colors"
          aria-label="Call Evaluation Home"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-white shadow-xs group-hover:bg-zinc-800 transition-colors">
            <FileCheck2 className="w-4 h-4 text-zinc-100" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tracking-tight text-zinc-900">
              Call Evaluation
            </span>
            <span className="text-[11px] font-mono text-zinc-400 font-medium px-1.5 py-0.5 rounded bg-zinc-100 hidden sm:inline-block">
              QA Core
            </span>
          </div>
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-2">
          <Link
            href="/history"
            aria-current={isHistoryPage ? "page" : undefined}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2",
              isHistoryPage
                ? "bg-zinc-900 text-white shadow-xs"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">History</span>
          </Link>

          {(isEvaluationPage || isHistoryPage) && (
            <Link href="/">
              <ActionButton
                variant="secondary"
                size="sm"
                leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
              >
                New Evaluation
              </ActionButton>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
