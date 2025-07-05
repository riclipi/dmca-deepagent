'use client'

import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

// Dynamic import to avoid SSR issues
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">API Documentation</h1>
          <p className="text-muted-foreground">
            Complete API reference for DMCA Guard Platform. All endpoints require authentication unless otherwise specified.
          </p>
        </div>
        
        <div className="bg-card rounded-lg shadow-lg p-4">
          <SwaggerUI 
            url="/api/openapi.json"
            docExpansion="list"
            defaultModelsExpandDepth={1}
            displayRequestDuration={true}
            filter={true}
            showExtensions={true}
            showCommonExtensions={true}
            tryItOutEnabled={true}
          />
        </div>

        <div className="mt-8 space-y-4">
          <div className="bg-muted rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
            <p className="mb-4">
              Most endpoints require authentication via Bearer token. Include your JWT token in the Authorization header:
            </p>
            <pre className="bg-background p-4 rounded-md overflow-x-auto">
              <code>{`Authorization: Bearer YOUR_JWT_TOKEN`}</code>
            </pre>
          </div>

          <div className="bg-muted rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Rate Limiting</h2>
            <p className="mb-4">
              API endpoints are rate limited based on your subscription plan. Rate limit information is included in response headers:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><code>X-RateLimit-Limit</code> - Your rate limit</li>
              <li><code>X-RateLimit-Remaining</code> - Remaining requests</li>
              <li><code>X-RateLimit-Reset</code> - Reset timestamp</li>
            </ul>
          </div>

          <div className="bg-muted rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">WebSocket Events</h2>
            <p className="mb-4">
              Real-time updates are available via WebSocket connections. Connect to the following namespaces:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><code>/monitoring</code> - Monitoring session updates</li>
              <li><code>/agents</code> - Agent activity updates</li>
            </ul>
            <p className="mt-4">
              Example connection:
            </p>
            <pre className="bg-background p-4 rounded-md overflow-x-auto mt-2">
              <code>{`import { io } from 'socket.io-client'

const socket = io('/monitoring', {
  path: '/api/socket/io',
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
})

socket.on('progress', (data) => {
  console.log('Progress update:', data)
})`}</code>
            </pre>
          </div>

          <div className="bg-muted rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Error Handling</h2>
            <p className="mb-4">
              All API responses follow a consistent format. Error responses include:
            </p>
            <pre className="bg-background p-4 rounded-md overflow-x-auto">
              <code>{`{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error 1", "Detailed error 2"],
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req_123456"
  }
}`}</code>
            </pre>
          </div>

          <div className="bg-muted rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Pagination</h2>
            <p className="mb-4">
              List endpoints support pagination via query parameters:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li><code>page</code> - Page number (default: 1)</li>
              <li><code>limit</code> - Items per page (default: 20, max: 100)</li>
            </ul>
            <p className="mt-4">
              Paginated responses include metadata:
            </p>
            <pre className="bg-background p-4 rounded-md overflow-x-auto mt-2">
              <code>{`{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}