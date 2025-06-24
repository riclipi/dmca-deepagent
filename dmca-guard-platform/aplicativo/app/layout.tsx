import './globals.css'
import { Inter } from 'next/font/google'
import SessionWrapper from '@/components/session-wrapper'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import Providers from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DMCA Guard - Proteção de Conteúdo Digital',
  description: 'Plataforma SaaS para detecção e remoção automatizada de conteúdo não autorizado',
  keywords: 'DMCA, proteção de conteúdo, takedown, direitos autorais, monitoramento',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionWrapper>
          <Providers>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {/* O Header NÃO é renderizado aqui globalmente! */}
              {children}
              <Toaster />
            </ThemeProvider>
          </Providers>
        </SessionWrapper>
      </body>
    </html>
  )
}
