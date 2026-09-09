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
      /role\s*=\s*'admin'[\s\S]*?is_staff\s*=\s*true,[\s\S]*?staff_type\s*=\s*'admin'/,
    );
    expect(localSeed).toMatch(
      /role\s*=\s*'coach'[\s\S]*?is_staff\s*=\s*true,[\s\S]*?staff_type\s*=\s*'coach'/,
    );
  });

  it("keeps the ordinary fencer and guardian accounts non-staff", () => {
    for (const role of ["fencer", "guardian"]) {
      expect(localSeed).toMatch(
        new RegExp(
          `role\\s*=\\s*'${role}'[\\s\\S]*?is_staff\\s*=\\s*false,[\\s\\S]*?staff_type\\s*=\\s*null`,
        ),
      );
    }
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
