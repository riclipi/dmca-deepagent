import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DashboardClient from '../../(main)/dashboard/dashboard-client'

export default async function EnglishDashboardPage() {
  const session = await getServerSession(authOptions)
  return <DashboardClient session={session} />
}