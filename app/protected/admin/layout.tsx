import Link from 'next/link'

/**
 * Shared frame for all admin pages: a small sub-nav under the app header.
 * Access control happens per-page via the admin service guard + RLS,
 * so this layout stays purely presentational.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 w-full flex flex-col gap-6">
      <nav aria-label="Admin sections" className="flex items-center gap-4 border-b pb-3 text-sm">
        <span className="font-semibold">Admin</span>
        <Link href="/protected/admin" className="text-muted-foreground hover:text-foreground transition-colors">
          Dashboard
        </Link>
        <Link href="/protected/admin/members" className="text-muted-foreground hover:text-foreground transition-colors">
          Members
        </Link>
      </nav>
      {children}
    </div>
  )
}
