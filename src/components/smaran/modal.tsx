"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useView } from "@/lib/store/view";
import { cn } from "@/lib/utils";

/**
 * Dialogs render as a bottom sheet on narrow screens and a centred card on desktop.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const { portalEl, isWeb } = useView();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        container={portalEl ?? undefined}
        className={cn(
          isWeb
            ? "sm:max-w-lg"
            : "top-auto bottom-0 left-0 max-h-[88%] max-w-full translate-x-0 translate-y-0 overflow-y-auto rounded-t-[28px] rounded-b-none pb-8 data-open:slide-in-from-bottom-10 data-open:zoom-in-100 data-closed:zoom-out-100 sm:max-w-full",
          className,
        )}
      >
        {!isWeb && <div aria-hidden className="mx-auto -mt-2 mb-1 h-1 w-10 rounded-full bg-line-strong" />}
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription className="text-[15px] text-ink-muted">{description}</DialogDescription>}
        </DialogHeader>
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
