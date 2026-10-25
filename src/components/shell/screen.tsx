"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One screen that stacks on small / laptop viewports and uses a contextual
 * right rail from xl and up so the composer is never squeezed beside the
 * sidebar at 1024px.
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
    <div className={cn("flex h-full min-h-0 flex-col overflow-x-hidden xl:flex-row", dockComposer && "max-xl:-mb-24")}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full min-w-0 px-5 pt-5 pb-8 animate-fade sm:px-8 lg:px-10 lg:pt-9 lg:pb-12", max, className)}>
            {children}
            {aside && <div className="mt-10 min-w-0 space-y-6 xl:hidden">{aside}</div>}
          </div>
        </div>
        {footer && (
          <div
            className={cn(
              "min-w-0 shrink-0 border-t border-line/70 bg-ivory/95",
              dockComposer && "pb-[max(0.75rem,env(safe-area-inset-bottom))] max-xl:pb-[calc(5.25rem+env(safe-area-inset-bottom))]",
            )}
          >
            <div className={cn("mx-auto w-full min-w-0 px-3 py-2.5 sm:px-8 sm:py-3 lg:px-10", max)}>{footer}</div>
          </div>
        )}
      </div>
      {aside && (
        <aside
          aria-label="Context"
          className="scrollbar-soft hidden min-w-0 w-[min(100%,22.5rem)] shrink overflow-x-hidden overflow-y-auto border-l border-line bg-surface/55 px-3 py-7 xl:block xl:w-[min(100%,23.25rem)] xl:px-4 xl:py-9"
        >
          <div className="min-w-0 space-y-6 animate-fade">{aside}</div>
        </aside>
      )}
    </div>
  );
}
