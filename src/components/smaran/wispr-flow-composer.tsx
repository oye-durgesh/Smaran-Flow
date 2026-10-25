"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WisprFlowMark } from "./brand";
import {
  WISPR_BUTTON_LABEL,
  WISPR_HEADING,
  WISPR_HELPER_BODY,
  WISPR_HELPER_TITLE,
  WISPR_ORGANIZE,
  WISPR_POWERED,
  WISPR_SHORTCUTS,
  WISPR_TAGLINE,
  wisprSection,
  type WisprSectionId,
} from "@/lib/wispr-flow-context";

export interface WisprFlowComposerProps {
  context: WisprSectionId;
  placeholder?: string;
  examples?: readonly string[];
  onSubmit: (text: string) => void | string | Promise<void | string>;
  isLoading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onAttachment?: () => void;
  careRecipientId?: string;
  className?: string;
  compact?: boolean;
}

function readField(el: HTMLTextAreaElement | null, fallback: string): string {
  const dom = el?.value ?? "";
  return (dom.length >= fallback.length ? dom : fallback).replace(/\u00a0/g, " ");
}

export function WisprFlowComposer({
  context,
  placeholder,
  examples,
  onSubmit,
  isLoading = false,
  error: externalError,
  disabled = false,
  onAttachment,
  className,
  compact = false,
}: WisprFlowComposerProps) {
  const config = wisprSection(context);
  const inputId = useId();
  const helperId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const onSubmitRef = useRef(onSubmit);
  const inFlight = useRef(false);
  const [value, setValue] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [rotate, setRotate] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hint, setHint] = useState(false);

  const list = examples ?? config.examples;
  const shownPlaceholder = placeholder ?? config.placeholder;

  useEffect(() => {
    onSubmitRef.current = onSubmit;
  }, [onSubmit]);

  useEffect(() => {
    if (!list.length || value.trim() || isLoading || focused) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const t = window.setInterval(() => setRotate((i) => i + 1), 4500);
    return () => window.clearInterval(t);
  }, [list.length, value, isLoading, focused]);

  const onChange = (next: string) => {
    setValue(next);
    setLocalError(null);
  };

  const submit = useCallback(async () => {
    if (inFlight.current || isLoading || disabled) return;
    const trimmed = readField(textareaRef.current, value).trim();
    if (!trimmed) {
      setLocalError("Add some text first — SMARAN does not record audio here.");
      return;
    }
    setValue(trimmed);
    inFlight.current = true;
    setLocalError(null);
    try {
      const result = await onSubmitRef.current(trimmed);
      if (typeof result === "string") {
        setLocalError(result);
        return;
      }
      setValue("");
      if (textareaRef.current) textareaRef.current.value = "";
    } catch {
      setLocalError("We couldn't process that. Your text is still here — try again.");
    } finally {
      inFlight.current = false;
    }
  }, [disabled, isLoading, value]);

  const focusWispr = () => {
    textareaRef.current?.focus();
    setHint(true);
  };

  const shownError = externalError ?? localError;
  const hasText = Boolean(value.trim());
  const rotating = list.length ? list[rotate % list.length] : shownPlaceholder;
  const chips = config.chips.slice(0, 3);
  const busy = isLoading || disabled;

  return (
    <div data-wispr-composer={context} className={cn("rounded-[24px] border border-line bg-surface-raised p-4 shadow-[var(--shadow-soft)] sm:p-5", className)}>
      <div className="mb-3 flex items-start gap-3">
        <button
          type="button"
          onClick={focusWispr}
          aria-label={WISPR_BUTTON_LABEL}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-[#EDE7F8] hover:bg-[#E3DBF4] focus-visible:ring-2 focus-visible:ring-[#C4B5E0]"
        >
          <WisprFlowMark size={28} className="rounded-[8px]" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-extrabold text-ink-strong">{WISPR_HEADING}</p>
          <p className="text-[13px] font-semibold text-[#6B5A8A]">{WISPR_TAGLINE}</p>
          <p className="text-[12.5px] leading-snug text-ink-muted">{config.subtitle}</p>
          <p className="text-[12.5px] leading-snug text-ink-muted">{WISPR_ORGANIZE}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full bg-[#EDE7F8] px-2.5 py-1 sm:inline-flex">
          <WisprFlowMark size={16} className="rounded-[4px]" />
          <span className="text-[11px] font-extrabold text-[#5E4B72]">{WISPR_POWERED}</span>
        </div>
      </div>

      <div className="flex items-end gap-2 rounded-[22px] border border-line bg-[#FFF6F0] p-2 pl-3 transition-colors focus-within:border-peach">
        {(onAttachment || config.showAttachment) && (
          <Link
            href={config.attachmentHref ?? "/documents/upload"}
            aria-label="Attach a medical document"
            onClick={onAttachment}
            className="mb-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep"
          >
            <Paperclip className="size-5" />
          </Link>
        )}
        <textarea
          ref={textareaRef}
          id={inputId}
          value={value}
          rows={compact ? 1 : 2}
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
          placeholder={hasText ? shownPlaceholder : rotating}
          disabled={busy}
          aria-label={`${WISPR_HEADING}: ${shownPlaceholder}`}
          aria-describedby={helperId}
          className={cn(
            "field-sizing-content block min-w-0 flex-1 resize-none bg-transparent text-[16px] leading-relaxed font-semibold text-ink-strong outline-none placeholder:font-semibold placeholder:text-ink-muted/60",
            compact ? "max-h-28 min-h-[44px] py-2.5" : "max-h-40 min-h-[64px] py-2",
          )}
        />
        {hasText && !busy && (
          <button type="button" onClick={() => onChange("")} aria-label="Clear" className="mb-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep">
            <X className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={focusWispr}
          aria-label={WISPR_BUTTON_LABEL}
          className="mb-0.5 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-[14px] bg-[#EDE7F8] px-2.5 text-[12px] font-extrabold text-[#5E4B72] hover:bg-[#E3DBF4] focus-visible:ring-2 focus-visible:ring-[#C4B5E0] sm:px-3"
        >
          <WisprFlowMark size={20} className="rounded-[6px]" />
          <span className="hidden sm:inline">{WISPR_BUTTON_LABEL}</span>
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !hasText}
          aria-label="Send to SMARAN"
          className="mb-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-peach text-ink-strong hover:bg-[#e29c7e] focus-visible:ring-2 focus-visible:ring-peach-deep disabled:bg-ivory-deep disabled:text-ink-muted/50"
        >
          {isLoading ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.6} />}
        </button>
      </div>

      <div id={helperId} className="mt-2">
        <p className="text-[12.5px] font-bold text-ink-strong">{WISPR_HELPER_TITLE}</p>
        <p className="text-[12px] leading-snug text-ink-muted">{WISPR_HELPER_BODY}</p>
        {hint && (
          <div role="status" className="mt-1 space-y-0.5 text-[12px] leading-snug text-[#5E4B72]">
            <p>{WISPR_SHORTCUTS.windows}</p>
            <p>{WISPR_SHORTCUTS.mac}</p>
            <p>{WISPR_SHORTCUTS.phone}</p>
          </div>
        )}
      </div>

      {shownError && (
        <p role="alert" className="mt-2 rounded-[14px] bg-missed-bg/70 px-3 py-2 text-[13px] font-semibold text-missed">
          {shownError}
        </p>
      )}

      {!hasText && !busy && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <li key={chip.text}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(chip.text);
                    textareaRef.current?.focus();
                  }}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-ivory px-2.5 py-1.5 text-left text-[12px] font-semibold text-ink hover:border-peach"
                >
                  <Icon className="size-3.5 shrink-0 text-peach-deep" aria-hidden />
                  <span className="truncate">{chip.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
