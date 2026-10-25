"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";
import { DEMO_BANNER, DEMO_FAMILY_NAME, DEMO_LOAD_CONFIRM, DEMO_RESET_CONFIRM } from "@/lib/demo/workspace";
import { DEMO_RECORDING_SCRIPT } from "@/lib/demo/recording";
import { useStore } from "@/lib/store/store";
import { PageHeader } from "@/components/smaran/primitives";
import { Screen } from "@/components/shell/screen";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const STEPS = [
  { title: "Welcome to SMARAN", body: "This walkthrough uses fictional SMARAN Demo Family records. It does not create a real account." },
  { title: "Sign-up preview", body: "Real sign-up still uses your email and password in Settings. This demo does not claim a simulated signup succeeded." },
  { title: "Account fields", body: "A real account needs email and password. Demo Mode stays on this device until you sign in." },
  { title: "Family setup", body: "Next we open the isolated demo workspace — never your real family." },
  { title: `Create ${DEMO_FAMILY_NAME}`, body: "Four fictional people are added: Mummy, Papa, Dadi, and Dada Ji." },
  { title: "Add Mummy", body: "Mother · peach family colour · BP and glucose histories already stored." },
  { title: "Add Papa", body: "Father · terracotta · medicines and cardiology follow-up samples." },
  { title: "Add Dadi", body: "Grandmother · sand · mobility notes and reports." },
  { title: "Add Dada Ji", body: "Grandfather · clay · annual checkup and trends." },
  { title: "Colours and relationships", body: "Each person keeps a stable colour and relationship alias (Maa, Pitaji, Dadi ji, Dada ji)." },
  { title: "Family dashboard", body: "Seeded charts, medicines, appointments, documents, and reminders are ready to demonstrate." },
];

export function DemoStudioScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const walkthrough = params.get("walkthrough") === "1";
  const { restoreDemo, resetDemo, state } = useStore();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const members = useMemo(() => state.family.map((m) => m.name).join(", "), [state.family]);

  function finish() {
    restoreDemo();
    toast.success("SMARAN Demo Family is ready. Records are fictional.");
    router.push("/today");
  }

  return (
    <Screen>
      <PageHeader title={walkthrough ? "Demo walkthrough" : "SMARAN Demo"} subtitle={DEMO_BANNER} />
      <p className="mb-4 rounded-[16px] bg-sand/50 px-3 py-2 text-[13px] font-semibold text-ink">{DEMO_FAMILY_NAME} · fictional workspace</p>

      {walkthrough ? (
        <div className="max-w-[640px] rounded-[20px] border border-line bg-surface-raised p-5">
          <p className="text-[12px] font-bold tracking-wide text-ink-muted uppercase">
            Step {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-2 text-[22px] font-extrabold text-ink-strong">{current.title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink">{current.body}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => finish()}>Skip to demo family</Button>
            {step > 0 && <Button variant="outline" onClick={() => setStep((s) => s - 1)}>Back</Button>}
            {step < STEPS.length - 1 ? <Button onClick={() => setStep((s) => s + 1)}>Next</Button> : <Button onClick={() => finish()}>Open demo family</Button>}
          </div>
        </div>
      ) : (
        <div className="max-w-[720px] space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { restoreDemo(); toast.success("Demo family loaded."); router.push("/today"); }}>Start Demo</Button>
            <Button variant="outline" onClick={() => router.push("/demo?walkthrough=1")}>Start Guided Walkthrough</Button>
            <Button variant="outline" onClick={() => { if (window.confirm(DEMO_RESET_CONFIRM)) { resetDemo(); toast.success("Demo workspace reset."); } }}>Reset Demo Data</Button>
            <Button variant="outline" onClick={() => { if (window.confirm(DEMO_LOAD_CONFIRM)) { restoreDemo(); toast.success("Demo data restored."); } }}>Restore Demo Data</Button>
          </div>
          <p className="text-[14px] text-ink-muted">Now in this browser: {members || "no people yet (restore to populate)."}</p>
          <section>
            <h2 className="mb-2 text-[16px] font-extrabold">Two-minute recording order</h2>
            <ol className="space-y-1.5">
              {DEMO_RECORDING_SCRIPT.map((row) => (
                <li key={row.at} className="rounded-[12px] border border-line bg-ivory px-3 py-2 text-[13px]">
                  <span className="font-bold">{row.at} · {row.scene}</span>
                  <span className="block text-ink-muted">{row.note}</span>
                </li>
              ))}
            </ol>
          </section>
          <div className="flex flex-wrap gap-2 text-[13px] font-bold">
            <Link className="text-peach-deep hover:underline" href="/family">Family</Link>
            <Link className="text-peach-deep hover:underline" href="/today">Today</Link>
            <Link className="text-peach-deep hover:underline" href="/ask">Ask SMARAN</Link>
            <Link className="text-peach-deep hover:underline" href="/medicines">Medicines</Link>
            <Link className="text-peach-deep hover:underline" href="/appointments">Appointments</Link>
          </div>
        </div>
      )}
    </Screen>
  );
}
