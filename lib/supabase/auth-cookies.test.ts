import { describe, expect, it } from "vitest";
import { selectStaleAuthCookieNames } from "./auth-cookies";

describe("selectStaleAuthCookieNames", () => {
  it("selects an invalid session cookie and its chunks", () => {
    expect(
      selectStaleAuthCookieNames([
        "sb-cfa-auth-token",
        "sb-cfa-auth-token.0",
        "sb-cfa-auth-token.1",
        "theme",
      ]),
    ).toEqual([
      "sb-cfa-auth-token",
      "sb-cfa-auth-token.0",
      "sb-cfa-auth-token.1",
    ]);
  });

  it("keeps the PKCE code verifier required by the OAuth callback", () => {
    expect(
      selectStaleAuthCookieNames([
        "sb-cfa-auth-token-code-verifier",
        "sb-cfa-auth-token",
      ]),
    ).toEqual(["sb-cfa-auth-token"]);
  });
});
