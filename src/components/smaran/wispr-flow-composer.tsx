"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronDown, Loader2, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { WisprFlowMark } from "./brand";
import {
  TEXTAREA_MAX_HEIGHT_COMPACT_PX,
  TEXTAREA_MAX_HEIGHT_DEFAULT_PX,
  TEXTAREA_MIN_HEIGHT_DEFAULT_PX,
  TEXTAREA_MIN_HEIGHT_PX,
} from "@/lib/wispr-flow-layout";
import {
  WISPR_BUTTON_LABEL,
  WISPR_HEADING,
  WISPR_ORGANIZE,
  WISPR_POWERED,
  WISPR_SHORTCUTS,
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
  const minHeight = compact ? TEXTAREA_MIN_HEIGHT_PX : TEXTAREA_MIN_HEIGHT_DEFAULT_PX;
  const maxHeight = compact ? TEXTAREA_MAX_HEIGHT_COMPACT_PX : TEXTAREA_MAX_HEIGHT_DEFAULT_PX;

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

  const growField = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight, minHeight]);

  useEffect(() => {
    growField();
  }, [growField, value]);

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
      if (textareaRef.current) {
        textareaRef.current.value = "";
        textareaRef.current.style.height = `${minHeight}px`;
        textareaRef.current.style.overflowY = "hidden";
      }
    } catch {
      setLocalError("We couldn't process that. Your text is still here — try again.");
    } finally {
      inFlight.current = false;
    }
  }, [disabled, isLoading, minHeight, value]);

  const focusWispr = () => {
    textareaRef.current?.focus();
    setHint(true);
  };

  const shownError = externalError ?? localError;
  const hasText = Boolean(value.trim());
  const rotating = list.length ? list[rotate % list.length] : shownPlaceholder;
  const chips = config.chips.slice(0, 3);
  const busy = isLoading || disabled;
  const showAttach = Boolean(onAttachment || config.showAttachment);

  return (
    <div
      data-wispr-composer={context}
      className={cn(
        "@container/composer w-full min-w-0 max-w-full overflow-x-hidden rounded-[20px] border border-line/80 bg-surface-raised",
        compact ? "p-2 shadow-none" : "p-3 shadow-[var(--shadow-soft)] sm:p-3.5",
        className,
      )}
    >
      {compact ? (
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full border border-[#E4D8F0] bg-[#F6F1FB] px-1.5 py-0.5">
            <WisprFlowMark size={11} className="max-h-3 max-w-5 rounded-[3px] object-contain" />
            <span className="truncate text-[10px] font-semibold tracking-wide text-[#6B5A8A]">{WISPR_POWERED}</span>
          </div>
          <details
            className="shrink-0"
            open={hint}
            onToggle={(e) => setHint(e.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center gap-0.5 text-[11px] font-semibold text-ink-muted marker:content-none [&::-webkit-details-marker]:hidden">
              Shortcuts
              <ChevronDown className={cn("size-3 transition-transform", hint && "rotate-180")} aria-hidden />
            </summary>
          </details>
        </div>
      ) : (
        <div className="grid w-full min-w-0 grid-cols-[40px_minmax(0,1fr)] items-start gap-2.5">
          <button
            type="button"
            onClick={focusWispr}
            aria-label={WISPR_BUTTON_LABEL}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#F6F1FB] hover:bg-[#EDE7F8] focus-visible:ring-2 focus-visible:ring-[#C4B5E0]"
          >
            <WisprFlowMark size={18} className="max-h-6 max-w-8 rounded-[5px] object-contain" />
          </button>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-col gap-1.5 @[420px]/composer:flex-row @[420px]/composer:items-center @[420px]/composer:justify-between">
              <p className="text-[15px] font-extrabold break-words text-ink-strong">{WISPR_HEADING}</p>
              <div className="flex items-center gap-2 self-start">
                <div className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-[#E4D8F0] bg-[#F6F1FB] px-2 py-0.5">
                  <WisprFlowMark size={12} className="max-h-3.5 max-w-6 rounded-[3px] object-contain" />
                  <span className="text-[10px] font-semibold whitespace-nowrap text-[#6B5A8A]">{WISPR_POWERED}</span>
                </div>
                <details
                  className="shrink-0"
                  open={hint}
                  onToggle={(e) => setHint(e.currentTarget.open)}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-0.5 text-[11px] font-semibold text-ink-muted marker:content-none [&::-webkit-details-marker]:hidden">
                    Shortcuts
                    <ChevronDown className={cn("size-3 transition-transform", hint && "rotate-180")} aria-hidden />
                  </summary>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className={cn("min-w-0 text-[12px] leading-4 break-words text-ink-muted", compact ? "mt-1.5" : "mt-2")}>
        {WISPR_ORGANIZE}
      </p>

      <div
        className={cn(
          "flex w-full min-w-0 flex-col gap-1.5 rounded-[16px] border border-line bg-[#FFF8F3] transition-colors focus-within:border-peach",
          compact ? "mt-1.5 p-1.5" : "mt-2 p-2",
        )}
      >
        <textarea
          ref={textareaRef}
          id={inputId}
          value={value}
          rows={1}
          onInput={(e) => {
            onChange(e.currentTarget.value);
            growField();
          }}
          onChange={(e) => {
            onChange(e.target.value);
            growField();
          }}
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
            "block w-full min-w-0 resize-none overflow-y-hidden bg-transparent px-1.5 text-[15px] leading-snug font-semibold break-words text-ink-strong outline-none placeholder:font-medium placeholder:text-ink-muted/55",
            compact ? "min-h-12 py-1.5" : "min-h-14 py-2",
          )}
        />
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
          {showAttach && (
            <Link
              href={config.attachmentHref ?? "/documents/upload"}
              aria-label="Attach a medical document"
              onClick={onAttachment}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-ink-muted hover:bg-ivory-deep"
            >
              <Paperclip className="size-4" />
            </Link>
          )}
          {hasText && !busy && (
            <button
              type="button"
              onClick={() => onChange("")}
              aria-label="Clear"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] text-ink-muted hover:bg-ivory-deep"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={focusWispr}
            aria-label={WISPR_BUTTON_LABEL}
            className="inline-flex h-9 min-h-9 min-w-0 items-center gap-1 rounded-full bg-[#EDE7F8] px-2.5 text-[11px] font-bold text-[#5E4B72] hover:bg-[#E3DBF4] focus-visible:ring-2 focus-visible:ring-[#C4B5E0]"
          >
            <WisprFlowMark size={14} className="max-h-3.5 max-w-6 rounded-[4px] object-contain" />
            <span className="max-w-[8.5rem] truncate @[360px]/composer:max-w-none">{WISPR_BUTTON_LABEL}</span>
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !hasText}
            aria-label="Send to SMARAN"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-peach text-ink-strong hover:bg-[#e29c7e] focus-visible:ring-2 focus-visible:ring-peach-deep disabled:bg-ivory-deep disabled:text-ink-muted/50"
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" strokeWidth={2.6} />}
          </button>
        </div>
      </div>

      <div id={helperId} className="min-w-0">
        {hint && (
          <div role="status" className="mt-1.5 space-y-0.5 rounded-[12px] bg-ivory px-2.5 py-1.5 text-[11px] leading-4 break-words text-[#5E4B72]">
            <p>{WISPR_SHORTCUTS.windows}</p>
            <p>{WISPR_SHORTCUTS.mac}</p>
            <p>{WISPR_SHORTCUTS.phone}</p>
          </div>
        )}
      </div>

      {shownError && (
        <p role="alert" className="mt-1.5 rounded-[12px] bg-missed-bg/70 px-2.5 py-1.5 text-[12.5px] font-semibold break-words text-missed">
          {shownError}
        </p>
      )}

      {!hasText && !busy && (
        <ul className="mt-2 flex min-w-0 flex-wrap gap-1">
          {chips.map((chip) => {
            const Icon = chip.icon;
            return (
              <li key={chip.text} className="min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={() => {
                    onChange(chip.text);
                    textareaRef.current?.focus();
                  }}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-line bg-ivory px-2 py-1 text-left text-[11px] font-semibold text-ink hover:border-peach"
                >
                  <Icon className="size-3 shrink-0 text-peach-deep" aria-hidden />
                  <span className="min-w-0 break-words">{chip.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
