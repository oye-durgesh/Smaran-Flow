import { cn } from "@/lib/utils";

/**
 * Brand assets are loaded from /public/brand so the supplied SMARAN logo and
 * Wispr Flow button can be dropped in without code changes.
 */
export const BRAND_ASSETS = {
  smaranMark: "/brand/smaran-mark.svg",
  smaranLockup: "/brand/smaran-lockup.png",
  wisprFlow: "/brand/wispr-flow.svg",
};

/** Full SMARAN lockup (mark + wordmark + स्मरण) for splash and welcome. */
export function SmaranLockup({ className, width = 192 }: { className?: string; width?: number }) {
  const height = Math.round((width * 166) / 192);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_ASSETS.smaranLockup}
      alt="SMARAN स्मरण"
      width={width}
      height={height}
      className={cn("select-none", className)}
      draggable={false}
    />
  );
}

export function SmaranMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={BRAND_ASSETS.smaranMark} alt="" width={size} height={size} className={cn("shrink-0 select-none", className)} draggable={false} />
  );
}

export function SmaranLogo({
  size = "md",
  className,
  stacked = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  stacked?: boolean;
}) {
  const dims = { sm: 30, md: 38, lg: 56, xl: 96 }[size];
  const word = { sm: "text-[15px]", md: "text-lg", lg: "text-2xl", xl: "text-4xl" }[size];
  const hindi = { sm: "text-[12px]", md: "text-[13px]", lg: "text-base", xl: "text-2xl" }[size];
  return (
    <div className={cn("flex items-center gap-2.5", stacked && "flex-col gap-4 text-center", className)} aria-label="SMARAN स्मरण">
      <SmaranMark size={dims} />
      <div className={cn("leading-none", stacked && "space-y-2")}>
        <div className={cn("font-extrabold tracking-[0.18em] text-ink-strong", word)}>SMARAN</div>
        <div lang="hi" className={cn("font-hindi font-medium text-brown", hindi, !stacked && "mt-0.5")}>
          स्मरण
        </div>
      </div>
    </div>
  );
}

export function WisprFlowMark({ size = 44, className }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={BRAND_ASSETS.wisprFlow} alt="" width={size} height={size} className={cn("shrink-0 select-none", className)} draggable={false} />
  );
}
