import { describe, expect, it } from "vitest";
import { PUBLIC_CONTACT_LINKS, PUBLIC_LEGAL_LINKS } from "./public-site";

describe("public footer destinations", () => {
  it("contains the verified contact and social destinations", () => {
    expect(PUBLIC_CONTACT_LINKS.map((link) => link.id)).toEqual([
      "location",
      "email",
      "facebook",
    ]);
    expect(PUBLIC_CONTACT_LINKS.find((link) => link.id === "email")?.href).toBe(
      "mailto:jeremy@capefencingacademy.com",
    );
    expect(
      PUBLIC_CONTACT_LINKS.find((link) => link.id === "facebook")?.href,
    ).toBe("https://www.facebook.com/groups/FencingWC/");
  });

  it("contains both required legal routes", () => {
    expect(PUBLIC_LEGAL_LINKS).toEqual([
      { label: "Privacy / POPIA", href: "/privacy" },
      { label: "Terms & Conditions", href: "/terms" },
    ]);
  });
});
