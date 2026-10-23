"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppState } from "../types";
import { createDemoState, createEmptyState, STATE_VERSION } from "../seed";
import { clearFiles } from "../files";

const STORAGE_KEY = "smaran:state";

interface StoreValue {
  state: AppState;
  /** Apply a pure state transition. */
  update: (fn: (s: AppState) => AppState) => void;
  /** Apply a transition that also returns a value (e.g. a new id). */
  commit: <T>(fn: (s: AppState) => [AppState, T]) => T;
  resetDemo: () => void;
  clearAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== STATE_VERSION) return createDemoState();
    return parsed;
  } catch {
    return createDemoState();
  }
}

export function StoreProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const ref = useRef<AppState | null>(null);

  useEffect(() => {
    const initial = load();
    ref.current = initial;
    // Hydrating from localStorage has to happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(initial);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const next = JSON.parse(e.newValue) as AppState;
        ref.current = next;
        setState(next);
      } catch {
        /* ignore malformed writes from other tabs */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!state) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or unavailable: the session keeps working in memory */
    }
  }, [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    if (!ref.current) return;
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
  }, []);

  const commit = useCallback(<T,>(fn: (s: AppState) => [AppState, T]): T => {
    if (!ref.current) throw new Error("Store not ready");
    const [next, value] = fn(ref.current);
    ref.current = next;
    setState(next);
    return value;
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = { ...createDemoState(), onboarded: ref.current?.onboarded ?? false, settings: ref.current?.settings ?? createDemoState().settings };
    ref.current = fresh;
    setState(fresh);
    void clearFiles();
  }, []);

  const clearAll = useCallback(() => {
    const empty = createEmptyState();
    ref.current = empty;
    setState(empty);
    void clearFiles();
  }, []);

  const value = useMemo(() => (state ? { state, update, commit, resetDemo, clearAll } : null), [state, update, commit, resetDemo, clearAll]);

  // The ref is only read inside the update callbacks, never while rendering.
  // eslint-disable-next-line react-hooks/refs
  return value ? <StoreContext.Provider value={value}>{children}</StoreContext.Provider> : <>{fallback}</>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useAppState(): AppState {
  return useStore().state;
}
