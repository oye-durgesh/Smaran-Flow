"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ViewValue {
  isDesktop: boolean;
  /** Alias of isDesktop — leftover name from the old layout switch. */
  isWeb: boolean;
  isNarrow: boolean;
  portalEl: HTMLElement | null;
  setPortalEl: (el: HTMLElement | null) => void;
  incomingReminderId: string | null;
  setIncomingReminderId: (id: string | null) => void;
}

const ViewContext = createContext<ViewValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [isNarrow, setIsNarrow] = useState(false);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [incomingReminderId, setIncomingReminderId] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const value = useMemo(
    () => ({ isDesktop: !isNarrow, isWeb: !isNarrow, isNarrow, portalEl, setPortalEl, incomingReminderId, setIncomingReminderId }),
    [isNarrow, portalEl, incomingReminderId],
  );
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView(): ViewValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used inside ViewProvider");
  return ctx;
}
