'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Footer } from '@/components/footer'
import { LoadingSpinner } from '@/components/loading-spinner'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Clock,
  Globe,
  ListChecks,
  BarChart3,
  Shield
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface MonitoringSession {
  id: string
  name: string
  description?: string
  brandProfile: {
    id: string
    brandName: string
  }
  targetPlatforms: string[]
  searchTerms: string[]
  isActive: boolean
  scanFrequency: number
  lastScan?: string
  nextScan?: string
  createdAt: string
  _count: {
    detectedContent: number
  }
}

export default function MonitoringSessionsPage() {
  const [monitoringSessions, setMonitoringSessions] = useState<MonitoringSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchMonitoringSessions()
  }, [])

  const fetchMonitoringSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/monitoring-sessions')
      if (response.ok) {
        const data = await response.json()
        setMonitoringSessions(data.sessions || data)
      } else {
        toast.error('Erro ao carregar sessões de monitoramento')
      }
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error('Erro ao carregar sessões de monitoramento')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string, sessionName: string) => {
    if (!confirm(`Tem certeza que deseja remover a sessão "${sessionName}"?`)) {
      return
    }
    try {
      const response = await fetch(`/api/monitoring-sessions/${id}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        toast.success('Sessão removida com sucesso')
        fetchMonitoringSessions()
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Erro ao remover sessão')
      }
    } catch (error) {
      toast.error('Erro ao remover sessão')
    }
  }

  if (isLoading) {
    return (
      <>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Sessões de Monitoramento
            </h1>
            <p className="text-muted-foreground">
              Gerencie suas configurações de varredura e detecção
            </p>
          </div>
          <Link href="/monitoring/new">
            <Button className="mt-4 sm:mt-0">
              <Plus className="h-4 w-4 mr-2" />
              Nova Sessão
            </Button>
          </Link>
        </motion.div>
        {monitoringSessions.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {monitoringSessions.map((session, index) => (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-300 group flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <Search className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{session.name}</CardTitle>
                      </div>
                      <StatusBadge status={session.isActive ? 'ACTIVE' : 'PAUSED'} />
                    </div>
                    {session.description && (
                      <CardDescription className="mt-2 text-sm">
                        {session.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4 flex-grow">
                    {session.brandProfile && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                          <Shield className="h-3 w-3 mr-1" />
                          Perfil de Marca
                        </h4>
                        <p className="text-sm">{session.brandProfile.brandName}</p>
                      </div>
                    )}
                    {session.targetPlatforms.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                          <Globe className="h-3 w-3 mr-1" />
                          Plataformas
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {session.targetPlatforms.slice(0, 3).map((platform, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {platform}
                            </Badge>
                          ))}
                          {session.targetPlatforms.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{session.targetPlatforms.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    {session.searchTerms.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                          <ListChecks className="h-3 w-3 mr-1" />
                          Termos de Busca
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {session.searchTerms.slice(0, 3).map((term, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {term}
                            </Badge>
                          ))}
                          {session.searchTerms.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{session.searchTerms.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t">
                       <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Varredura
                        </h4>
                      <p className="text-sm">
                        Frequência: {session.scanFrequency}h
                      </p>
                      {session.nextScan && (
                        <p className="text-sm text-muted-foreground">
                          Próxima: {format(new Date(session.nextScan), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      )}
                    </div>
                     <div className="text-sm flex items-center text-orange-500 pt-2">
                        <BarChart3 className="h-4 w-4 mr-1" />
                        Conteúdo Detectado:
                        <span className="font-semibold ml-1">{session._count?.detectedContent || 0}</span>
                      </div>
                  </CardContent>
                  <CardContent className="mt-auto pb-4">
                    <div className="flex space-x-2 pt-4 border-t">
                      <Link href={`/monitoring/${session.id}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </Link>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(session.id, session.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-16"
          >
            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhuma sessão de monitoramento criada
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Crie sua primeira sessão para começar a detectar conteúdo infrator automaticamente.
            </p>
            <Link href="/monitoring/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Sessão
              </Button>
            </Link>
          </motion.div>
        )}
      </main>
      <Footer />
    </>
  )
}
