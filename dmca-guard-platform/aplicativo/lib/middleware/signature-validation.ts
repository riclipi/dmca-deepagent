import { NextRequest, NextResponse } from 'next/server'
import { validateSignature } from '@/lib/security/request-signing-edge'
import { ApiResponse } from '@/lib/api-response'

// Define which endpoints should be protected
const PROTECTED_PATTERNS = [
  '/api/admin/',
  '/api/agents/',
  '/api/takedown-requests/',
  '/api/detected-content/'
]

function shouldProtectEndpoint(pathname: string): boolean {
  return PROTECTED_PATTERNS.some(pattern => pathname.startsWith(pattern))
}

export async function signatureValidationMiddleware(request: NextRequest) {
  const pathname = new URL(request.url).pathname

  // Check if endpoint should be protected
  if (!shouldProtectEndpoint(pathname)) {
    return NextResponse.next()
  }

  // Allow if signature validation is disabled (development)
  if (process.env.DISABLE_REQUEST_SIGNING === 'true') {
    console.warn(`[Security] Request signing disabled for ${pathname}`)
    return NextResponse.next()
  }

  // Get signing secret
  const secret = process.env.REQUEST_SIGNING_SECRET
  if (!secret) {
    console.error('[Security] REQUEST_SIGNING_SECRET not configured')
    return NextResponse.json(
      { error: 'Internal configuration error' },
      { status: 500 }
    )
  }

  // Validate signature
  const validation = await validateSignature(request, secret, {
    includeBody: request.method !== 'GET' && request.method !== 'HEAD'
  })

  if (!validation.isValid) {
    console.error(`[Security] Invalid signature for ${pathname}:`, validation.error)
    
    // Log the attempt for monitoring
    if (process.env.NODE_ENV === 'production') {
      // TODO: Log to monitoring service
      console.error('[Security] Potential security violation:', {
        pathname,
        method: request.method,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
        userAgent: request.headers.get('user-agent'),
        error: validation.error
      })
    }

    return NextResponse.json(
      { error: validation.error || 'Invalid request signature' },
      { status: 401 }
    )
  }

  // Add validated timestamp to headers for downstream use
  const response = NextResponse.next()
  response.headers.set('x-validated-timestamp', validation.timestamp!.toString())
  
  return response
}