import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AccountChoicePage() {
  return <main className="min-h-screen bg-white px-6 py-20 text-[#25145c]"><div className="mx-auto max-w-4xl space-y-8"><div><h1 className="text-4xl font-semibold">Access CFA</h1><p className="mt-3 text-[#625b73]">Choose the action that matches what you want to do.</p></div><div className="grid gap-5 md:grid-cols-3">
    <Card><CardHeader><CardTitle>Login</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Access an existing account.</p><Button asChild><Link href="/auth/login">Login</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Sign up as guest</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Create an account. Guest signup does not grant membership.</p><Button asChild><Link href="/auth/sign-up">Create guest account</Link></Button></CardContent></Card>
    <Card><CardHeader><CardTitle>Request membership</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Membership is granted only after staff approval. Create or log into a guest account first.</p><Button asChild><Link href="/protected/membership-request">Request membership</Link></Button></CardContent></Card>
  </div></div></main>
}
