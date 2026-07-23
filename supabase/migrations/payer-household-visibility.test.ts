import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL("./0004_payer_household_profile_visibility.sql", import.meta.url),
  "utf8",
);

describe("payer household profile visibility migration", () => {
  it("limits household profile reads to the authenticated payer", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("actor.profile_id = auth.uid()");
    expect(sql).toContain("actor.household_role = 'payer'");
    expect(sql).toContain(
      "target.household_id = actor.household_id",
    );
  });

  it("adds only a select policy and restricts helper execution", () => {
    expect(sql).toContain(
      'create policy "Payers can read profiles in their household"',
    );
    expect(sql).toContain("on public.profiles for select");
    expect(sql).toContain(
      "revoke all on function public.current_payer_can_view_profile(uuid) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.current_payer_can_view_profile(uuid) to authenticated",
    );
  });
});
