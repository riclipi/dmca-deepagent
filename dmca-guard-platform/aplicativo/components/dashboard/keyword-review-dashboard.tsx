'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Search,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface KeywordReview {
  id: string
  keyword: string
  riskScore: number
  riskReasons: string[]
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  isApproved: boolean | null
  createdAt: string
  reviewedAt: string | null
  reviewNotes: string | null
  brandProfile?: {
    id: string
    brandName: string
  }
}

interface ReviewStats {
  pending: number
  approved: number
  rejected: number
  averageRiskScore: number
}

interface KeywordReviewCardProps {
  review: KeywordReview
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
  onAction: (id: string, action: 'approve' | 'reject', notes?: string) => void
  isLoading?: boolean
}

function KeywordReviewCard({ review, isSelected, onSelect, onAction, isLoading }: KeywordReviewCardProps) {
  const [notes, setNotes] = useState('')
  const [showNotes, setShowNotes] = useState(false)

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'bg-red-100 text-red-800 border-red-200'
    if (score >= 50) return 'bg-orange-100 text-orange-800 border-orange-200'
    if (score >= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  const getRiskLabel = (score: number) => {
    if (score >= 70) return 'Alto Risco'
    if (score >= 50) return 'Risco Moderado-Alto'
    if (score >= 30) return 'Risco Moderado'
    return 'Baixo Risco'
  }

  const handleApprove = () => {
    onAction(review.id, 'approve', notes || undefined)
    setNotes('')
    setShowNotes(false)
  }

  const handleReject = () => {
    onAction(review.id, 'reject', notes || undefined)
    setNotes('')
    setShowNotes(false)
  }

  return (
    <Card className={`${isSelected ? 'border-blue-500 bg-blue-50' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(review.id, !!checked)}
            />
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-mono text-lg font-medium">"{review.keyword}"</h3>
                <Badge className={getRiskColor(review.riskScore)}>
                  {review.riskScore} - {getRiskLabel(review.riskScore)}
                </Badge>
              </div>
              {review.brandProfile && (
                <p className="text-sm text-muted-foreground">
                  Perfil: {review.brandProfile.brandName}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Risk Reasons */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Motivos de Risco:</h4>
          <ul className="space-y-1">
            {review.riskReasons.map((reason, index) => (
              <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Notes Section */}
        {showNotes && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Notas de Review:</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre esta keyword..."
              className="h-20"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes(!showNotes)}
          >
            <MoreHorizontal className="h-4 w-4" />
            {showNotes ? 'Fechar' : 'Adicionar'} Notas
          </Button>

          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleReject}
              disabled={isLoading}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Rejeitar
            </Button>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isLoading}
            >
              <CheckCircle className="mr-1 h-3 w-3" />
              Aprovar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface StatsCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color?: string
}

function StatsCard({ icon, label, value, color = 'text-gray-600' }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center space-x-2">
          <div className={color}>{icon}</div>
          <div>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KeywordReviewDashboard() {
  const [reviews, setReviews] = useState<KeywordReview[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [bulkNotes, setBulkNotes] = useState('')

  const { toast } = useToast()

  useEffect(() => {
    loadReviews()
  }, [filter])

  const loadReviews = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (filter !== 'all') {
        params.append('status', filter.toUpperCase())
      }
      
      const response = await fetch(`/api/keyword-reviews?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setReviews(data.reviews)
        setStats(data.stats)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Erro ao carregar reviews:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao carregar reviews de keywords',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectReview = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedReviews)
    if (selected) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedReviews(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedReviews.size === reviews.length) {
      setSelectedReviews(new Set())
    } else {
      setSelectedReviews(new Set(reviews.map(r => r.id)))
    }
  }

  const handleSingleAction = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    setActionLoading(id)
    
    try {
      const response = await fetch('/api/keyword-reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId: id,
          action,
          notes
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: 'Sucesso',
          description: data.message
        })
        await loadReviews()
        setSelectedReviews(new Set())
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Erro ao processar review:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao processar review',
        variant: 'destructive'
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedReviews.size === 0) {
      toast({
        title: 'Seleção Necessária',
        description: 'Selecione pelo menos uma keyword para processar',
        variant: 'destructive'
      })
      return
    }

    setActionLoading('bulk')
    
    try {
      const response = await fetch('/api/keyword-reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewIds: Array.from(selectedReviews),
          action: `bulk_${action}`,
          notes: bulkNotes || undefined
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: 'Sucesso',
          description: data.message
        })
        await loadReviews()
        setSelectedReviews(new Set())
        setBulkNotes('')
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Erro ao processar reviews em lote:', error)
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao processar reviews',
        variant: 'destructive'
      })
    } finally {
      setActionLoading(null)
    }
  }

  const pendingReviews = reviews.filter(r => r.status === 'PENDING')
  const hasSelection = selectedReviews.size > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Review de Keywords</h2>
          <p className="text-muted-foreground">
            Analise e aprove keywords moderadas antes de usá-las em sessões de monitoramento
          </p>
        </div>
        <Button onClick={loadReviews} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatsCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Pendentes"
            value={stats.pending}
            color="text-yellow-600"
          />
          <StatsCard
            icon={<CheckCircle className="h-4 w-4" />}
            label="Aprovadas"
            value={stats.approved}
            color="text-green-600"
          />
          <StatsCard
            icon={<XCircle className="h-4 w-4" />}
            label="Rejeitadas"
            value={stats.rejected}
            color="text-red-600"
          />
          <StatsCard
            icon={<Shield className="h-4 w-4" />}
            label="Risco Médio"
            value={Math.round(stats.averageRiskScore)}
            color="text-blue-600"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Filtre reviews por status</CardDescription>
            </div>
            <div className="flex space-x-2">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((filterOption) => (
                <Button
                  key={filterOption}
                  variant={filter === filterOption ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(filterOption)}
                >
                  {filterOption === 'all' ? 'Todos' :
                   filterOption === 'pending' ? 'Pendentes' :
                   filterOption === 'approved' ? 'Aprovadas' : 'Rejeitadas'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Bulk Actions */}
      {pendingReviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ações em Lote</CardTitle>
            <CardDescription>
              Processe múltiplas keywords de uma vez
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={selectedReviews.size === reviews.length && reviews.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm">
                  {selectedReviews.size} de {reviews.length} selecionadas
                </span>
              </div>
              
              {hasSelection && (
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBulkAction('reject')}
                    disabled={actionLoading === 'bulk'}
                  >
                    <XCircle className="mr-1 h-3 w-3" />
                    Rejeitar Selecionadas
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleBulkAction('approve')}
                    disabled={actionLoading === 'bulk'}
                  >
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Aprovar Selecionadas
                  </Button>
                </div>
              )}
            </div>

            {hasSelection && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Notas para ações em lote:</label>
                <Textarea
                  value={bulkNotes}
                  onChange={(e) => setBulkNotes(e.target.value)}
                  placeholder="Adicione observações para todas as keywords selecionadas..."
                  className="h-16"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">Nenhum review encontrado</h3>
              <p className="text-muted-foreground">
                {filter === 'pending' 
                  ? 'Não há keywords pendentes de review no momento'
                  : `Não há keywords ${filter === 'approved' ? 'aprovadas' : 'rejeitadas'} para mostrar`
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-4 pr-4">
              {reviews.map((review) => (
                <KeywordReviewCard
                  key={review.id}
                  review={review}
                  isSelected={selectedReviews.has(review.id)}
                  onSelect={handleSelectReview}
                  onAction={handleSingleAction}
                  isLoading={actionLoading === review.id}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}