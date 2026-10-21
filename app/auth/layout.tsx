// The main bar (root layout) has the theme toggle and Home, so the auth
// pages don't need their own.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative min-h-[calc(100svh-var(--site-nav-height))]">{children}</div>;
}
