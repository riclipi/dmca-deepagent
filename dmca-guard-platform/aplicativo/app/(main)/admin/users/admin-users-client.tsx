'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Search, 
  Filter, 
  Eye,
  Mail,
  Calendar,
  User,
  CreditCard
} from 'lucide-react'
import Link from 'next/link'

interface User {
  id: string
  name: string
  email: string
  status: string
  planType: string
  planExpiresAt: string | null
  emailVerified: boolean
  lastLoginAt: string | null
  createdAt: string
  activeSubscription: {
    id: string
    status: string
    amount: number
    plan: {
      displayName: string
      name: string
    }
  } | null
  _count: {
    brandProfiles: number
    detectedContent: number
    takedownRequests: number
    monitoringSessions: number
  }
}

const ITEMS_PER_PAGE = 20

export default function AdminUsersClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all')
  const [planFilter, setPlanFilter] = useState(searchParams.get('planType') || 'all')

  // Initialize page from URL
  useEffect(() => {
    const pageFromUrl = parseInt(searchParams.get('page') || '1')
    setCurrentPage(pageFromUrl)
  }, [searchParams])

  const fetchUsers = useCallback(async (page: number = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString()
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (planFilter !== 'all') params.append('planType', planFilter)

      const response = await fetch(`/api/admin/users?${params}`)
      
      if (!response.ok) {
        throw new Error('Erro ao carregar usuários')
      }

      const data = await response.json()
      setUsers(data.data)
      setTotalPages(data.pagination.pages)
      setTotalItems(data.pagination.total)
      setCurrentPage(data.pagination.page)
    } catch (error) {
      console.error('Erro ao buscar usuários:', error)
      toast.error('Erro ao carregar usuários')
    } finally {
      setIsLoading(false)
    }
  }, [searchTerm, statusFilter, planFilter])

  useEffect(() => {
    fetchUsers(currentPage)
  }, [fetchUsers, currentPage])

  const handleSearch = () => {
    // Update URL with filters
    const params = new URLSearchParams()
    if (searchTerm) params.set('search', searchTerm)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (planFilter !== 'all') params.set('planType', planFilter)
    params.set('page', '1')
    
    router.push(`?${params.toString()}`)
    setCurrentPage(1)
    fetchUsers(1)
  }

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', page.toString())
      router.push(`?${params.toString()}`)
      setCurrentPage(page)
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

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="ACTIVE">Ativo</SelectItem>
              <SelectItem value="SUSPENDED">Suspenso</SelectItem>
              <SelectItem value="PENDING_VERIFICATION">Pendente</SelectItem>
              <SelectItem value="DELETED">Deletado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Planos</SelectItem>
              <SelectItem value="FREE">Gratuito</SelectItem>
              <SelectItem value="BASIC">Básico</SelectItem>
              <SelectItem value="PREMIUM">Premium</SelectItem>
              <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
              <SelectItem value="SUPER_USER">Admin</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleSearch} disabled={isLoading}>
            <Filter className="h-4 w-4 mr-2" />
            Filtrar
          </Button>
        </div>
      </Card>

      {/* Results Info */}
      <div className="flex justify-between items-center">
        <p className="text-muted-foreground">
          {isLoading ? 'Carregando...' : `${totalItems} usuário(s) encontrado(s)`}
        </p>
        <p className="text-muted-foreground">
          Página {currentPage} de {totalPages}
        </p>
      </div>

      {/* Users Table */}
      <Card>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Assinatura</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {user._count.brandProfiles} perfis • {user._count.detectedContent} detecções
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      {getStatusBadge(user.status)}
                      {user.emailVerified ? (
                        <div className="text-xs text-green-600">✓ Email verificado</div>
                      ) : (
                        <div className="text-xs text-yellow-600">⚠ Email não verificado</div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-1">
                      {getPlanBadge(user.planType)}
                      {user.planExpiresAt && (
                        <div className="text-xs text-muted-foreground">
                          Expira: {format(new Date(user.planExpiresAt), 'dd/MM/yyyy')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    {user.activeSubscription ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          <Badge variant="default" className="text-xs">
                            {user.activeSubscription.plan.displayName}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          R$ {user.activeSubscription.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-xs">Sem assinatura</Badge>
                    )}
                  </TableCell>
                  
                  <TableCell>
                    <div className="text-sm">
                      {user.lastLoginAt ? (
                        <div className="text-muted-foreground">
                          {format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm')}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Nunca logou</div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {user._count.takedownRequests} takedowns
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(user.createdAt), 'dd/MM/yyyy')}
                      </span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-right">
                    <Link href={`/admin/users/${user.id}`}>
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-1" />
                        Ver Detalhes
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            Anterior
          </Button>
          
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const page = i + Math.max(1, currentPage - 2)
            if (page > totalPages) return null
            
            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page)}
                disabled={isLoading}
              >
                {page}
              </Button>
            )
          })}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}