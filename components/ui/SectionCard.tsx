import React from "react";
import { cn } from "@/lib/utils/cn";

interface SectionCardProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  badge?: React.ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  action,
  icon,
  children,
  className,
  headerClassName,
  bodyClassName,
  badge,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "bg-white rounded-xl border border-zinc-200/90 shadow-xs overflow-hidden transition-all print-break-inside-avoid",
        className
      )}
    >
      {(title || subtitle || action) && (
        <header
          className={cn(
            "px-5 py-4 border-b border-zinc-100 flex flex-wrap items-center justify-between gap-3 bg-zinc-50/40",
            headerClassName
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <span className="text-zinc-500 shrink-0">{icon}</span>}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {typeof title === "string" ? (
                  <h2 className="text-sm font-semibold text-zinc-900 tracking-tight truncate">
                    {title}
                  </h2>
                ) : (
                  title
                )}
                {badge && <span className="shrink-0">{badge}</span>}
              </div>
              {subtitle && (
                <p className="text-xs text-zinc-500 mt-0.5 font-normal truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
