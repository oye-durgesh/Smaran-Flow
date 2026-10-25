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

  const growField = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const max = compact ? 112 : 160;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, 72), max);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [compact]);

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
        textareaRef.current.style.height = "72px";
        textareaRef.current.style.overflowY = "hidden";
      }
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
  const showAttach = Boolean(onAttachment || config.showAttachment);

  return (
    <div
      data-wispr-composer={context}
      className={cn(
        "@container/composer w-full min-w-0 max-w-full overflow-x-hidden rounded-[24px] border border-line bg-surface-raised p-3 shadow-[var(--shadow-soft)] sm:p-4",
        className,
      )}
    >
      <div className="grid w-full min-w-0 grid-cols-[48px_minmax(0,1fr)] items-start gap-3">
        <button
          type="button"
          onClick={focusWispr}
          aria-label={WISPR_BUTTON_LABEL}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-[#EDE7F8] hover:bg-[#E3DBF4] focus-visible:ring-2 focus-visible:ring-[#C4B5E0]"
        >
          <WisprFlowMark size={22} className="max-h-7 max-w-10 rounded-[6px] object-contain" />
        </button>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-col gap-2 @[420px]/composer:flex-row @[420px]/composer:items-start @[420px]/composer:justify-between">
            <p className="text-[16px] font-extrabold break-words text-ink-strong">{WISPR_HEADING}</p>
            <div className="inline-flex max-w-full shrink-0 items-center gap-1.5 self-start rounded-full bg-[#EDE7F8] px-2.5 py-1">
              <WisprFlowMark size={14} className="max-h-4 max-w-7 rounded-[4px] object-contain" />
              <span className="text-[11px] font-extrabold whitespace-nowrap text-[#5E4B72]">{WISPR_POWERED}</span>
            </div>
          </div>
          <p className="mt-1 text-[13px] leading-5 font-semibold break-words text-[#6B5A8A]">{WISPR_TAGLINE}</p>
          <p className="text-[12.5px] leading-5 break-words text-ink-muted">{config.subtitle}</p>
          <p className="text-[12.5px] leading-5 break-words text-ink-muted">{WISPR_ORGANIZE}</p>
        </div>
      </div>

      <div className="mt-3 flex w-full min-w-0 flex-col gap-2 rounded-[22px] border border-line bg-[#FFF6F0] p-2.5 transition-colors focus-within:border-peach">
        <textarea
          ref={textareaRef}
          id={inputId}
          value={value}
          rows={compact ? 2 : 3}
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
          className="block min-h-[72px] w-full min-w-0 resize-none overflow-y-hidden bg-transparent px-1.5 py-2 text-[16px] leading-relaxed font-semibold break-words text-ink-strong outline-none placeholder:font-semibold placeholder:text-ink-muted/60"
        />
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          {showAttach && (
            <Link
              href={config.attachmentHref ?? "/documents/upload"}
              aria-label="Attach a medical document"
              onClick={onAttachment}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep"
            >
              <Paperclip className="size-5" />
            </Link>
          )}
          {hasText && !busy && (
            <button type="button" onClick={() => onChange("")} aria-label="Clear" className="inline-flex size-11 shrink-0 items-center justify-center rounded-[12px] text-ink-muted hover:bg-ivory-deep">
              <X className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={focusWispr}
            aria-label={WISPR_BUTTON_LABEL}
            className="inline-flex h-11 min-w-0 items-center gap-1.5 rounded-[14px] bg-[#EDE7F8] px-2.5 text-[12px] font-extrabold text-[#5E4B72] hover:bg-[#E3DBF4] focus-visible:ring-2 focus-visible:ring-[#C4B5E0]"
          >
            <WisprFlowMark size={18} className="max-h-5 max-w-8 rounded-[5px] object-contain" />
            <span className="max-w-[9.5rem] truncate @[420px]/composer:max-w-none">{WISPR_BUTTON_LABEL}</span>
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !hasText}
            aria-label="Send to SMARAN"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-peach text-ink-strong hover:bg-[#e29c7e] focus-visible:ring-2 focus-visible:ring-peach-deep disabled:bg-ivory-deep disabled:text-ink-muted/50"
          >
            {isLoading ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" strokeWidth={2.6} />}
          </button>
        </div>
      </div>

      <div id={helperId} className="mt-2 min-w-0">
        <p className="text-[12.5px] font-bold break-words text-ink-strong">{WISPR_HELPER_TITLE}</p>
        <p className="text-[12px] leading-5 break-words text-ink-muted">{WISPR_HELPER_BODY}</p>
        {hint && (
          <div role="status" className="mt-1 space-y-0.5 text-[12px] leading-5 break-words text-[#5E4B72]">
            <p>{WISPR_SHORTCUTS.windows}</p>
            <p>{WISPR_SHORTCUTS.mac}</p>
            <p>{WISPR_SHORTCUTS.phone}</p>
          </div>
        )}
      </div>

      {shownError && (
        <p role="alert" className="mt-2 rounded-[14px] bg-missed-bg/70 px-3 py-2 text-[13px] font-semibold break-words text-missed">
          {shownError}
        </p>
      )}

      {!hasText && !busy && (
        <ul className="mt-3 flex min-w-0 flex-wrap gap-1.5">
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
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-ivory px-2.5 py-1.5 text-left text-[12px] font-semibold text-ink hover:border-peach"
                >
                  <Icon className="size-3.5 shrink-0 text-peach-deep" aria-hidden />
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
