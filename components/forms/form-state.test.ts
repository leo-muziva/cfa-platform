import { describe, expect, it } from "vitest";
import { keptValues, normalizeFieldName } from "./form-state";

describe("keptValues", () => {
  it("keeps valid fields and drops the invalid ones", () => {
    const formData = new FormData();
    formData.set("full_name", "Leo Muziva");
    formData.set("phone", "+2766");
    formData.set("terms_accepted", "on");
    expect(keptValues(formData, { phone: "Enter a valid phone number" })).toEqual({
      full_name: ["Leo Muziva"],
      terms_accepted: ["on"],
    });
  });

  it("matches camelCase errors to snake_case fields", () => {
    const formData = new FormData();
    formData.set("starts_at", "2026-10-02T10:00");
    formData.set("coach_id", "abc");
    expect(keptValues(formData, { startsAt: "Pick a time" })).toEqual({ coach_id: ["abc"] });
  });

  it("keeps every value of repeated fields", () => {
    const formData = new FormData();
    formData.append("participantIds", "a");
    formData.append("participantIds", "b");
    expect(keptValues(formData, undefined)).toEqual({ participantIds: ["a", "b"] });
  });

  it("normalises field names", () => {
    expect(normalizeFieldName("emergency_contact_phone")).toBe(normalizeFieldName("emergencyContactPhone"));
  });
});
