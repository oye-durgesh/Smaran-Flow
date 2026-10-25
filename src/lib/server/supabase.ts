import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { backendConfigured, supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./env";

export function requireSupabaseUrl(): { url: string; anon: string } {
  const url = supabaseUrl();
  const anon = supabaseAnonKey();
  if (!url || !anon) {
    throw new Error("DEVICE_LOCAL_MODE");
  }
  return { url, anon };
}

export async function createUserClient(): Promise<SupabaseClient> {
  const { url, anon } = requireSupabaseUrl();
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        try {
          for (const c of list) cookieStore.set(c.name, c.value, c.options);
        } catch {
          /* Server Components cannot always set cookies */
        }
      },
    },
  });
}

/** Service role — server routes only. Never import this module from a client file. */
export function createServiceClient(): SupabaseClient {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!url || !key) throw new Error("SERVICE_ROLE_UNAVAILABLE");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function persistenceLabel(): "supabase" | "device-local" {
  return backendConfigured() && supabaseAnonKey() ? "supabase" : "device-local";
}
