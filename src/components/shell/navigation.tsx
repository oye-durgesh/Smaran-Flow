"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Home, Menu, MessageCircleQuestion, Settings, UserRound, X, Pill } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT, type StringKey } from "@/lib/i18n";
import { useAppState } from "@/lib/store/store";
import { SmaranLogo } from "@/components/smaran/brand";
import { MemberAvatar } from "@/components/smaran/primitives";
import { NotificationBell } from "./notification-center";

interface NavItem {
  href: string;
  key: StringKey;
  icon: typeof Home;
  match: (path: string) => boolean;
}

const NAV = {
  today: { href: "/today", key: "today" as const, icon: Home, match: (p: string) => p === "/today" },
  medicines: { href: "/medicines", key: "medicines" as const, icon: Pill, match: (p: string) => p.startsWith("/medicines") || p.startsWith("/reminders") },
  appointments: { href: "/appointments", key: "appointments" as const, icon: CalendarDays, match: (p: string) => p.startsWith("/appointments") },
  documents: { href: "/documents", key: "documents" as const, icon: FileText, match: (p: string) => p.startsWith("/documents") },
  ask: { href: "/ask", key: "ask" as const, icon: MessageCircleQuestion, match: (p: string) => p.startsWith("/ask") },
  settings: { href: "/settings", key: "settings" as const, icon: Settings, match: (p: string) => p.startsWith("/settings") },
  aboutMe: { href: "/settings", key: "aboutMe" as const, icon: UserRound, match: (p: string) => p.startsWith("/settings") },
};

const MAIN: NavItem[] = [NAV.today, NAV.medicines, NAV.appointments, NAV.documents, NAV.ask, NAV.settings];
export const SIDEBAR_MAIN_HREFS = MAIN.map((i) => i.href);
export const SIDEBAR_EXCLUDES_MEMORY = true;
const MOBILE_TABS = [NAV.today, NAV.medicines, NAV.appointments, NAV.ask, NAV.documents];

function NavLinks({ path, onNavigate, compact }: { path: string; onNavigate?: () => void; compact?: boolean }) {
  const t = useT();
  const state = useAppState();
  return (
    <>
      <p className="mb-2 px-3 text-[11px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">{t("mainNav")}</p>
      <ul className="space-y-1">
        {MAIN.map((item) => {
          const active = item.match(path);
          const Icon = item.icon;
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-nav={item.key}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-[14px] px-3 font-bold transition-colors",
                  compact ? "h-11 text-[14.5px]" : "h-11 text-[15px]",
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
        <div className="mb-2 text-[11px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">{t("healthCards")}</div>
        <ul className="space-y-1">
          {state.family.map((m) => (
            <li key={m.id}>
              <Link
                href={`/health-card/${m.id}`}
                data-nav={`health-${m.id}`}
                onClick={onNavigate}
                className={cn("-mx-1 flex items-center gap-2.5 rounded-[12px] px-1 py-1.5 text-[14px] font-semibold hover:bg-ivory-deep", path === `/health-card/${m.id}` ? "text-ink-strong" : "text-ink")}
              >
                <MemberAvatar member={m} size={26} />
                {m.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function BottomNavigation({ className }: { className?: string }) {
  const path = usePathname();
  const t = useT();
  return (
    <nav aria-label="Main" data-testid="mobile-tabs" className={cn("border-t border-line bg-surface-raised/95 px-2 pt-1.5 pb-[max(10px,env(safe-area-inset-bottom))]", className)}>
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
                {item.key === "medicines" ? "Medicines" : item.key === "appointments" ? "Visits" : t(item.key)}
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
    <nav aria-label="Main" data-testid="desktop-sidebar" className={cn("flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-surface/70 px-3 py-6", className)}>
      <div className="mb-7 flex items-start justify-between gap-2 px-2">
        <Link href="/today">
          <SmaranLogo size="md" />
        </Link>
        <NotificationBell />
      </div>
      <NavLinks path={path} compact />
      <Link
        href="/settings"
        data-nav="aboutMe"
        className="mt-auto rounded-[18px] border border-line bg-surface-raised p-4 hover:border-peach"
      >
        <div className="text-[12px] font-extrabold tracking-[0.12em] text-ink-muted uppercase">{t("aboutMe")}</div>
        <div className="mt-1 text-[15px] font-bold text-ink-strong">{state.user.name}</div>
      </Link>
    </nav>
  );
}

export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const path = usePathname();
  const t = useT();
  const state = useAppState();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden" data-testid="mobile-drawer">
      <button type="button" aria-label="Close menu" className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <nav className="absolute inset-y-0 left-0 flex w-[min(86vw,300px)] flex-col overflow-y-auto border-r border-line bg-ivory px-3 py-5 shadow-[var(--shadow-soft)]">
        <div className="mb-5 flex items-center justify-between px-2">
          <SmaranLogo size="sm" />
          <button type="button" aria-label="Close menu" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ivory-deep">
            <X className="size-5" />
          </button>
        </div>
        <NavLinks path={path} onNavigate={onClose} />
        <Link href="/settings" data-nav="aboutMe" onClick={onClose} className="mt-8 rounded-[18px] border border-line bg-surface-raised p-4">
          <div className="text-[12px] font-extrabold tracking-[0.12em] text-ink-muted uppercase">{t("aboutMe")}</div>
          <div className="mt-1 text-[15px] font-bold text-ink-strong">{state.user.name}</div>
        </Link>
      </nav>
    </div>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" aria-label="Open menu" onClick={onClick} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-ivory-deep lg:hidden">
      <Menu className="size-5" />
    </button>
  );
}
