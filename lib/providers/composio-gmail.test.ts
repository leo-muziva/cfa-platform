import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cleanProviderError, describeComposioError, extractDraftId, getComposioGmailConfig } from "./composio-gmail";

describe("getComposioGmailConfig", () => {
  it("needs the API key and the connected account ID", () => {
    expect(getComposioGmailConfig({ COMPOSIO_API_KEY: "k" })).toBeNull();
    expect(getComposioGmailConfig({ COMPOSIO_GMAIL_CONNECTED_ACCOUNT_ID: "ca_1" })).toBeNull();
  });

  it("works without a user ID, since the ca_ ID identifies the inbox", () => {
    expect(getComposioGmailConfig({ COMPOSIO_API_KEY: "k", COMPOSIO_GMAIL_CONNECTED_ACCOUNT_ID: "ca_1" })).toEqual({
      apiKey: "k",
      connectedAccountId: "ca_1",
      userId: null,
      toolkitVersion: null,
    });
  });

  it("uses the user ID when one is set", () => {
    const config = getComposioGmailConfig({
      COMPOSIO_API_KEY: "k",
      COMPOSIO_GMAIL_CONNECTED_ACCOUNT_ID: "ca_1",
      COMPOSIO_USER_ID: " cfa-ordering ",
    });
    expect(config?.userId).toBe("cfa-ordering");
  });
});

describe("extractDraftId", () => {
  it("finds the draft id in the shapes Gmail responses use", () => {
    expect(extractDraftId({ id: "r1" })).toBe("r1");
    expect(extractDraftId({ draft: { id: "r2" } })).toBe("r2");
    expect(extractDraftId({ response_data: { id: "r3" } })).toBe("r3");
    expect(extractDraftId({})).toBeNull();
  });
});

describe("cleanProviderError", () => {
  it("removes addresses and links and keeps errors short", () => {
    const cleaned = cleanProviderError("Error executing the tool at https://backend.composio.dev/x?token=abc for orders@supplier.example " + "x".repeat(500));
    expect(cleaned).not.toContain("supplier.example");
    expect(cleaned).not.toContain("token=abc");
    expect(cleaned).toContain("[link]");
    expect(cleaned.length).toBeLessThanOrEqual(300);
  });
});

describe("describeComposioError", () => {
  it("adds the API status and message hidden on the cause", () => {
    const apiError = Object.assign(new Error("400 Bad Request"), {
      status: 400,
      error: { error: { message: "Invalid request: attachment.s3key is required" } },
    });
    const wrapped = new Error("Error executing the tool GMAIL_CREATE_EMAIL_DRAFT", { cause: apiError });
    expect(describeComposioError(wrapped)).toBe(
      "Error executing the tool GMAIL_CREATE_EMAIL_DRAFT - 400: Invalid request: attachment.s3key is required"
    );
  });

  it("still removes addresses and links from the cause", () => {
    const wrapped = new Error("Error executing the tool X", { cause: new Error("bad recipient orders@supplier.example see https://x.example/a") });
    const text = describeComposioError(wrapped);
    expect(text).not.toContain("supplier.example");
    expect(text).not.toContain("x.example");
  });

  it("handles a plain error and a non-error", () => {
    expect(describeComposioError(new Error("timeout"))).toBe("timeout");
    expect(describeComposioError("nope")).toBe("Could not reach Composio.");
  });
});
