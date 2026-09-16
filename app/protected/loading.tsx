export default function ProtectedLoading() {
  return (
    <div className="flex min-h-[22rem] items-center justify-center" aria-busy="true" aria-live="polite">
      <div className="w-full max-w-lg rounded-[1.75rem] border border-border bg-card px-8 py-10 text-center text-card-foreground shadow-xl">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-xs font-bold tracking-widest text-primary-foreground">CFA</div>
        <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted-foreground">Member Portal</p>
        <h1 className="mt-3 font-serif text-3xl font-light">Loading your account</h1>
        <p className="mt-3 text-sm text-muted-foreground">One moment while we securely prepare your CFA workspace.</p>
      </div>
    </div>
  )
}
