import { describe, expect, it } from "vitest";
import { greetingName } from "./display-name";

describe("greetingName", () => {
  it("uses the first name", () => expect(greetingName("Fiona Fencer")).toBe("Fiona"));
  it("skips a title", () => expect(greetingName("Dr. Misha Galukhin")).toBe("Misha"));
  it("falls back when there is no name", () => expect(greetingName("  ")).toBe("member"));
  it("keeps a lone title rather than nothing", () => expect(greetingName("Coach")).toBe("Coach"));
});
