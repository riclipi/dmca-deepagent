// dmca-guard-platform/app/app/dashboard/dashboard-client.tsx

'use client'

import { useEffect, useState } from 'react'
// REMOVEMOS a importação 'useSession'
import { motion } from 'framer-motion'
import { Header } from '@/components/header'
// ... (todas as suas outras importações permanecem)
import { Session } from 'next-auth' // NOVA importação para tipagem
import Link from 'next/link'
import { 
  Shield, Search, AlertTriangle, CheckCircle, TrendingUp,
  Eye, Mail, Clock, Plus
} from 'lucide-react'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Footer } from '@/components/footer'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Adicione a importação do StatsCard
import { StatsCard } from '@/components/stats-card'


// ... (a interface DashboardStats permanece a mesma)
interface DashboardStats {
  overview: {
    brandProfiles: number
    monitoringSessions: number
    detectedContent: number
    takedownRequests: number
    unreadNotifications: number
  }
  recent: {
    detectedContent: Array<{
      id: string
      title: string
      platform: string
      detectedAt: string
      brandProfile: {
        brandName: string
      }
    }>
    takedowns: Array<{
      id: string
      status: string
      platform: string
      createdAt: string
      detectedContent: {
        title: string
        platform: string
      }
    }>
  }
  analytics: {
    takedownsByStatus: Record<string, number>
    contentByPlatform: Record<string, number>
    last30Days: {
      detectedContent: number
      takedowns: number
    }
  }
}


// NOVA interface para as props do componente
interface DashboardClientProps {
  session: Session | null;
}

// O componente agora recebe 'session' como prop
export default function DashboardClient({ session }: DashboardClientProps) {
  // REMOVEMOS a linha: const { data: session } = useSession()
  
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Verificamos se temos o ID do usuário antes de buscar os dados
    if (session?.user?.id) {
      fetchStats(session.user.id)
    } else {
      setIsLoading(false) // Se não tiver ID, paramos o loading
    }
  }, [session]) // O useEffect agora depende da prop 'session'

  // A função agora recebe o userId e o envia para a API
  const fetchStats = async (userId: string) => {
    try {
      // Passamos o userId como um parâmetro de busca na URL
      const response = await fetch(`/api/dashboard/stats?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // O restante do seu código (o return com o JSX) permanece exatamente o mesmo
  // ... (todo o seu JSX de 300 linhas vai aqui, sem alterações)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Bem-vinda, {session?.user?.name}!
          </h1>
          <p className="text-muted-foreground">
            Aqui está um resumo da proteção do seu conteúdo
          </p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Perfis de Marca"
            value={stats?.overview.brandProfiles || 0}
            icon={Shield}
            description="Perfis ativos sendo monitorados"
          />
          <StatsCard
            title="Sessões de Monitoramento"
            value={stats?.overview.monitoringSessions || 0}
            icon={Search}
            description="Monitoramentos em execução"
          />
          <StatsCard
            title="Conteúdo Detectado"
            value={stats?.overview.detectedContent || 0}
            icon={AlertTriangle}
            description="Total de infrações encontradas"
            trend={{
              value: stats?.analytics.last30Days.detectedContent || 0,
              isPositive: false
            }}
          />
          <StatsCard
            title="Takedowns Enviados"
            value={stats?.overview.takedownRequests || 0}
            icon={Mail}
            description="Solicitações de remoção"
            trend={{
              value: stats?.analytics.last30Days.takedowns || 0,
              isPositive: true
            }}
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Detected Content */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                    Conteúdo Detectado Recentemente
                  </CardTitle>
                  <CardDescription>
                    Últimas infrações encontradas
                  </CardDescription>
                </div>
                <Link href="/detected-content">
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Todos
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {stats?.recent.detectedContent.length ? (
                  <div className="space-y-4">
                    {stats.recent.detectedContent.map((content) => (
                      <div key={content.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{content.title}</h4>
                          <p className="text-xs text-muted-foreground">
                            {content.brandProfile.brandName} • {content.platform}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {new Date(content.detectedAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum conteúdo infrator detectado!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Ações Rápidas</CardTitle>
                <CardDescription>
                  Configure sua proteção
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/brand-profiles/new">
                  <Button className="w-full justify-start" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Perfil de Marca
                  </Button>
                </Link>
                <Link href="/monitoring/new">
                  <Button className="w-full justify-start" variant="outline">
                    <Search className="h-4 w-4 mr-2" />
                    Nova Sessão de Monitoramento
                  </Button>
                </Link>
                <Link href="/takedowns">
                  <Button className="w-full justify-start" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    Ver Takedowns
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button className="w-full justify-start" variant="outline">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade de Plano
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Takedowns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-8"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2 text-blue-500" />
                  Takedowns Recentes
                </CardTitle>
                <CardDescription>
                  Status das suas solicitações de remoção
                </CardDescription>
              </div>
              <Link href="/takedowns">
                <Button variant="outline" size="sm">
                  Ver Todos
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats?.recent.takedowns.length ? (
                <div className="space-y-4">
                  {stats.recent.takedowns.map((takedown) => (
                    <div key={takedown.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{takedown.detectedContent.title}</h4>
                        <p className="text-xs text-muted-foreground">
                          {takedown.platform}
                        </p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <StatusBadge status={takedown.status} />
                        <p className="text-xs text-muted-foreground">
                          {new Date(takedown.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhum takedown enviado ainda</p>
                  <Link href="/detected-content">
                    <Button className="mt-4" size="sm">
                      Verificar Conteúdo Detectado
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </div>
  )
}