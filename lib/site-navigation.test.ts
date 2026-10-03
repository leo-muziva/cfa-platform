import { describe, expect, it } from "vitest";
import { MAIN_LINKS, MEMBER_PORTAL_HREF, isMainLinkCurrent } from "@/components/site-navigation";

describe("main bar", () => {
  it("has the four page buttons in order, with Member Portal on its own", () => {
    expect(MAIN_LINKS.map((link) => link.label)).toEqual(["Home", "Book", "Membership", "Shop"]);
    expect(MEMBER_PORTAL_HREF).toBe("/protected");
  });

  it("highlights the right button for each page", () => {
    const current = (pathname: string) =>
      [...MAIN_LINKS, { href: MEMBER_PORTAL_HREF, label: "Member Portal" }]
        .filter((link) => isMainLinkCurrent(link.href, pathname))
        .map((link) => link.label);

    expect(current("/")).toEqual(["Home"]);
    expect(current("/protected/book")).toEqual(["Book"]);
    expect(current("/protected/book/some-coach")).toEqual(["Book"]);
    expect(current("/protected/membership")).toEqual(["Membership"]);
    expect(current("/protected/shop/orders")).toEqual(["Shop"]);
    expect(current("/protected")).toEqual(["Member Portal"]);
    expect(current("/protected/lessons")).toEqual(["Member Portal"]);
    expect(current("/protected/admin/members")).toEqual(["Member Portal"]);
    expect(current("/protected/info")).toEqual([]);
    expect(current("/privacy")).toEqual([]);
  });

  it("doesn't treat a page that only starts with the same letters as a match", () => {
    expect(isMainLinkCurrent("/protected/book", "/protected/bookings")).toBe(false);
    expect(isMainLinkCurrent("/protected/shop", "/protected/shopping")).toBe(false);
  });
});
