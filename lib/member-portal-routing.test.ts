import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const read = (relativePath: string) => readFileSync(new URL(relativePath, root), "utf8");

function protectedPages(directory = new URL("app/protected/", root)): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(fileURLToPath(directory), entry.name);
    if (entry.isDirectory()) return protectedPages(new URL(`${entry.name}/`, directory));
    return entry.name === "page.tsx" ? [readFileSync(path, "utf8")] : [];
  });
}

describe("consolidated member portal routing", () => {
  it("uses Profile as the canonical first destination and links the crest to the public home", () => {
    const layout = read("app/protected/layout.tsx");
    const navigation = read("components/portal/portal-navigation.tsx");
    expect(layout).toContain("{ href: '/protected', label: 'Profile' }");
    expect(layout).not.toMatch(/label: ["'](?:Overview|Membership|Dependents)["']/);
    expect(navigation).toContain('href="/"');
    expect(navigation).toContain('aria-label="Cape Fencing Academy home"');
  });

  it("keeps legacy member destinations as compatibility redirects", () => {
    expect(read("app/protected/profile/page.tsx")).toContain("redirect('/protected')");
    expect(read("app/protected/membership-request/page.tsx")).toContain("redirect('/protected/membership')");
    expect(read("app/protected/dependents/page.tsx")).toContain("redirect('/protected/family#dependents')");
    expect(read("app/membership-portal/page.tsx")).toContain("redirect('/protected/membership')");
  });

  it("keeps dependent management on Family without a booking call to action", () => {
    const family = read("app/protected/family/page.tsx");
    expect(family).toContain('id="dependents"');
    expect(family).not.toContain('href="/protected/book"');
    expect(family).not.toMatch(/Book (?:a |for (?:this )?)?dependent/i);
  });

  it("does not render page-level backward navigation inside the protected portal", () => {
    const source = protectedPages().join("\n");
    expect(source).not.toContain("BackButton");
    expect(source).not.toMatch(/[←‹]\s*Back|>\s*Back\s*</);
  });
});
