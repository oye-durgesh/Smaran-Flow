"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { formatTime, timeOf } from "@/lib/dates";
import { memberById } from "@/lib/selectors";
import { Toaster } from "@/components/ui/sonner";
import { SmaranLogo } from "@/components/smaran/brand";
import { MemoryTimeline } from "@/components/smaran/memory-timeline";
import { BottomNavigation, DesktopSidebar } from "./navigation";
import { DemoBar, DemoPanel } from "./demo-controls";
import { IncomingReminderBanner } from "./incoming-reminder";

const CHROMELESS = (p: string) => p === "/" || p.startsWith("/welcome") || p.startsWith("/onboarding");
const FOCUSED_MOBILE = (p: string) => p === "/new" || /^\/reminders\/[^/]+\/chat/.test(p);

function useScrollReset(path: string, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [path, ref]);
}

function PhoneStatusBar() {
  const state = useAppState();
  const [clock] = formatTime(timeOf(state.demoNow)).split(" ");
  return (
    <div className="absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between bg-ivory/90 px-7 text-[13px] font-extrabold text-ink-strong" aria-hidden>
      <span>{clock}</span>
      <span className="absolute left-1/2 top-2.5 h-[22px] w-[96px] -translate-x-1/2 rounded-full bg-[#3d302a]" />
      <span className="flex items-center gap-1.5">
        <Signal className="size-3.5" strokeWidth={2.6} />
        <Wifi className="size-3.5" strokeWidth={2.6} />
        <BatteryFull className="size-4" strokeWidth={2.2} />
      </span>
    </div>
  );
}

function PresenterAside({ side }: { side: "left" | "right" }) {
  const state = useAppState();
  if (side === "left") {
    return (
      <div className="hidden w-[300px] shrink-0 xl:block">
        <SmaranLogo size="lg" />
        <p className="mt-6 text-[22px] leading-snug font-extrabold text-ink-strong">Your voice remembers, even when you can&apos;t be there.</p>
        <ol className="mt-7 space-y-3 text-[14.5px] text-ink">
          {["You speak with Wispr Flow", "SMARAN understands", "SMARAN remembers", "Your family gets reminded", "They reply — you see it"].map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-sand text-[12px] font-extrabold text-brown">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
        <p className="mt-7 text-[13px] leading-relaxed text-ink-muted">Switch to <b className="text-ink">Web</b> at any point — it&apos;s the same app and the same family memory.</p>
      </div>
    );
  }
  return (
    <div className="hidden w-[300px] shrink-0 xl:block">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11.5px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">Live family memory</span>
        <Link href="/memory" className="text-[12.5px] font-bold text-peach-deep hover:underline">Open</Link>
      </div>
      <div className="max-h-[520px] overflow-hidden rounded-[22px] border border-line bg-surface-raised/70 p-4 [mask-image:linear-gradient(to_bottom,black_80%,transparent)]">
        <MemoryTimeline state={state} events={state.memory} limit={7} />
      </div>
    </div>
  );
}

export function AppFrame({ children }: { children: ReactNode }) {
  const path = usePathname();
  const state = useAppState();
  const { layout, isNarrow, setPortalEl } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  const chromeless = CHROMELESS(path);
  useScrollReset(path, scrollRef);

  const chatMatch = path.match(/^\/reminders\/([^/]+)\/chat/);
  const chatMember = chatMatch ? memberById(state, state.reminders.find((r) => r.id === chatMatch[1])?.familyMemberId) : undefined;

  if (layout === "web") {
    return (
      <div className="flex h-dvh flex-col">
        <DemoBar />
        <div key="web" className="flex min-h-0 flex-1 animate-fade">
          {!chromeless && <DesktopSidebar />}
          <main ref={scrollRef} className={cn("min-h-0 min-w-0 flex-1", chromeless && "overflow-y-auto")}>
            {children}
          </main>
        </div>
        <IncomingReminderBanner placement="desktop" />
        <DemoPanel />
        <Toaster position="bottom-right" />
      </div>
    );
  }

  const showNav = !chromeless && !FOCUSED_MOBILE(path);

  if (isNarrow) {
    return (
      <div className="flex min-h-dvh flex-col">
        <DemoBar />
        <div ref={(el) => setPortalEl(el)} className="relative flex min-h-0 flex-1 flex-col [transform:translateZ(0)]">
          <main ref={scrollRef} className={cn("flex-1", showNav && "pb-24")}>
            {children}
          </main>
          {showNav && <BottomNavigation className="fixed inset-x-0 bottom-0 z-30" />}
          <IncomingReminderBanner placement="phone" />
          <Toaster position="top-center" />
        </div>
        <DemoPanel />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-[radial-gradient(ellipse_at_top,var(--smaran-ivory)_0%,var(--smaran-ivory-deep)_100%)]">
      <DemoBar />
      <div key="mobile" className="flex min-h-0 flex-1 items-center justify-center gap-14 overflow-hidden px-6 py-5 animate-fade">
        <PresenterAside side="left" />
        <div className="flex h-full flex-col items-center">
          <div className="mb-2 text-[12px] font-bold text-ink-muted">{chatMember ? `${chatMember.name}'s phone` : `${state.user.name}'s phone`}</div>
          <div
            ref={(el) => setPortalEl(el)}
            className="relative h-[min(844px,calc(100%-26px))] w-[390px] overflow-hidden rounded-[52px] border-[10px] border-[#4a3a31] bg-ivory shadow-[0_30px_80px_-30px_rgb(69_52_43/0.45)] [transform:translateZ(0)]"
          >
            <PhoneStatusBar />
            <div ref={scrollRef as React.RefObject<HTMLDivElement>} className="scrollbar-none absolute inset-0 overflow-y-auto pt-11">
              <main className={cn(showNav && "pb-24")}>{children}</main>
            </div>
            {showNav && <BottomNavigation className="absolute inset-x-0 bottom-0 z-30" />}
            <IncomingReminderBanner placement="phone" />
            <Toaster position="top-center" />
          </div>
        </div>
        <PresenterAside side="right" />
      </div>
      <DemoPanel />
    </div>
  );
}
