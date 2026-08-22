import React from "react";
import { cn } from "@/lib/utils/cn";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "full";
}

export function PageContainer({
  children,
  className,
  size = "md",
}: PageContainerProps) {
  const sizeClasses = {
    sm: "max-w-3xl",
    md: "max-w-5xl",
    lg: "max-w-6xl",
    full: "max-w-7xl",
  };

  return (
    <main
      className={cn(
        "mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10 animate-fade-in",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </main>
  );
}
