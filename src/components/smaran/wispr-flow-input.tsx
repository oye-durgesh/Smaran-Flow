"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppState } from "@/lib/store/store";
import { WisprFlowMark } from "./brand";

type Phase = "idle" | "ready" | "error";

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
  examplesAction?: "fill" | "submit";
  title?: string;
  support?: string;
}

const CAPTURE_ERROR = "We couldn't capture that. Try speaking again.";
const DEFAULT_TITLE = "Speak naturally";
const DEFAULT_SUPPORT = "Your voice, organized by SMARAN.";

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
  label = "Wispr Flow",
  className,
  examplesLabel,
  examplesAction = "submit",
  title = DEFAULT_TITLE,
  support,
}: WisprFlowInputProps) {
  const { wisprEnabled } = useAppState().settings;
  const inputId = useId();
  const helperId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

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
    ? "Wispr Flow is turned off in Settings — you can still type here."
    : effectivePhase === "busy"
      ? busyLabel
      : (support ?? DEFAULT_SUPPORT);

  void primary;

  const wisprMark = (
    <span className="shrink-0 select-none" aria-hidden>
      <WisprFlowMark size={variant === "composer" ? 48 : 56} className="rounded-[18px] pointer-events-none" />
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

  const chips = examples.length > 0 && !hasText && !busy && (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {examplesLabel && <span className="sr-only">{examplesLabel}</span>}
      {examples.map((ex) => (
        <button
          key={ex}
          type="button"
          onClick={() => (examplesAction === "fill" ? onChange(ex) : void submit(ex))}
          className="h-9 shrink-0 rounded-full border border-line bg-ivory/70 px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:border-peach hover:bg-peach-soft/30 hover:text-ink"
        >
          {ex}
        </button>
      ))}
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
      rows={variant === "composer" ? 1 : 3}
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
        variant === "composer" ? "max-h-28 min-h-[44px] py-2.5 text-[16px] leading-snug" : "max-h-44 min-h-[88px] py-1 text-[18px] leading-relaxed font-semibold",
      )}
    />
  );

  const header = (
    <div className="mb-3">
      <label htmlFor={inputId} className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.2em] text-ink-muted uppercase">
        <span className={cn("size-1.5 rounded-full", busy ? "bg-peach-deep" : "bg-peach")} aria-hidden />
        {label}
      </label>
      {title && <p className="mt-1 text-[20px] leading-tight font-extrabold tracking-tight text-ink-strong sm:text-[22px]">{title}</p>}
    </div>
  );

  const footer = (
    <p id={helperId} className="text-[12.5px] leading-snug text-ink-muted" aria-live="polite">
      {busy && <Waveform active className="mr-2 inline-flex align-middle" />}
      {helper}
    </p>
  );

  if (variant === "composer") {
    return (
      <div className={cn("space-y-2.5", className)}>
        {header}
        {errorRow}
        <div className="flex items-end gap-2 rounded-[22px] border border-line bg-surface-raised p-2 pl-4 shadow-[var(--shadow-soft)] transition-colors focus-within:border-peach">
          <div className="min-w-0 flex-1">{textarea}</div>
          {hasText && !busy && (
            <button type="button" onClick={() => onChange("")} aria-label="Clear" className="mb-1 inline-flex size-9 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep">
              <X className="size-4" />
            </button>
          )}
          {sendButton}
          {wisprMark}
        </div>
        {chips}
        {footer}
      </div>
    );
  }

  return (
    <div className={cn("rounded-[24px] border border-line bg-surface-raised p-5 shadow-[var(--shadow-soft)] transition-colors focus-within:border-peach sm:p-6", className)}>
      {header}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">{textarea}</div>
        <div className="flex items-center gap-2 pb-0.5">
          {hasText && !busy && (
            <button type="button" onClick={() => onChange("")} aria-label="Clear" className="inline-flex size-10 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep">
              <X className="size-4" />
            </button>
          )}
          {sendButton}
          {wisprMark}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {errorRow}
        {chips}
        {footer}
      </div>
    </div>
  );
}
