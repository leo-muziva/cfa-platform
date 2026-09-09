import { BackButton } from "@/components/back-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh">
      <div className="fixed right-6 top-6 z-50 flex items-center gap-3">
        <ThemeToggle />
        <BackButton
          fallback="/"
          useHistory={false}
          className="bg-background/20 text-foreground backdrop-blur-md hover:bg-background/30 focus-visible:outline-foreground/60"
        />
      </div>
      {children}
    </div>
  );
}
