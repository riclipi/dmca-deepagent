import { RateLimitWidget } from '@/components/dashboard/rate-limit-widget'
import { RateLimitChart } from '@/components/dashboard/rate-limit-chart'
import { RateLimitAlert } from '@/components/dashboard/rate-limit-alert'

export default function TestRateLimitPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold">Rate Limit Test Page</h1>
      
      <RateLimitAlert threshold={50} />
      
      <div className="grid gap-6 md:grid-cols-2">
        <RateLimitWidget />
        <RateLimitChart />
      </div>
    </div>
  )
}