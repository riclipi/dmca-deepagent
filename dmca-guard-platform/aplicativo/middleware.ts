
import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

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
  function middleware(req) {
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
    const isPublicPage = ['/', '/pricing', '/about'].includes(pathnameWithoutLocale)

    if (isApiAuthRoute) {
      return null
    }

    if (isAuthPage) {
      if (isAuth) {
        const redirectUrl = locale === defaultLocale ? '/dashboard' : `/${locale}/dashboard`
        return NextResponse.redirect(new URL(redirectUrl, req.url))
      }
      return null
    }

    if (!isAuth && !isPublicPage) {
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
    '/((?!api|_next/static|_next/image|favicon.ico).*)'
  ]
}
