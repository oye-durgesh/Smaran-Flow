"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { Toaster } from "@/components/ui/sonner";
import { SmaranLogo } from "@/components/smaran/brand";
import { BottomNavigation, DesktopSidebar, MobileMenuButton, MobileNavDrawer } from "./navigation";
import { IncomingReminderBanner } from "./incoming-reminder";
import { NotificationBell } from "./notification-center";

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
  const { state, session, vaultError } = useStore();
  const { setPortalEl } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  const [drawer, setDrawer] = useState(false);
  const chromeless = CHROMELESS(path);
  const showNav = !chromeless && !FOCUSED(path);
  useScrollReset(path, scrollRef);

  return (
    <div ref={(el) => setPortalEl(el)} className="flex h-dvh flex-col overflow-x-hidden bg-ivory">
      {showNav && (
        <header className="flex h-14 items-center justify-between border-b border-line px-3 lg:hidden">
          <MobileMenuButton onClick={() => setDrawer(true)} />
          <Link href="/today">
            <SmaranLogo size="sm" />
          </Link>
          <div className="flex items-center gap-0.5">
            <NotificationBell />
            <Link href="/settings" aria-label="About Me" className="flex size-11 items-center justify-center rounded-full bg-sand text-[14px] font-extrabold text-brown">
              {state.user.name.charAt(0)}
            </Link>
          </div>
        </header>
      )}
      <MobileNavDrawer open={drawer} onClose={() => setDrawer(false)} />
      <div className="flex min-h-0 min-w-0 flex-1">
        {showNav && <DesktopSidebar className="hidden lg:flex" />}
        <main ref={scrollRef} className={cn("min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto", showNav && "pb-24 lg:pb-0")}>
          {showNav && (
            <p
              role="status"
              className={cn(
                "border-b px-4 py-2 text-[12.5px] font-semibold",
                session.isDemo ? "border-[#E8C4B0] bg-[#FFF1E8] text-[#8F4538]" : session.authenticated ? "border-confirmed/30 bg-confirmed-bg text-confirmed" : "border-line bg-sand/50 text-ink",
              )}
            >
              {vaultError
                ? `Vault error: ${vaultError}`
                : session.isDemo
                  ? "DEMO WORKSPACE — All family health records shown here are fictional."
                  : session.authenticated
                    ? "Signed-in family vault (Supabase). Browser sample copies were not deleted."
                    : session.configured
                      ? "Supabase is configured. You are not signed in — records on this device are not the cloud."
                      : "Device-local mode. Nothing is cloud-synced."}
            </p>
          )}
          {children}
        </main>
      </div>
      {showNav && <BottomNavigation className="fixed inset-x-0 bottom-0 z-30 lg:hidden" />}
      <IncomingReminderBanner placement="desktop" />
      <Toaster position="bottom-right" />
    </div>
  );
}
