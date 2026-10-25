"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { AppState } from "../types";
import { createDemoState, createEmptyState, STATE_VERSION } from "../seed";
import { clearFiles } from "../files";
import { fetchSession, fetchVault, type SessionPayload } from "./cloud";

const STORAGE_KEY = "smaran:state";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function migrate(parsed: AppState): AppState {
  if (parsed.version === STATE_VERSION && Array.isArray(parsed.measurements)) {
    return {
      ...parsed,
      reminders: parsed.reminders.map((r) => ({ ...r, kind: r.kind === "pickup" || r.kind === "check" || r.kind === "medicine" ? r.kind : r.kind === "other" ? "other" : "other" })),
      appointments: parsed.appointments.map((a) => ({ ...a, status: a.status === "completed" || a.status === "cancelled" ? a.status : "upcoming" })),
    };
  }
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
let cloudView = false;
const serverSnapshot = createDemoState();

function getSnapshot(): AppState {
  if (typeof window === "undefined") return serverSnapshot;
  if (!snapshot) snapshot = readStorage();
  return snapshot;
}

function persistDevice(next: AppState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* session keeps working in memory */
  }
}

function persist(next: AppState) {
  snapshot = next;
  if (cloudView) {
    const device = readStorage();
    persistDevice({
      ...device,
      settings: next.settings,
      demoNow: next.demoNow,
      selectedDate: next.selectedDate,
      onboarded: next.onboarded,
      user: next.user,
      conversations: next.conversations,
    });
  } else {
    persistDevice(next);
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

const idleSession: SessionPayload = {
  mode: "device-local",
  userId: null,
  familyId: null,
  role: null,
  authenticated: false,
  configured: false,
  persistence: "device-local",
  cloud: false,
  message: "Checking persistence…",
};

interface StoreValue {
  state: AppState;
  session: SessionPayload;
  vaultError: string | null;
  update: (fn: (s: AppState) => AppState) => void;
  commit: <T>(fn: (s: AppState) => [AppState, T]) => T;
  resetDemo: () => void;
  clearAll: () => void;
  refreshSession: () => Promise<void>;
  refreshVault: () => Promise<boolean>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode; fallback?: ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const [session, setSession] = useState<SessionPayload>(idleSession);
  const [vaultError, setVaultError] = useState<string | null>(null);

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

  const refreshVault = useCallback(async () => {
    const vault = await fetchVault();
    if (!vault.ok) {
      setVaultError(vault.error);
      return false;
    }
    setVaultError(null);
    const device = getSnapshot();
    cloudView = true;
    snapshot = {
      ...device,
      family: vault.family as AppState["family"],
      appointments: vault.appointments as AppState["appointments"],
      reminders: vault.reminders as AppState["reminders"],
      measurements: vault.measurements as AppState["measurements"],
      documents: vault.documents as AppState["documents"],
      memory: vault.memory as AppState["memory"],
    };
    emit();
    return true;
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const next = await fetchSession();
      setSession(next);
      if (next.authenticated) {
        await refreshVault();
      } else {
        cloudView = false;
        snapshot = readStorage();
        emit();
      }
    } catch {
      setSession({
        ...idleSession,
        message: "Could not read the session. Device-local records are still in this browser.",
      });
    }
  }, [refreshVault]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  const value = useMemo(
    () => ({ state, session, vaultError, update, commit, resetDemo, clearAll, refreshSession, refreshVault }),
    [state, session, vaultError, update, commit, resetDemo, clearAll, refreshSession, refreshVault],
  );
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

/** Browser copy that is never auto-deleted when the vault hydrates. */
export function readDeviceState(): AppState {
  if (typeof window === "undefined") return createDemoState();
  return readStorage();
}
