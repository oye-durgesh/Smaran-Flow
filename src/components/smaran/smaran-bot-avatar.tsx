import { cn } from "@/lib/utils";

export function SmaranBotAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="SMARAN assistant"
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-[#F6C7B4] ring-1 ring-[#E8B49C]", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 40 40" width={size * 0.78} height={size * 0.78} aria-hidden>
        <rect x="8" y="12" width="24" height="18" rx="7" fill="#5C3A2E" />
        <circle cx="16" cy="20" r="2.2" fill="#F8EDE4" />
        <circle cx="24" cy="20" r="2.2" fill="#F8EDE4" />
        <path d="M17 25c2 1.4 4 1.4 6 0" stroke="#E58F7D" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <rect x="18" y="7" width="4" height="5" rx="1.5" fill="#C45C48" />
      </svg>
    </span>
  );
}
