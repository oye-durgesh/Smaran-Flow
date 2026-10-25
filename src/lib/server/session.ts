import "server-only";
import { backendConfigured } from "./env";
import { createUserClient } from "./supabase";

export interface DeviceSession {
  mode: "supabase" | "device-local";
  userId: string | null;
  familyId: string | null;
  role: string | null;
  authenticated: boolean;
  configured: boolean;
}

export async function readSession(): Promise<DeviceSession> {
  if (!backendConfigured()) {
    return { mode: "device-local", userId: null, familyId: null, role: null, authenticated: false, configured: false };
  }
  try {
    const supabase = await createUserClient();
    const { data: userData, error } = await supabase.auth.getUser();
    if (error || !userData.user) {
      return { mode: "supabase", userId: null, familyId: null, role: null, authenticated: false, configured: true };
    }
    const { data: membership } = await supabase.from("family_memberships").select("family_id, role").eq("user_id", userData.user.id).limit(1).maybeSingle();
    return {
      mode: "supabase",
      userId: userData.user.id,
      familyId: membership?.family_id ?? null,
      role: membership?.role ?? null,
      authenticated: true,
      configured: true,
    };
  } catch {
    return { mode: "supabase", userId: null, familyId: null, role: null, authenticated: false, configured: true };
  }
}
