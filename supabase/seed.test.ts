import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const localSeed = readFileSync(new URL("./seed.sql", import.meta.url), "utf8");
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
      "'33333333-3333-3333-3333-333333333333',\n  'dependent'",
    );
    expect(localSeed).toContain(
      "payer_id = '44444444-4444-4444-4444-444444444444'",
    );
  });

  it("keeps hosted identity fields aligned with the current model", () => {
    expect(hostedSeed).toContain("membership_status: 'guest'");
    expect(hostedSeed).toContain("is_staff: user.is_staff");
    expect(hostedSeed).toContain("staff_type: user.staff_type");
  });
});
