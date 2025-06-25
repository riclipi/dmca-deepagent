
'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Mail, Phone } from 'lucide-react'

export default function SuspendedPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">
              Conta Suspensa
            </CardTitle>
            <CardDescription>
              Sua conta foi temporariamente suspensa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Sua conta foi suspensa devido a uma violação dos nossos termos de uso. 
              Entre em contato conosco para mais informações sobre como reativar sua conta.
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center justify-center space-x-2 text-sm">
                <Mail className="h-4 w-4 text-primary" />
                <span>suporte@dmcaguard.com</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-sm">
                <Phone className="h-4 w-4 text-primary" />
                <span>(11) 9999-9999</span>
              </div>
            </div>

            <div className="pt-4 space-y-2">
              <Link href="/contact">
                <Button className="w-full">
                  Entrar em Contato
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" className="w-full">
                  Tentar Fazer Login Novamente
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
