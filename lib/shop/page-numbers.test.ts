import { describe, expect, it } from "vitest";
import { pageNumbers } from "./page-numbers";

describe("pageNumbers", () => {
  it("shows nothing for no pages and a single link for one", () => {
    expect(pageNumbers(1, 0)).toEqual([]);
    expect(pageNumbers(1, 1)).toEqual([1]);
  });

  it("shows every page when there are only a few", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3]);
    expect(pageNumbers(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts a gap before the last page when on the first", () => {
    expect(pageNumbers(1, 9)).toEqual([1, 2, "gap", 9]);
  });

  it("puts gaps on both sides in the middle", () => {
    expect(pageNumbers(5, 9)).toEqual([1, "gap", 4, 5, 6, "gap", 9]);
  });

  it("puts a gap after the first page when on the last", () => {
    expect(pageNumbers(9, 9)).toEqual([1, "gap", 8, 9]);
  });

  it("shows a single skipped page rather than a gap", () => {
    expect(pageNumbers(3, 9)).toEqual([1, 2, 3, 4, "gap", 9]);
  });

  it("never repeats a page", () => {
    for (let total = 1; total <= 12; total++) {
      for (let current = 1; current <= total; current++) {
        const pages = pageNumbers(current, total).filter((p) => p !== "gap");
        expect(new Set(pages).size).toBe(pages.length);
        expect(pages).toContain(current);
      }
    }
  });
});
