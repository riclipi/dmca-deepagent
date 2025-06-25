"use client"
import dynamic from 'next/dynamic'

const CancelSubscriptionPage = dynamic(() => import('../../../../(main)/subscription/cancel/page'), {
  ssr: false
})

export default function EnglishCancelSubscriptionPage() {
  return <CancelSubscriptionPage />
}