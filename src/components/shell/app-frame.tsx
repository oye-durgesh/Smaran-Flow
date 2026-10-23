"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { Toaster } from "@/components/ui/sonner";
import { SmaranLogo } from "@/components/smaran/brand";
import { BottomNavigation, DesktopSidebar } from "./navigation";
import { IncomingReminderBanner } from "./incoming-reminder";

const CHROMELESS = (p: string) => p === "/" || p.startsWith("/welcome") || p.startsWith("/onboarding");
const FOCUSED = (p: string) => p === "/new" || /^\/reminders\/[^/]+\/chat/.test(p);

function useScrollReset(path: string, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [path, ref]);
}

export function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const state = useAppState();
  const { setPortalEl } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  const chromeless = CHROMELESS(path);
  const showNav = !chromeless && !FOCUSED(path);
  useScrollReset(path, scrollRef);

  return (
    <div ref={(el) => setPortalEl(el)} className="flex h-dvh flex-col bg-ivory">
      {showNav && (
        <header className="flex h-14 items-center justify-between border-b border-line px-4 lg:hidden">
          <Link href="/today">
            <SmaranLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/memory" className="inline-flex h-11 items-center rounded-full px-3 text-[13px] font-bold text-ink hover:bg-ivory-deep">
              Memory
            </Link>
            <Link href="/settings" aria-label="Settings" className="flex size-11 items-center justify-center rounded-full bg-sand text-[14px] font-extrabold text-brown">
              {state.user.name.charAt(0)}
            </Link>
          </div>
        </header>
      )}
      <div className="flex min-h-0 flex-1">
        {showNav && <DesktopSidebar className="hidden lg:flex" />}
        <main ref={scrollRef} className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto", showNav && "pb-24 lg:pb-0")}>
          {children}
        </main>
      </div>
      {showNav && <BottomNavigation className="fixed inset-x-0 bottom-0 z-30 lg:hidden" />}
      <IncomingReminderBanner placement="desktop" />
      <Toaster position="bottom-right" />
    </div>
  );
}
