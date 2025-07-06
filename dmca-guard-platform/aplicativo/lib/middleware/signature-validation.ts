import { NextRequest, NextResponse } from 'next/server'
import { requestSigner, shouldProtectEndpoint } from '@/lib/security/request-signing'
import { ApiResponse } from '@/lib/api-response'

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

  // Parse body if needed
  let body
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      const clonedRequest = request.clone()
      const text = await clonedRequest.text()
      body = text ? JSON.parse(text) : undefined
    } catch (error) {
      return ApiResponse.error('Invalid request body')
    }
  }

  // Validate signature
  const validation = await requestSigner.validateSignature(request, body)

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

    return ApiResponse.unauthorized(validation.error || 'Invalid request signature')
  }

  // Add validated timestamp to headers for downstream use
  const response = NextResponse.next()
  response.headers.set('x-validated-timestamp', validation.timestamp!.toString())
  
  return response
}