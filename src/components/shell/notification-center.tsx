"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { fetchReminderInbox, fetchSchedulerStatus, isUuid, patchReminderInbox } from "@/lib/store/cloud";
import {
  acknowledgeNotification,
  applyLocalProcessor,
  completeNotification,
  dismissNotification,
  filterInbox,
  lateLabel,
  reminderHref,
  shouldShowToast,
  skipOccurrence,
  snoozeNotification,
  unreadCount,
  type InAppNotification,
} from "@/lib/in-app-reminders";
import { memberById } from "@/lib/selectors";
import { formatTime } from "@/lib/dates";

const SEEN_KEY = "smaran:toast-seen";

function loadSeen(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function persistSeen(seen: Set<string>) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

function asNotifications(items: unknown[]): InAppNotification[] {
  return items.filter((n): n is InAppNotification => Boolean(n && typeof n === "object" && "id" in n && "scheduledAt" in n));
}

export function NotificationBell() {
  const { state, session, update } = useStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread" | "due" | "acknowledged" | "historical">("all");
  const [pollError, setPollError] = useState<string | null>(null);
  const [schedulerNote, setSchedulerNote] = useState<string | null>(null);
  const seenRef = useRef<Set<string>>(loadSeen());
  const lastToast = useRef<string | null>(null);

  const notifications = useMemo(() => state.inAppNotifications ?? [], [state.inAppNotifications]);
  const badge = unreadCount(notifications);
  const visible = useMemo(() => filterInbox(notifications, filter), [notifications, filter]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function tick() {
      if (document.visibilityState === "hidden") return;
      update((s) => applyLocalProcessor(s, new Date()));
      if (session.authenticated) {
        const inbox = await fetchReminderInbox();
        if (cancelled) return;
        if (!inbox.ok) setPollError(inbox.error || "Inbox unavailable.");
        else {
          setPollError(null);
          const cloud = asNotifications(inbox.items);
          update((s) => {
            const ids = new Set(cloud.map((n) => n.id));
            const localOnly = (s.inAppNotifications ?? []).filter((n) => !ids.has(n.id) && !isUuid(n.id));
            return { ...s, inAppNotifications: [...cloud, ...localOnly] };
          });
        }
      }
    }

    function schedule() {
      const ms = document.visibilityState === "hidden" ? 120_000 : 20_000;
      timer = window.setTimeout(() => {
        void tick().finally(() => {
          if (!cancelled) schedule();
        });
      }, ms);
    }

    void tick();
    schedule();
    const onVis = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVis);
    void fetchSchedulerStatus()
      .then((s) => {
        if (!cancelled) setSchedulerNote(s.message);
      })
      .catch(() => {
        if (!cancelled) setSchedulerNote("Could not read scheduler status.");
      });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session.authenticated, update]);

  useEffect(() => {
    if (!state.settings.notifications) return;
    for (const n of notifications) {
      if ((n.status !== "due" && n.status !== "missed") || !n.unread) continue;
      if (!shouldShowToast(n.id, seenRef.current)) continue;
      persistSeen(seenRef.current);
      if (lastToast.current === n.id) continue;
      lastToast.current = n.id;
      const member = memberById(state, n.familyMemberId);
      toast.custom(
        () => (
          <div role="status" className="w-[min(92vw,360px)] rounded-[18px] border border-line bg-surface-raised p-3 shadow-[var(--shadow-raised)]">
            <p className="text-[11px] font-extrabold tracking-[0.12em] text-ink-muted uppercase">Medicine reminder</p>
            <p className="mt-1 text-[15px] font-bold text-ink-strong">
              {member?.name ?? "Family"} — {n.title} is due now.
            </p>
            <p className="text-[12.5px] text-ink-muted">Scheduled: {formatTime(n.scheduledAt.slice(11, 16))}</p>
            {lateLabel(n) && <p className="mt-1 text-[12px] font-semibold text-terracotta">{lateLabel(n)}</p>}
          </div>
        ),
        { id: n.id, duration: 12_000 },
      );
    }
  }, [notifications, state, state.settings.notifications]);

  async function act(n: InAppNotification, action: "acknowledge" | "snooze" | "skip" | "complete" | "read") {
    if (session.authenticated && isUuid(n.id)) {
      try {
        await patchReminderInbox(n.id, action === "read" ? "read" : action);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not update notification.");
        return;
      }
    }
    update((s) => {
      const store = {
        reminders: s.reminders,
        occurrences: [],
        notifications: [...(s.inAppNotifications ?? [])],
        attempts: [],
      };
      const now = new Date();
      const actor = session.userId || "local";
      if (action === "acknowledge") acknowledgeNotification(store, n.id, actor, now);
      if (action === "snooze") snoozeNotification(store, n.id, actor, now);
      if (action === "skip") skipOccurrence(store, n.id, actor, now);
      if (action === "complete") completeNotification(store, n.id, actor, now);
      if (action === "read") dismissNotification(store, n.id);
      return { ...s, inAppNotifications: store.notifications };
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={badge ? `${badge} unread reminders` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex size-11 items-center justify-center rounded-full hover:bg-ivory-deep"
      >
        <Bell className="size-5 text-ink-strong" />
        {badge > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-extrabold text-ivory">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-12 right-0 z-50 w-[min(92vw,380px)] rounded-[22px] border border-line bg-surface-raised p-3 shadow-[var(--shadow-raised)]">
          <div className="flex items-center justify-between px-1">
            <p className="text-[14px] font-extrabold text-ink-strong">Reminders</p>
            <button type="button" className="text-[12px] font-bold text-ink-muted" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["all", "unread", "due", "acknowledged", "historical"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold capitalize", filter === f ? "bg-peach text-ink-strong" : "bg-sand text-ink-muted")}
              >
                {f === "historical" ? "Completed" : f}
              </button>
            ))}
          </div>
          {pollError && <p className="mt-2 text-[12px] font-semibold text-terracotta">{pollError}</p>}
          {schedulerNote && <p className="mt-2 text-[11.5px] leading-4 text-ink-muted">{schedulerNote}</p>}
          <ul className="mt-2 max-h-[min(60vh,420px)] space-y-2 overflow-y-auto">
            {visible.length === 0 && <li className="rounded-[16px] bg-sand/60 px-3 py-4 text-[13px] text-ink-muted">No in-app reminders in this filter.</li>}
            {visible.map((n) => {
              const member = memberById(state, n.familyMemberId);
              return (
                <li key={n.id} className="rounded-[16px] border border-line bg-ivory px-3 py-2.5">
                  <p className="text-[11px] font-extrabold text-ink-muted uppercase">{member?.name ?? "Family"}</p>
                  <p className="text-[14px] font-bold text-ink-strong">{n.title}</p>
                  <p className="text-[12px] text-ink-muted">
                    {n.scheduledAt.slice(0, 10)} · {formatTime(n.scheduledAt.slice(11, 16))} · {n.status}
                    {n.unread ? " · unread" : ""}
                  </p>
                  {lateLabel(n) && <p className="text-[12px] font-semibold text-terracotta">{lateLabel(n)}</p>}
                  <p className="text-[11px] text-ink-muted">Alert status is not a medical outcome. Dose: {n.doseOutcome}.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Link href={reminderHref(n)} onClick={() => setOpen(false)} className="rounded-full bg-peach px-2.5 py-1 text-[11px] font-bold text-ink-strong">
                      View
                    </Link>
                    {n.unread && (
                      <button type="button" onClick={() => void act(n, "acknowledge")} className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-bold">
                        Acknowledge
                      </button>
                    )}
                    {(n.status === "due" || n.status === "missed") && (
                      <>
                        <button type="button" onClick={() => void act(n, "snooze")} className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-bold">
                          Snooze 10 min
                        </button>
                        <button type="button" onClick={() => void act(n, "skip")} className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-bold">
                          Skip this time
                        </button>
                        <button type="button" onClick={() => void act(n, "complete")} className="rounded-full bg-sand px-2.5 py-1 text-[11px] font-bold">
                          Complete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
