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
  dockComposer = false,
}: {
  children: ReactNode;
  aside?: ReactNode;
  footer?: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
  /** Keep a tall composer fully visible above the mobile tab bar. */
  dockComposer?: boolean;
}) {
  const max = { narrow: "max-w-[680px]", default: "max-w-[860px]", wide: "max-w-[1120px]" }[width];
  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-x-hidden lg:flex-row", dockComposer && "max-lg:-mb-24")}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full px-5 pt-5 pb-8 animate-fade sm:px-8 lg:px-10 lg:pt-9 lg:pb-12", max, className)}>
            {children}
            {aside && <div className="mt-10 space-y-6 lg:hidden">{aside}</div>}
          </div>
        </div>
        {footer && (
          <div
            className={cn(
              "shrink-0 border-t border-line/70 bg-ivory/95",
              dockComposer && "pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:pb-[calc(5.25rem+env(safe-area-inset-bottom))]",
            )}
          >
            <div className={cn("mx-auto w-full px-3 py-2.5 sm:px-8 sm:py-3 lg:px-10", max)}>{footer}</div>
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
