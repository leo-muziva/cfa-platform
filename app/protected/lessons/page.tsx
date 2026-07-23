import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getLessonHistory } from '@/lib/services/PlatformService'

export default async function LessonHistoryPage() {
  const result = await getLessonHistory()
  if ('error' in result) redirect('/auth/login')
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Lesson history</h1><p className="text-muted-foreground">Past and upcoming lessons. Financial details are not included here.</p></div>
    {result.items.length === 0 ? <p>No lessons yet.</p> : result.items.map((item) => <Card key={item.id}><CardHeader><CardTitle className="flex justify-between"><span>{new Date(item.starts_at).toLocaleString('en-ZA')}</span><Badge variant="secondary">{item.status}</Badge></CardTitle></CardHeader><CardContent>{item.fencer_name}</CardContent></Card>)}</div>
}
