"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { AppState } from "../types";
import { createDemoState, createEmptyState, STATE_VERSION } from "../seed";
import { clearFiles } from "../files";

const STORAGE_KEY = "smaran:state";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function migrate(parsed: AppState): AppState {
  if (parsed.version === STATE_VERSION && Array.isArray(parsed.measurements)) return parsed;
  const seed = createDemoState();
  return {
    ...parsed,
    version: STATE_VERSION,
    measurements: Array.isArray(parsed.measurements) ? parsed.measurements : seed.measurements,
  };
}

function readStorage(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDemoState();
    return migrate(JSON.parse(raw) as AppState);
  } catch {
    return createDemoState();
  }
}

let snapshot: AppState | null = null;
const serverSnapshot = createDemoState();

function getSnapshot(): AppState {
  if (typeof window === "undefined") return serverSnapshot;
  if (!snapshot) snapshot = readStorage();
  return snapshot;
}

function persist(next: AppState) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* session keeps working in memory */
  }
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      snapshot = migrate(JSON.parse(e.newValue) as AppState);
      emit();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

interface StoreValue {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  commit: <T>(fn: (s: AppState) => [AppState, T]) => T;
  resetDemo: () => void;
  clearAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode; fallback?: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);

  const update = useCallback((fn: (s: AppState) => AppState) => {
    persist(fn(getSnapshot()));
  }, []);

  const commit = useCallback(<T,>(fn: (s: AppState) => [AppState, T]): T => {
    const [next, value] = fn(getSnapshot());
    persist(next);
    return value;
  }, []);

  const resetDemo = useCallback(() => {
    const current = getSnapshot();
    persist({ ...createDemoState(), onboarded: current.onboarded, settings: current.settings });
    void clearFiles();
  }, []);

  const clearAll = useCallback(() => {
    persist(createEmptyState());
    void clearFiles();
  }, []);

  const value = useMemo(() => ({ state, update, commit, resetDemo, clearAll }), [state, update, commit, resetDemo, clearAll]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export function useAppState(): AppState {
  return useStore().state;
}
