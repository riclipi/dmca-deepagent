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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Painel Administrativo</h1>
        <p className="text-muted-foreground">
          Gerencie usuários, assinaturas e configurações da plataforma
        </p>
      </div>
      {children}
    </div>
  )
}