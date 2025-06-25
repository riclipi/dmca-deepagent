import { Suspense } from 'react'
import AdminUserDetailClient from './admin-user-detail-client'
import { LoadingSpinner } from '@/components/loading-spinner'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminUserDetailPage({ params }: Props) {
  const { id } = await params

  return (
    <div className="space-y-6">
      <Suspense fallback={
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <AdminUserDetailClient userId={id} />
      </Suspense>
    </div>
  )
}