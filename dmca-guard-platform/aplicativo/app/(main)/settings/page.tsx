import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  
  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-foreground mb-8">
        Configurações
      </h1>
      <SettingsClient session={session} />
    </div>
  )
}