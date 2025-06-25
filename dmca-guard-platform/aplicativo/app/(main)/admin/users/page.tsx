import { Suspense } from 'react'
import AdminUsersClient from './admin-users-client'
import { LoadingSpinner } from '@/components/loading-spinner'

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Gerenciamento de Usuários</h2>
        <p className="text-muted-foreground">
          Visualize e gerencie todas as contas de usuário da plataforma
        </p>
      </div>
      
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <AdminUsersClient />
      </Suspense>
    </div>
  )
}