import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Analytics Dashboard | DMCA Guard',
  description: 'Comprehensive analytics and insights for your DMCA protection',
}

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}