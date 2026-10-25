import "server-only";
import { resolveActiveFamily, type WorkspaceInfo } from "@/lib/demo/workspace";
import { backendConfigured } from "./env";
import { createUserClient } from "./supabase";

export interface DeviceSession {
  mode: "supabase" | "device-local";
  userId: string | null;
  familyId: string | null;
  role: string | null;
  email: string | null;
  authenticated: boolean;
  configured: boolean;
  isDemo?: boolean;
  workspaces?: WorkspaceInfo[];
  demoSeedVersion?: number | null;
  demoReferenceDate?: string | null;
}

export async function readSession(): Promise<DeviceSession> {
  if (!backendConfigured()) {
    return { mode: "device-local", userId: null, familyId: null, role: null, email: null, authenticated: false, configured: false };
  }
  try {
    const supabase = await createUserClient();
    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData.user) {
      return { mode: "supabase", userId: null, familyId: null, role: null, email: null, authenticated: false, configured: true };
    }
    const [{ data: memberships }, { data: profile }] = await Promise.all([
      supabase.from("family_memberships").select("family_id, role, families ( id, name, is_demo, demo_seed_version, demo_reference_date )").eq("user_id", userData.user.id),
      supabase.from("profiles").select("active_family_id").eq("id", userData.user.id).maybeSingle(),
    ]);
    const workspaces: WorkspaceInfo[] = (memberships ?? []).map((row) => {
      const fam = Array.isArray(row.families) ? row.families[0] : row.families;
      return {
        id: String(row.family_id),
        name: String(fam?.name ?? "Family"),
        isDemo: Boolean(fam?.is_demo),
        role: String(row.role),
        seedVersion: fam?.demo_seed_version ?? null,
        referenceDate: fam?.demo_reference_date ?? null,
      };
    });
    const active = resolveActiveFamily(workspaces, profile?.active_family_id ?? null);
    return {
      mode: "supabase",
      userId: userData.user.id,
      familyId: active?.id ?? null,
      role: active?.role ?? null,
      email: userData.user.email ?? null,
      authenticated: true,
      configured: true,
      isDemo: Boolean(active?.isDemo),
      workspaces,
      demoSeedVersion: active?.seedVersion ?? null,
      demoReferenceDate: active?.referenceDate ?? null,
    };
  } catch {
    return { mode: "supabase", userId: null, familyId: null, role: null, email: null, authenticated: false, configured: true };
  }
}
