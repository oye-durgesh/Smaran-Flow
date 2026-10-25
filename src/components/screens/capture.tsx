"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, CheckCircle2, Info, Paperclip, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store/store";
import { useView } from "@/lib/store/view";
import {
  classifySmaranIntent,
  missingAppointmentFields,
  missingReminderFields,
  parseAppointment,
  parseReminder,
  refineAppointment,
  refineReminder,
  type AppointmentDraft,
  type ReminderDraft,
} from "@/lib/nlu";
import { zonedNow } from "@/lib/timezone";
import { createAppointment, createReminder } from "@/lib/store/actions";
import { createCloudAppointment, createCloudReminder, isUuid } from "@/lib/store/cloud";
import { describeReminder, documentsFor, memberById } from "@/lib/selectors";
import { formatDayLong, formatShort, formatTime } from "@/lib/dates";
import { Screen } from "@/components/shell/screen";
import { useSendReminderNow } from "@/components/shell/use-send-reminder";
import { PageHeader, SectionLabel, Surface } from "@/components/smaran/primitives";
import { WisprFlowInput } from "@/components/smaran/wispr-flow-input";
import { SmaranSpeakBox } from "@/components/smaran/smaran-speak-box";
import { ProcessingState } from "@/components/smaran/processing-state";
import { AppointmentUnderstood, ReminderUnderstood } from "@/components/smaran/understood";
import { Button } from "@/components/ui/button";

const EXAMPLES = {
  reminder: ["Mummy ko roz raat 9 baje BP ki medicine yaad dilani hai.", "Papa ko subah 8 baje sugar ki dawai yaad dilana.", "Mummy ka BP check roz subah 10 baje."],
  appointment: ["Mummy ka Dr Sharma ke saath Friday ko 11 baje appointment hai. Teen din pehle yaad dila dena.", "Papa ka kal shaam 5 baje Dr Mehta ke saath checkup hai at Apollo Hospital."],
};

type Kind = "reminder" | "appointment" | "medicine" | "pickup" | "check";
type Phase = "input" | "processing" | "review" | "done";

const FOLLOW_UP: Record<string, (name?: string) => string> = {
  memberId: () => "Who is this for?",
  title: (n) => `What should I remind ${n ?? "them"} about?`,
  time: (n) => `What time should I remind ${n ?? "them"}?`,
  doctor: () => "Which doctor is the appointment with?",
  date: () => "Which day is the appointment?",
  frequency: () => "Is this once, every day, or weekly? I will not guess.",
};

export function CaptureScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { state, session, commit, refreshVault } = useStore();
  const { isWeb } = useView();
  const sendNow = useSendReminderNow();
  const today = zonedNow().date;

  const initialText = params.get("text");
  const fixedKind = (params.get("kind") as Kind | null) ?? null;
  const initial = useMemo(() => {
    if (!initialText) return null;
    const smaran = classifySmaranIntent(initialText);
    const intent =
      fixedKind === "appointment" || smaran === "appointment_create_or_update"
        ? "appointment"
        : smaran === "ask_question" || smaran === "document_question"
          ? "question"
          : smaran === "unknown"
            ? "unknown"
            : smaran === "health_measurement"
              ? "health"
              : "reminder";
    return { text: initialText, intent, smaran };
  }, [initialText, fixedKind]);

  const [kind, setKind] = useState<Kind>(initial && initial.intent === "appointment" ? "appointment" : fixedKind ?? "reminder");
  const [phase, setPhase] = useState<Phase>(initial && (initial.intent === "appointment" || initial.intent === "reminder") ? "review" : "input");
  const [reminder, setReminder] = useState<ReminderDraft | null>(() => (initial?.intent === "reminder" ? parseReminder(initial.text, state.family, today, { inventFrequency: false, inventTitle: false }) : null));
  const [appointment, setAppointment] = useState<AppointmentDraft | null>(() => (initial?.intent === "appointment" ? parseAppointment(initial.text, state.family, today) : null));
  const [unknownNote, setUnknownNote] = useState<string | null>(initial?.intent === "unknown" ? "That did not match a safe action. Nothing was created." : null);
  const [docIds, setDocIds] = useState<string[]>([]);
  const [result, setResult] = useState<{ id: string; merged: boolean } | null>(null);

  useEffect(() => {
    if (initial?.intent === "question") router.replace(`/ask?q=${encodeURIComponent(initial.text)}`);
  }, [initial, router]);

  const onDone = useCallback(() => setPhase("review"), []);

  const submit = (text: string) => {
    const smaran = classifySmaranIntent(text);
    if (smaran === "unknown") {
      setUnknownNote("That did not match a safe action. Nothing was created.");
      return;
    }
    if (smaran === "health_measurement") return;
    if (smaran === "ask_question" || smaran === "document_question") {
      router.push(`/ask?q=${encodeURIComponent(text)}`);
      return;
    }
    setUnknownNote(null);
    if (smaran === "appointment_create_or_update" || fixedKind === "appointment") {
      setKind("appointment");
      setAppointment(parseAppointment(text, state.family, today));
      setReminder(null);
    } else {
      const draft = parseReminder(text, state.family, today, { inventFrequency: false, inventTitle: false });
      if (smaran === "pickup_reminder") draft.kind = "pickup";
      if (smaran === "medicine_reminder") draft.kind = "medicine";
      if (smaran === "health_check_reminder") draft.kind = "check";
      setKind(smaran === "pickup_reminder" ? "pickup" : smaran === "health_check_reminder" ? "check" : "medicine");
      setReminder(draft);
      setAppointment(null);
    }
    setDocIds([]);
    setPhase("review");
  };

  const isReminder = kind !== "appointment";
  const followUp = (text: string) => {
    if (isReminder && reminder) setReminder(refineReminder(reminder, text, state.family, today));
    if (kind === "appointment" && appointment) setAppointment(refineAppointment(appointment, text, state.family, today));
  };

  const missing = isReminder ? (reminder ? missingReminderFields(reminder) : []) : appointment ? missingAppointmentFields(appointment) : [];
  const draftMember = memberById(state, isReminder ? reminder?.memberId : appointment?.memberId);
  const transcript = isReminder ? reminder?.transcript : appointment?.transcript;
  const duplicate =
    isReminder && reminder?.memberId && reminder.title
      ? state.reminders.find((r) => r.familyMemberId === reminder.memberId && r.title.toLowerCase() === reminder.title!.toLowerCase())
      : kind === "appointment" && appointment?.memberId && appointment.doctor && appointment.date
        ? state.appointments.find((a) => a.familyMemberId === appointment.memberId && a.doctor === appointment.doctor && a.date === appointment.date && a.status === "upcoming")
        : undefined;

  const create = async () => {
    if (missing.length) return;
    try {
      if (isReminder && reminder) {
        if (session.authenticated && isUuid(reminder.memberId)) {
          await createCloudReminder({
            recipientId: reminder.memberId!,
            title: reminder.title!,
            kind: reminder.kind ?? "other",
            time: reminder.time!,
            date: reminder.date,
            recurrence: reminder.frequency ?? "once",
            medicineName: reminder.medicineName,
          });
          const ok = await refreshVault();
          if (!ok) throw new Error("Saved on the server, but the vault did not refresh.");
          setResult({ id: "cloud", merged: false });
        } else {
          const res = commit((s) => {
            const r = createReminder(s, reminder as Required<Pick<ReminderDraft, "memberId" | "title" | "time">> & ReminderDraft);
            return [r.state, { id: r.id, merged: r.merged }];
          });
          setResult(res);
        }
        setPhase("done");
      }
      if (kind === "appointment" && appointment) {
        if (session.authenticated && isUuid(appointment.memberId)) {
          await createCloudAppointment({
            recipientId: appointment.memberId!,
            doctor: appointment.doctor!,
            date: appointment.date!,
            time: appointment.time!,
            location: appointment.location,
            notes: appointment.notes,
          });
          const ok = await refreshVault();
          if (!ok) throw new Error("Saved on the server, but the vault did not refresh.");
          setResult({ id: "cloud", merged: false });
        } else {
          const res = commit((s) => {
            const r = createAppointment(s, appointment as Required<Pick<AppointmentDraft, "memberId" | "doctor" | "date" | "time">> & AppointmentDraft, docIds);
            return [r.state, { id: r.id, merged: r.merged }];
          });
          setResult(res);
        }
        setPhase("done");
        if (docIds.length) toast.success(`${docIds.length} document${docIds.length === 1 ? "" : "s"} attached`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nothing was saved.");
    }
  };

  const restart = () => {
    setPhase("input");
    setReminder(null);
    setAppointment(null);
    setResult(null);
    router.replace(fixedKind ? `/new?kind=${fixedKind}` : "/new");
  };

  /* ---------- phases ---------- */

  let body: React.ReactNode;
  let footer: React.ReactNode;

  if (phase === "input") {
    body = (
      <>
        <PageHeader
          back="/today"
          eyebrow={kind === "appointment" ? "New appointment" : "New memory"}
          title={kind === "appointment" ? "Tell SMARAN about the appointment." : "What should SMARAN remember?"}
          subtitle="Say it the way you'd say it to family. SMARAN will pull out the details for you to check."
        />
        <SmaranSpeakBox context={kind === "appointment" ? "appointments" : "general"} onCapture={submit} />
        {unknownNote && <p role="status" className="mt-3 rounded-[16px] bg-sand/50 px-4 py-3 text-[14px] font-semibold text-ink">{unknownNote}</p>}
        {!fixedKind && (
          <p className="mt-4 text-center text-[13px] text-ink-muted">
            Works for medicines, checks, pickups and doctor appointments — in Hindi, English or both. Unknown text is not saved as a reminder.
          </p>
        )}
      </>
    );
  } else if (phase === "processing") {
    body = (
      <>
        <PageHeader eyebrow="Review" title="Checking the details you typed…" />
        <ProcessingState
          transcript={transcript}
          steps={["Reading your words", "Aligning the details", kind === "appointment" ? "Preparing your appointment" : "Preparing your reminder"]}
          layout={isWeb ? "horizontal" : "vertical"}
          stepMs={0}
          onDone={onDone}
        />
      </>
    );
  } else if (phase === "review") {
    const memberDocs = draftMember ? documentsFor(state, draftMember.id) : [];
    body = (
      <>
        <PageHeader eyebrow="SMARAN understood" title={missing.length ? "Almost there." : "I understood."} subtitle={missing.length ? "I need a little more information before saving this." : "Check the details. Tap any of them to change it."} />
        <blockquote className="mb-5 rounded-[20px] border border-line bg-surface px-5 py-4 text-[16px] leading-relaxed font-semibold text-ink-strong">
          <span className="mb-1 block text-[11px] font-extrabold tracking-[0.18em] text-ink-muted uppercase">You said</span>“{transcript}”
        </blockquote>
        <Surface className="p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 text-[12px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">
            <CheckCircle2 className="size-4 text-confirmed" aria-hidden /> {kind === "appointment" ? "Appointment" : "Reminder"}
          </div>
          {isReminder && reminder && <ReminderUnderstood draft={reminder} family={state.family} onChange={setReminder} columns={isWeb ? 4 : 2} />}
          {kind === "appointment" && appointment && <AppointmentUnderstood draft={appointment} family={state.family} onChange={setAppointment} />}
          {duplicate && !missing.length && (
            <p className="mt-4 flex items-start gap-2 rounded-[14px] bg-sand/50 px-3 py-2.5 text-[13.5px] text-ink">
              <Info className="mt-0.5 size-4 shrink-0 text-brown" aria-hidden />
              {isReminder
                ? `${draftMember?.name} already has ${reminder?.title}. SMARAN will update it and keep its confirmation history.`
                : `${draftMember?.name} already has this appointment. SMARAN will update it with what you said.`}
            </p>
          )}
        </Surface>

        {missing.length > 0 && (
          <div className="mt-5 animate-rise">
            <p className="mb-3 text-[16px] font-bold text-ink-strong">{FOLLOW_UP[missing[0]]?.(draftMember?.name)}</p>
            <WisprFlowInput
              variant="composer"
              placeholder={missing[0] === "time" ? "e.g. raat 9 baje" : missing[0] === "memberId" ? "e.g. Mummy" : missing[0] === "date" ? "e.g. Friday" : "Say the missing detail..."}
              examples={missing[0] === "time" ? ["Raat 9 baje"] : missing[0] === "memberId" ? state.family.slice(0, 2).map((m) => m.name) : missing[0] === "date" ? ["Friday ko"] : []}
              examplesLabel="Answer"
              onSubmit={followUp}
            />
          </div>
        )}

        {kind === "appointment" && memberDocs.length > 0 && !missing.length && (
          <section className="mt-6">
            <SectionLabel>Attach documents (optional)</SectionLabel>
            <ul className="flex flex-wrap gap-2">
              {memberDocs.slice(0, 6).map((d) => {
                const on = docIds.includes(d.id);
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDocIds(on ? docIds.filter((x) => x !== d.id) : [...docIds, d.id])}
                      className={cn("inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold transition-colors", on ? "border-peach bg-peach-soft/60 text-ink-strong" : "border-line-strong bg-surface-raised text-ink")}
                    >
                      {on ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Paperclip className="size-4" aria-hidden />}
                      {d.name} · {formatShort(d.date)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </>
    );
    footer = (
      <div className={cn("flex gap-3", isWeb ? "justify-end" : "flex-col-reverse")}>
        <Button variant="outline" size="lg" onClick={restart} className={cn(!isWeb && "w-full")}>
          <RotateCcw className="size-4" aria-hidden /> Speak again
        </Button>
        <Button size="lg" onClick={create} disabled={missing.length > 0} className={cn(!isWeb && "w-full")}>
          {kind === "appointment" ? (duplicate ? "Update appointment" : "Create appointment") : duplicate ? "Update reminder" : "Create reminder"}
        </Button>
      </div>
    );
  } else if (phase === "done" && result) {
    const r = isReminder ? state.reminders.find((x) => x.id === result.id) : undefined;
    const a = kind === "appointment" ? state.appointments.find((x) => x.id === result.id) : undefined;
    const member = memberById(state, r?.familyMemberId ?? a?.familyMemberId);
    body = (
      <div className={cn("flex flex-col items-center text-center", isWeb ? "pt-16" : "pt-14")} role="status">
        <span className="flex size-20 items-center justify-center rounded-full bg-confirmed text-white animate-pop">
          <Check className="size-10" strokeWidth={3} aria-hidden />
        </span>
        <h1 className="mt-6 text-[30px] font-extrabold text-ink-strong">
          {isReminder ? (result.merged ? "Reminder updated" : "Reminder created") : result.merged ? "Appointment updated" : "Appointment saved"}
        </h1>
        {r && (
          <p className="mt-2 text-[17px] text-ink-muted">
            {member?.name}&apos;s {r.title.toLowerCase()}
            <br />
            <b className="text-ink-strong">{describeReminder(r)}</b>
          </p>
        )}
        {a && (
          <p className="mt-2 text-[17px] text-ink-muted">
            {member?.name} with {a.doctor}
            <br />
            <b className="text-ink-strong">
              {formatDayLong(a.date)} · {formatTime(a.time)}
            </b>
          </p>
        )}
        <p className="mt-4 max-w-sm text-[14px] text-ink-muted">Saved to Today, {member?.name}&apos;s Health Card and your family memory.</p>
        <div className={cn("mt-8 flex w-full gap-3", isWeb ? "max-w-md" : "flex-col")}>
          {r ? (
            <>
              <Link href={`/reminders/${r.id}`} className="flex h-13 flex-1 items-center justify-center rounded-[16px] bg-peach text-[16px] font-bold text-ink-strong hover:bg-[#e29c7e]">
                View reminder
              </Link>
              <Link href="/today" className="flex h-13 flex-1 items-center justify-center rounded-[16px] border border-line-strong bg-surface-raised text-[16px] font-bold text-ink hover:bg-ivory-deep">
                Back to today
              </Link>
            </>
          ) : (
            a && (
              <>
                <Link href={`/appointments/${a.id}`} className="flex h-13 flex-1 items-center justify-center rounded-[16px] bg-peach text-[16px] font-bold text-ink-strong hover:bg-[#e29c7e]">
                  View appointment
                </Link>
                <Link href="/appointments" className="flex h-13 flex-1 items-center justify-center rounded-[16px] border border-line-strong bg-surface-raised text-[16px] font-bold text-ink hover:bg-ivory-deep">
                  All appointments
                </Link>
              </>
            )
          )}
        </div>
        {r && r.frequency !== "once" && (
          <button
            type="button"
            onClick={() => {
              router.push("/today");
              sendNow(r.id);
            }}
            className="mt-5 text-[14px] font-bold text-peach-deep hover:underline"
          >
            Don&apos;t wait for {formatTime(r.time)} — send it to {member?.name} now
          </button>
        )}
      </div>
    );
  }

  const aside =
    isWeb && phase !== "done" ? (
      <>
        <div>
          <SectionLabel>You can say things like</SectionLabel>
          <ul className="space-y-2">
            {[...EXAMPLES.reminder, ...EXAMPLES.appointment].map((e) => (
              <li key={e} className="rounded-[16px] border border-line bg-surface-raised px-4 py-3 text-[14px] leading-snug text-ink">
                “{e}”
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[18px] bg-sand/40 p-4 text-[13.5px] leading-relaxed text-ink">
          SMARAN reads your words on this device with simple rules — no audio or text leaves the browser. Anything it isn&apos;t sure about, it asks.
        </div>
      </>
    ) : undefined;

  return (
    <Screen width="narrow" aside={aside} footer={footer}>
      {body}
    </Screen>
  );
}
