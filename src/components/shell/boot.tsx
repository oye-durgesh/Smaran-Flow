import { SmaranLockup } from "@/components/smaran/brand";

/** Shown while the family memory loads from this device. */
export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ivory px-6" role="status" aria-label="Loading SMARAN">
      <SmaranLockup width={168} className="animate-pulse" />
    </div>
  );
}
