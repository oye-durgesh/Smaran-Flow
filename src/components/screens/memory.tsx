"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderHeart, History, MessageCircleQuestion } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { todayOf } from "@/lib/selectors";
import { dateOf } from "@/lib/dates";
import type { MemoryEvent } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { MemoryTimeline } from "@/components/smaran/memory-timeline";
import { EmptyState, PageHeader, PillGroup, SectionLabel, Surface } from "@/components/smaran/primitives";

type Kind = "all" | "reminders" | "appointments" | "documents";

const matchesKind = (e: MemoryEvent, kind: Kind) =>
  kind === "all" || (kind === "reminders" ? e.type.startsWith("reminder") : kind === "appointments" ? e.type.startsWith("appointment") : e.type.startsWith("document"));

export function MemoryScreen() {
  const { state } = useStore();
  const { isWeb } = useView();
  const [person, setPerson] = useState("all");
  const [kind, setKind] = useState<Kind>("all");
  const today = todayOf(state);

  const events = state.memory.filter((e) => (person === "all" || e.familyMemberId === person) && matchesKind(e, kind));
  const todayEvents = state.memory.filter((e) => dateOf(e.timestamp) === today);
  const confirmedToday = todayEvents.filter((e) => e.type === "reminder_confirmed").length;

  const filters = (
    <div className="mb-6 space-y-3">
      <PillGroup label="Family member" value={person} onChange={setPerson} options={[{ value: "all", label: "Everyone" }, ...state.family.map((m) => ({ value: m.id, label: m.name }))]} />
      <PillGroup
        label="Kind"
        value={kind}
        onChange={setKind}
        options={[
          { value: "all", label: "Everything" },
          { value: "reminders", label: "Reminders" },
          { value: "appointments", label: "Appointments" },
          { value: "documents", label: "Documents" },
        ]}
      />
    </div>
  );

  const content =
    state.memory.length === 0 ? (
      <EmptyState icon={<History className="size-6" />} title="Your family's memory starts here." body="Every reminder, confirmation, appointment and document will appear on this timeline." action={{ label: "Create your first reminder", href: "/new" }} />
    ) : events.length === 0 ? (
      <EmptyState icon={<History className="size-6" />} title="Nothing here yet." body="Try another person or kind." action={{ label: "Show everything", onClick: () => { setPerson("all"); setKind("all"); } }} />
    ) : (
      <MemoryTimeline state={state} events={events} showPerson={person === "all"} />
    );

  return (
    <Screen
      aside={
        isWeb ? (
          <>
            <div>
              <SectionLabel>Today</SectionLabel>
              <Surface className="grid grid-cols-2 divide-x divide-line">
                <div className="p-4">
                  <div className="text-[28px] font-extrabold text-ink-strong">{todayEvents.length}</div>
                  <div className="text-[13px] text-ink-muted">moments saved</div>
                </div>
                <div className="p-4">
                  <div className="text-[28px] font-extrabold text-confirmed">{confirmedToday}</div>
                  <div className="text-[13px] text-ink-muted">confirmations</div>
                </div>
              </Surface>
            </div>
            <p className="rounded-[18px] bg-sand/40 p-4 text-[13.5px] leading-relaxed text-ink">
              Memory is a record of what happened — created automatically when you speak to SMARAN, when family replies, and when documents are added.
            </p>
          </>
        ) : undefined
      }
    >
      <PageHeader title="Memory" subtitle="Everything your family remembered, in order." />
      {!isWeb && (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <Link href="/documents" className="flex items-center gap-3 rounded-[18px] border border-line bg-surface-raised p-4 hover:border-line-strong">
            <FolderHeart className="size-5 text-peach-deep" aria-hidden />
            <span>
              <span className="block text-[15px] font-extrabold text-ink-strong">Documents</span>
              <span className="block text-[12.5px] text-ink-muted">{state.documents.length} saved</span>
            </span>
          </Link>
          <Link href="/ask" className="flex items-center gap-3 rounded-[18px] border border-line bg-surface-raised p-4 hover:border-line-strong">
            <MessageCircleQuestion className="size-5 text-peach-deep" aria-hidden />
            <span>
              <span className="block text-[15px] font-extrabold text-ink-strong">Ask SMARAN</span>
              <span className="block text-[12.5px] text-ink-muted">Find anything</span>
            </span>
          </Link>
        </div>
      )}
      {filters}
      {content}
    </Screen>
  );
}
