"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/store";
import { WisprFlowMark } from "./brand";

type Phase = "idle" | "ready" | "error";

export interface WisprFlowInputProps {
  placeholder: string;
  examples?: readonly string[];
  onSubmit: (text: string) => void | string | Promise<void | string>;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  variant?: "card" | "composer";
  primary?: boolean;
  className?: string;
  examplesAction?: "fill" | "submit";
  examplesLabel?: string;
  support?: string;
}

const CAPTURE_ERROR = "Voice capture isn't available right now. You can type instead.";
const HEADLINE = "Use Wispr Flow for better voice capture";
const DEFAULT_SUPPORT = "Speak naturally — SMARAN will organize it for you.";

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
  busyLabel = "Got it. Organizing this for you…",
  error: externalError,
  variant = "card",
  primary = false,
  className,
  examplesAction = "fill",
  examplesLabel,
  support,
}: WisprFlowInputProps) {
  const { wisprEnabled } = useAppState().settings;
  const inputId = useId();
  const helperId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rotate, setRotate] = useState(0);

  useEffect(() => {
    if (!examples.length || value.trim() || busy) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = window.setInterval(() => setRotate((i) => i + 1), 5200);
    return () => window.clearInterval(t);
  }, [examples.length, value, busy]);

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setError(CAPTURE_ERROR);
        setPhase("error");
        return;
      }
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

  const onChange = (next: string) => {
    setValue(next);
    if (phase === "error") setError(null);
    setPhase(next.trim() ? "ready" : "idle");
  };

  const shownError = externalError ?? error;
  const effectivePhase: Phase | "busy" = busy ? "busy" : shownError ? "error" : phase;
  const hasText = Boolean(value.trim());
  const helper = !wisprEnabled
    ? "Voice capture isn't available right now. You can type instead."
    : effectivePhase === "busy"
      ? busyLabel
      : (support ?? DEFAULT_SUPPORT);

  void primary;
  void examplesLabel;

  const featured = examples.length ? examples[rotate % examples.length] : null;
  const chips = examples.length
    ? [0, 1, 2].map((i) => examples[(rotate + i) % examples.length]).filter((v, i, a) => a.indexOf(v) === i)
    : [];

  const wisprMark = (
    <span className="shrink-0 select-none" aria-hidden>
      <WisprFlowMark size={variant === "composer" ? 48 : 56} className="pointer-events-none rounded-[18px]" />
    </span>
  );

  const sendButton = hasText && !busy && (
    <button
      type="button"
      onClick={() => void submit(value)}
      aria-label="Send to SMARAN"
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-peach text-ink-strong transition-colors hover:bg-[#e29c7e] focus-visible:ring-2 focus-visible:ring-peach-deep"
    >
      <ArrowUp className="size-5" strokeWidth={2.6} />
    </button>
  );

  const trySaying = examples.length > 0 && !hasText && !busy && (
    <div className="space-y-2">
      <p className="text-[11px] font-extrabold tracking-[0.16em] text-ink-muted uppercase">Try saying</p>
      {featured && (
        <p className="text-[14.5px] leading-snug font-semibold text-ink">
          “{featured}”
        </p>
      )}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => (examplesAction === "submit" ? void submit(ex) : onChange(ex))}
            className="h-10 max-w-[85vw] shrink-0 truncate rounded-full border border-line bg-ivory/80 px-3.5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-peach hover:bg-peach-soft/30 hover:text-ink focus-visible:ring-2 focus-visible:ring-peach-deep"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );

  const errorRow = effectivePhase === "error" && shownError && (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-[14px] bg-missed-bg/70 px-3 py-2 text-[13px] font-semibold text-missed">
      <span>{shownError}</span>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setPhase(hasText ? "ready" : "idle");
          textareaRef.current?.focus();
        }}
        className="shrink-0 font-bold underline-offset-2 hover:underline"
      >
        Try again
      </button>
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
      }}
      placeholder={placeholder}
      disabled={busy}
      aria-label={placeholder}
      aria-describedby={helperId}
      className={cn(
        "field-sizing-content block w-full resize-none bg-transparent text-ink-strong outline-none placeholder:font-semibold placeholder:text-ink-muted/55 focus-visible:outline-none",
        variant === "composer" ? "max-h-28 min-h-[44px] py-2.5 text-[16px] leading-snug" : "max-h-40 min-h-[72px] py-1 text-[17px] leading-relaxed font-semibold",
      )}
    />
  );

  const header = (
    <div className="mb-4 space-y-1">
      <p className="text-[11px] font-extrabold tracking-[0.2em] text-ink-muted uppercase">Tell SMARAN</p>
      <label htmlFor={inputId} className="block text-[10.5px] font-extrabold tracking-[0.18em] text-brown uppercase">
        Wispr Flow
      </label>
      <p className="text-[16px] leading-snug font-extrabold text-ink-strong sm:text-[17px]">{HEADLINE}</p>
      <p id={helperId} className="text-[13px] leading-snug text-ink-muted">
        {busy ? busyLabel : helper}
      </p>
    </div>
  );

  const field = (
    <div className="flex items-end gap-2 rounded-[22px] border border-line bg-ivory/40 p-2 pl-4 transition-colors focus-within:border-peach sm:gap-3">
      <div className="min-w-0 flex-1">{textarea}</div>
      {hasText && !busy && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear" className="mb-0.5 inline-flex size-10 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep">
          <X className="size-4" />
        </button>
      )}
      {sendButton}
      {wisprMark}
    </div>
  );

  if (variant === "composer") {
    return (
      <div className={cn("space-y-3", className)}>
        {header}
        {errorRow}
        {field}
        {trySaying}
      </div>
    );
  }

  return (
    <div className={cn("rounded-[24px] border border-line bg-surface-raised p-5 shadow-[var(--shadow-soft)] sm:p-6", className)}>
      {header}
      {field}
      <div className="mt-4 space-y-3">
        {errorRow}
        {trySaying}
      </div>
    </div>
  );
}
