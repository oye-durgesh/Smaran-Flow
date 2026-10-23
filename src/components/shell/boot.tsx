/** Shown while the family memory loads from this device. */
export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ivory" role="status" aria-label="Loading SMARAN">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/smaran-mark.svg" alt="" width={64} height={64} className="animate-pulse rounded-[20px]" />
      <div className="text-center leading-tight">
        <div className="text-lg font-extrabold tracking-[0.18em] text-ink-strong">SMARAN</div>
        <div lang="hi" className="font-hindi text-sm text-brown">स्मरण</div>
      </div>
    </div>
  );
}
