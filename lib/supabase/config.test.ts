import { describe, expect, it } from "vitest";
import {
  SupabaseConfigError,
  validateSupabasePublicConfig,
} from "./config";

describe("validateSupabasePublicConfig", () => {
  it("rejects missing values", () => {
    expect(() => validateSupabasePublicConfig({})).toThrowError(
      SupabaseConfigError,
    );
  });

  it.each([
    {
      url: "https://your-project.supabase.co",
      publishableKey: "sb_publishable_test",
    },
    {
      url: "https://project.supabase.co",
      publishableKey: "replace-with-your-publishable-key",
    },
  ])("rejects placeholder configuration", (values) => {
    expect(() => validateSupabasePublicConfig(values)).toThrowError(
      expect.objectContaining({ code: "placeholder" }),
    );
  });

  it("rejects malformed and unsupported URLs", () => {
    expect(() =>
      validateSupabasePublicConfig({
        url: "not a url",
        publishableKey: "sb_publishable_test",
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid-url" }));

    expect(() =>
      validateSupabasePublicConfig({
        url: "ftp://project.supabase.co",
        publishableKey: "sb_publishable_test",
      }),
    ).toThrowError(expect.objectContaining({ code: "invalid-url" }));
  });

  it("accepts local Supabase configuration", () => {
    expect(
      validateSupabasePublicConfig({
        url: "http://127.0.0.1:54321/",
        publishableKey: "sb_publishable_local",
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_local",
    });
  });

  it("accepts hosted Supabase configuration", () => {
    expect(
      validateSupabasePublicConfig({
        url: "https://cfa-project.supabase.co",
        publishableKey: "sb_publishable_hosted",
      }),
    ).toEqual({
      url: "https://cfa-project.supabase.co",
      publishableKey: "sb_publishable_hosted",
    });
  });
});
