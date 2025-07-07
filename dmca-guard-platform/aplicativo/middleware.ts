
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit-edge'
import { simpleRateLimit, getRateLimitHeaders } from '@/lib/middleware/simple-rate-limit'
import { signatureValidationMiddleware } from '@/lib/middleware/signature-validation'
import { getToken } from 'next-auth/jwt'

const locales = ['en', 'pt']
const defaultLocale = 'pt'

function getLocale(req: any): string {
  const { pathname } = req.nextUrl
  
  // Check if there is any supported locale in the pathname
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  )

  if (pathnameHasLocale) return pathname.split('/')[1]

  // For now, default to Portuguese
  return defaultLocale
}

export default withAuth(
  async function middleware(req) {
    // Apply rate limiting first for API routes
    if (req.nextUrl.pathname.startsWith('/api/')) {
      try {
        // Try to use advanced rate limiter first
        const advancedRateLimitResponse = await rateLimitMiddleware(req as NextRequest)
        if (advancedRateLimitResponse && advancedRateLimitResponse.status === 429) {
          return advancedRateLimitResponse
        }
      } catch (error) {
        // Check if this is a Redis configuration error in production
        if (process.env.NODE_ENV === 'production' && 
            error instanceof Error && 
            error.message.includes('Redis configuration is required')) {
          console.error('Critical: Redis not configured in production:', error.message)
          return NextResponse.json(
            { 
              error: 'Service Configuration Error',
              message: 'The application is misconfigured. Please contact the administrator.',
              code: 'REDIS_CONFIG_ERROR'
            },
            { status: 503 } // Service Unavailable
          )
        }
        
        // Fallback to simple rate limiter if advanced fails
        console.warn('Advanced rate limiter failed, falling back to simple rate limiter:', error)
        
        const token = await getToken({ req: req as NextRequest })
        const identifier = token?.sub || req.headers.get('x-forwarded-for') || 'unknown'
        
        const rateLimitResult = await simpleRateLimit(identifier, 100, 3600)
        
        if (!rateLimitResult.success) {
          const response = NextResponse.json(
            { error: 'Too Many Requests' },
            { status: 429 }
          )
          
          // Add rate limit headers
          const headers = getRateLimitHeaders(rateLimitResult)
          headers.forEach((value, key) => {
            response.headers.set(key, value)
          })
          
          return response
        }
      }
      
      // Apply signature validation for critical APIs
      const signatureResponse = await signatureValidationMiddleware(req as NextRequest)
      if (signatureResponse.status === 401) {
        return signatureResponse
      }
    }

    const token = req.nextauth.token
    const isAuth = !!token
    
    // Handle i18n routing first
    const { pathname } = req.nextUrl
    const pathnameHasLocale = locales.some(
      (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    )

    // Get the current locale
    const locale = getLocale(req)
    
    // Remove locale from pathname for auth checks
    const pathnameWithoutLocale = pathnameHasLocale 
      ? pathname.slice(`/${locale}`.length) || '/'
      : pathname

    const isAuthPage = pathnameWithoutLocale.startsWith('/auth')
    const isApiAuthRoute = pathname.startsWith('/api/auth')
    const isPublicApiRoute = pathname.startsWith('/api/health') || pathname.startsWith('/api/api-docs')
    const isPublicPage = ['/', '/pricing', '/about', '/test-rate-limit'].includes(pathnameWithoutLocale)

    if (isApiAuthRoute || isPublicApiRoute) {
      return null
    }

    if (isAuthPage) {
      if (isAuth) {
        const redirectUrl = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`
        return NextResponse.redirect(new URL(redirectUrl, req.url))
      }
      return null
    }

    if (!isAuth && !isPublicPage && !isPublicApiRoute) {
      let from = pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }

      const loginUrl = locale === defaultLocale 
        ? `/auth/login?from=${encodeURIComponent(from)}`
        : `/${locale}/auth/login?from=${encodeURIComponent(from)}`
      
      return NextResponse.redirect(new URL(loginUrl, req.url))
    }

    // Verificar status do usuário
    if (isAuth && token?.status === 'SUSPENDED') {
      const suspendedUrl = locale === defaultLocale ? '/suspended' : `/${locale}/suspended`
      return NextResponse.redirect(new URL(suspendedUrl, req.url))
    }

    return null
  },
  {
    callbacks: {
      authorized: () => true
    }
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
}
