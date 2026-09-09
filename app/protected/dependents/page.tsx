import { redirect } from 'next/navigation'

export default async function DependentsPage() {
  redirect('/protected/family#dependents')
}
