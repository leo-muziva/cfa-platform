'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Member Portal route error', error)
  }, [error])

  return (
    <div className="flex min-h-[22rem] items-center justify-center">
      <div className="w-full max-w-lg rounded-[1.75rem] bg-slate-950 px-8 py-10 text-center text-white shadow-xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xs font-bold tracking-widest text-black">CFA</div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/55">Member Portal</p>
        <h1 className="mt-3 font-serif text-3xl font-light">We could not load this page</h1>
        <p className="mt-3 text-sm leading-6 text-white/65">Try again once. If the problem continues, return to the CFA home page and sign in again.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button onClick={reset} className="rounded-full bg-white text-black hover:bg-white/85">Try again</Button>
          <Button asChild variant="outline" className="rounded-full border-white/25 bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Link href="/">CFA home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
