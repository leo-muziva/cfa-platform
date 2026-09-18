import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const localSeed = readFileSync(new URL("./seed.sql", import.meta.url), "utf8").replaceAll("\r\n", "\n");
const hostedSeed = readFileSync(
  new URL("../scripts/seed-hosted-users.mjs", import.meta.url),
  "utf8",
);

describe("CFA test account seed identities", () => {
  it("seeds independent admin and coach staff identities locally", () => {
    expect(localSeed).toMatch(
      /is_staff\s*=\s*true,[\s\S]*?staff_type\s*=\s*'admin',[\s\S]*?full_name\s*=\s*'Alice Admin'/,
    );
    expect(localSeed).toMatch(
      /is_staff\s*=\s*true,[\s\S]*?staff_type\s*=\s*'coach',[\s\S]*?full_name\s*=\s*'Dr. Misha Galukhin'/,
    );
  });

  it("keeps the ordinary fencer and guardian accounts non-staff", () => {
    for (const name of ["Fiona Fencer", "George Guardian"]) {
      expect(localSeed).toMatch(
        new RegExp(
          `is_staff\\s*=\\s*false,[\\s\\S]*?staff_type\\s*=\\s*null,[\\s\\S]*?full_name\\s*=\\s*'${name}'`,
        ),
      );
    }
  });

  it("does not set the retired profiles.role column", () => {
    // 0014 drops the column, so writing it here would break the seed outright.
    // Reintroducing it would also bring back the two-sources-of-truth problem
    // where staff_type said coach and role still said fencer.
    expect(localSeed).not.toMatch(/\brole\s*=\s*'(admin|coach|fencer|guardian)'/);
  });

  it("creates a payer and dependent test household", () => {
    expect(localSeed).toContain(
      "'33333333-3333-4333-8333-333333333333',\n  'dependent'",
    );
    expect(localSeed).toContain(
      "payer_id = '44444444-4444-4444-8444-444444444444'",
    );
  });

  it("uses RFC-compliant v4 UUIDs for local Auth users", () => {
    for (const id of [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      "33333333-3333-4333-8333-333333333333",
      "44444444-4444-4444-8444-444444444444",
    ]) {
      expect(localSeed).toContain(`'${id}'`);
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("keeps hosted identity fields aligned with the current model", () => {
    expect(hostedSeed).toContain("membership_status: 'guest'");
    expect(hostedSeed).toContain("is_staff: user.is_staff");
    expect(hostedSeed).toContain("staff_type: user.staff_type");
  });
});
