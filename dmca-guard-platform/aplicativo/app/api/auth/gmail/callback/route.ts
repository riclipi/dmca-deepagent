// app/api/auth/gmail/callback/route.ts - Gmail OAuth callback handler

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gmailService } from '@/lib/services/gmail-secure'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.redirect(
        new URL('/auth/login?error=unauthenticated', request.url)
      )
    }

    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Verificar erro do OAuth
    if (error) {
      console.error('Gmail OAuth error:', error)
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=gmail_auth_denied', request.url)
      )
    }

    // Verificar código de autorização
    if (!code) {
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=no_auth_code', request.url)
      )
    }

    try {
      // Trocar código por token
      const tokens = await gmailService.exchangeCodeForToken(code)
      
      // Salvar token no banco
      await prisma.userIntegration.upsert({
        where: {
          userId_provider: {
            userId: session.user.id,
            provider: 'GMAIL'
          }
        },
        update: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          status: 'ACTIVE',
          lastSyncAt: new Date()
        },
        create: {
          userId: session.user.id,
          provider: 'GMAIL',
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          status: 'ACTIVE'
        }
      })

      // Redirecionar para settings com sucesso
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&success=gmail_connected', request.url)
      )
    } catch (error) {
      console.error('Error exchanging code for token:', error)
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=token_exchange_failed', request.url)
      )
    }
  } catch (error) {
    console.error('Gmail callback error:', error)
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=internal_error', request.url)
    )
  }
}