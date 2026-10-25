import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { backendConfigured, supabasePublishableKey, supabaseServiceRoleKey, supabaseUrl } from "./env";

export function requireSupabaseUrl(): { url: string; publishableKey: string } {
  const url = supabaseUrl();
  const publishableKey = supabasePublishableKey();
  if (!url || !publishableKey) {
    throw new Error("DEVICE_LOCAL_MODE");
  }
  return { url, publishableKey };
}

export async function createUserClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = requireSupabaseUrl();
  const cookieStore = await cookies();
  return createServerClient(url, publishableKey, {
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
  return backendConfigured() && supabasePublishableKey() ? "supabase" : "device-local";
}
