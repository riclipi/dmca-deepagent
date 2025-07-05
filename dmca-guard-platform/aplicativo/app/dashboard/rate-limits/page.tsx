import { Metadata } from 'next'
import { RateLimitWidget } from '@/components/dashboard/rate-limit-widget'
import { RateLimitChart } from '@/components/dashboard/rate-limit-chart'
import { RateLimitAlert } from '@/components/dashboard/rate-limit-alert'

export const metadata: Metadata = {
  title: 'API Rate Limits | DMCA Guard',
  description: 'Monitor your API usage and rate limits',
}

export default function RateLimitsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Rate Limits</h1>
        <p className="text-gray-500 mt-2">
          Monitor your API usage and ensure you stay within your plan limits
        </p>
      </div>

      {/* Alert for high usage */}
      <RateLimitAlert threshold={80} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Usage Widget */}
        <div className="md:col-span-1">
          <RateLimitWidget />
        </div>

        {/* Usage History Chart */}
        <div className="md:col-span-1">
          <RateLimitChart />
        </div>
      </div>

      {/* Additional Information */}
      <div className="grid gap-6 md:grid-cols-2 mt-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Rate Limit Information</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Rate limits reset every hour</li>
            <li>• Different endpoints have different limits</li>
            <li>• Upgrade your plan for higher limits</li>
            <li>• Use webhooks to reduce API calls</li>
          </ul>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="font-semibold text-green-900 mb-2">Best Practices</h3>
          <ul className="space-y-2 text-sm text-green-800">
            <li>• Cache responses when possible</li>
            <li>• Use batch operations for multiple items</li>
            <li>• Implement exponential backoff for retries</li>
            <li>• Monitor usage regularly to avoid surprises</li>
          </ul>
        </div>
      </div>
    </div>
  )
}