import "server-only";

function read(name: string): string | undefined {
  const value = process.env[name];
  if (!value || !value.trim()) return undefined;
  return value.trim();
}

export function anthropicApiKey(): string | undefined {
  return read("ANTHROPIC_API_KEY");
}

export function anthropicModel(): string {
  return read("ANTHROPIC_MODEL") ?? "claude-sonnet-4-5";
}

export function supabaseUrl(): string | undefined {
  return read("NEXT_PUBLIC_SUPABASE_URL");
}

export function supabasePublishableKey(): string | undefined {
  return read("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
}

export function supabaseServiceRoleKey(): string | undefined {
  return read("SUPABASE_SERVICE_ROLE_KEY");
}

export function vapidPublicKey(): string | undefined {
  return read("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
}

export function vapidPrivateKey(): string | undefined {
  return read("VAPID_PRIVATE_KEY");
}

/** True when the browser/server can talk to Supabase Auth + RLS (publishable key). */
export function backendConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function serviceRoleConfigured(): boolean {
  return Boolean(supabaseUrl() && supabaseServiceRoleKey());
}

export function claudeConfigured(): boolean {
  return Boolean(anthropicApiKey());
}
