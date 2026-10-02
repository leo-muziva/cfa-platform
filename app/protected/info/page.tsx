import type { Metadata } from "next";
import { ClubInfo } from "@/components/landing/club-info";

export const metadata: Metadata = {
  title: "Club Info — Cape Fencing Academy",
};

// Same info block as the home page, inside the portal layout.
export default function ClubInfoPage() {
  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">
          Member Portal
        </p>
        <h1 className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl">
          Club Info
        </h1>
      </header>

      <ClubInfo compact className="bg-transparent px-0 py-0 sm:px-0 md:px-0 md:py-0" />
    </div>
  );
}
