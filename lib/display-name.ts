const TITLES = new Set(["dr", "mr", "mrs", "ms", "miss", "prof", "coach", "sir"]);

// "Dr. Misha Galukhin" should greet "Misha", not "Dr.".
export function greetingName(fullName: string | null | undefined): string {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  const first = words.find((word) => !TITLES.has(word.replace(/\.$/, "").toLowerCase()));
  return first ?? words[0] ?? "member";
}
