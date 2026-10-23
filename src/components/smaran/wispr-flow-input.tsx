"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/store";
import { WisprFlowMark } from "./brand";

type Phase = "idle" | "listening" | "ready" | "error";

export interface WisprFlowInputProps {
  placeholder: string;
  examples?: string[];
  onSubmit: (text: string) => void | string | Promise<void | string>;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  variant?: "card" | "composer";
  primary?: boolean;
  label?: string;
  className?: string;
  examplesLabel?: string;
  headline?: string;
  support?: string;
}

const LISTEN_TIMEOUT_MS = 12_000;
const CAPTURE_ERROR = "We couldn't capture that. Try speaking again.";

export function Waveform({ active, className }: { active: boolean; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex h-5 items-center gap-[3px]", className)}>
      {[0.55, 0.9, 0.7, 1, 0.6].map((h, i) => (
        <span
          key={i}
          className={cn("w-[3px] origin-center rounded-full bg-peach-deep", active && "animate-wave")}
          style={{ height: `${h * 100}%`, animationDelay: `${i * 110}ms`, transform: active ? undefined : "scaleY(0.35)" }}
        />
      ))}
    </span>
  );
}

export function WisprFlowInput({
  placeholder,
  examples = [],
  onSubmit,
  busy = false,
  busyLabel = "SMARAN is understanding…",
  error: externalError,
  variant = "card",
  primary = false,
  label = "Wispr Flow",
  className,
  examplesLabel = "Try asking",
  headline,
  support,
}: WisprFlowInputProps) {
  const { wisprEnabled } = useAppState().settings;
  const inputId = useId();
  const helperId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const listenTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (listenTimer.current) window.clearTimeout(listenTimer.current);
    listenTimer.current = null;
  };
  useEffect(() => clearTimers, []);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setError(CAPTURE_ERROR);
        setPhase("error");
        return;
      }
      clearTimers();
      setError(null);
      const result = await onSubmit(trimmed);
      if (typeof result === "string") {
        setError(result);
        setPhase("error");
        return;
      }
      setValue("");
      setPhase("idle");
    },
    [onSubmit],
  );

  const startListening = useCallback(() => {
    clearTimers();
    setError(null);
    setPhase("listening");
    textareaRef.current?.focus();
    listenTimer.current = window.setTimeout(() => {
      setPhase((p) => (p === "listening" ? "error" : p));
      setError((e) => e ?? CAPTURE_ERROR);
    }, LISTEN_TIMEOUT_MS);
  }, []);

  const toggleListening = () => {
    if (phase === "listening") {
      clearTimers();
      setPhase(value.trim() ? "ready" : "idle");
    } else {
      startListening();
    }
  };

  const onChange = (next: string) => {
    setValue(next);
    if (listenTimer.current) {
      window.clearTimeout(listenTimer.current);
      listenTimer.current = null;
    }
    if (phase === "error") setError(null);
    setPhase(next.trim() ? (phase === "listening" ? "listening" : "ready") : phase === "listening" ? "listening" : "idle");
  };

  const shownError = externalError ?? error;
  const effectivePhase: Phase | "busy" = busy ? "busy" : shownError ? "error" : phase;
  const listening = effectivePhase === "listening";
  const helper = support ?? (wisprEnabled
    ? "Speak naturally — SMARAN will organize it for you."
    : "Wispr Flow is turned off in Settings — you can still type here.");

  const statusText = {
    idle: headline ?? "Ready",
    listening: "Listening…",
    ready: "Review, then send",
    error: "Try again",
    busy: busyLabel,
  }[effectivePhase];

  const wisprButton = (
    <button
      type="button"
      onClick={toggleListening}
      disabled={busy || !wisprEnabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop Wispr Flow" : "Speak with Wispr Flow"}
      aria-describedby={helperId}
      className={cn("relative shrink-0 rounded-[18px] transition-transform duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-40", listening && "animate-breathe")}
    >
      <WisprFlowMark size={variant === "composer" ? 46 : 54} className="rounded-[18px]" />
    </button>
  );

  const sendButton = (
    <button
      type="button"
      onClick={() => void submit(value)}
      disabled={busy || !value.trim()}
      aria-label="Send to SMARAN"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-peach text-ink-strong transition-all hover:bg-[#e29c7e] disabled:bg-ivory-deep disabled:text-ink-muted/60"
    >
      <ArrowUp className="size-5" strokeWidth={2.6} />
    </button>
  );

  const chips = examples.length > 0 && !value && !busy && (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-muted">
        <Sparkles className="size-3.5" aria-hidden /> {examplesLabel}
      </span>
      {examples.map((ex) => (
        <button key={ex} type="button" onClick={() => void submit(ex)} className="max-w-full truncate rounded-full border border-line-strong bg-surface px-3 py-1.5 text-left text-[13px] font-semibold text-ink transition-colors hover:border-peach hover:bg-peach-soft/40">
          “{ex}”
        </button>
      ))}
    </div>
  );

  const listeningRow = listening && !value && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-peach-soft/45 px-3 py-2 animate-fade" role="status">
      <Waveform active />
      <span className="text-[13px] font-semibold text-ink">Listening — speak with Wispr Flow</span>
    </div>
  );

  const errorRow = effectivePhase === "error" && shownError && (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-[14px] bg-missed-bg/70 px-3 py-2 text-[13px] font-semibold text-missed animate-fade">
      <span>{shownError}</span>
      <button type="button" onClick={startListening} className="shrink-0 font-bold underline-offset-2 hover:underline">
        Speak again
      </button>
    </div>
  );

  const busyRow = busy && (
    <div role="status" className="flex items-center gap-3 rounded-[14px] bg-sand/60 px-3 py-2 text-[13px] font-semibold text-ink animate-fade">
      <Waveform active className="h-4" />
      {busyLabel}
    </div>
  );

  const textarea = (
    <textarea
      ref={textareaRef}
      id={inputId}
      value={value}
      rows={variant === "composer" ? 1 : 2}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          void submit(value);
        }
        if (e.key === "Escape" && listening) {
          clearTimers();
          setPhase(value ? "ready" : "idle");
        }
      }}
      placeholder={placeholder}
      disabled={busy}
      aria-label={placeholder}
      aria-describedby={helperId}
      className={cn(
        "field-sizing-content block w-full resize-none bg-transparent text-ink-strong outline-none placeholder:text-ink-muted/80 focus-visible:outline-none",
        variant === "composer" ? "max-h-28 min-h-[44px] py-2.5 text-[16px]" : "max-h-40 min-h-[56px] py-1 text-[18px] leading-relaxed font-semibold",
      )}
    />
  );

  void primary;

  if (variant === "composer") {
    return (
      <div className={cn("space-y-2", className)}>
        {headline && <p className="px-1 text-[15px] font-extrabold text-ink-strong">{headline}</p>}
        {chips}
        {listeningRow}
        {errorRow}
        {busyRow}
        <div className={cn("flex items-end gap-2 rounded-[22px] border bg-surface-raised p-2 pl-4 shadow-[var(--shadow-soft)] transition-colors focus-within:border-peach", listening ? "border-peach" : "border-line-strong")}>
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="block pt-1.5 text-[10px] font-extrabold tracking-[0.18em] text-ink-muted uppercase">
              {label}
            </label>
            {textarea}
          </div>
          {sendButton}
          {wisprButton}
        </div>
        <p id={helperId} className="px-2 text-center text-[12px] text-ink-muted">
          {helper}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-[22px] border bg-surface-raised p-4 shadow-[var(--shadow-soft)] transition-colors focus-within:border-peach sm:p-5", listening ? "border-peach" : "border-line-strong", className)}>
      {headline && <p className="mb-1 text-[16px] font-extrabold text-ink-strong">{headline}</p>}
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.2em] text-ink-muted uppercase">
          <span className={cn("size-1.5 rounded-full", listening || busy ? "bg-peach-deep" : "bg-line-strong")} aria-hidden />
          {label}
        </label>
        <span className="text-[12px] font-semibold text-ink-muted" aria-live="polite">
          {statusText}
        </span>
      </div>
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">{textarea}</div>
        <div className="flex items-center gap-2">
          {value.trim() && !busy && (
            <button type="button" onClick={() => onChange("")} aria-label="Clear" className="inline-flex size-9 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep">
              <X className="size-4" />
            </button>
          )}
          {sendButton}
          {wisprButton}
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {listeningRow}
        {errorRow}
        {busyRow}
        {chips}
      </div>
      <p id={helperId} className="mt-3 border-t border-line pt-3 text-[12.5px] leading-snug text-ink-muted">
        {helper}
      </p>
    </div>
  );
}
