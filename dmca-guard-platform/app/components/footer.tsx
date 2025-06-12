
import Link from 'next/link'
import { Shield } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          {/* Logo */}
          <div className="flex items-center space-x-2 mb-4 md:mb-0">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-primary">DMCA Guard</span>
          </div>

          {/* Links */}
          <div className="flex items-center space-x-6 text-sm text-muted-foreground">
            <Link href="/about" className="hover:text-primary transition-colors">
              Sobre
            </Link>
            <Link href="/pricing" className="hover:text-primary transition-colors">
              Planos
            </Link>
            <Link href="/contact" className="hover:text-primary transition-colors">
              Contato
            </Link>
          </div>

          {/* Copyright */}
          <div className="text-sm text-muted-foreground mt-4 md:mt-0">
            © 2025 DMCA Guard. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  )
}
