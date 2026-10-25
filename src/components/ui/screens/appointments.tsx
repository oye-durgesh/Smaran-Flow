"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarCheck, CalendarClock, CalendarDays, CalendarRange, CalendarX2, Check, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Paperclip, Pencil, Plus, Stethoscope, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import { addAppointmentReminder, linkDocument, setAppointmentStatus, toggleAppointmentReminder, updateAppointment } from "@/lib/store/actions";
import { archiveDoctor, recordVisit, saveAppointment, scheduleFollowUp, upsertDoctor } from "@/lib/store/appointment-actions";
import { createCloudAppointment, isUuid, patchAppointment } from "@/lib/store/cloud";
import { documentsFor, memberById, todayOf } from "@/lib/selectors";
import { addMinutes, dateOf, formatDayLong, formatDayShort, formatOffset, formatShort, formatTime, stamp, timeOf } from "@/lib/dates";
import { addCalendarMonths, formatFullDate, formatMonthTitle, monthGridMonday, yearMonthOf } from "@/lib/timezone";
import {
  APPOINTMENT_WISPR_EXAMPLES,
  APPOINTMENT_WISPR_HEADING,
  APPOINTMENT_WISPR_SUPPORT,
  APPOINTMENT_PAGE_LAYOUT,
  appointmentKind,
  appointmentLists,
  dateLabel,
  doctorDisplayName,
  kindLabel,
  listOnDate,
  reminderStatusLabel,
  validateAppointmentInput,
} from "@/lib/appointment-model";
import {
  SAMPLE_APPOINTMENT_BADGE,
  SAMPLE_APPOINTMENTS,
  SAMPLE_DOCTORS,
  SAMPLE_FAMILY,
  SAMPLE_PREVIEW_LABEL,
  SAMPLE_REFERENCE_DATE,
  hasLiveAppointments,
  isFixtureId,
  sampleChip,
  sampleMember,
  type FixtureAppointment,
} from "@/lib/demo/appointment-fixtures";
import { missingAppointmentFields, parseAppointment } from "@/lib/nlu";
import { familySwatch } from "@/lib/family-color";
import type { AppointmentDraft } from "@/lib/nlu";
import type { Appointment, FamilyDoctor, FamilyMember } from "@/lib/types";
import { Screen } from "@/components/shell/screen";
import { DOC_ICON } from "@/components/smaran/cards";
import { DetailRow, EmptyState, MemberAvatar, PageHeader, SectionLabel, StatusBadge, Surface } from "@/components/smaran/primitives";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { AppointmentDraftEditor } from "@/components/smaran/understood";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Tab = "calendar" | "upcoming" | "past" | "followups" | "doctors";

export function AppointmentsScreen() {
  const router = useRouter();
  const { state, session, update, refreshVault } = useStore();
  const liveToday = todayOf(state);
  const liveExists = hasLiveAppointments(state.appointments);
  const [samplePreview, setSamplePreview] = useState(!liveExists);
  const today = samplePreview ? SAMPLE_REFERENCE_DATE : liveToday;
  const [tab, setTab] = useState<Tab>("calendar");
  const [month, setMonth] = useState(() => yearMonthOf(today));
  const [selected, setSelected] = useState(today);
  const [sampleDetail, setSampleDetail] = useState<FixtureAppointment | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyApptDraft(state.family[0]?.id ?? "", today));
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctorDraft, setDoctorDraft] = useState({ name: "", specialty: "", category: "specialist" as FamilyDoctor["category"], clinic: "", address: "", phone: "", notes: "" });
  const [followFrom, setFollowFrom] = useState<Appointment | null>(null);
  const [followDate, setFollowDate] = useState("");
  const [followTime, setFollowTime] = useState("11:00");
  const [visitFor, setVisitFor] = useState<Appointment | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [wisprReview, setWisprReview] = useState<ReturnType<typeof parseAppointment> | null>(null);

  const records = samplePreview ? SAMPLE_APPOINTMENTS : state.appointments;
  const lists = useMemo(() => appointmentLists(records, today), [records, today]);
  const upcoming = lists.upcoming;
  const past = lists.past;
  const reviews = lists.reviews;
  const followups = lists.followups;
  const awaiting = lists.awaiting;
  const onDay = listOnDate(records, selected);
  const cells = useMemo(() => monthGridMonday(month), [month]);
  const busy = lists.busy;
  const upcomingGroups = lists.groups;
  const doctors = samplePreview ? SAMPLE_DOCTORS : state.doctors.filter((d) => !d.archived);
  const primaryDoctors = doctors.filter((d) => d.category === "primary");
  const specialistDoctors = doctors.filter((d) => d.category !== "primary");
  const persistence = session.authenticated ? "Saved to the family vault after a successful write." : "Saved on this device only — not cloud-saved.";
  const recent = past.slice(0, 4);
  const upcomingRail = upcoming.filter((a) => a.date !== today).slice(0, 2);

  function enterSample() {
    setSamplePreview(true);
    setSelected(SAMPLE_REFERENCE_DATE);
    setMonth(yearMonthOf(SAMPLE_REFERENCE_DATE));
    setTab("calendar");
  }

  function leaveSample() {
    setSamplePreview(false);
    setSelected(liveToday);
    setMonth(yearMonthOf(liveToday));
    setTab("calendar");
  }

  function openItem(a: Appointment) {
    if (samplePreview || isFixtureId(a.id) || a.source === "sample") {
      setSampleDetail(a);
      return;
    }
    router.push(`/appointments/${a.id}`);
  }

  function openNew(date = selected) {
    setEditId(null);
    setDraft(emptyApptDraft(state.family[0]?.id ?? "", date));
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(a: Appointment) {
    setEditId(a.id);
    setDraft({
      familyMemberId: a.familyMemberId,
      doctor: a.doctor,
      date: a.date,
      time: a.time,
      reminderOffsets: a.reminders.filter((r) => r.enabled).map((r) => r.offsetMinutes),
      clinic: a.clinic ?? "",
      address: a.location ?? "",
      purpose: a.purpose ?? "",
      notes: a.notes ?? "",
      followUpDate: a.followUpDate ?? "",
      doctorId: a.doctorId ?? "",
      doctorCategory: a.doctorCategory ?? "specialist",
      specialty: a.specialty ?? "",
      customReminder: "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function persistAppointment() {
    setSaving(true);
    setFormError(null);
    try {
      if (editId) {
        const errors = validateAppointmentInput(draft, state);
        if (errors.length) {
          setFormError(errors.join(" "));
          return;
        }
        update((s) => updateAppointment(s, editId, { doctor: draft.doctor, date: draft.date, time: draft.time, location: draft.address, notes: draft.notes, familyMemberId: draft.familyMemberId }));
      } else if (session.authenticated && isUuid(draft.familyMemberId)) {
        await createCloudAppointment({
          recipientId: draft.familyMemberId,
          doctor: draft.doctor,
          date: draft.date,
          time: draft.time,
          location: draft.address,
          notes: draft.notes,
          doctorId: draft.doctorId && isUuid(draft.doctorId) ? draft.doctorId : undefined,
          clinic: draft.clinic,
          purpose: draft.purpose,
          reminderOffsets: withCustomOffset(draft),
          followUpDate: draft.followUpDate,
        });
        const ok = await refreshVault();
        if (!ok) throw new Error("The server write could not be confirmed.");
      } else {
        const result = saveAppointment(state, { ...draft, reminderOffsets: withCustomOffset(draft) });
        if (!result.ok) {
          setFormError(result.errors.join(" "));
          return;
        }
        update(() => result.state);
      }
      toast.success(editId ? "Appointment updated." : "Appointment saved.");
      setFormOpen(false);
      setEditId(null);
      setSamplePreview(false);
      setSelected(draft.date);
      setMonth(yearMonthOf(draft.date));
      setTab("calendar");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div className="overflow-x-hidden">
      <PageHeader
        title="Family Appointments"
        subtitle="Every visit, every doctor, every follow-up."
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setTab("doctors")} className="h-10 rounded-full px-3.5 text-[13px] font-bold">
              <Stethoscope className="size-4" aria-hidden /> Manage doctors
            </Button>
            <Button type="button" onClick={() => openNew(today)} className="h-10 rounded-full bg-[#E8A98D] px-3.5 text-[13px] font-bold text-[#49352C] hover:bg-[#E8A98D]">
              <Plus className="size-4" aria-hidden /> New appointment
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {samplePreview ? (
          <>
            <span className="rounded-full bg-[#FBE4D7] px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#8F4538]">{SAMPLE_PREVIEW_LABEL}</span>
            <span className="rounded-full border border-[#F0D9CC] px-2.5 py-1 text-[11px] font-bold text-[#9A8173]">{SAMPLE_APPOINTMENT_BADGE}</span>
            <button type="button" className="text-[13px] font-bold text-[#C45C48] hover:underline" onClick={leaveSample}>Leave sample preview</button>
          </>
        ) : (
          <button type="button" className="text-[13px] font-bold text-[#C45C48] hover:underline" onClick={enterSample}>
            {liveExists ? "View sample preview" : "Try a sample preview"}
          </button>
        )}
      </div>
      <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <SummaryCard label="Upcoming" value={upcoming.length} hint={upcoming[0] ? `${upcoming[0].doctor} · ${dateLabel(upcoming[0].date, today)}` : "No upcoming visits"} icon={<CalendarClock className="size-4" />} accent="#FBE4D7" onClick={() => setTab("upcoming")} />
        <SummaryCard label="Awaiting follow-up" value={awaiting} hint={followups[0] ? `${followups[0].doctor} · ${followups[0].followUpDate ?? followups[0].date}` : "No open follow-ups"} icon={<CalendarRange className="size-4" />} accent="#F8EBD5" onClick={() => setTab("followups")} />
        <SummaryCard label="Past visits" value={past.length} hint={past[0] ? `${past[0].doctor} · ${past[0].date}` : "No completed visits"} icon={<CalendarCheck className="size-4" />} accent="#F3E6DC" onClick={() => setTab("past")} />
      </div>
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Appointment sections">
        {([["calendar", "Calendar"], ["upcoming", "Upcoming"], ["past", "Past visits"], ["followups", "Follow-ups"], ["doctors", "Doctors"]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("h-10 rounded-full px-3.5 text-[13px] font-bold", tab === key ? "bg-[#E8A98D] text-[#49352C]" : "border border-[#F0D9CC] bg-[#FFFCFA] text-[#9A8173]")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "calendar" && (
        <div className={cn("grid gap-4", APPOINTMENT_PAGE_LAYOUT.calendar)}>
          <Surface className="min-w-0 border-[#F0D9CC] bg-[#FFFCFA] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[20px] font-extrabold text-ink-strong">{formatMonthTitle(month)}</h2>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setMonth(addCalendarMonths(month, -1))} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => { setMonth(yearMonthOf(today)); setSelected(today); }}>Today</Button>
                <Button size="sm" variant="outline" onClick={() => setMonth(addCalendarMonths(month, 1))} aria-label="Next month"><ChevronRight className="size-4" /></Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-ink-muted">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {cells.map((cell) => {
                const isToday = cell.date === today;
                const isSelected = cell.date === selected;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    onClick={() => setSelected(cell.date)}
                    className={cn(
                      "relative flex min-h-12 flex-col items-center justify-center rounded-[14px] text-[13px] font-bold sm:min-h-14",
                      cell.inMonth ? "text-ink-strong" : "text-ink-muted/45",
                      isSelected && "bg-peach text-ink-strong",
                      isToday && !isSelected && "bg-[#F8E8DC] ring-2 ring-[#C45C48]/70",
                    )}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={isSelected}
                  >
                    {Number(cell.date.slice(8))}
                    {busy.has(cell.date) && <span className={cn("mt-1 size-1.5 rounded-full", isSelected ? "bg-[#5C3A2E]" : "bg-[#C45C48]")} aria-hidden />}
                  </button>
                );
              })}
            </div>
          </Surface>
          <section className="min-w-0">
            <h3 className="mb-2 text-[16px] font-extrabold text-ink-strong">{formatFullDate(selected)}</h3>
            {samplePreview && <p className="mb-2 text-[12px] font-bold text-[#9A8173]">{SAMPLE_APPOINTMENT_BADGE}</p>}
            {onDay.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[#F0D9CC] bg-[#FFFCFA] px-4 py-5">
                <p className="text-[15px] font-bold text-[#49352C]">No appointments on this day.</p>
                <p className="mt-1 text-[13px] leading-5 text-[#9A8173]">Select another date or create a new appointment.</p>
                <Button type="button" size="sm" className="mt-3 rounded-full bg-[#E8A98D] text-[#49352C] hover:bg-[#E8A98D]" onClick={() => openNew(selected)}>
                  <Plus className="size-4" /> New appointment
                </Button>
              </div>
            ) : (
              <DayTimeline items={onDay} sample={samplePreview} onOpen={openItem} />
            )}
          </section>
        </div>
      )}

      {tab === "upcoming" && (
        upcoming.length === 0 ? (
          <EmptyState icon={<CalendarX2 className="size-6" />} title="No upcoming appointments." body="Add a visit for someone already in this family." action={{ label: "New appointment", onClick: () => openNew(today) }} />
        ) : (
          <div className="space-y-6">
            {upcomingGroups.map((group) => (
              <section key={group.key}>
                <h3 className="mb-2 text-[13px] font-extrabold tracking-wide text-ink-muted uppercase">{group.label}</h3>
                <ul className="grid gap-3 md:grid-cols-2">{group.items.map((a) => <li key={a.id}><VisitCard appointment={a} today={today} sample={samplePreview} onOpen={() => openItem(a)} onEdit={samplePreview ? undefined : () => openEdit(a)} onCancel={samplePreview ? undefined : () => setConfirmCancel(a.id)} onComplete={samplePreview ? undefined : () => { setVisitFor(a); setVisitNotes(""); }} /></li>)}</ul>
              </section>
            ))}
          </div>
        )
      )}

      {tab === "past" && (
        past.length === 0 && reviews.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-6" />} title="No completed visits yet." body="Overdue visits stay as needs review until someone records what happened. Dates alone do not mark attendance." />
        ) : (
          <div className="space-y-6">
            {reviews.length > 0 && (
              <section>
                <h3 className="mb-2 text-[13px] font-extrabold tracking-wide text-ink-muted uppercase">Needs review</h3>
                <ul className="grid gap-3 md:grid-cols-2">{reviews.map((a) => <li key={a.id}><VisitCard appointment={a} today={today} sample={samplePreview} onOpen={() => openItem(a)} onEdit={samplePreview ? undefined : () => openEdit(a)} onCancel={samplePreview ? undefined : () => setConfirmCancel(a.id)} onComplete={samplePreview ? undefined : () => { setVisitFor(a); setVisitNotes(""); }} /></li>)}</ul>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h3 className="mb-2 text-[13px] font-extrabold tracking-wide text-ink-muted uppercase">Completed visits</h3>
                <ul className="grid gap-3 md:grid-cols-2">{past.map((a) => <li key={a.id}><VisitCard appointment={a} today={today} sample={samplePreview} onOpen={() => openItem(a)} onFollow={samplePreview ? undefined : () => { setFollowFrom(a); setFollowDate(a.followUpDate ?? ""); }} /></li>)}</ul>
              </section>
            )}
          </div>
        )
      )}

      {tab === "followups" && (
        followups.length === 0 ? (
          <EmptyState icon={<CalendarDays className="size-6" />} title="No follow-ups recorded." body="A follow-up needs a confirmed date. Passing a visit does not create one automatically." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">{followups.map((a) => <li key={a.id}><VisitCard appointment={a} today={today} sample={samplePreview} onOpen={() => openItem(a)} onEdit={samplePreview ? undefined : () => openEdit(a)} onFollow={samplePreview ? undefined : () => { setFollowFrom(a); setFollowDate(a.followUpDate ?? ""); }} /></li>)}</ul>
        )
      )}

      {tab === "doctors" && (
        <div className="space-y-6">
          {doctors.length === 0 ? (
            <EmptyState icon={<Stethoscope className="size-6" />} title="No doctors recorded." body="Add a doctor as written on the prescription or visit note. Names are never invented." action={{ label: "Add doctor", onClick: () => setDoctorOpen(true) }} />
          ) : (
            <>
              <DoctorGroup title="Primary doctor" doctors={primaryDoctors} empty="No primary doctor recorded." readOnly={samplePreview} />
              <DoctorGroup title="Specialist doctors" doctors={specialistDoctors} empty="No specialists recorded." readOnly={samplePreview} />
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Screen width="wide" aside={
      <>
        <SmaranSpeakBox
          context="appointments"
          stayOnPage
          examples={APPOINTMENT_WISPR_EXAMPLES}
          support={APPOINTMENT_WISPR_SUPPORT}
          onCapture={async (text) => {
            if (samplePreview) {
              return "Sample preview only — this did not save an appointment or send a notification.";
            }
            const parsed = parseAppointment(text, state.family, today);
            const missing = missingAppointmentFields(parsed);
            if (missing.length) {
              return `I need ${missing.join(", ").replace("memberId", "who it is for").replace("doctor", "the doctor").replace("date", "the date").replace("time", "the time")} before I can save. Nothing was created.`;
            }
            setWisprReview(parsed);
          }}
        />
        <p className="sr-only">{APPOINTMENT_WISPR_HEADING}</p>
        <RailCard title="Recent appointments" onViewAll={() => setTab("past")} sample={samplePreview} rows={recent} today={today} onOpen={openItem} />
        <RailCard title="Upcoming" onViewAll={() => setTab("upcoming")} sample={samplePreview} rows={upcomingRail} today={today} onOpen={openItem} />
        <p className="text-[13px] text-ink-muted">{persistence} Reminder rows are schedules, not delivered notifications.</p>
      </>
    }>
      {content}
      <Modal open={formOpen} onOpenChange={(open) => { setFormOpen(open); if (!open) setEditId(null); }} title={editId ? "Edit appointment" : "New appointment"} description="Enter only recorded details. The care recipient must be someone in this family." className="sm:max-w-xl" footer={
        <>
          <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
          <Button disabled={saving} onClick={() => void persistAppointment()}>{saving ? "Saving…" : editId ? "Save changes" : "Save appointment"}</Button>
        </>
      }>
        {formError && <p className="mb-3 text-[13.5px] font-semibold text-missed" role="alert">{formError}</p>}
        {samplePreview && <p className="mb-3 text-[13px] font-semibold text-[#8F4538]">This form saves a real appointment. It does not write the sample fixtures.</p>}
        <AppointmentForm draft={draft} people={state.family} doctors={state.doctors.filter((d) => !d.archived)} onChange={setDraft} />
      </Modal>
      <Modal open={Boolean(confirmCancel)} onOpenChange={(o) => !o && setConfirmCancel(null)} title="Cancel this appointment?" description="It will leave Upcoming and stay on the record as cancelled." footer={
        <>
          <Button variant="outline" onClick={() => setConfirmCancel(null)}>Keep</Button>
          <Button onClick={() => { if (confirmCancel) update((s) => setAppointmentStatus(s, confirmCancel, "cancelled")); setConfirmCancel(null); toast.success("Appointment cancelled."); }}>Cancel appointment</Button>
        </>
      } />
      <Modal open={doctorOpen} onOpenChange={setDoctorOpen} title="Add doctor" description="Reuse an existing name when it is the same person." footer={
        <>
          <Button variant="outline" onClick={() => setDoctorOpen(false)}>Cancel</Button>
          <Button onClick={() => {
            const result = upsertDoctor(state, { ...doctorDraft, recipientIds: [] });
            if (!result.ok) { toast.error(result.errors.join(" ")); return; }
            update(() => result.state);
            toast.success(result.reused ? "Existing doctor reused." : "Doctor saved.");
            setDoctorOpen(false);
          }}>Save doctor</Button>
        </>
      }>
        <div className="grid gap-3">
          <Field label="Doctor name"><Input value={doctorDraft.name} onChange={(e) => setDoctorDraft({ ...doctorDraft, name: e.target.value })} /></Field>
          <Field label="Specialty"><Input value={doctorDraft.specialty} onChange={(e) => setDoctorDraft({ ...doctorDraft, specialty: e.target.value })} placeholder="Leave blank if not recorded" /></Field>
          <Field label="Category">
            <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3" value={doctorDraft.category} onChange={(e) => setDoctorDraft({ ...doctorDraft, category: e.target.value as FamilyDoctor["category"] })}>
              <option value="primary">Primary doctor</option>
              <option value="specialist">Specialist</option>
            </select>
          </Field>
          <Field label="Clinic or hospital"><Input value={doctorDraft.clinic} onChange={(e) => setDoctorDraft({ ...doctorDraft, clinic: e.target.value })} /></Field>
          <Field label="Address"><Input value={doctorDraft.address} onChange={(e) => setDoctorDraft({ ...doctorDraft, address: e.target.value })} /></Field>
          <Field label="Contact"><Input value={doctorDraft.phone} onChange={(e) => setDoctorDraft({ ...doctorDraft, phone: e.target.value })} /></Field>
          <Field label="Visit notes"><Textarea value={doctorDraft.notes} onChange={(e) => setDoctorDraft({ ...doctorDraft, notes: e.target.value })} /></Field>
        </div>
      </Modal>
      <Modal open={Boolean(followFrom)} onOpenChange={(o) => !o && setFollowFrom(null)} title="Schedule follow-up" description="A confirmed date is required. This creates a new appointment, not a duplicate of the original visit." footer={
        <>
          <Button variant="outline" onClick={() => setFollowFrom(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!followFrom) return;
            const result = scheduleFollowUp(state, followFrom.id, followDate, followTime);
            if (!result.ok) { toast.error(result.errors.join(" ")); return; }
            update(() => result.state);
            setFollowFrom(null);
            toast.success("Follow-up saved.");
            setTab("calendar");
            setSelected(followDate);
            setMonth(yearMonthOf(followDate));
          }}>Save follow-up</Button>
        </>
      }>
        <Field label="Follow-up date"><Input type="date" value={followDate} onChange={(e) => setFollowDate(e.target.value)} /></Field>
        <Field label="Time"><Input type="time" value={followTime} onChange={(e) => setFollowTime(e.target.value)} /></Field>
      </Modal>
      <Modal open={Boolean(visitFor)} onOpenChange={(o) => !o && setVisitFor(null)} title="Record the visit" description="This is a family-entered account. It does not prove a doctor's instruction." footer={
        <>
          <Button variant="outline" onClick={() => setVisitFor(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!visitFor) return;
            update((s) => recordVisit(s, visitFor.id, { actualDate: visitFor.date, familyNotes: visitNotes }));
            setVisitFor(null);
            toast.success("Visit recorded.");
          }}>Mark attended</Button>
        </>
      }>
        <Field label="Family notes"><Textarea value={visitNotes} onChange={(e) => setVisitNotes(e.target.value)} /></Field>
      </Modal>
      <Modal open={Boolean(wisprReview)} onOpenChange={(o) => !o && setWisprReview(null)} title="Review appointment" description="Confirm these details before SMARAN saves anything." footer={
        <>
          <Button variant="outline" onClick={() => setWisprReview(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!wisprReview?.memberId || !wisprReview.doctor || !wisprReview.date || !wisprReview.time) return;
            const result = saveAppointment(state, {
              familyMemberId: wisprReview.memberId,
              doctor: wisprReview.doctor,
              date: wisprReview.date,
              time: wisprReview.time,
              address: wisprReview.location,
              notes: wisprReview.notes,
              reminderOffsets: wisprReview.reminderOffsets,
            });
            if (!result.ok) {
              toast.error(result.errors.join(" "));
              return;
            }
            update(() => result.state);
            setSelected(wisprReview.date);
            setMonth(yearMonthOf(wisprReview.date));
            setTab("calendar");
            setWisprReview(null);
            toast.success("Appointment saved.");
          }}>Confirm and save</Button>
        </>
      }>
        {wisprReview && (
          <dl className="space-y-2 text-[14px]">
            <div><dt className="text-ink-muted">For</dt><dd className="font-bold">{memberById(state, wisprReview.memberId ?? "")?.name ?? "Not recorded"}</dd></div>
            <div><dt className="text-ink-muted">Doctor</dt><dd className="font-bold">{wisprReview.doctor}</dd></div>
            <div><dt className="text-ink-muted">When</dt><dd className="font-bold">{wisprReview.date} · {wisprReview.time}</dd></div>
          </dl>
        )}
      </Modal>
      <Modal open={Boolean(sampleDetail)} onOpenChange={(o) => !o && setSampleDetail(null)} title={sampleDetail?.doctor ?? "Sample visit"} description={SAMPLE_APPOINTMENT_BADGE}>
        {sampleDetail && (
          <div className="space-y-2 text-[14px] text-[#49352C]">
            <p><span className="text-[#9A8173]">For </span>{sampleMember(sampleDetail.familyMemberId)?.name}</p>
            <p><span className="text-[#9A8173]">When </span>{sampleDetail.date} · {formatTime(sampleDetail.time)}</p>
            <p><span className="text-[#9A8173]">Clinic </span>{sampleDetail.clinic ?? "Not recorded"}</p>
            <p className="text-[13px] text-[#9A8173]">Demonstration only. Nothing was saved to the family vault.</p>
          </div>
        )}
      </Modal>
    </Screen>
  );
}

function emptyApptDraft(memberId: string, date: string) {
  return {
    familyMemberId: memberId,
    doctor: "",
    date,
    time: "11:00",
    reminderOffsets: [1440, 180],
    clinic: "",
    address: "",
    purpose: "",
    notes: "",
    followUpDate: "",
    doctorId: "",
    doctorCategory: "specialist" as FamilyDoctor["category"],
    specialty: "",
    customReminder: "",
  };
}

function SummaryCard({ label, value, hint, icon, accent, onClick }: { label: string; value: number; hint: string; icon: React.ReactNode; accent: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-[16px] border border-[#F0D9CC] bg-[#FFFCFA] px-3.5 py-3 text-left shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-[10px] text-[#49352C]" style={{ background: accent }}>{icon}</span>
        <p className="text-[12px] font-bold text-[#9A8173]">{label}</p>
      </div>
      <p className="mt-1 text-[26px] font-extrabold leading-none text-[#49352C]">{value}</p>
      <p className="mt-1 truncate text-[12px] text-[#9A8173]">{hint}</p>
    </button>
  );
}

function DayTimeline({ items, sample, onOpen }: { items: Appointment[]; sample: boolean; onOpen: (a: Appointment) => void }) {
  const { state } = useStore();
  return (
    <ol className="space-y-0">
      {items.map((a, i) => {
        const who = sample ? sampleMember(a.familyMemberId) : memberById(state, a.familyMemberId);
        const swatch = familySwatch(who);
        return (
          <li key={a.id} className="flex gap-3">
            <div className="w-16 shrink-0 pt-1 text-right text-[12px] font-bold text-[#9A8173]">{formatTime(a.time)}</div>
            <div className="flex w-4 shrink-0 flex-col items-center">
              <span className="mt-2 size-2.5 rounded-full" style={{ background: swatch.primary }} />
              {i < items.length - 1 && <span className="w-px flex-1 bg-[#F0D9CC]" />}
            </div>
            <button type="button" onClick={() => onOpen(a)} className="mb-3 min-w-0 flex-1 rounded-[16px] border border-[#F0D9CC] bg-[#FFFCFA] px-3 py-2.5 text-left">
              <div className="flex items-start gap-2">
                <MemberAvatar member={who} size={32} identity />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-extrabold text-[#49352C]">{a.doctor}</p>
                  <p className="text-[12.5px] font-semibold" style={{ color: swatch.text }}>{who?.name ?? a.familyMemberId} · {a.specialty || "Specialty not recorded"}</p>
                  <p className="text-[12px] text-[#9A8173]">{a.clinic || a.location || "Clinic not recorded"}</p>
                </div>
                <span className="rounded-full bg-[#FBE4D7] px-2 py-0.5 text-[11px] font-bold text-[#8F4538]">{sample ? sampleChip(a) : kindLabel(appointmentKind(a))}</span>
                <ChevronRight className="size-4 shrink-0 text-[#9A8173]" />
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function RailCard({ title, rows, today, sample, onViewAll, onOpen }: { title: string; rows: Appointment[]; today: string; sample: boolean; onViewAll: () => void; onOpen: (a: Appointment) => void }) {
  const { state } = useStore();
  return (
    <section className="rounded-[18px] border border-[#F0D9CC] bg-[#FFFCFA] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-extrabold text-[#49352C]">{title}</h3>
        <button type="button" className="text-[12.5px] font-bold text-[#C45C48] hover:underline" onClick={onViewAll}>View all</button>
      </div>
      {sample && <p className="mb-2 text-[11px] font-bold text-[#9A8173]">{SAMPLE_APPOINTMENT_BADGE}</p>}
      {rows.length === 0 ? <p className="text-[13px] text-[#9A8173]">Nothing to show.</p> : (
        <ul className="space-y-2">
          {rows.map((a) => {
            const who = sample ? sampleMember(a.familyMemberId) : memberById(state, a.familyMemberId);
            return (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(a)} className="flex w-full items-center gap-2 text-left">
                  <span className="inline-flex size-8 items-center justify-center rounded-[10px] bg-[#FBE4D7] text-[#8F4538]"><Stethoscope className="size-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold text-[#49352C]">{a.doctor}</span>
                    <span className="block truncate text-[12px] text-[#9A8173]">{who?.name ?? a.familyMemberId} · {dateLabel(a.date, today)} · {formatTime(a.time)}</span>
                  </span>
                  <ChevronRight className="size-4 text-[#9A8173]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function DoctorGroup({ title, doctors, empty, readOnly }: { title: string; doctors: FamilyDoctor[]; empty: string; readOnly?: boolean }) {
  const { state, update } = useStore();
  const people = readOnly ? SAMPLE_FAMILY : state.family;
  return (
    <section>
      <h3 className="mb-2 text-[13px] font-extrabold tracking-wide text-ink-muted uppercase">{title}</h3>
      {doctors.length === 0 ? <p className="text-[13.5px] text-ink-muted">{empty}</p> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {doctors.map((d) => (
            <li key={d.id}>
              <Surface className="p-4">
                <p className="text-[16px] font-extrabold text-ink-strong">{doctorDisplayName(d.name)} {d.source === "sample" && <span className="text-[12px] font-bold text-ink-muted">· sample</span>}</p>
                <p className="text-[13px] text-ink-muted">{d.category === "primary" ? "Primary doctor" : "Specialist"}{d.specialty ? ` · ${d.specialty}` : " · specialty not recorded"}</p>
                <p className="text-[13px] text-ink-muted">{d.clinic || "Clinic not recorded"}{d.address ? ` · ${d.address}` : ""}</p>
                <p className="text-[13px] text-ink-muted">{d.phone || "Contact not recorded"}</p>
                <p className="text-[12.5px] text-ink-muted">Used by {d.recipientIds.map((id) => people.find((m) => m.id === id)?.name).filter(Boolean).join(", ") || "not linked yet"}</p>
                <p className="mt-1 text-[12.5px] text-ink-muted">{(readOnly ? SAMPLE_APPOINTMENTS : state.appointments).filter((a) => a.doctorId === d.id || a.doctor === d.name).length} linked visit{(readOnly ? SAMPLE_APPOINTMENTS : state.appointments).filter((a) => a.doctorId === d.id || a.doctor === d.name).length === 1 ? "" : "s"}</p>
                {readOnly ? <p className="mt-2 text-[12px] font-bold text-[#9A8173]">{SAMPLE_APPOINTMENT_BADGE}</p> : <Button size="sm" variant="ghost" className="mt-2" onClick={() => update((s) => archiveDoctor(s, d.id))}>Archive</Button>}
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VisitCard({ appointment, today, sample, onCancel, onComplete, onFollow, onEdit, onOpen }: { appointment: Appointment; today: string; sample?: boolean; onCancel?: () => void; onComplete?: () => void; onFollow?: () => void; onEdit?: () => void; onOpen?: () => void }) {
  const { state } = useStore();
  const member = sample ? sampleMember(appointment.familyMemberId) : memberById(state, appointment.familyMemberId);
  const swatch = familySwatch(member);
  const kind = appointmentKind(appointment, today);
  const doctor = state.doctors.find((d) => d.id === appointment.doctorId);
  return (
    <Surface className="overflow-hidden p-4" style={{ borderLeft: `4px solid ${swatch.primary}` }}>
      <div className="flex items-start gap-3">
        <MemberAvatar member={member} size={40} identity />
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-extrabold break-words text-ink-strong">{doctorDisplayName(appointment.doctor)}{appointment.source === "sample" ? " · sample" : ""}</p>
          <p className="text-[13px] font-semibold" style={{ color: swatch.text }}>{member?.name ?? "Unknown recipient"}</p>
          <p className="text-[13px] text-ink-muted">
            {dateLabel(appointment.date, today)} · {appointment.date} · {formatTime(appointment.time)}
          </p>
          <p className="text-[13px] text-ink-muted">{appointment.clinic || appointment.location || "Location not recorded"}{appointment.specialty || doctor?.specialty ? ` · ${appointment.specialty || doctor?.specialty}` : ""}</p>
          <p className="text-[12.5px] text-ink-muted">{reminderStatusLabel(appointment)}</p>
          {appointment.followUpDate && <p className="text-[12.5px] text-ink-muted">Follow-up: {appointment.followUpDate}</p>}
          <StatusBadge status={kind === "completed" ? "completed" : kind === "cancelled" ? "cancelled" : kind === "needs_review" ? "waiting" : "upcoming"} label={kindLabel(kind)} className="mt-2" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {onOpen ? (
          <button type="button" onClick={onOpen} className="inline-flex h-9 items-center rounded-[12px] px-3 text-[13px] font-bold text-peach-deep hover:underline">View details</button>
        ) : (
          <Link href={`/appointments/${appointment.id}`} className="inline-flex h-9 items-center rounded-[12px] px-3 text-[13px] font-bold text-peach-deep hover:underline">View details</Link>
        )}
        {onEdit && kind !== "cancelled" && <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>}
        {onComplete && (kind === "upcoming" || kind === "needs_review") && <Button size="sm" variant="outline" onClick={onComplete}>Mark attended</Button>}
        {onCancel && (kind === "upcoming" || kind === "needs_review") && <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
        {onFollow && appointment.status === "completed" && <Button size="sm" variant="outline" onClick={onFollow}>Schedule follow-up</Button>}
      </div>
    </Surface>
  );
}

function AppointmentForm({ draft, people, doctors, onChange }: { draft: ReturnType<typeof emptyApptDraft>; people: FamilyMember[]; doctors: FamilyDoctor[]; onChange: (d: ReturnType<typeof emptyApptDraft>) => void }) {
  const set = (patch: Partial<typeof draft>) => onChange({ ...draft, ...patch });
  return (
    <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
      <Field label="Care recipient">
        <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3" value={draft.familyMemberId} onChange={(e) => set({ familyMemberId: e.target.value })}>
          <option value="">Select who this visit is for</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.relationship}</option>)}
        </select>
      </Field>
      <Field label="Doctor">
        <Input list="family-doctors" value={draft.doctor} onChange={(e) => {
          const match = doctors.find((d) => d.name === e.target.value);
          set({ doctor: e.target.value, doctorId: match?.id ?? "", specialty: match?.specialty ?? draft.specialty, clinic: match?.clinic ?? draft.clinic, doctorCategory: match?.category ?? draft.doctorCategory });
        }} />
        <datalist id="family-doctors">{doctors.map((d) => <option key={d.id} value={d.name} />)}</datalist>
      </Field>
      <Field label="Doctor category">
        <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3" value={draft.doctorCategory} onChange={(e) => set({ doctorCategory: e.target.value as FamilyDoctor["category"] })}>
          <option value="primary">Primary</option>
          <option value="specialist">Specialist</option>
        </select>
      </Field>
      <Field label="Hospital or clinic"><Input value={draft.clinic} onChange={(e) => set({ clinic: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date"><Input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Time"><Input type="time" value={draft.time} onChange={(e) => set({ time: e.target.value })} /></Field>
      </div>
      <Field label="Address"><Input value={draft.address} onChange={(e) => set({ address: e.target.value })} /></Field>
      <Field label="Purpose"><Input value={draft.purpose} onChange={(e) => set({ purpose: e.target.value })} /></Field>
      <Field label="Notes"><Textarea value={draft.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <fieldset>
        <legend className="mb-1 text-[13px] font-semibold text-ink-muted">Reminders</legend>
        {[0, 30, 1440].map((offset) => (
          <label key={offset} className="mr-3 inline-flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={draft.reminderOffsets.includes(offset)} onChange={(e) => set({ reminderOffsets: e.target.checked ? [...draft.reminderOffsets, offset] : draft.reminderOffsets.filter((x) => x !== offset) })} />
            {offset === 0 ? "At appointment time" : offset === 30 ? "30 minutes before" : "1 day before"}
          </label>
        ))}
        <p className="mt-1 text-[12px] text-ink-muted">These are saved reminder schedules. They are not delivered phone notifications unless the server notifier is configured.</p>
      </fieldset>
      <Field label="Custom reminder date and time">
        <Input type="datetime-local" value={draft.customReminder} onChange={(e) => set({ customReminder: e.target.value })} />
      </Field>
      <Field label="Follow-up date (optional)"><Input type="date" value={draft.followUpDate} onChange={(e) => set({ followUpDate: e.target.value })} /></Field>
    </div>
  );
}

function withCustomOffset(draft: ReturnType<typeof emptyApptDraft>): number[] {
  if (!draft.customReminder) return draft.reminderOffsets;
  const appt = Date.parse(`${draft.date}T${draft.time}`);
  const when = Date.parse(draft.customReminder);
  if (!Number.isFinite(appt) || !Number.isFinite(when)) return draft.reminderOffsets;
  return [...new Set([...draft.reminderOffsets, Math.round((appt - when) / 60000)])];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <Label className="mb-1.5">{label}</Label>
      {children}
    </div>
  );
}

const EXTRA_OFFSETS = [4320, 1440, 180, 60];

export function AppointmentDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const { state, session, update, refreshVault } = useStore();
  const { isWeb } = useView();
  const [editing, setEditing] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const appointment = state.appointments.find((a) => a.id === id);

  if (!appointment) {
    return (
      <Screen width="narrow">
        <PageHeader back="/appointments" title="Appointment" />
        <EmptyState icon={<CalendarDays className="size-6" />} title="We couldn't find this appointment." body="Tell SMARAN about it again and it'll be saved." action={{ label: "Add appointment", href: "/new?kind=appointment" }} />
      </Screen>
    );
  }

  const member = memberById(state, appointment.familyMemberId);
  const docs = appointment.documentIds.map((d) => state.documents.find((x) => x.id === d)).filter((d): d is NonNullable<typeof d> => !!d);
  const memberDocs = documentsFor(state, appointment.familyMemberId);
  const done = appointment.status === "completed";
  const at = stamp(appointment.date, appointment.time);

  const draft: AppointmentDraft = {
    transcript: "",
    memberId: appointment.familyMemberId,
    doctor: appointment.doctor,
    date: appointment.date,
    time: appointment.time,
    location: appointment.location,
    notes: appointment.notes,
    reminderOffsets: appointment.reminders.filter((r) => r.enabled).map((r) => r.offsetMinutes),
    assumptions: [],
  };

  const details = (
    <section>
      <SectionLabel>Appointment details</SectionLabel>
      <Surface className="px-5">
        <dl className="divide-y divide-line">
          <DetailRow label="Doctor">{appointment.doctor}</DetailRow>
          <DetailRow label="For">
            <Link href={`/family/${member?.id}`} className="inline-flex items-center gap-2 hover:underline">
              <MemberAvatar member={member} size={22} /> {member?.name}
            </Link>
          </DetailRow>
          <DetailRow label="Date">{formatDayShort(appointment.date)}</DetailRow>
          <DetailRow label="Time">{formatTime(appointment.time)}</DetailRow>
          <DetailRow label="Location">{appointment.location ?? <span className="text-ink-muted">Not added</span>}</DetailRow>
        </dl>
        {appointment.notes && (
          <div className="border-t border-line py-4">
            <div className="text-[13px] text-ink-muted">Note</div>
            <p className="mt-1 text-[15.5px] font-semibold text-ink-strong">{appointment.notes}</p>
          </div>
        )}
      </Surface>
    </section>
  );

  const documents = (
    <section>
      <SectionLabel
        action={
          <button type="button" onClick={() => setAttaching(true)} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-peach-deep hover:underline">
            <Paperclip className="size-3.5" aria-hidden /> Attach
          </button>
        }
      >
        Documents
      </SectionLabel>
      {docs.length ? (
        <Surface className="divide-y divide-line px-4">
          {docs.map((d) => {
            const Icon = DOC_ICON[d.type];
            return (
              <div key={d.id} className="flex items-center gap-3 py-3">
                <span className="flex size-10 items-center justify-center rounded-[12px] bg-peach-soft/60 text-peach-deep">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <Link href={`/documents/${d.id}`} className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-[15px] font-bold text-ink-strong">{d.name}</span>
                  <span className="block text-[13px] text-ink-muted">{formatShort(d.date)}</span>
                </Link>
                <button
                  type="button"
                  aria-label={`Detach ${d.name}`}
                  onClick={() => {
                    update((s) => linkDocument(s, d.id, undefined));
                    toast(`${d.name} detached`);
                  }}
                  className="inline-flex size-8 items-center justify-center rounded-full text-ink-muted hover:bg-ivory-deep"
                >
                  <X className="size-4" />
                </button>
              </div>
            );
          })}
        </Surface>
      ) : (
        <button type="button" onClick={() => setAttaching(true)} className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-line-strong bg-surface/60 px-4 py-5 text-[14.5px] font-semibold text-ink-muted hover:border-peach">
          <Paperclip className="size-4" aria-hidden /> Attach reports or prescriptions to bring
        </button>
      )}
    </section>
  );

  const reminders = (
    <section>
      <SectionLabel>Reminders</SectionLabel>
      <Surface className="divide-y divide-line px-4">
        {appointment.reminders.map((r) => (
          <label key={r.id} className="flex cursor-pointer items-center gap-3 py-3.5">
            <span className="flex-1">
              <span className="block text-[15px] font-bold text-ink-strong">{r.label}</span>
              <span className="block text-[13px] text-ink-muted">
                {formatShort(dateOf(addMinutes(at, -r.offsetMinutes)))} · {formatTime(timeOf(addMinutes(at, -r.offsetMinutes)))}
              </span>
            </span>
            <Switch checked={r.enabled} disabled={done} onCheckedChange={() => update((s) => toggleAppointmentReminder(s, appointment.id, r.id))} aria-label={`Remind ${r.label}`} />
          </label>
        ))}
        {appointment.reminders.length === 0 && <p className="py-4 text-[14px] text-ink-muted">No reminders set.</p>}
      </Surface>
      {!done && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXTRA_OFFSETS.filter((o) => !appointment.reminders.some((r) => r.offsetMinutes === o)).map((o) => (
            <button key={o} type="button" onClick={() => update((s) => addAppointmentReminder(s, appointment.id, o))} className="inline-flex h-8 items-center gap-1 rounded-full border border-line-strong bg-surface-raised px-3 text-[12.5px] font-bold text-ink hover:border-peach">
              <Plus className="size-3.5" aria-hidden /> {formatOffset(o)}
            </button>
          ))}
        </div>
      )}
    </section>
  );

  const actions = (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden /> Edit
      </Button>
      <Button
        variant={done ? "outline" : "secondary"}
        onClick={async () => {
          try {
            if (session.authenticated && isUuid(appointment.id)) {
              await patchAppointment(appointment.id, done ? "upcoming" : "complete");
              const ok = await refreshVault();
              if (!ok) throw new Error("Saved on the server, but the vault did not refresh.");
            } else {
              update((s) => setAppointmentStatus(s, appointment.id, done ? "upcoming" : "completed"));
            }
            toast.success(done ? "Marked as upcoming" : `${appointment.doctor} appointment completed`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "The appointment was not changed.");
          }
        }}
      >
        <CheckCircle2 className="size-4" aria-hidden /> {done ? "Mark upcoming" : "Mark done"}
      </Button>
      {appointment.status !== "cancelled" && (
        <Button
          variant="outline"
          className="col-span-2"
          onClick={async () => {
            try {
              if (session.authenticated && isUuid(appointment.id)) {
                await patchAppointment(appointment.id, "cancel");
                const ok = await refreshVault();
                if (!ok) throw new Error("Saved on the server, but the vault did not refresh.");
              } else {
                update((s) => setAppointmentStatus(s, appointment.id, "cancelled"));
              }
              toast.success("Appointment cancelled");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "The appointment was not cancelled.");
            }
          }}
        >
          Cancel appointment
        </Button>
      )}
    </div>
  );

  const hero = (
    <Surface className="mb-7 flex items-center gap-4 p-5">
      <div className={cn("flex size-16 shrink-0 flex-col items-center justify-center rounded-[18px]", done ? "bg-paused-bg text-brown" : "bg-peach-soft/70 text-ink-strong")}>
        <span className="text-[11px] font-extrabold tracking-wider uppercase">{formatShort(appointment.date).split(" ")[0]}</span>
        <span className="text-[24px] leading-none font-extrabold">{formatShort(appointment.date).split(" ")[1]}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[18px] font-extrabold text-ink-strong">
          {formatDayLong(appointment.date)} · {formatTime(appointment.time)}
        </div>
        {appointment.location && (
          <div className="mt-0.5 flex items-center gap-1.5 text-[14px] text-ink-muted">
            <MapPin className="size-3.5" aria-hidden /> {appointment.location}
          </div>
        )}
      </div>
      <StatusBadge status={done ? "completed" : "upcoming"} />
    </Surface>
  );

  const dialogs = (
    <>
      <AppointmentDraftEditor
        open={editing}
        onOpenChange={setEditing}
        draft={draft}
        family={state.family}
        onSave={(d) => {
          update((s) => {
            let next = updateAppointment(s, appointment.id, { doctor: d.doctor, date: d.date, time: d.time, location: d.location, familyMemberId: d.memberId });
            for (const o of d.reminderOffsets) next = addAppointmentReminder(next, appointment.id, o);
            const appt = next.appointments.find((a) => a.id === appointment.id)!;
            for (const r of appt.reminders) {
              if (r.enabled !== d.reminderOffsets.includes(r.offsetMinutes)) next = toggleAppointmentReminder(next, appointment.id, r.id);
            }
            return next;
          });
          toast.success("Appointment updated");
        }}
      />
      <Modal open={attaching} onOpenChange={setAttaching} title="Attach documents" description={`${member?.name}'s documents. Attached ones will be ready for ${appointment.doctor}.`}>
        <ul className="space-y-2">
          {memberDocs.map((d) => {
            const on = appointment.documentIds.includes(d.id);
            const Icon = DOC_ICON[d.type];
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => update((s) => linkDocument(s, d.id, on ? undefined : appointment.id))}
                  className={cn("flex w-full items-center gap-3 rounded-[16px] border p-3 text-left transition-colors", on ? "border-peach bg-peach-soft/30" : "border-line bg-surface-raised hover:border-line-strong")}
                >
                  <Icon className="size-5 text-peach-deep" aria-hidden />
                  <span className="flex-1">
                    <span className="block text-[15px] font-bold text-ink-strong">{d.name}</span>
                    <span className="block text-[12.5px] text-ink-muted">
                      {formatShort(d.date)}
                      {d.linkedAppointmentId && d.linkedAppointmentId !== appointment.id ? " · attached to another visit" : ""}
                    </span>
                  </span>
                  <span className={cn("flex size-6 items-center justify-center rounded-full", on ? "bg-peach text-ink-strong" : "border-2 border-line-strong")}>{on && <Check className="size-3.5" strokeWidth={3} />}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <Link href={`/documents/upload?appointment=${appointment.id}`} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-strong text-[14px] font-bold text-ink hover:border-peach">
          <Upload className="size-4" aria-hidden /> Upload a new document
        </Link>
      </Modal>
    </>
  );

  const header = <PageHeader back="/appointments" eyebrow={`${member?.name}'s appointment`} title={appointment.doctor} />;

  if (isWeb) {
    return (
      <Screen
        aside={
          <>
            {reminders}
            <div>
              <SectionLabel>Manage</SectionLabel>
              {actions}
            </div>
          </>
        }
      >
        {header}
        {hero}
        <div className="space-y-8">
          {details}
          {documents}
        </div>
        {dialogs}
      </Screen>
    );
  }
  return (
    <Screen>
      {header}
      {hero}
      <div className="space-y-7">
        {details}
        {documents}
        {reminders}
        {actions}
      </div>
      {dialogs}
    </Screen>
  );
}

