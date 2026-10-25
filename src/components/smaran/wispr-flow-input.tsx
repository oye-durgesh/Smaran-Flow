"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
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

const CAPTURE_ERROR = "Add some text first — SMARAN does not record audio here.";
const WISPR_PROMOTE = "Use Wispr Flow for better voice capture";
const DEFAULT_SUPPORT = "Dictate with Wispr Flow or type. SMARAN never listens through the browser.";

function readField(el: HTMLTextAreaElement | null, fallback: string): string {
  const dom = el?.value ?? "";
  return (dom.length >= fallback.length ? dom : fallback).replace(/\u00a0/g, " ");
}

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
  busyLabel = "Working on what you wrote…",
  error: externalError,
  variant = "card",
  primary = false,
  className,
  examplesAction = "fill",
  examplesLabel,
  support,
}: WisprFlowInputProps) {
  const inputId = useId();
  const helperId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onSubmitRef = useRef(onSubmit);
  const inFlight = useRef(false);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rotate, setRotate] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const sync = () => {
      const next = el.value.replace(/\u00a0/g, " ");
      setValue((prev) => (prev === next ? prev : next));
      setPhase((p) => {
        if (p === "error") return p;
        return next.trim() ? "ready" : "idle";
      });
    };
    el.addEventListener("input", sync);
    el.addEventListener("change", sync);
    el.addEventListener("paste", () => window.requestAnimationFrame(sync));
    const mo = new MutationObserver(sync);
    mo.observe(el, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["value"] });
    return () => {
      el.removeEventListener("input", sync);
      el.removeEventListener("change", sync);
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!examples.length || value.trim() || busy || focused) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = window.setInterval(() => setRotate((i) => i + 1), 4500);
    return () => window.clearInterval(t);
  }, [examples.length, value, busy, focused]);

  const onChange = (next: string) => {
    setValue(next);
    if (phase === "error") setError(null);
    setPhase(next.trim() ? "ready" : "idle");
  };

  const submit = useCallback(async () => {
    if (inFlight.current || busy) return;
    const trimmed = readField(textareaRef.current, value).trim();
    if (!trimmed) {
      setError(CAPTURE_ERROR);
      setPhase("error");
      return;
    }
    setValue(trimmed);
    inFlight.current = true;
    setError(null);
    try {
      const result = await onSubmitRef.current(trimmed);
      if (typeof result === "string") {
        setError(result);
        setPhase("error");
        return;
      }
      setValue("");
      if (textareaRef.current) textareaRef.current.value = "";
      setPhase("idle");
    } catch {
      setError("We couldn't process that. Your text is still here — try again.");
      setPhase("error");
    } finally {
      inFlight.current = false;
    }
  }, [busy, value]);

  const shownError = externalError ?? error;
  const effectivePhase: Phase | "busy" = busy ? "busy" : shownError ? "error" : phase;
  const hasText = Boolean(value.trim());
  const helper = effectivePhase === "busy" ? busyLabel : (support ?? DEFAULT_SUPPORT);
  const rotating = examples.length ? examples[rotate % examples.length] : placeholder;

  void primary;
  void examplesLabel;
  void examplesAction;

  const errorRow = effectivePhase === "error" && shownError && (
    <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-[14px] bg-missed-bg/70 px-3 py-2 text-[13px] font-semibold text-missed">
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

  return (
    <div
      className={cn(
        variant === "card" && "rounded-[24px] border border-line bg-surface-raised p-5 shadow-[var(--shadow-soft)] sm:p-6",
        className,
      )}
    >
      <div className="mb-3 flex items-start gap-3">
        <WisprFlowMark size={variant === "composer" ? 36 : 40} className="pointer-events-none mt-0.5 shrink-0 rounded-[12px]" />
        <div className="min-w-0">
          <p className="text-[15px] leading-snug font-extrabold text-ink-strong">{WISPR_PROMOTE}</p>
          <p id={helperId} className="mt-0.5 text-[13px] leading-snug text-ink-muted">
            {helper}
          </p>
        </div>
      </div>
      <div className="flex items-end gap-2 rounded-[22px] border border-line bg-ivory/50 p-2 pl-4 transition-colors focus-within:border-peach">
        <textarea
          ref={textareaRef}
          id={inputId}
          value={value}
          rows={variant === "composer" ? 1 : 3}
          onInput={(e) => onChange(e.currentTarget.value)}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={hasText ? placeholder : rotating}
          disabled={busy}
          aria-label={placeholder}
          aria-describedby={helperId}
          className={cn(
            "field-sizing-content block min-w-0 flex-1 resize-none bg-transparent text-ink-strong outline-none placeholder:font-semibold placeholder:text-ink-muted/60 focus-visible:outline-none",
            variant === "composer" ? "max-h-28 min-h-[44px] py-2.5 text-[16px]" : "max-h-44 min-h-[84px] py-2 pr-1 text-[17px] leading-relaxed font-semibold",
          )}
        />
        {hasText && !busy && (
          <button type="button" onClick={() => onChange("")} aria-label="Clear" className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep">
            <X className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !hasText}
          aria-label="Send to SMARAN"
          className="mb-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-peach text-ink-strong transition-colors hover:bg-[#e29c7e] focus-visible:ring-2 focus-visible:ring-peach-deep disabled:bg-ivory-deep disabled:text-ink-muted/50"
        >
          <ArrowUp className="size-5" strokeWidth={2.6} />
        </button>
      </div>
      {errorRow}
      {!hasText && !busy && examples.length > 0 && (
        <button
          type="button"
          onClick={() => {
            onChange(rotating);
            textareaRef.current?.focus();
          }}
          className="mt-3 w-full text-left text-[13.5px] leading-snug text-ink-muted transition-colors hover:text-ink"
        >
          Try saying: <span className="font-semibold text-ink">“{rotating}”</span>
        </button>
      )}
    </div>
  );
}
