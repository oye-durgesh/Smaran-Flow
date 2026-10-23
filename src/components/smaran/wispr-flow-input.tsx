"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useView } from "@/lib/store/view";
import { useAppState } from "@/lib/store/store";
import { WisprFlowMark } from "./brand";

type Phase = "idle" | "listening" | "transcribing" | "ready" | "error";

export interface WisprFlowInputProps {
  placeholder: string;
  /** Suggested phrases. The first one is used by the demo transcript. */
  examples?: string[];
  onSubmit: (text: string) => void | string | Promise<void | string>;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  variant?: "card" | "composer";
  /** Types this text in as a demo transcript when it changes. */
  autoTypeText?: string | null;
  autoSubmit?: boolean;
  /** Receives Alt+W from anywhere on the page. */
  primary?: boolean;
  label?: string;
  className?: string;
  examplesLabel?: string;
}

const LISTEN_TIMEOUT_MS = 12_000;
const CAPTURE_ERROR = "We couldn't capture that. Try speaking again.";

/* One page-level shortcut: Alt/⌥ + W activates the most recently mounted primary input. */
const activators: (() => void)[] = [];
let shortcutInstalled = false;
function installShortcut() {
  if (shortcutInstalled || typeof window === "undefined") return;
  shortcutInstalled = true;
  window.addEventListener("keydown", (e) => {
    if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyW") {
      const activate = activators[activators.length - 1];
      if (activate) {
        e.preventDefault();
        activate();
      }
    }
  });
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useWisprShortcutHint(): string {
  const [hint, setHint] = useState("");
  useEffect(() => {
    const ua = navigator.userAgent;
    // Platform detection needs the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHint(/Mac/i.test(ua) ? "Wispr Flow's default on Mac is holding fn." : /Win/i.test(ua) ? "Wispr Flow's default on Windows is holding Ctrl + Win." : "");
  }, []);
  return hint;
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
  busyLabel = "Reading your words…",
  error: externalError,
  variant = "card",
  autoTypeText,
  autoSubmit = false,
  primary = false,
  label = "Wispr Flow",
  className,
  examplesLabel = "Try saying",
}: WisprFlowInputProps) {
  const { isWeb } = useView();
  const { wisprEnabled } = useAppState().settings;
  const shortcutHint = useWisprShortcutHint();
  const inputId = useId();
  const helperId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const listenTimer = useRef<number | null>(null);
  const typeTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (listenTimer.current) window.clearTimeout(listenTimer.current);
    if (typeTimer.current) window.clearInterval(typeTimer.current);
    listenTimer.current = null;
    typeTimer.current = null;
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

  const typeIn = useCallback(
    (text: string, thenSubmit = false) => {
      clearTimers();
      setError(null);
      textareaRef.current?.focus();
      if (prefersReducedMotion()) {
        setValue(text);
        setPhase("ready");
        if (thenSubmit) void submit(text);
        return;
      }
      setPhase("transcribing");
      setValue("");
      let i = 0;
      typeTimer.current = window.setInterval(() => {
        i = Math.min(text.length, i + 2);
        setValue(text.slice(0, i));
        if (i >= text.length) {
          if (typeTimer.current) window.clearInterval(typeTimer.current);
          typeTimer.current = null;
          setPhase("ready");
          if (thenSubmit) window.setTimeout(() => void submit(text), 450);
        }
      }, 28);
    },
    [submit],
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

  useEffect(() => {
    if (!primary) return;
    installShortcut();
    const activate = () => startListening();
    activators.push(activate);
    return () => {
      const i = activators.indexOf(activate);
      if (i >= 0) activators.splice(i, 1);
    };
  }, [primary, startListening]);

  const typeInRef = useRef(typeIn);
  const autoSubmitRef = useRef(autoSubmit);
  useEffect(() => {
    typeInRef.current = typeIn;
    autoSubmitRef.current = autoSubmit;
  });
  const playedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoTypeText || playedRef.current === autoTypeText) return;
    let inner: number | undefined;
    const t = window.setTimeout(() => {
      playedRef.current = autoTypeText;
      setPhase("listening");
      inner = window.setTimeout(() => typeInRef.current(autoTypeText, autoSubmitRef.current), 700);
    }, 250);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(inner);
    };
  }, [autoTypeText]);

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
  const listening = effectivePhase === "listening" || effectivePhase === "transcribing";
  const helper = isWeb ? "Use your configured Wispr Flow shortcut to dictate into this box." : "Tap this button on the right side of your phone to use Wispr Flow.";

  const statusText = {
    idle: isWeb ? "Ready" : "Ready",
    listening: "Listening…",
    transcribing: "Transcribing…",
    ready: "Press Enter to send",
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
      className={cn(
        "relative shrink-0 rounded-[18px] transition-transform duration-200 hover:scale-[1.03] active:scale-95 disabled:opacity-40",
        listening && "animate-breathe",
      )}
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
        <button
          key={ex}
          type="button"
          onClick={() => typeIn(ex)}
          className="max-w-full truncate rounded-full border border-line-strong bg-surface px-3 py-1.5 text-left text-[13px] font-semibold text-ink transition-colors hover:border-peach hover:bg-peach-soft/40"
        >
          “{ex}”
        </button>
      ))}
    </div>
  );

  const listeningRow = listening && !value && (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[14px] bg-peach-soft/45 px-3 py-2 animate-fade" role="status">
      <Waveform active />
      <span className="text-[13px] font-semibold text-ink">Listening — speak with Wispr Flow</span>
      {examples[0] && (
        <button type="button" onClick={() => typeIn(examples[0])} className="ml-auto text-[13px] font-bold text-peach-deep underline-offset-2 hover:underline">
          Use sample phrase (demo)
        </button>
      )}
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

  if (variant === "composer") {
    return (
      <div className={cn("space-y-2", className)}>
        {chips}
        {listeningRow}
        {errorRow}
        {busyRow}
        <div
          className={cn(
            "flex items-end gap-2 rounded-[22px] border bg-surface-raised p-2 pl-4 shadow-[var(--shadow-soft)] transition-colors focus-within:border-peach",
            listening ? "border-peach" : "border-line-strong",
          )}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={inputId} className="block pt-1.5 text-[10px] font-extrabold tracking-[0.18em] text-ink-muted uppercase">
              {label}
            </label>
            {textarea}
          </div>
          {value.trim() && sendButton}
          {wisprButton}
        </div>
        <p id={helperId} className="px-2 text-center text-[12px] text-ink-muted">
          {helper}
          {isWeb && " Demo shortcut: Alt + W."}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-[22px] border bg-surface-raised p-4 shadow-[var(--shadow-soft)] transition-colors focus-within:border-peach sm:p-5",
        listening ? "border-peach" : "border-line-strong",
        className,
      )}
    >
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
          {value.trim() && sendButton}
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
        {wisprEnabled ? helper : "Wispr Flow is turned off in Settings — you can still type here."}
        {isWeb && wisprEnabled && (
          <span className="block text-ink-muted/80">
            {shortcutHint} Demo shortcut: <kbd className="rounded-md border border-line-strong bg-surface px-1.5 py-0.5 text-[11px] font-bold">Alt + W</kbd>
          </span>
        )}
      </p>
    </div>
  );
}
