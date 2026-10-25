import { describe, it } from "vitest";

/**
 * Live Supabase RLS / two-account tests are blocked in this environment:
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and two test accounts
 * are not configured. These cases must be run against a real project after
 * applying supabase/migrations/0001–0003.
 */
describe.skip("Supabase integration (blocked — no credentials)", () => {
  it("authenticated user reads only their family rows after refresh", () => {
    /* blocked */
  });

  it("unauthorized user is denied another family's appointments", () => {
    /* blocked */
  });

  it("two permitted accounts see the same family appointment", () => {
    /* blocked */
  });

  it("appointment create/complete/cancel/reschedule persist after a new session", () => {
    /* blocked */
  });
});
