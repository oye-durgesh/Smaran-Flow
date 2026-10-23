"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One screen that stacks on small viewports and uses a contextual right rail
 * from lg and up.
 */
export function Screen({
  children,
  aside,
  footer,
  width = "default",
  className,
}: {
  children: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  const max = { narrow: "max-w-[680px]", default: "max-w-[860px]", wide: "max-w-[1120px]" }[width];
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full px-5 pt-5 pb-8 animate-fade sm:px-8 lg:px-10 lg:pt-9 lg:pb-12", max, className)}>
            {children}
            {aside && <div className="mt-10 space-y-6 lg:hidden">{aside}</div>}
          </div>
        </div>
        {footer && (
          <div className="border-t border-line/70 bg-ivory/95">
            <div className={cn("mx-auto w-full px-4 py-3 sm:px-8 lg:px-10", max)}>{footer}</div>
          </div>
        )}
      </div>
      {aside && (
        <aside aria-label="Context" className="scrollbar-soft hidden w-[340px] shrink-0 overflow-y-auto border-l border-line bg-surface/55 px-6 py-9 xl:w-[372px] lg:block">
          <div className="space-y-6 animate-fade">{aside}</div>
        </aside>
      )}
    </div>
  );
}
