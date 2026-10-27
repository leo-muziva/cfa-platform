import { redirect } from 'next/navigation'

/** /protected/dependents: old link, now the dependents section of the family page. */
export default async function DependentsPage() {
  redirect('/protected/family#dependents')
}
