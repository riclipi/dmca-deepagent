import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  CreditCard, 
  Settings, 
  BarChart3, 
  Shield,
  UserCheck,
  DollarSign,
  Activity
} from 'lucide-react'
import { prisma } from '@/lib/db'

export default async function AdminDashboard() {
  // Buscar estatísticas gerais
  const [
    totalUsers,
    activeUsers,
    totalSubscriptions,
    activeSubscriptions,
    totalRevenue,
    recentSignups
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { amount: true }
    }),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // últimos 7 dias
        }
      }
    })
  ])

  const stats = [
    {
      title: 'Total de Usuários',
      value: totalUsers.toLocaleString('pt-BR'),
      description: `${activeUsers} ativos`,
      icon: Users,
      href: '/admin/users'
    },
    {
      title: 'Assinaturas Ativas',
      value: activeSubscriptions.toLocaleString('pt-BR'),
      description: `${totalSubscriptions} total`,
      icon: CreditCard,
      href: '/admin/subscriptions'
    },
    {
      title: 'Receita Mensal',
      value: `R$ ${(totalRevenue._sum.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      description: 'Assinaturas ativas',
      icon: DollarSign,
      href: '/admin/subscriptions'
    },
    {
      title: 'Novos Usuários',
      value: recentSignups.toLocaleString('pt-BR'),
      description: 'Últimos 7 dias',
      icon: UserCheck,
      href: '/admin/users'
    }
  ]

  const quickActions = [
    {
      title: 'Gerenciar Usuários',
      description: 'Visualizar e editar contas de usuário',
      icon: Users,
      href: '/admin/users',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200'
    },
    {
      title: 'Assinaturas',
      description: 'Gerenciar planos e pagamentos',
      icon: CreditCard,
      href: '/admin/subscriptions',
      color: 'bg-green-50 hover:bg-green-100 border-green-200'
    },
    {
      title: 'Analytics',
      description: 'Relatórios e métricas',
      icon: BarChart3,
      href: '/admin/analytics',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200'
    },
    {
      title: 'Configurações',
      description: 'Configurações da plataforma',
      icon: Settings,
      href: '/admin/settings',
      color: 'bg-gray-50 hover:bg-gray-100 border-gray-200'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
              <Link href={stat.href}>
                <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto">
                  Ver detalhes →
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => (
          <Link key={action.title} href={action.href}>
            <Card className={`transition-colors ${action.color} border`}>
              <CardHeader>
                <div className="flex items-center space-x-3">
                  <action.icon className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {action.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Novos usuários cadastrados</p>
                  <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
                </div>
                <div className="text-lg font-bold">{recentSignups}</div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Assinaturas ativas</p>
                  <p className="text-xs text-muted-foreground">Total atual</p>
                </div>
                <div className="text-lg font-bold">{activeSubscriptions}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Status do Sistema</p>
                  <p className="text-xs text-muted-foreground">Todos os serviços</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">Online</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Banco de Dados</p>
                  <p className="text-xs text-muted-foreground">PostgreSQL</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-green-600">Conectado</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}