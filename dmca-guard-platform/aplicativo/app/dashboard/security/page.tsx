import { AbuseMonitoringDashboard } from '@/components/dashboard/abuse-monitoring-dashboard'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Security Monitoring | DMCA Guard',
  description: 'Monitor user abuse scores and security violations',
}

export default function SecurityPage() {
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Security Monitoring</h1>
        <p className="text-muted-foreground">
          Monitor user abuse scores, track violations, and manage security threats in real-time.
        </p>
      </div>

      <AbuseMonitoringDashboard />
    </div>
  )
}