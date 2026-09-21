"use client";

import { useRouter } from "next/navigation";

// A dropdown that changes the sort by navigating to a new URL.
// The parent passes in the URLs so all the current filters are preserved.
export function SortSelect({
  value,
  options,
}: {
  value: string;
  options: { key: string; label: string; href: string }[];
}) {
  const router = useRouter();

  return (
    <select
      value={value}
      onChange={function (e) {
        const chosen = options.find(function (o) {
          return o.key === e.target.value;
        });
        if (chosen) {
          router.push(chosen.href);
        }
      }}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground"
    >
      {options.map(function (o) {
              return (
          <option key={o.key} value={o.key} className="bg-card text-foreground">
            {o.label}
          </option>
        );
      })}
    </select>
  );
}