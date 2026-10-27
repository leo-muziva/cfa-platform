import { Swords } from "lucide-react";
import { ProfileCard } from "@/components/ui/profile-card";
import type { LessonCoachSummary } from "@/types/domain";

const weaponLabels = {
  foil: "Foil",
  epee: "Épée",
  sabre: "Sabre",
} as const;

const coachPhotos: Record<string, { url: string; position: string }> = {
  "Dr. Misha Galukhin": {
    url: "/media/coaches/coach_misha.png",
    position: "center 24%",
  },
  "Jacques Viljoen": {
    url: "/media/coaches/coach_jacques.png",
    position: "center 24%",
  },
  "Jeremy Saner": {
    url: "/media/coaches/coach_jeremy.png",
    position: "center 24%",
  },
  "Caden Sampson": {
    url: "/media/coaches/coach_caden.png",
    position: "center 24%",
  },
};

const fallbackCoachPhoto = coachPhotos["Dr. Misha Galukhin"];

// A coach with their next open lesson time, if any.
export type LessonCoachDirectoryEntry = LessonCoachSummary & {
  nextAvailableAt: string | null;
};

/** Cards for every bookable coach, each linking to that coach's booking page. */
export function CoachDirectory({ coaches }: { coaches: LessonCoachDirectoryEntry[] }) {
  if (coaches.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="font-serif text-2xl text-slate-950 dark:text-white">No coaches are taking bookings</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-white/75">
          Check again soon. Existing lessons are still available in your lesson history.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Available lesson coaches">
      {coaches.map((coach) => {
        const photo = coachPhotos[coach.fullName] ?? fallbackCoachPhoto;
        const href = "/protected/book/" + coach.coachId;

        return (
          <li key={coach.coachId}>
            <ProfileCard
              name={coach.fullName}
              image={photo.url}
              imagePosition={photo.position}
              stats={[
                {
                  icon: <Swords aria-hidden="true" />,
                  label: coach.weapons.map((weapon) => weaponLabels[weapon]).join(" · "),
                },
              ]}
              actionHref={href}
              actionLabel={coach.nextAvailableAt ? "View times" : "See schedule"}
              actionAriaLabel={"View available times with " + coach.fullName}
              isMuted={coach.nextAvailableAt === null}
            />
          </li>
        );
      })}
    </ul>
  );
}
