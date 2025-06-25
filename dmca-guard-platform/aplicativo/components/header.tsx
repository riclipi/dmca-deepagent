'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button' 
import { 
  Shield, 
  Menu, 
  X, 
  Bell, 
  User, 
  Settings, 
  LogOut,
  Crown,
  Zap
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'


export function Header() {
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)



  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Perfis de Marca', href: '/brand-profiles' },
    { name: 'Monitoramento', href: '/monitoring' },
    { name: 'SEO Analysis', href: '/dashboard/seo-analysis' },
    { name: 'Takedowns', href: '/takedown-requests' }, // Corrigido para /takedown-requests
    { name: 'Planos', href: '/pricing' }
  ]

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case 'FREE': return 'bg-gray-500'
      case 'BASIC': return 'bg-blue-500'
      case 'PREMIUM': return 'bg-purple-500'
      case 'ENTERPRISE': return 'bg-gold-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">DMCA Guard</span>
          </Link>

          {/* Desktop Navigation */}
          {session && (
            <nav className="hidden md:flex items-center space-x-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          )}

          {/* Action Buttons + User Menu */}
          <div className="flex items-center space-x-4">
            {session?.user ? ( // Verificação mais segura
              <>
                {/* Criar Monitoramento Button */}
                <Link href="/integrated-monitoring">
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                    <Zap className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Criar Monitoramento</span>
                    <span className="sm:hidden">Criar</span>
                  </Button>
                </Link>

                {/* Plan Badge */}
                <Badge 
                  className={`${getPlanBadgeColor(session.user.planType)} text-white`}
                >
                  <Crown className="h-3 w-3 mr-1" />
                  {session.user.planType}
                </Badge>

                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    3
                  </span>
                </Button>

                {/* User Menu */}
                <div className="relative group">
                  <Button variant="ghost" size="icon">
                    <User className="h-5 w-5" />
                  </Button>
                  
                  <div className="absolute right-0 mt-2 w-56 bg-background border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-muted-foreground border-b">
                        <p className="font-semibold">{session.user.name}</p>
                        {/* --- ALTERAÇÃO 1: ADICIONADO O E-MAIL --- */}
                        <p className="truncate">{session.user.email}</p>
                      </div>
                      <Link
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm hover:bg-accent"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configurações
                      </Link>
                      <Link
                        href="/subscription/cancel"
                        className="flex items-center px-4 py-2 text-sm hover:bg-accent text-red-600"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancelar Assinatura
                      </Link>
                      <button
                        // --- ALTERAÇÃO 2: MELHORADA A FUNÇÃO signOut ---
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="flex items-center w-full px-4 py-2 text-sm hover:bg-accent text-left"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sair
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/auth/login">
                  <Button variant="ghost">Entrar</Button>
                </Link>
                <Link href="/auth/register">
                  <Button>Cadastrar</Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && session && (
          <div className="md:hidden border-t py-4">
            <div className="px-2 pb-3">
              <Link href="/integrated-monitoring" onClick={() => setIsMenuOpen(false)}>
                <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white">
                  <Zap className="h-4 w-4 mr-2" />
                  Criar Monitoramento
                </Button>
              </Link>
            </div>
            <nav className="flex flex-col space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}