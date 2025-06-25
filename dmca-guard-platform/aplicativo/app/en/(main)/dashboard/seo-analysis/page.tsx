"use client"
import dynamic from 'next/dynamic'

const SEOAnalysisPage = dynamic(() => import('../../../../(main)/dashboard/seo-analysis/page'), {
  ssr: false
})

export default function EnglishSEOAnalysisPage() {
  return <SEOAnalysisPage />
}