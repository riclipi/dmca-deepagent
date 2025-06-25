import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    redirect('/auth/login')
  }

  // Verificar se o usuário é admin (SUPER_USER)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { planType: true, status: true }
  })

  if (!user || user.planType !== 'SUPER_USER' || user.status !== 'ACTIVE') {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground">
            Gerencie usuários, assinaturas e configurações da plataforma
          </p>
        </div>
        <div className="flex gap-2">
          <a 
            href="/docs" 
            target="_blank"
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
          >
            📚 API Docs
          </a>
        </div>
      </div>
      {children}
    </div>
  )
}