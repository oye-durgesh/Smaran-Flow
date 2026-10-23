"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import type { FamilyMember } from "@/lib/types";
import type { ReminderDraft } from "@/lib/nlu/reminder";
import type { AppointmentDraft } from "@/lib/nlu/appointment";
import { formatDayLong, formatOffset, formatTime } from "@/lib/dates";
import { frequencyLabel } from "@/lib/selectors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldTile, PillGroup } from "./primitives";
import { Modal } from "./modal";

function Assumptions({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((a) => (
        <li key={a} className="flex items-start gap-2 text-[13px] text-ink-muted">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {a}
        </li>
      ))}
    </ul>
  );
}

function MemberPicker({ family, value, onChange }: { family: FamilyMember[]; value?: string; onChange: (id: string) => void }) {
  return (
    <PillGroup label="Family member" value={value ?? ""} onChange={onChange} options={family.map((m) => ({ value: m.id, label: m.name }))} />
  );
}

/* ---------- Reminder ---------- */

export function ReminderUnderstood({
  draft,
  family,
  onChange,
  columns = 2,
}: {
  draft: ReminderDraft;
  family: FamilyMember[];
  onChange?: (d: ReminderDraft) => void;
  columns?: 2 | 4;
}) {
  const [editing, setEditing] = useState(false);
  const member = family.find((m) => m.id === draft.memberId);
  const edit = onChange ? () => setEditing(true) : undefined;
  return (
    <div>
      <div className={cn("grid gap-2.5", columns === 4 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
        <FieldTile label="Person" value={member?.name} missing={member ? undefined : "Who is this for?"} onEdit={edit} />
        <FieldTile label="Reminder" value={draft.title} missing={draft.title ? undefined : "What to remember?"} onEdit={edit} />
        <FieldTile label="Time" value={draft.time ? formatTime(draft.time) : undefined} missing={draft.time ? undefined : "What time?"} onEdit={edit} />
        <FieldTile label="Frequency" value={draft.frequency === "once" && draft.date ? `Once · ${formatDayLong(draft.date)}` : frequencyLabel(draft)} onEdit={edit} />
      </div>
      <Assumptions items={draft.assumptions} />
      {onChange && <ReminderDraftEditor open={editing} onOpenChange={setEditing} draft={draft} family={family} onSave={onChange} />}
    </div>
  );
}

export function ReminderDraftEditor({
  open,
  onOpenChange,
  draft,
  family,
  onSave,
  title = "Edit reminder",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  draft: ReminderDraft;
  family: FamilyMember[];
  onSave: (d: ReminderDraft) => void;
  title?: string;
}) {
  const [local, setLocal] = useState(draft);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLocal(draft);
  }
  const valid = local.memberId && local.title?.trim() && local.time;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSave({ ...local, title: local.title?.trim(), assumptions: [] });
              onOpenChange(false);
            }}
          >
            Save details
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Person</Label>
          <MemberPicker family={family} value={local.memberId} onChange={(id) => setLocal({ ...local, memberId: id })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-title">Reminder</Label>
          <Input id="r-title" value={local.title ?? ""} placeholder="BP Medicine" onChange={(e) => setLocal({ ...local, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-time">Time</Label>
          <Input id="r-time" type="time" value={local.time ?? ""} onChange={(e) => setLocal({ ...local, time: e.target.value || undefined })} />
        </div>
        <div className="space-y-2">
          <Label>Frequency</Label>
          <PillGroup
            label="Frequency"
            value={local.frequency}
            onChange={(f) => setLocal({ ...local, frequency: f })}
            options={[
              { value: "daily", label: "Every day" },
              { value: "weekly", label: "Every week" },
              { value: "once", label: "Once" },
            ]}
          />
          {local.frequency === "once" && (
            <Input type="date" aria-label="Date" value={local.date ?? ""} onChange={(e) => setLocal({ ...local, date: e.target.value || undefined })} />
          )}
          {local.frequency === "weekly" && (
            <PillGroup
              label="Weekday"
              value={String(local.weekday ?? 1)}
              onChange={(w) => setLocal({ ...local, weekday: Number(w) })}
              options={["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => ({ value: String(i), label: d }))}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Appointment ---------- */

const OFFSET_CHOICES = [4320, 1440, 180, 60];

export function AppointmentUnderstood({
  draft,
  family,
  onChange,
}: {
  draft: AppointmentDraft;
  family: FamilyMember[];
  onChange?: (d: AppointmentDraft) => void;
}) {
  const [editing, setEditing] = useState(false);
  const member = family.find((m) => m.id === draft.memberId);
  const edit = onChange ? () => setEditing(true) : undefined;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <FieldTile label="Person" value={member?.name} missing={member ? undefined : "Who is this for?"} onEdit={edit} />
        <FieldTile label="Doctor" value={draft.doctor} missing={draft.doctor ? undefined : "Which doctor?"} onEdit={edit} />
        <FieldTile label="Date" value={draft.date ? formatDayLong(draft.date) : undefined} missing={draft.date ? undefined : "Which day?"} onEdit={edit} />
        <FieldTile label="Time" value={draft.time ? formatTime(draft.time) : undefined} missing={draft.time ? undefined : "What time?"} onEdit={edit} />
        <FieldTile label="Location" value={draft.location ?? "Not mentioned"} onEdit={edit} />
        <FieldTile label="Reminders" value={draft.reminderOffsets.map(formatOffset).join(" · ")} onEdit={edit} />
      </div>
      <Assumptions items={draft.assumptions} />
      {onChange && <AppointmentDraftEditor open={editing} onOpenChange={setEditing} draft={draft} family={family} onSave={onChange} />}
    </div>
  );
}

export function AppointmentDraftEditor({
  open,
  onOpenChange,
  draft,
  family,
  onSave,
  title = "Edit appointment",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  draft: AppointmentDraft;
  family: FamilyMember[];
  onSave: (d: AppointmentDraft) => void;
  title?: string;
}) {
  const [local, setLocal] = useState(draft);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setLocal(draft);
  }
  const valid = local.memberId && local.doctor?.trim() && local.date && local.time;
  const toggleOffset = (o: number) =>
    setLocal({
      ...local,
      reminderOffsets: local.reminderOffsets.includes(o) ? local.reminderOffsets.filter((x) => x !== o) : [...local.reminderOffsets, o].sort((a, b) => b - a),
    });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => {
              onSave({ ...local, doctor: local.doctor?.trim(), location: local.location?.trim() || undefined, assumptions: [] });
              onOpenChange(false);
            }}
          >
            Save details
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label>Person</Label>
          <MemberPicker family={family} value={local.memberId} onChange={(id) => setLocal({ ...local, memberId: id })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="a-doctor">Doctor</Label>
          <Input id="a-doctor" value={local.doctor ?? ""} placeholder="Dr Sharma" onChange={(e) => setLocal({ ...local, doctor: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="a-date">Date</Label>
            <Input id="a-date" type="date" value={local.date ?? ""} onChange={(e) => setLocal({ ...local, date: e.target.value || undefined })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="a-time">Time</Label>
            <Input id="a-time" type="time" value={local.time ?? ""} onChange={(e) => setLocal({ ...local, time: e.target.value || undefined })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="a-loc">Location</Label>
          <Input id="a-loc" value={local.location ?? ""} placeholder="City Hospital, Room 204" onChange={(e) => setLocal({ ...local, location: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Remind</Label>
          <div className="flex flex-wrap gap-2">
            {OFFSET_CHOICES.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={local.reminderOffsets.includes(o)}
                onClick={() => toggleOffset(o)}
                className={cn("h-9 rounded-full border px-4 text-sm font-semibold", local.reminderOffsets.includes(o) ? "border-peach bg-peach text-ink-strong" : "border-line-strong bg-surface-raised text-ink-muted")}
              >
                {formatOffset(o)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
