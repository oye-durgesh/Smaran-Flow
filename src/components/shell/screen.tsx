"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useView } from "@/lib/store/view";

/**
 * One screen, two compositions. Mobile: a single scrolling column inside the
 * phone. Web: a centred content column with an optional contextual right panel.
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
  /** Pinned to the bottom of the screen (chat composer, primary actions). */
  footer?: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  const { isWeb } = useView();

  if (!isWeb) {
    return (
      <div className={cn("flex min-h-full flex-col", className)}>
        <div className="flex-1 px-5 pt-4 pb-8 animate-fade">{children}</div>
        {footer && <div className="sticky bottom-0 z-20 border-t border-line/70 bg-ivory/95 px-4 pt-3 pb-4">{footer}</div>}
      </div>
    );
  }

  const max = { narrow: "max-w-[680px]", default: "max-w-[860px]", wide: "max-w-[1120px]" }[width];
  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full px-10 pt-9 pb-12 animate-fade", max, className)}>{children}</div>
        </div>
        {footer && (
          <div className="border-t border-line bg-ivory/95">
            <div className={cn("mx-auto w-full px-10 py-4", max)}>{footer}</div>
          </div>
        )}
      </div>
      {aside && (
        <aside aria-label="Context" className="scrollbar-soft w-[372px] shrink-0 overflow-y-auto border-l border-line bg-surface/55 px-6 py-9 max-xl:w-[320px]">
          <div className="space-y-6 animate-fade">{aside}</div>
        </aside>
      )}
    </div>
  );
}
