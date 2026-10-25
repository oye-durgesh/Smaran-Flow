import { describe, expect, it } from "vitest";
import { VaultError } from "./vault-error";

describe("database failures", () => {
  it("do not look like success", () => {
    const err = new VaultError("Update failed.", 500);
    expect(err.status).toBe(500);
    expect(err.message).toBe("Update failed.");
    expect(err.name).toBe("VaultError");
  });

  it("maps unauthorized vault access to 401", () => {
    const err = new VaultError("Sign in to use the family vault.", 401);
    expect(err.status).toBe(401);
  });

  it("maps missing backend to 503 device-local, not a fake cloud write", () => {
    const err = new VaultError("This server is in device-local mode. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.", 503);
    expect(err.status).toBe(503);
    expect(err.message).toContain("device-local");
  });
});
