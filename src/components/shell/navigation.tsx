"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Home, MessageCircleQuestion, Settings, Users, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, type StringKey } from "@/lib/i18n";
import { useAppState } from "@/lib/store/store";
import { SmaranLogo } from "@/components/smaran/brand";
import { MemberAvatar } from "@/components/smaran/primitives";

interface NavItem {
  href: string;
  key: StringKey;
  icon: typeof Home;
  match: (path: string) => boolean;
}

const NAV: Record<string, NavItem> = {
  today: { href: "/today", key: "today", icon: Home, match: (p) => p === "/today" || p.startsWith("/reminders") || p === "/new" },
  family: { href: "/family", key: "family", icon: Users, match: (p) => p.startsWith("/family") || p.startsWith("/health-card") },
  appointments: { href: "/appointments", key: "appointments", icon: CalendarDays, match: (p) => p.startsWith("/appointments") },
  documents: { href: "/documents", key: "documents", icon: FileText, match: (p) => p.startsWith("/documents") },
  memory: { href: "/memory", key: "memory", icon: History, match: (p) => p.startsWith("/memory") },
  ask: { href: "/ask", key: "ask", icon: MessageCircleQuestion, match: (p) => p.startsWith("/ask") },
  settings: { href: "/settings", key: "settings", icon: Settings, match: (p) => p.startsWith("/settings") },
};

const MOBILE_TABS = [NAV.today, NAV.family, NAV.appointments, NAV.documents, NAV.ask];
const DESKTOP_ITEMS = [NAV.today, NAV.family, NAV.appointments, NAV.documents, NAV.memory, NAV.ask, NAV.settings];

export function BottomNavigation({ className }: { className?: string }) {
  const path = usePathname();
  const t = useT();
  return (
    <nav aria-label="Main" className={cn("border-t border-line bg-surface-raised/95 px-2 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]", className)}>
      <ul className="grid grid-cols-5">
        {MOBILE_TABS.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-1 rounded-[14px] py-1.5 text-[11px] font-bold transition-colors", active ? "text-ink-strong" : "text-ink-muted hover:text-ink")}
              >
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-300", active && "bg-peach-soft")}>
                  <Icon className="size-[21px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DesktopSidebar({ className }: { className?: string }) {
  const path = usePathname();
  const t = useT();
  const state = useAppState();
  return (
    <nav aria-label="Main" className={cn("flex h-full w-[264px] shrink-0 flex-col border-r border-line bg-surface/70 px-4 py-6", className)}>
      <Link href="/today" className="mb-8 px-2">
        <SmaranLogo size="md" />
      </Link>
      <ul className="space-y-1">
        {DESKTOP_ITEMS.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-bold transition-colors",
                  active ? "bg-peach-soft/70 text-ink-strong" : "text-ink-muted hover:bg-ivory-deep hover:text-ink",
                )}
              >
                <Icon className="size-[19px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-8 px-3">
        <div className="mb-2 text-[11px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">Health Cards</div>
        <ul className="space-y-1">
          {state.family.map((m) => (
            <li key={m.id}>
              <Link href={`/health-card/${m.id}`} className={cn("-mx-1 flex items-center gap-2.5 rounded-[12px] px-1 py-1.5 text-[14px] font-semibold hover:bg-ivory-deep", path === `/health-card/${m.id}` ? "text-ink-strong" : "text-ink")}>
                <MemberAvatar member={m} size={26} />
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto rounded-[18px] border border-line bg-surface-raised p-4">
        <div className="text-[14px] font-bold text-ink-strong">{state.user.name}</div>
        <div className="text-[12.5px] leading-snug text-ink-muted">
          Caring for {state.family.map((m) => m.name).join(" & ") || "your family"}
        </div>
      </div>
    </nav>
  );
}
