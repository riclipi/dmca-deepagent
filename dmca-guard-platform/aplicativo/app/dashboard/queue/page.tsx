import { QueueStatusDashboard } from '@/components/dashboard/queue-status-dashboard'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Queue Status | DMCA Guard',
  description: 'Monitor your scan queue status and performance metrics',
}

export default function QueuePage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Queue Status</h1>
        <p className="text-muted-foreground">
          Monitor your scan queue status, view performance metrics, and manage queued scans.
        </p>
      </div>

      <QueueStatusDashboard />
    </div>
  )
}