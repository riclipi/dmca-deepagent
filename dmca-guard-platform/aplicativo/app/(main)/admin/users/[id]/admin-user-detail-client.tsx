'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { LoadingSpinner } from '@/components/loading-spinner'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { 
  ArrowLeft,
  User,
  Mail,
  Calendar,
  CreditCard,
  Shield,
  Activity,
  Edit,
  Save,
  X,
  AlertTriangle,
  DollarSign,
  FileText,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'

interface UserDetails {
  id: string
  name: string
  email: string
  status: string
  planType: string
  planExpiresAt: string | null
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  subscriptions: Array<{
    id: string
    status: string
    startDate: string
    endDate: string | null
    amount: number
    plan: {
      id: string
      name: string
      displayName: string
      price: number
      currency: string
      interval: string
    }
  }>
  brandProfiles: Array<{
    id: string
    brandName: string
    isActive: boolean
    createdAt: string
    _count: {
      detectedContent: number
      monitoringSessions: number
    }
  }>
  _count: {
    detectedContent: number
    takedownRequests: number
    monitoringSessions: number
    notifications: number
    auditLogs: number
  }
  stats: {
    recentActivity: Array<{
      action: string
      timestamp: string
      resource: string | null
    }>
    takedownsByStatus: Record<string, number>
  }
}

interface Props {
  userId: string
}

export default function AdminUserDetailClient({ userId }: Props) {
  const router = useRouter()
  const [user, setUser] = useState<UserDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editData, setEditData] = useState({
    status: '',
    planType: ''
  })

  useEffect(() => {
    fetchUserDetails()
  }, [userId])

  const fetchUserDetails = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar dados do usuário')
      }

      const data = await response.json()
      setUser(data)
      setEditData({
        status: data.status,
        planType: data.planType
      })
    } catch (error) {
      console.error('Erro ao buscar usuário:', error)
      toast.error('Erro ao carregar dados do usuário')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveChanges = async () => {
    if (!user) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar usuário')
      }

      toast.success('Usuário atualizado com sucesso!')
      setIsEditing(false)
      fetchUserDetails()
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar usuário')
    } finally {
      setIsSaving(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      ACTIVE: { variant: 'default', label: 'Ativo' },
      SUSPENDED: { variant: 'destructive', label: 'Suspenso' },
      PENDING_VERIFICATION: { variant: 'secondary', label: 'Pendente' },
      DELETED: { variant: 'outline', label: 'Deletado' }
    }
    
    const config = variants[status] || { variant: 'outline', label: status }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getPlanBadge = (planType: string) => {
    const variants: Record<string, any> = {
      FREE: { variant: 'outline', label: 'Gratuito' },
      BASIC: { variant: 'secondary', label: 'Básico' },
      PREMIUM: { variant: 'default', label: 'Premium' },
      ENTERPRISE: { variant: 'destructive', label: 'Enterprise' },
      SUPER_USER: { variant: 'destructive', label: 'Admin' }
    }
    
    const config = variants[planType] || { variant: 'outline', label: planType }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-16">
        <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-2">Usuário não encontrado</h3>
        <p className="text-muted-foreground mb-6">
          O usuário solicitado não existe ou você não tem permissão para visualizá-lo.
        </p>
        <Link href="/admin/users">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Usuários
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6" />
              {user.name}
            </h2>
            <p className="text-muted-foreground">{user.email}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSaveChanges} disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Select value={editData.status} onValueChange={(value) => setEditData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="SUSPENDED">Suspenso</SelectItem>
                  <SelectItem value="PENDING_VERIFICATION">Pendente</SelectItem>
                  <SelectItem value="DELETED">Deletado</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1">
                {getStatusBadge(user.status)}
                <p className="text-xs text-muted-foreground">
                  {user.emailVerified ? '✓ Email verificado' : '⚠ Email não verificado'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plano</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <Select value={editData.planType} onValueChange={(value) => setEditData(prev => ({ ...prev, planType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FREE">Gratuito</SelectItem>
                  <SelectItem value="BASIC">Básico</SelectItem>
                  <SelectItem value="PREMIUM">Premium</SelectItem>
                  <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  <SelectItem value="SUPER_USER">Admin</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="space-y-1">
                {getPlanBadge(user.planType)}
                {user.planExpiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Expira: {format(new Date(user.planExpiresAt), 'dd/MM/yyyy')}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividade</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user._count.detectedContent}</div>
            <p className="text-xs text-muted-foreground">
              Conteúdos detectados
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {user._count.takedownRequests} takedowns enviados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cadastro</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {format(new Date(user.createdAt), 'dd/MM/yyyy')}
            </div>
            <p className="text-xs text-muted-foreground">
              {user.lastLoginAt 
                ? `Último login: ${format(new Date(user.lastLoginAt), 'dd/MM HH:mm')}`
                : 'Nunca logou'
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Information */}
      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="brands">Perfis de Marca</TabsTrigger>
          <TabsTrigger value="activity">Atividade Recente</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Assinaturas</CardTitle>
              <CardDescription>
                Todas as assinaturas deste usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.subscriptions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Vigência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.subscriptions.map((subscription) => (
                      <TableRow key={subscription.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{subscription.plan.displayName}</div>
                            <div className="text-sm text-muted-foreground">{subscription.plan.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={subscription.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {subscription.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            R$ {subscription.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </TableCell>
                        <TableCell>{subscription.plan.interval}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{format(new Date(subscription.startDate), 'dd/MM/yyyy')}</div>
                            {subscription.endDate && (
                              <div className="text-muted-foreground">
                                até {format(new Date(subscription.endDate), 'dd/MM/yyyy')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">Nenhuma assinatura encontrada</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brands">
          <Card>
            <CardHeader>
              <CardTitle>Perfis de Marca</CardTitle>
              <CardDescription>
                Marcas cadastradas pelo usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.brandProfiles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.brandProfiles.map((brand) => (
                    <Card key={brand.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{brand.brandName}</CardTitle>
                          <Badge variant={brand.isActive ? 'default' : 'secondary'}>
                            {brand.isActive ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm text-muted-foreground">
                          <div>Criado: {format(new Date(brand.createdAt), 'dd/MM/yyyy')}</div>
                          <div>{brand._count.detectedContent} detecções</div>
                          <div>{brand._count.monitoringSessions} sessões de monitoramento</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhum perfil de marca cadastrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>
                Últimas ações realizadas pelo usuário
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user.stats.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {user.stats.recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between border-l-2 border-muted pl-4">
                      <div>
                        <div className="font-medium">{activity.action}</div>
                        {activity.resource && (
                          <div className="text-sm text-muted-foreground">
                            Recurso: {activity.resource}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(activity.timestamp), 'dd/MM HH:mm')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Nenhuma atividade recente</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Takedowns por Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(user.stats.takedownsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{status}</span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resumo Geral
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Perfis de Marca</span>
                    <Badge variant="outline">{user._count.monitoringSessions}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Sessões de Monitoramento</span>
                    <Badge variant="outline">{user._count.monitoringSessions}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Notificações</span>
                    <Badge variant="outline">{user._count.notifications}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Logs de Auditoria</span>
                    <Badge variant="outline">{user._count.auditLogs}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}