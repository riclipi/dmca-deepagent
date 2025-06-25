'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSpinner } from '@/components/loading-spinner'

// Dynamically import SwaggerUI to avoid SSR issues
const SwaggerUI = dynamic(
  () => import('swagger-ui-react'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }
)

export default function APIDocsPage() {
  const [spec, setSpec] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSpec = async () => {
      try {
        const response = await fetch('/api/docs')
        if (!response.ok) {
          throw new Error('Failed to fetch API specification')
        }
        const data = await response.json()
        setSpec(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchSpec()
  }, [])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-96">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>Failed to load API documentation</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">DMCA Guard Platform API</h1>
          <p className="text-muted-foreground">
            Complete API documentation for the DMCA Guard Platform. 
            This interactive documentation allows you to test API endpoints directly.
          </p>
        </div>
        
        <Card>
          <CardContent className="p-0">
            <div className="swagger-container">
              {spec && (
                <SwaggerUI
                  spec={spec}
                  docExpansion="list"
                  defaultModelsExpandDepth={2}
                  tryItOutEnabled={true}
                  requestInterceptor={(request: any) => {
                    // Add any custom headers or authentication here
                    return request
                  }}
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Need help? Contact our team at{' '}
            <a href="mailto:support@dmcaguard.com" className="text-primary hover:underline">
              support@dmcaguard.com
            </a>
          </p>
        </div>
      </div>

      <style jsx global>{`
        .swagger-container .swagger-ui {
          font-family: inherit;
        }
        .swagger-ui .topbar {
          display: none;
        }
        .swagger-ui .info {
          margin: 20px 0;
        }
        .swagger-ui .scheme-container {
          background: transparent;
          box-shadow: none;
        }
        .swagger-ui .opblock-summary {
          border: none;
        }
        .swagger-ui .opblock {
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          margin-bottom: 16px;
        }
        .swagger-ui .opblock .opblock-summary {
          border-radius: 8px 8px 0 0;
        }
        .swagger-ui .opblock.is-open .opblock-summary {
          border-bottom: 1px solid hsl(var(--border));
        }
      `}</style>
    </div>
  )
}