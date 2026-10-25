"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store/store";
import { createCloudHealthRecord, createCloudMeasurement, isUuid } from "@/lib/store/cloud";
import { recordMeasurement, saveDiary, saveHistory, saveVaccination } from "@/lib/store/health-record-actions";
import { familySwatch } from "@/lib/family-color";
import { lastUpdatedFor, latestMeasurement, measurementsFor } from "@/lib/selectors";
import { lastUpdatedLabel } from "@/components/smaran/health-card";
import {
  bpSeries,
  diaryFor,
  documentCategory,
  emptyHealthSections,
  glucoseSeries,
  glucoseUnitsInRange,
  healthTabs,
  numericSeries,
  historyFor,
  latestDisplay,
  NOT_RECORDED,
  personDocuments,
  personTimeline,
  vaccinationStatus,
  vaccinationsFor,
  type ChartRange,
} from "@/lib/health-record-model";
import { pastVisits, upcomingVisits } from "@/lib/appointment-model";
import { currentMedicines } from "@/lib/medicine-model";
import type { FamilyMember, HistoryCategory, MeasurementKind } from "@/lib/types";
import { zonedNow } from "@/lib/timezone";
import { EmptyState, MemberAvatar, PageHeader, Surface } from "@/components/smaran/primitives";
import { TrendChart } from "@/components/smaran/trend-chart";
import { Modal } from "@/components/smaran/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Tab = ReturnType<typeof healthTabs>[number]["key"];
type AddKind = "measurement" | "history" | "document" | "vaccination" | "diary" | "appointment";

export function HealthRecordView({ member }: { member: FamilyMember }) {
  const { state, update, session, refreshVault } = useStore();
  const router = useRouter();
  const swatch = familySwatch(member);
  const [tab, setTab] = useState<Tab>("overview");
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<AddKind | null>(null);
  const [range, setRange] = useState<ChartRange>("90d");
  const [weekly, setWeekly] = useState(false);
  const [docQuery, setDocQuery] = useState("");
  const [docCat, setDocCat] = useState("all");
  const [warning, setWarning] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [mForm, setMForm] = useState({ kind: "blood_pressure" as MeasurementKind, value: "", systolic: "", diastolic: "", unit: "mmHg", context: "", note: "", recordedAt: zonedNow().timestamp });
  const [hForm, setHForm] = useState({ category: "illness" as HistoryCategory, name: "", status: "", startDate: "", notes: "", hospital: "", relationship: "" });
  const [vForm, setVForm] = useState({ name: "", dose: "", receivedDate: "", nextDueDate: "", clinic: "", notes: "" });
  const [dForm, setDForm] = useState({ title: "", body: "" });

  const empty = emptyHealthSections(state, member.id);
  const bp = latestDisplay(latestMeasurement(state, member.id, "blood_pressure"));
  const sugar = latestDisplay(latestMeasurement(state, member.id, "blood_sugar"));
  const nextAppt = upcomingVisits(state, member.id)[0];
  const history = historyFor(state, member.id);
  const docs = personDocuments(state, member.id).filter((d) => {
    if (docCat !== "all" && documentCategory(d.name, d.type) !== docCat) return false;
    if (docQuery && !`${d.name} ${d.metadata.description ?? ""} ${d.file.name}`.toLowerCase().includes(docQuery.toLowerCase())) return false;
    return true;
  });
  const glucoseUnits = glucoseUnitsInRange(state, member.id, range);
  const glucoseUnit = glucoseUnits[0];
  const sys = bpSeries(state, member.id, range, weekly);
  const dia = sys.map((p) => ({ ...p, value: p.extra ?? p.value }));
  const glu = glucoseUnit ? glucoseSeries(state, member.id, range, weekly, glucoseUnit) : [];
  const hr = numericSeries(state, member.id, "heart_rate", range, weekly);
  const wt = numericSeries(state, member.id, "weight", range, weekly);
  const temp = numericSeries(state, member.id, "temperature", range, weekly);
  const spo2 = numericSeries(state, member.id, "spo2", range, weekly);
  const last10 = range === "30d" && !weekly;

  function openAdd(kind: AddKind) {
    setAddKind(kind);
    setAddOpen(true);
    setFormError(null);
    setWarning(null);
    if (kind === "document") router.push(`/documents/upload?member=${member.id}`);
    if (kind === "appointment") router.push(`/appointments`);
  }

  async function persistMeasurement() {
    setSaving(true);
    setFormError(null);
    const result = recordMeasurement(state, {
      familyMemberId: member.id,
      kind: mForm.kind,
      value: mForm.value,
      systolic: mForm.systolic,
      diastolic: mForm.diastolic,
      unit: mForm.kind === "blood_pressure" ? "mmHg" : mForm.unit,
      recordedAt: mForm.recordedAt,
      glucoseContext: mForm.kind === "blood_sugar" && (mForm.context === "fasting" || mForm.context === "post_meal" || mForm.context === "random") ? mForm.context : undefined,
      note: mForm.note,
    });
    if (!result.ok) {
      setSaving(false);
      setFormError(result.errors.join(" "));
      return;
    }
    try {
      if (session.authenticated && isUuid(member.id)) {
        const row = result.state.measurements[0];
        await createCloudMeasurement({
          recipientId: member.id,
          kind: row.kind,
          value: row.value,
          unit: row.unit,
          systolic: row.systolic,
          diastolic: row.diastolic,
          glucoseContext: row.glucoseContext,
          note: row.note,
          recordedAt: row.recordedAt,
        });
        await refreshVault();
      } else {
        update(() => result.state);
      }
      if (result.warning) {
        setWarning(result.warning);
        toast.message("Saved exactly as entered — review the caution below.");
      } else {
        toast.success("Measurement saved.");
        setAddOpen(false);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save that measurement.");
    } finally {
      setSaving(false);
    }
  }

  async function persistOther() {
    setSaving(true);
    setFormError(null);
    try {
      if (addKind === "history") {
        const r = saveHistory(state, { familyMemberId: member.id, ...hForm });
        if (!r.ok) { setFormError(r.errors.join(" ")); return; }
        if (session.authenticated && isUuid(member.id)) {
          await createCloudHealthRecord({ kind: "history", recipientId: member.id, ...hForm });
          await refreshVault();
        } else update(() => r.state);
        toast.success("History saved.");
        setAddOpen(false);
      }
      if (addKind === "vaccination") {
        const r = saveVaccination(state, { familyMemberId: member.id, ...vForm });
        if (!r.ok) { setFormError(r.errors.join(" ")); return; }
        if (session.authenticated && isUuid(member.id)) {
          await createCloudHealthRecord({ kind: "vaccination", recipientId: member.id, ...vForm });
          await refreshVault();
        } else update(() => r.state);
        toast.success("Vaccination saved.");
        setAddOpen(false);
      }
      if (addKind === "diary") {
        const r = saveDiary(state, { familyMemberId: member.id, title: dForm.title, body: dForm.body, recordedAt: zonedNow().timestamp });
        if (!r.ok) { setFormError(r.errors.join(" ")); return; }
        if (session.authenticated && isUuid(member.id)) {
          await createCloudHealthRecord({ kind: "diary", recipientId: member.id, title: dForm.title, body: dForm.body });
          await refreshVault();
        } else update(() => r.state);
        toast.success("Diary note saved.");
        setAddOpen(false);
      }
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not save that record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overflow-x-hidden">
      <PageHeader
        back="/family"
        eyebrow="Family Health Record"
        title={member.name}
        subtitle={`${member.relationship}${member.age ? ` · ${member.age} years` : ""} · ${lastUpdatedLabel(state, lastUpdatedFor(state, member.id))}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => { setAddKind(null); setAddOpen(true); }} className="h-10 rounded-full bg-peach px-3.5 font-bold text-ink-strong hover:bg-peach">
              <Plus className="size-4" /> Add record
            </Button>
            <Link href={`/share/health-card/${member.id}?print=1`} target="_blank" className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] font-bold">
              <Printer className="size-4" /> Print
            </Link>
          </div>
        }
      />
      <div className="mb-4 flex items-center gap-3 rounded-[18px] border px-3 py-2" style={{ borderColor: swatch.border, backgroundColor: swatch.background }}>
        <MemberAvatar member={member} size={44} identity />
        <div>
          <p className="text-[16px] font-extrabold" style={{ color: swatch.text }}>{member.name}</p>
          <p className="text-[12.5px] text-ink-muted">This record stays on {member.name} — never mixed with another family member.</p>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Health record sections">
        {healthTabs().map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("h-10 shrink-0 rounded-full px-3 text-[13px] font-bold", tab === t.key ? "bg-peach text-ink-strong" : "border border-line-strong bg-surface-raised")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Latest blood pressure" value={bp.value} meta={bp.meta} />
            <Metric title="Latest blood sugar" value={sugar.value} meta={sugar.meta} />
            <Metric title="Upcoming appointment" value={nextAppt ? nextAppt.doctor : "No visit recorded"} meta={nextAppt ? `${nextAppt.date} · ${nextAppt.time}` : NOT_RECORDED} />
            <Metric title="Medical history" value={empty.history ? "None recorded" : `${history.length} saved`} meta={empty.history ? "Add only what the family recorded." : "From this person's file"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openAdd("measurement")}>Add measurement</Button>
            <Button size="sm" variant="outline" onClick={() => openAdd("history")}>Add medical history</Button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendChart title="Blood pressure" help={weekly ? "Each point is the latest actual BP in that Sunday–Saturday week." : "Raw stored readings. Missing days stay blank."} seriesA={last10 ? sys.slice(-10) : sys} seriesB={last10 ? dia.slice(-10) : dia} labelA="Systolic" labelB="Diastolic" unit="mmHg" empty="No BP readings recorded yet." />
            <TrendChart title={glucoseUnits.length > 1 ? `Blood glucose (${glucoseUnit} only — other units are kept separate)` : "Blood glucose"} help={weekly ? "Each point is the latest actual glucose reading in that Sunday–Saturday week." : "Raw stored readings for this person."} seriesA={last10 ? glu.slice(-10) : glu} labelA="Glucose" unit={glucoseUnit || "as recorded"} empty="No glucose readings recorded yet." />
          </div>
          <RangeControls range={range} weekly={weekly} onRange={setRange} onWeekly={setWeekly} />
          <section>
            <h3 className="mb-2 text-[15px] font-extrabold">Recent activity</h3>
            {personTimeline(state, member.id).length === 0 ? <p className="text-[14px] text-ink-muted">No saved events yet.</p> : (
              <ul className="space-y-2">{personTimeline(state, member.id).map((e) => <li key={e.id} className="text-[14px]"><span className="font-bold">{e.title}</span> <span className="text-ink-muted">· {e.timestamp}{e.source === "sample" ? " · sample" : ""}</span></li>)}</ul>
            )}
          </section>
        </div>
      )}

      {tab === "history" && (
        <HistorySection memberId={member.id} onAdd={() => openAdd("history")} />
      )}

      {tab === "measurements" && (
        <div>
          <Button className="mb-4" onClick={() => openAdd("measurement")}>Add measurement</Button>
          <RangeControls range={range} weekly={weekly} onRange={setRange} onWeekly={setWeekly} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TrendChart title="Blood pressure history" help={weekly ? "Weekly view: latest actual reading that Sunday–Saturday week." : "Stored BP values for this person."} seriesA={sys} seriesB={dia} labelA="Systolic" labelB="Diastolic" unit="mmHg" empty="No BP readings recorded yet." />
            <TrendChart title="Glucose history" help="Units are never mixed on one axis." seriesA={glu} labelA="Glucose" unit={glucoseUnit || "as recorded"} empty="No glucose readings recorded yet." />
            <TrendChart title="Heart-rate history" seriesA={hr} labelA="Heart rate" unit="bpm" empty="No heart-rate readings recorded yet." />
            <TrendChart title="Weight history" seriesA={wt} labelA="Weight" unit="kg" empty="No weight readings recorded yet." />
            <TrendChart title="Temperature history" seriesA={temp} labelA="Temperature" unit="°C" empty="No temperature readings recorded yet." />
            <TrendChart title="SpO₂ history" seriesA={spo2} labelA="SpO₂" unit="%" empty="No oxygen readings recorded yet." />
          </div>
          <ul className="mt-4 space-y-2">
            {measurementsFor(state, member.id).map((m) => (
              <li key={m.id} className="rounded-[14px] border border-line bg-surface-raised px-3 py-2 text-[14px]">
                <span className="font-bold">{m.kind === "blood_pressure" && m.systolic != null ? `${m.systolic}/${m.diastolic}` : m.value} {m.unit}</span>
                <span className="text-ink-muted"> · {m.recordedAt} · {m.source}{m.glucoseContext ? ` · ${m.glucoseContext}` : ""}{m.source === "sample" ? (state.settings.demoWorkspace ? " · fictional demo reading" : " · excluded from real-family charts") : ""}</span>
              </li>
            ))}
          </ul>
          {empty.measurements && <EmptyState icon={<Plus className="size-6" />} title="No readings recorded yet." body="Add a measurement only when the family has a real number." />}
        </div>
      )}

      {tab === "documents" && (
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Input value={docQuery} onChange={(e) => setDocQuery(e.target.value)} placeholder="Search this person's documents" />
            <select className="h-10 rounded-[12px] border border-line-strong bg-surface px-3" value={docCat} onChange={(e) => setDocCat(e.target.value)}>
              <option value="all">All categories</option>
              <option value="prescriptions">Prescriptions</option>
              <option value="blood_tests">Blood-test reports</option>
              <option value="imaging">Imaging / scans</option>
              <option value="discharge">Discharge summaries</option>
              <option value="notes">Consultation notes</option>
              <option value="vaccination">Vaccination records</option>
              <option value="insurance">Insurance</option>
              <option value="other">Other</option>
            </select>
            <Link href={`/documents/upload?member=${member.id}`} className="inline-flex h-10 items-center rounded-full bg-peach px-3 text-[13px] font-bold">Upload</Link>
          </div>
          {docs.length === 0 ? <EmptyState icon={<Plus className="size-6" />} title="No documents uploaded yet." body="The Documents page uses the same records. Extraction text appears only if it was actually processed." /> : (
            <ul className="space-y-2">{docs.map((d) => (
              <li key={d.id}><Link href={`/documents/${d.id}`} className="block rounded-[14px] border border-line bg-surface-raised px-3 py-2 hover:border-peach"><span className="font-bold">{d.name}</span> <span className="text-ink-muted">· {d.date} · {documentCategory(d.name, d.type)} · {d.metadata.source === "sample" ? "sample" : "upload"}{d.metadata.detectedFrom === "manual" && !d.metadata.description ? " · not extracted" : ""}</span></Link></li>
            ))}</ul>
          )}
        </div>
      )}

      {tab === "appointments" && (
        <div className="space-y-3">
          <Link href="/appointments" className="text-[13px] font-bold text-peach-deep hover:underline">Open Family Appointments</Link>
          {[...upcomingVisits(state, member.id), ...pastVisits(state, member.id)].length === 0 ? (
            <EmptyState icon={<Plus className="size-6" />} title="No appointments recorded yet." body="These are the same visits as the Appointments page." action={{ label: "New appointment", href: "/appointments" }} />
          ) : (
            <ul className="space-y-2">{[...upcomingVisits(state, member.id), ...pastVisits(state, member.id)].map((a) => (
              <li key={a.id}><Link href={`/appointments/${a.id}`} className="block rounded-[14px] border border-line px-3 py-2"><span className="font-bold">{a.doctor}</span> <span className="text-ink-muted">· {a.date} · {a.time} · {a.status}{a.visit ? " · family visit note saved" : ""}</span></Link></li>
            ))}</ul>
          )}
          {currentMedicines(state, member.id).length > 0 && <p className="text-[13px] text-ink-muted">Current medicines for {member.name} come from the Medicines section.</p>}
        </div>
      )}

      {tab === "vaccinations" && (
        <div>
          <Button className="mb-4" onClick={() => openAdd("vaccination")}>Add vaccination</Button>
          {vaccinationsFor(state, member.id).length === 0 ? <EmptyState icon={<Plus className="size-6" />} title="No vaccinations recorded yet." body="SMARAN will not invent a vaccine name or schedule." /> : (
            <ul className="space-y-2">{vaccinationsFor(state, member.id).map((v) => (
              <li key={v.id} className="rounded-[14px] border border-line px-3 py-2"><span className="font-bold">{v.name}</span> <span className="text-ink-muted">· dose {v.dose || NOT_RECORDED} · received {v.receivedDate || NOT_RECORDED} · next due {v.nextDueDate || NOT_RECORDED} · {vaccinationStatus(v)}</span></li>
            ))}</ul>
          )}
        </div>
      )}

      {tab === "diary" && (
        <div>
          <Button className="mb-4" onClick={() => openAdd("diary")}>Add diary entry</Button>
          {diaryFor(state, member.id).length === 0 ? <EmptyState icon={<Plus className="size-6" />} title="No diary notes yet." body="Family observations stay separate from measurements and documents." /> : (
            <ul className="space-y-2">{diaryFor(state, member.id).map((d) => (
              <li key={d.id} className="rounded-[14px] border border-line px-3 py-2"><p className="font-bold">{d.title}</p><p className="text-[14px] text-ink">{d.body}</p><p className="text-[12.5px] text-ink-muted">{d.recordedAt} · family note, not a clinical fact</p></li>
            ))}</ul>
          )}
        </div>
      )}

      <Modal open={addOpen} onOpenChange={setAddOpen} title={addKind ? `Add ${addKind}` : "Add record"} description={`For ${member.name}. Nothing is invented.`} footer={
        addKind && addKind !== "document" && addKind !== "appointment" ? (
          <>
            <Button variant="outline" onClick={() => setAddKind(null)}>Back</Button>
            <Button disabled={saving} onClick={() => {
              if (addKind === "measurement") void persistMeasurement();
              else void persistOther();
            }}>{saving ? "Saving…" : "Save"}</Button>
          </>
        ) : undefined
      }>
        {formError && <p className="mb-2 font-semibold text-missed" role="alert">{formError}</p>}
        {warning && <p className="mb-2 text-[13.5px] text-waiting">{warning}</p>}
        {!addKind && (
          <div className="grid gap-2">
            {(["measurement", "history", "document", "vaccination", "diary", "appointment"] as AddKind[]).map((k) => (
              <Button key={k} variant="outline" onClick={() => openAdd(k)}>{k === "history" ? "Add medical-history entry" : k === "document" ? "Upload document" : k === "appointment" ? "Add or schedule appointment" : `Add ${k}`}</Button>
            ))}
          </div>
        )}
        {addKind === "measurement" && (
          <div className="grid gap-3">
            <Field label="Type">
              <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3" value={mForm.kind} onChange={(e) => setMForm({ ...mForm, kind: e.target.value as MeasurementKind, unit: e.target.value === "blood_pressure" ? "mmHg" : e.target.value === "blood_sugar" ? "mg/dL" : mForm.unit })}>
                <option value="blood_pressure">Blood pressure</option>
                <option value="blood_sugar">Blood glucose</option>
                <option value="heart_rate">Heart rate</option>
                <option value="weight">Weight</option>
                <option value="temperature">Temperature</option>
                <option value="spo2">SpO₂</option>
                <option value="other">Other</option>
              </select>
            </Field>
            {mForm.kind === "blood_pressure" ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Systolic"><Input value={mForm.systolic} onChange={(e) => setMForm({ ...mForm, systolic: e.target.value })} /></Field>
                <Field label="Diastolic"><Input value={mForm.diastolic} onChange={(e) => setMForm({ ...mForm, diastolic: e.target.value })} /></Field>
              </div>
            ) : (
              <Field label="Value"><Input value={mForm.value} onChange={(e) => setMForm({ ...mForm, value: e.target.value })} /></Field>
            )}
            <Field label="Unit"><Input value={mForm.unit} onChange={(e) => setMForm({ ...mForm, unit: e.target.value })} /></Field>
            {mForm.kind === "blood_sugar" && (
              <Field label="Context (only if recorded)">
                <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3" value={mForm.context} onChange={(e) => setMForm({ ...mForm, context: e.target.value })}>
                  <option value="">Not recorded</option>
                  <option value="fasting">Fasting</option>
                  <option value="post_meal">Post-meal</option>
                  <option value="random">Random</option>
                </select>
              </Field>
            )}
            <Field label="Date and time"><Input value={mForm.recordedAt} onChange={(e) => setMForm({ ...mForm, recordedAt: e.target.value })} /></Field>
            <Field label="Notes"><Textarea value={mForm.note} onChange={(e) => setMForm({ ...mForm, note: e.target.value })} /></Field>
          </div>
        )}
        {addKind === "history" && (
          <div className="grid gap-3">
            <Field label="Category">
              <select className="h-10 w-full rounded-[12px] border border-line-strong bg-surface px-3" value={hForm.category} onChange={(e) => setHForm({ ...hForm, category: e.target.value as HistoryCategory })}>
                <option value="illness">Previous illness</option>
                <option value="chronic">Chronic condition</option>
                <option value="surgery">Surgery</option>
                <option value="hospitalization">Hospitalization</option>
                <option value="family_history">Family medical history</option>
              </select>
            </Field>
            <Field label="Name as recorded"><Input value={hForm.name} onChange={(e) => setHForm({ ...hForm, name: e.target.value })} /></Field>
            <Field label="Status"><Input value={hForm.status} onChange={(e) => setHForm({ ...hForm, status: e.target.value })} /></Field>
            <Field label="Date if known"><Input type="date" value={hForm.startDate} onChange={(e) => setHForm({ ...hForm, startDate: e.target.value })} /></Field>
            <Field label="Hospital / clinic"><Input value={hForm.hospital} onChange={(e) => setHForm({ ...hForm, hospital: e.target.value })} /></Field>
            {hForm.category === "family_history" && <Field label="Relationship"><Input value={hForm.relationship} onChange={(e) => setHForm({ ...hForm, relationship: e.target.value })} /></Field>}
            <Field label="Notes"><Textarea value={hForm.notes} onChange={(e) => setHForm({ ...hForm, notes: e.target.value })} /></Field>
          </div>
        )}
        {addKind === "vaccination" && (
          <div className="grid gap-3">
            <Field label="Vaccine name"><Input value={vForm.name} onChange={(e) => setVForm({ ...vForm, name: e.target.value })} /></Field>
            <Field label="Dose / sequence"><Input value={vForm.dose} onChange={(e) => setVForm({ ...vForm, dose: e.target.value })} /></Field>
            <Field label="Date received"><Input type="date" value={vForm.receivedDate} onChange={(e) => setVForm({ ...vForm, receivedDate: e.target.value })} /></Field>
            <Field label="Next due (optional)"><Input type="date" value={vForm.nextDueDate} onChange={(e) => setVForm({ ...vForm, nextDueDate: e.target.value })} /></Field>
            <Field label="Clinic"><Input value={vForm.clinic} onChange={(e) => setVForm({ ...vForm, clinic: e.target.value })} /></Field>
            <Field label="Notes"><Textarea value={vForm.notes} onChange={(e) => setVForm({ ...vForm, notes: e.target.value })} /></Field>
          </div>
        )}
        {addKind === "diary" && (
          <div className="grid gap-3">
            <Field label="Title"><Input value={dForm.title} onChange={(e) => setDForm({ ...dForm, title: e.target.value })} /></Field>
            <Field label="Note"><Textarea value={dForm.body} onChange={(e) => setDForm({ ...dForm, body: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function HistorySection({ memberId, onAdd }: { memberId: string; onAdd: () => void }) {
  const { state } = useStore();
  const groups: { key: HistoryCategory; title: string }[] = [
    { key: "illness", title: "Previous illnesses" },
    { key: "chronic", title: "Chronic conditions" },
    { key: "surgery", title: "Surgeries" },
    { key: "hospitalization", title: "Hospitalizations" },
    { key: "family_history", title: "Family medical history" },
  ];
  return (
    <div className="space-y-5">
      <Button onClick={onAdd}>Add medical history</Button>
      {groups.map((g) => {
        const rows = historyFor(state, memberId).filter((h) => h.category === g.key);
        return (
          <section key={g.key}>
            <h3 className="mb-2 text-[15px] font-extrabold">{g.title}</h3>
            {rows.length === 0 ? <p className="text-[14px] text-ink-muted">No medical history recorded yet.</p> : rows.map((h) => (
              <Surface key={h.id} className="mb-2 p-3">
                <p className="font-bold">{h.name}{h.source === "sample" ? " · sample" : ""}</p>
                <p className="text-[13px] text-ink-muted">{h.status || NOT_RECORDED} · {h.startDate || NOT_RECORDED}{h.hospital ? ` · ${h.hospital}` : ""}{h.relationship ? ` · ${h.relationship}` : ""}</p>
                {h.notes && <p className="text-[13px]">{h.notes}</p>}
                <p className="text-[12px] text-ink-muted">Recorded {h.createdAt}{h.previous ? " · earlier values kept" : ""}</p>
              </Surface>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function Metric({ title, value, meta }: { title: string; value: string; meta: string }) {
  return (
    <Surface className="p-4">
      <p className="text-[12px] font-bold tracking-[0.12em] text-ink-muted uppercase">{title}</p>
      <p className="mt-1 text-[20px] font-extrabold text-ink-strong">{value}</p>
      <p className="text-[12.5px] text-ink-muted">{meta}</p>
    </Surface>
  );
}

function RangeControls({ range, weekly, onRange, onWeekly }: { range: ChartRange; weekly: boolean; onRange: (r: ChartRange) => void; onWeekly: (w: boolean) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {(["7d", "30d", "90d", "12m", "all"] as ChartRange[]).map((r) => (
        <button key={r} type="button" onClick={() => onRange(r)} className={cn("h-8 rounded-full px-3 text-[12.5px] font-bold", range === r ? "bg-peach" : "border border-line-strong")}>{r}</button>
      ))}
      <button type="button" onClick={() => onWeekly(!weekly)} className={cn("h-8 rounded-full px-3 text-[12.5px] font-bold", weekly ? "bg-peach" : "border border-line-strong")}>{weekly ? "Weekly (latest actual reading)" : "Raw readings"}</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="mb-1.5">{label}</Label>{children}</div>;
}

