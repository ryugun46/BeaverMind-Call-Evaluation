import React from "react";
import { MessageSquareText } from "lucide-react";

interface BriefCardProps {
  brief?: string | null;
}

export function BriefCard({ brief }: BriefCardProps) {
  if (!brief) return null;

  return (
    <section className="bg-white rounded-2xl border border-zinc-200/90 p-6 sm:p-7 shadow-xs space-y-3">
      <div className="flex items-center gap-2 border-b border-zinc-100 pb-3">
        <MessageSquareText className="w-4 h-4 text-zinc-500" />
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-500">
          Brief
        </h2>
      </div>

      <p className="text-base sm:text-[17px] text-zinc-800 leading-relaxed font-normal antialiased">
        {brief}
      </p>
    </section>
  );
}
