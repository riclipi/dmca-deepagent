// dmca-guard-platform/app/app/dashboard/dashboard-client.tsx

'use client'

import { useEffect, useState } from 'react'
// REMOVEMOS a importação 'useSession'
import { motion } from 'framer-motion'
// Header moved to dashboard layout
// ... (todas as suas outras importações permanecem)
import { Session } from 'next-auth' // NOVA importação para tipagem
import { useTranslation } from '@/lib/translations'
import Link from 'next/link'
import { 
  Shield, Search, AlertTriangle, CheckCircle, TrendingUp,
  Eye, Mail, Clock, Plus, PlusSquare, FilePlus, ListFilter // Added ListFilter for Whitelist
} from 'lucide-react'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Footer } from '@/components/footer'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Adicione a importação do StatsCard
import { StatsCard } from '@/components/stats-card'
import { RealTimeScanDashboard } from '@/components/dashboard/real-time-scan-dashboard'
import RealSearchMonitor from '@/components/dashboard/real-search-monitor'
import KeywordGenerator from '@/components/dashboard/keyword-generator'
import PerformanceSummary from '@/components/dashboard/performance-summary'


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
  const { t } = useTranslation()
  
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAddContentModalOpen, setIsAddContentModalOpen] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  enum ContentType { IMAGE = "IMAGE", VIDEO = "VIDEO", AUDIO = "AUDIO", DOCUMENT = "DOCUMENT", OTHER = "OTHER" }
  const [monitoringSessionsList, setMonitoringSessionsList] = useState<Array<{ id: string; name: string }>>([])
  const [brandProfiles, setBrandProfiles] = useState<Array<{ 
    id: string; 
    brandName: string;
    safeKeywords?: string[];
    moderateKeywords?: string[];
    dangerousKeywords?: string[];
    lastKeywordUpdate?: string;
    keywords?: string[];
  }>>([])
  const [isFetchingBrandProfiles, setIsFetchingBrandProfiles] = useState(false)


  useEffect(() => {
    const abortController = new AbortController()
    
    const fetchData = async () => {
      if (session?.user?.id) {
        await fetchStats(session.user.id, abortController.signal)
        await fetchMonitoringSessions(abortController.signal)
        await fetchBrandProfiles(abortController.signal)
      } else {
        setIsLoading(false)
      }
    }
    
    fetchData()
    
    return () => {
      abortController.abort()
    }
  }, [session])

  const fetchStats = async (userId: string, signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/dashboard/stats?userId=${userId}`, { signal })
      if (response.ok) {
        const data = await response.json()
        if (!signal?.aborted) {
          setStats(data)
        }
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error('Erro ao buscar estatísticas:', error)
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }

  const fetchMonitoringSessions = async (signal?: AbortSignal) => {
    if (!session?.user?.id) return
    try {
      const response = await fetch(`/api/monitoring-sessions?userId=${session.user.id}`, { signal })
      if (response.ok) {
        const data = await response.json()
        if (!signal?.aborted) {
          setMonitoringSessionsList(data.sessions || [])
        }
      } else {
        if (!signal?.aborted) {
          console.error('Erro ao buscar sessões de monitoramento:', response.statusText)
          setMonitoringSessionsList([])
        }
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error('Erro ao buscar sessões de monitoramento:', error)
        setMonitoringSessionsList([])
      }
    }
  }

  const fetchBrandProfiles = async (signal?: AbortSignal) => {
    if (!session?.user?.id) return
    setIsFetchingBrandProfiles(true)
    try {
      const response = await fetch('/api/brand-profiles', { signal })
      if (response.ok) {
        const data = await response.json()
        if (!signal?.aborted) {
          setBrandProfiles(data)
        }
      } else {
        if (!signal?.aborted) {
          console.error('Erro ao buscar perfis de marca:', response.statusText)
          setBrandProfiles([])
        }
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error('Erro ao buscar perfis de marca:', error)
        setBrandProfiles([])
      }
    } finally {
      if (!signal?.aborted) {
        setIsFetchingBrandProfiles(false)
      }
    }
  }



  const handleManualAddContent = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setModalError(null); // Limpa erros anteriores

    if (!session?.user?.id) {
      setModalError("Usuário não autenticado.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const data = {
      monitoringSessionId: formData.get('monitoringSessionId') as string,
      title: formData.get('title') as string,
      infringingUrl: formData.get('infringingUrl') as string,
      platform: formData.get('platform') as string,
      contentType: formData.get('contentType') as ContentType,
      userId: session.user.id, // Adiciona userId
    };

    // Validação básica
    if (!data.monitoringSessionId || !data.title || !data.infringingUrl || !data.platform || !data.contentType) {
      setModalError("Todos os campos são obrigatórios.");
      return;
    }

    try {
      const response = await fetch('/api/detected-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setIsAddContentModalOpen(false);
        fetchStats(session.user.id); // Atualiza as estatísticas
        // TODO: Adicionar toast de sucesso opcional
      } else {
        const errorData = await response.json();
        setModalError(errorData.error || "Erro ao adicionar conteúdo.");
      }
    } catch (error) {
      console.error('Erro ao submeter formulário:', error);
      setModalError("Ocorreu um erro inesperado. Tente novamente.");
    }
  };

  // O restante do seu código (o return com o JSX) permanece exatamente o mesmo
  // ... (todo o seu JSX de 300 linhas vai aqui, sem alterações)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
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
      
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Modal para Adicionar Conteúdo Manualmente */}
        <Dialog open={isAddContentModalOpen} onOpenChange={setIsAddContentModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Adicionar Conteúdo Detectado Manualmente</DialogTitle>
              <DialogDescription>
                Preencha os detalhes do conteúdo infrator que você encontrou.
                {modalError && <p className="text-red-500 text-sm mt-2">{modalError}</p>}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleManualAddContent}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="monitoringSessionId" className="text-right">
                    Sessão
                  </Label>
                  <Select name="monitoringSessionId" required>
                    <SelectTrigger className="col-span-3" id="monitoringSessionId">
                      <SelectValue placeholder="Selecione uma sessão" />
                    </SelectTrigger>
                    <SelectContent>
                      {monitoringSessionsList.length === 0 && <SelectItem value="loading" disabled>Carregando sessões...</SelectItem>}
                      {monitoringSessionsList.map(session => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">
                    Título
                  </Label>
                  <Input id="title" name="title" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="infringingUrl" className="text-right">
                    URL Infratora
                  </Label>
                  <Input id="infringingUrl" name="infringingUrl" type="url" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="platform" className="text-right">
                    Plataforma
                  </Label>
                  <Input id="platform" name="platform" className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="contentType" className="text-right">
                    Tipo
                  </Label>
                  <Select name="contentType" required>
                    <SelectTrigger className="col-span-3" id="contentType">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(ContentType).map(type => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit">Submeter</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <StatsCard
            title={t('brandProfiles.title')}
            value={stats?.overview.brandProfiles || 0}
            icon={Shield}
            description="Perfis ativos sendo monitorados"
          />
          <StatsCard
            title={t('monitoring.title')}
            value={stats?.overview.monitoringSessions || 0}
            icon={Search}
            description="Monitoramentos em execução"
          />
          <StatsCard
            title="Detectados"
            value={stats?.overview.detectedContent || 0}
            icon={AlertTriangle}
            description="Conteúdos aguardando revisão"
            trend={{
              value: stats?.analytics.last30Days.detectedContent || 0,
              isPositive: false
            }}
          />
          <StatsCard
            title="DMCA Enviados"
            value={stats?.overview.takedownRequests || 0}
            icon={Mail}
            description="Solicitações DMCA enviadas"
            trend={{
              value: stats?.analytics.last30Days.takedowns || 0,
              isPositive: true
            }}
          />
          <StatsCard
            title="Removidos"
            value={stats?.overview.contentRemoved || 0}
            icon={CheckCircle}
            description="Conteúdos removidos com sucesso"
            trend={{
              value: stats?.analytics.last30Days.removed || 0,
              isPositive: true
            }}
          />
        </div>

        {/* Performance Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <PerformanceSummary />
        </motion.div>

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
                <Link href="/monitoring/new" legacyBehavior>
                  <a>
                    <Button className="w-full justify-start" variant="outline">
                      <Search className="h-4 w-4 mr-2" />
                      {t('monitoring.createSession')}
                    </Button>
                  </a>
                </Link>
                <Link href="/takedown-requests">
                  <Button className="w-full justify-start" variant="outline">
                    <Mail className="h-4 w-4 mr-2" />
                    {t('takedowns.title')}
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button className="w-full justify-start" variant="outline">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Upgrade de Plano
                  </Button>
                </Link>
                <Button className="w-full justify-start" variant="outline" onClick={() => setIsAddContentModalOpen(true)}>
                  <FilePlus className="h-4 w-4 mr-2" />
                  Adicionar Conteúdo Detectado Manualmente
                </Button>
                <Link href="/whitelist">
                  <Button className="w-full justify-start" variant="outline">
                    <ListFilter className="h-4 w-4 mr-2" />
                    Gerenciar Whitelist de Domínios
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
                  {t('dashboard.recentActivity')}
                </CardTitle>
                <CardDescription>
                  Status das suas solicitações de remoção
                </CardDescription>
              </div>
                <Link href="/takedown-requests">
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

        {/* Keyword Generator - PASSO 1 */}
        {brandProfiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-8"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                🪄 Passo 1: Gerar Keywords Seguras
              </h2>
              <p className="text-muted-foreground">
                Primeiro, gere keywords seguras e filtradas para seus perfis de marca
              </p>
            </div>
            <KeywordGenerator 
              brandProfiles={brandProfiles.map(p => ({ 
                id: p.id, 
                brandName: p.brandName, 
                safeKeywords: p.safeKeywords || [],
                moderateKeywords: p.moderateKeywords || [],
                dangerousKeywords: p.dangerousKeywords || [],
                lastKeywordUpdate: p.lastKeywordUpdate
              }))}
              onKeywordsGenerated={() => {
                // Recarregar perfis após gerar keywords
                fetchBrandProfiles();
              }}
            />
          </motion.div>
        )}

        {/* Real Search Monitor - PASSO 2 */}
        {brandProfiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                🔍 Passo 2: Busca Real de Vazamentos
              </h2>
              <p className="text-muted-foreground">
                Execute buscas reais usando as keywords seguras para encontrar conteúdo vazado
              </p>
            </div>
            <RealSearchMonitor 
              brandProfiles={brandProfiles.map(p => ({ 
                id: p.id, 
                brandName: p.brandName, 
                keywords: p.keywords || [], 
                safeKeywords: p.safeKeywords || [] 
              }))}
              onSearchComplete={(results) => {
                // Atualizar stats após busca
                if (session?.user?.id) {
                  fetchStats(session.user.id);
                }
              }}
            />
          </motion.div>
        )}

        {/* Real-Time Scan Dashboard */}
        {brandProfiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Live Protection Monitoring
              </h2>
              <p className="text-muted-foreground">
                Real-time leak detection and threat analysis powered by advanced scanning technology
              </p>
            </div>
            <RealTimeScanDashboard brandProfiles={brandProfiles} />
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  )
}