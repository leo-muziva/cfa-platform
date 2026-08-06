import { BackButton } from "@/components/back-button";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-svh">
      <BackButton
        fallback="/"
        useHistory={false}
        className="fixed right-6 top-6 z-50 bg-background/20 text-foreground backdrop-blur-md hover:bg-background/30 focus-visible:outline-foreground/60"
      />
      {children}
    </div>
  );
}
