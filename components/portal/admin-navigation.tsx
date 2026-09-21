'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/protected/admin', label: 'Dashboard' },
  { href: '/protected/admin/members', label: 'Members' },
  { href: '/protected/admin/households', label: 'Households' },
  { href: '/protected/admin/membership-requests', label: 'Requests' },
  { href: '/protected/admin/lessons', label: 'Lessons' },
  { href: '/protected/admin/coaches', label: 'Coaches' },
  { href: '/protected/admin/closures', label: 'Closures' },
  { href: '/protected/admin/lesson-settings', label: 'Lesson settings' },
  { href: '/protected/admin/invoicing', label: 'Invoicing' },
  { href: '/protected/admin/payments', label: 'Payments' },
  { href: '/protected/admin/products', label: 'Products' },
  { href: '/protected/admin/bulk-orders', label: 'Bulk orders' },
]

export function AdminNavigation() {
  const pathname = usePathname()
  const isCurrent = (href: string) =>
    href === '/protected/admin' ? pathname === href : pathname.startsWith(href)

  return (
    <nav aria-label="Admin sections" className="flex flex-wrap items-center gap-4 border-b pb-3 text-sm">
      <span className="font-semibold">Admin</span>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isCurrent(link.href) ? 'page' : undefined}
          className={
            isCurrent(link.href)
              ? 'font-medium text-foreground underline decoration-2 underline-offset-8'
              : 'text-muted-foreground hover:text-foreground'
          }
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}
