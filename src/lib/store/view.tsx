"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ViewMode } from "../types";

const VIEW_KEY = "smaran:view";

interface ViewValue {
  /** What the presenter picked in the Mobile | Web toggle. */
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  /** The layout actually rendered: narrow screens are always mobile. */
  layout: ViewMode;
  isWeb: boolean;
  isNarrow: boolean;
  portalEl: HTMLElement | null;
  setPortalEl: (el: HTMLElement | null) => void;
  demoOpen: boolean;
  setDemoOpen: (open: boolean) => void;
  incomingReminderId: string | null;
  setIncomingReminderId: (id: string | null) => void;
}

const ViewContext = createContext<ViewValue | null>(null);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ViewMode>("mobile");
  const [isNarrow, setIsNarrow] = useState(false);
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [incomingReminderId, setIncomingReminderId] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(VIEW_KEY);
    // Restoring the presenter's last choice can only happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "mobile" || saved === "web") setModeState(saved);
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const setMode = useCallback((next: ViewMode) => {
    setModeState(next);
    window.localStorage.setItem(VIEW_KEY, next);
  }, []);

  const layout: ViewMode = isNarrow ? "mobile" : mode;

  const value = useMemo(
    () => ({ mode, setMode, layout, isWeb: layout === "web", isNarrow, portalEl, setPortalEl, demoOpen, setDemoOpen, incomingReminderId, setIncomingReminderId }),
    [mode, setMode, layout, isNarrow, portalEl, demoOpen, incomingReminderId],
  );
  return <ViewContext.Provider value={value}>{children}</ViewContext.Provider>;
}

export function useView(): ViewValue {
  const ctx = useContext(ViewContext);
  if (!ctx) throw new Error("useView must be used inside ViewProvider");
  return ctx;
}
