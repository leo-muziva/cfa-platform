import Link from 'next/link'
import { PUBLIC_CONTACT_LINKS, PUBLIC_LEGAL_LINKS } from '@/lib/public-site'

const links = [
  ['Home', '/'], ['Classes', '/classes'], ['Membership', '/membership'],
  ['About', '/about'], ['Trial & contact', '/contact'],
] as const

export function PublicPageShell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-white text-[#25145c]"><header className="border-b border-[#2d176b]/10 bg-white/95"><nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-5" aria-label="Public navigation"><Link href="/" className="font-semibold">Cape Fencing Academy</Link><div className="flex flex-wrap gap-5 text-sm text-[#625b73]">{links.map(([label, href]) => <Link key={href} href={href} className="hover:text-[#8a6810]">{label}</Link>)}<Link href="/auth" className="font-medium text-[#2d176b] hover:text-[#8a6810]">Login / Sign up</Link></div></nav></header><section className="mx-auto max-w-6xl px-6 py-20"><h1 className="text-4xl md:text-6xl tracking-[-0.04em]">{title}</h1><p className="mt-5 max-w-2xl text-lg text-[#625b73]">{intro}</p><div className="mt-12">{children}</div></section><footer className="mx-auto flex max-w-6xl flex-wrap justify-between gap-8 border-t border-[#2d176b]/10 px-6 py-10 text-sm text-[#625b73]"><div className="flex max-w-md flex-col gap-2"><span>© 2026 Cape Fencing Academy</span>{PUBLIC_CONTACT_LINKS.map((link) => <a key={link.id} href={link.href} {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="hover:text-[#8a6810] underline-offset-4 hover:underline">{link.shortLabel}</a>)}</div><div className="flex flex-wrap content-start gap-4">{PUBLIC_LEGAL_LINKS.map((link) => <Link key={link.href} href={link.href} className="hover:text-[#8a6810] underline-offset-4 hover:underline">{link.label}</Link>)}</div></footer></main>
}
