"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { IdCard, Pencil, Phone, Plus, UserRound, Users } from "lucide-react";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { addMember, updateMember } from "@/lib/store/actions";
import { agendaFor, documentsFor, memberById, memberDaySummary, todayOf, upcomingAppointments } from "@/lib/selectors";
import type { FamilyMember, Relationship } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { AgendaCard, AppointmentCard, DocumentCard, FamilyMemberCard, ReminderRow } from "@/components/smaran/cards";
import { EmptyState, MemberAvatar, PageHeader, PillGroup, SectionLabel, Surface } from "@/components/smaran/primitives";
import { MemoryTimeline } from "@/components/smaran/memory-timeline";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSendReminderNow } from "@/components/shell/use-send-reminder";

const RELATIONSHIPS: Relationship[] = ["Mother", "Father", "Grandmother", "Grandfather", "Partner", "Other"];

function MemberDialog({ open, onOpenChange, member }: { open: boolean; onOpenChange: (o: boolean) => void; member?: FamilyMember }) {
  const { session, commit, update, refreshVault } = useStore();
  const [form, setForm] = useState({ name: "", relationship: "Mother" as Relationship, age: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setForm(member ? { name: member.name, relationship: member.relationship, age: member.age ? String(member.age) : "", phone: member.phone ?? "" } : { name: "", relationship: "Grandmother", age: "", phone: "" });
      setError(null);
    }
  }
  const save = async () => {
    if (!form.name.trim()) return setError("Add a name so SMARAN knows who this is.");
    const age = form.age ? Number(form.age) : undefined;
    if (age !== undefined && (age < 1 || age > 120)) return setError("That age doesn't look right.");
    try {
      if (member) {
        update((s) => updateMember(s, member.id, { name: form.name.trim(), relationship: form.relationship, age, phone: form.phone.trim() || undefined }));
        toast.success("Details saved");
      } else if (session.authenticated) {
        const res = await fetch("/api/family", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: form.name.trim(), relationship: form.relationship }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not add this person.");
        const ok = await refreshVault();
        if (!ok) throw new Error("Saved on the server, but the vault did not refresh.");
        toast.success(`${form.name.trim()} added to your family vault`);
      } else {
        commit((s) => addMember(s, { name: form.name, relationship: form.relationship, age, phone: form.phone }));
        toast.success(`${form.name.trim()} added to your family`);
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={member ? `Edit ${member.name}` : "Add someone to your family"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{member ? "Save" : "Add to family"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="m-name">Name</Label>
          <Input id="m-name" value={form.name} placeholder="e.g. Dadi" onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!error && !form.name.trim()} />
        </div>
        <div className="space-y-2">
          <Label>Relationship</Label>
          <PillGroup label="Relationship" value={form.relationship} onChange={(r) => setForm({ ...form, relationship: r })} options={RELATIONSHIPS.map((r) => ({ value: r, label: r }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="m-age">Age</Label>
            <Input id="m-age" inputMode="numeric" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value.replace(/\D/g, "") })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-phone">Phone</Label>
            <Input id="m-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        {error && <p role="alert" className="text-[13px] font-semibold text-missed">{error}</p>}
      </div>
    </Modal>
  );
}

export function FamilyScreen() {
  const { state } = useStore();
  const { isWeb } = useView();
  const [adding, setAdding] = useState(false);
  const today = todayOf(state);

  const cards = state.family.length ? (
    <div className={isWeb ? "grid grid-cols-2 gap-4" : "space-y-4"}>
      {state.family.map((m) => (
        <FamilyMemberCard key={m.id} member={m} summary={memberDaySummary(state, m.id, today)} nextAppointment={upcomingAppointments(state, m.id)[0]} today={today} />
      ))}
    </div>
  ) : (
    <EmptyState icon={<Users className="size-6" />} title="Who are you remembering for?" body="Add a parent or anyone you care for. SMARAN keeps their reminders and records together." action={{ label: "Add family member", onClick: () => setAdding(true) }} />
  );

  const activity = (
    <section>
      <SectionLabel action={<Link href="/memory" className="text-[12.5px] font-bold text-peach-deep hover:underline">See all</Link>}>Recent activity</SectionLabel>
      {state.memory.length ? <MemoryTimeline state={state} events={state.memory} limit={isWeb ? 8 : 5} /> : <p className="text-[14px] text-ink-muted">Nothing yet — activity appears here as your family uses SMARAN.</p>}
    </section>
  );

  const header = (
    <PageHeader
      title="Family"
      subtitle="Everyone you're remembering for, at a glance."
      actions={
        <Button variant="outline" size={isWeb ? "default" : "sm"} onClick={() => setAdding(true)}>
          <Plus className="size-4" aria-hidden /> Add
        </Button>
      }
    />
  );

  const wispr = <SmaranSpeakBox context="family" />;

  return (
    <Screen width={isWeb ? "default" : undefined} aside={isWeb ? <>{wispr}{activity}</> : undefined}>
      {header}
      {cards}
      {!isWeb && (
        <div className="mt-8 space-y-8">
          {activity}
          {wispr}
        </div>
      )}
      <MemberDialog open={adding} onOpenChange={setAdding} />
    </Screen>
  );
}

export function FamilyMemberScreen() {
  const { id } = useParams<{ id: string }>();
  const { state } = useStore();
  const { isWeb } = useView();
  const sendNow = useSendReminderNow();
  const [editing, setEditing] = useState(false);
  const member = memberById(state, id);

  if (!member) {
    return (
      <Screen width="narrow">
        <PageHeader back="/family" title="Family" />
        <EmptyState icon={<UserRound className="size-6" />} title="We couldn't find this person." body="They may have been removed from your family." action={{ label: "Back to family", href: "/family" }} />
      </Screen>
    );
  }

  const today = todayOf(state);
  const agenda = agendaFor(state, today, member.id);
  const reminders = state.reminders.filter((r) => r.familyMemberId === member.id);
  const appointments = upcomingAppointments(state, member.id);
  const docs = documentsFor(state, member.id);
  const events = state.memory.filter((e) => e.familyMemberId === member.id);

  const profile = (
    <Surface className="flex items-center gap-4 p-5">
      <MemberAvatar member={member} size={64} />
      <div className="min-w-0 flex-1">
        <div className="text-[26px] leading-tight font-extrabold text-ink-strong">{member.name}</div>
        <div className="text-[14.5px] text-ink-muted">
          {member.relationship}
          {member.age ? ` · ${member.age} years` : ""}
        </div>
        {member.phone && (
          <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="mt-1 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-brown hover:underline">
            <Phone className="size-3.5" aria-hidden /> {member.phone}
          </a>
        )}
      </div>
      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${member.name}`} onClick={() => setEditing(true)}>
        <Pencil className="size-4" />
      </Button>
    </Surface>
  );

  const healthCardLink = (
    <Link href={`/health-card/${member.id}`} className="flex items-center gap-3 rounded-[18px] bg-peach-soft/50 p-4 transition-colors hover:bg-peach-soft">
      <IdCard className="size-6 text-peach-deep" aria-hidden />
      <span className="flex-1">
        <span className="block text-[15.5px] font-extrabold text-ink-strong">{member.name}&apos;s Health Card</span>
        <span className="block text-[13px] text-ink-muted">A clean summary you can share</span>
      </span>
    </Link>
  );

  const sections = (
    <div className="space-y-8">
      <section>
        <SectionLabel>Today</SectionLabel>
        {agenda.length ? (
          <ul className="space-y-3">
            {agenda.map((item) => (
              <li key={item.id}>
                <AgendaCard item={item} today={today} onSend={sendNow} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[16px] bg-surface px-4 py-4 text-[14.5px] text-ink-muted">Nothing for {member.name} today.</p>
        )}
      </section>
      <section>
        <SectionLabel action={<Link href="/new?kind=reminder" className="text-[12.5px] font-bold text-peach-deep hover:underline">Add</Link>}>Medicines & checks</SectionLabel>
        {reminders.length ? (
          <Surface className="divide-y divide-line px-3">
            {reminders.map((r) => (
              <ReminderRow key={r.id} reminder={r} />
            ))}
          </Surface>
        ) : (
          <EmptyState icon={<Plus className="size-6" />} title="Nothing to remember yet." body={`Tell SMARAN what ${member.name} needs to remember.`} action={{ label: "Add reminder", href: "/new?kind=reminder" }} />
        )}
      </section>
      <section>
        <SectionLabel>Upcoming appointments</SectionLabel>
        {appointments.length ? (
          <ul className="space-y-3">
            {appointments.map((a) => (
              <li key={a.id}>
                <AppointmentCard appointment={a} member={member} today={today} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[16px] bg-surface px-4 py-4 text-[14.5px] text-ink-muted">No appointments coming up.</p>
        )}
      </section>
      <section>
        <SectionLabel action={<Link href="/documents" className="text-[12.5px] font-bold text-peach-deep hover:underline">All documents</Link>}>Documents</SectionLabel>
        {docs.length ? (
          <div className={isWeb ? "grid grid-cols-2 gap-3" : "space-y-2.5"}>
            {docs.slice(0, 4).map((d) => (
              <DocumentCard key={d.id} doc={d} member={member} compact />
            ))}
          </div>
        ) : (
          <p className="rounded-[16px] bg-surface px-4 py-4 text-[14.5px] text-ink-muted">No documents yet.</p>
        )}
      </section>
    </div>
  );

  const memory = (
    <section>
      <SectionLabel>{member.name}&apos;s memory</SectionLabel>
      {events.length ? <MemoryTimeline state={state} events={events} showPerson={false} limit={6} /> : <p className="text-[14px] text-ink-muted">Nothing recorded yet.</p>}
    </section>
  );

  const wispr = <SmaranSpeakBox context={{ person: member.name }} />;

  return (
    <Screen
      aside={
        isWeb ? (
          <>
            {healthCardLink}
            {wispr}
            {memory}
          </>
        ) : undefined
      }
    >
      <PageHeader back="/family" eyebrow="Family" title={`${member.name}'s health memory`} />
      <div className="space-y-6">
        {profile}
        {!isWeb && healthCardLink}
        {sections}
        {!isWeb && (
          <>
            {memory}
            {wispr}
          </>
        )}
      </div>
      <MemberDialog open={editing} onOpenChange={setEditing} member={member} />
    </Screen>
  );
}
