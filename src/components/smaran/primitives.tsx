"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft, Check, Circle, Clock3, Pause, CalendarClock, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FamilyMember, ReminderDayStatus } from "@/lib/types";
import { useView } from "@/lib/store/view";

/* ---------- Surface ---------- */

export function Surface({ className, as: Tag = "div", ...props }: Omit<ComponentProps<"div">, "ref"> & { as?: "div" | "section" | "article" }) {
  return <Tag className={cn("rounded-[20px] border border-line bg-surface-raised shadow-[var(--shadow-soft)]", className)} {...props} />;
}

export function SectionLabel({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[12px] font-bold tracking-[0.14em] text-ink-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

/* ---------- Avatar ---------- */

const TONE: Record<FamilyMember["avatar"]["tone"], string> = {
  peach: "bg-peach-soft text-peach-deep",
  sand: "bg-sand text-brown",
  terracotta: "bg-[#f1dcc4] text-[#a77a4c]",
  brown: "bg-[#e9dbd1] text-brown",
};

export function MemberAvatar({ member, size = 44, className }: { member?: FamilyMember; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-extrabold", TONE[member?.avatar.tone ?? "sand"], className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {member?.avatar.initials ?? "?"}
    </span>
  );
}

/* ---------- Status ---------- */

const STATUS: Record<ReminderDayStatus | "completed", { label: string; cls: string; bar: string; icon: typeof Check }> = {
  confirmed: { label: "Confirmed", cls: "bg-confirmed-bg text-confirmed", bar: "bg-confirmed", icon: Check },
  waiting: { label: "Waiting", cls: "bg-waiting-bg text-waiting", bar: "bg-peach", icon: Clock3 },
  upcoming: { label: "Upcoming", cls: "bg-upcoming-bg text-upcoming", bar: "bg-terracotta", icon: CalendarClock },
  missed: { label: "Missed", cls: "bg-missed-bg text-missed", bar: "bg-missed", icon: CircleAlert },
  paused: { label: "Paused", cls: "bg-paused-bg text-paused", bar: "bg-line-strong", icon: Pause },
  completed: { label: "Completed", cls: "bg-paused-bg text-brown", bar: "bg-line-strong", icon: Check },
};

export const statusBarClass = (status: keyof typeof STATUS) => STATUS[status].bar;

export function StatusBadge({ status, label, className }: { status: keyof typeof STATUS; label?: string; className?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] leading-none font-bold whitespace-nowrap", s.cls, className)}>
      <Icon className="size-3.5" strokeWidth={2.6} aria-hidden />
      <span className="badge-label">{label ?? s.label}</span>
    </span>
  );
}

export function CheckDot({ done, className }: { done: boolean; className?: string }) {
  return done ? (
    <span className={cn("inline-flex size-5 items-center justify-center rounded-full bg-confirmed text-white", className)} aria-label="Done">
      <Check className="size-3" strokeWidth={3.2} />
    </span>
  ) : (
    <Circle className={cn("size-5 text-line-strong", className)} strokeWidth={2} aria-label="Not yet" />
  );
}

/* ---------- Page header ---------- */

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  eyebrow,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string | true;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const { isWeb } = useView();
  return (
    <header className={cn("mb-6 flex items-start justify-between gap-4", isWeb ? "pt-2" : "pt-1", className)}>
      <div className="min-w-0">
        {back && (
          <button
            type="button"
            onClick={() => (typeof back === "string" ? router.push(back) : router.back())}
            className="mb-3 -ml-1 inline-flex h-9 items-center gap-1.5 rounded-[12px] px-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-ivory-deep hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back
          </button>
        )}
        {eyebrow && <div className="mb-1.5 text-[12px] font-bold tracking-[0.14em] text-ink-muted uppercase">{eyebrow}</div>}
        <h1 className={cn("font-extrabold tracking-tight text-ink-strong", isWeb ? "text-[32px] leading-tight" : "text-[28px] leading-tight")}>{title}</h1>
        {subtitle && <p className={cn("mt-1.5 text-ink-muted", isWeb ? "text-base" : "text-[15px]")}>{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center rounded-[24px] border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-[18px] bg-sand/70 text-brown">{icon}</div>
      <h3 className="text-lg font-bold text-ink-strong">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[15px] text-ink-muted">{body}</p>
      {action &&
        (action.href ? (
          <Link href={action.href} className="mt-5 inline-flex h-11 items-center rounded-[14px] bg-peach px-5 text-[15px] font-semibold text-ink-strong transition-colors hover:bg-[#e29c7e]">
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className="mt-5 inline-flex h-11 items-center rounded-[14px] bg-peach px-5 text-[15px] font-semibold text-ink-strong transition-colors hover:bg-[#e29c7e]">
            {action.label}
          </button>
        ))}
    </div>
  );
}

/* ---------- Pills ---------- */

export function PillGroup<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-semibold transition-colors",
              active ? "border-peach bg-peach text-ink-strong" : "border-line-strong bg-surface-raised text-ink-muted hover:border-peach hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Detail rows ---------- */

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <dt className="text-[14px] text-ink-muted">{label}</dt>
      <dd className="text-right text-[15px] font-semibold text-ink-strong">{children}</dd>
    </div>
  );
}

export function FieldTile({ label, value, missing, onEdit }: { label: string; value?: ReactNode; missing?: string; onEdit?: () => void }) {
  return (
    <div className={cn("rounded-[16px] border px-4 py-3", missing ? "border-dashed border-peach bg-waiting-bg/50" : "border-line bg-surface")}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold tracking-[0.14em] text-ink-muted uppercase">{label}</div>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-[12px] font-bold text-peach-deep hover:underline">
            {missing ? "Add" : "Edit"}
          </button>
        )}
      </div>
      <div className={cn("mt-1 text-[17px] font-bold", missing ? "text-waiting" : "text-ink-strong")}>{value ?? missing}</div>
    </div>
  );
}
