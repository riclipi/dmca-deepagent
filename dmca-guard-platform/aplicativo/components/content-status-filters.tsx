'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { 
  AlertTriangle, 
  CheckCircle, 
  Mail, 
  Clock, 
  XCircle, 
  Archive,
  Filter,
  X
} from 'lucide-react'

interface ContentStatusFiltersProps {
  onStatusChange: (status: string | null) => void
  currentStatus: string | null
  counts?: {
    total: number
    detected: number
    reviewed: number
    dmcaSent: number
    pendingReview: number
    delisted: number
    rejected: number
    falsePositive: number
    ignored: number
  }
}

const statusConfig = {
  'DETECTED': { 
    label: 'Detectados', 
    icon: AlertTriangle, 
    color: 'bg-orange-500',
    description: 'Aguardando revisão'
  },
  'REVIEWED': { 
    label: 'Revisados', 
    icon: CheckCircle, 
    color: 'bg-blue-500',
    description: 'Confirmados para takedown'
  },
  'DMCA_SENT': { 
    label: 'DMCA Enviados', 
    icon: Mail, 
    color: 'bg-blue-600',
    description: 'Notificação enviada'
  },
  'PENDING_REVIEW': { 
    label: 'Aguardando', 
    icon: Clock, 
    color: 'bg-yellow-600',
    description: 'Resposta do provedor'
  },
  'DELISTED': { 
    label: 'Removidos', 
    icon: CheckCircle, 
    color: 'bg-green-600',
    description: 'Conteúdo removido'
  },
  'REJECTED': { 
    label: 'Rejeitados', 
    icon: XCircle, 
    color: 'bg-red-500',
    description: 'Solicitação negada'
  },
  'FALSE_POSITIVE': { 
    label: 'Falsos Positivos', 
    icon: Archive, 
    color: 'bg-gray-500',
    description: 'Não é infração'
  },
  'IGNORED': { 
    label: 'Ignorados', 
    icon: Archive, 
    color: 'bg-gray-400',
    description: 'Marcados para ignorar'
  }
}

export function ContentStatusFilters({ 
  onStatusChange, 
  currentStatus, 
  counts 
}: ContentStatusFiltersProps) {
  const [showAllFilters, setShowAllFilters] = useState(false)

  const handleStatusClick = (status: string) => {
    if (currentStatus === status) {
      onStatusChange(null) // Remove filter if clicking the same status
    } else {
      onStatusChange(status)
    }
  }

  const primaryStatuses = ['DETECTED', 'REVIEWED', 'DMCA_SENT', 'DELISTED']
  const secondaryStatuses = ['PENDING_REVIEW', 'REJECTED', 'FALSE_POSITIVE', 'IGNORED']

  const getStatusCount = (status: string): number => {
    if (!counts) return 0
    const key = status.toLowerCase() as keyof typeof counts
    return counts[key] || 0
  }

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <h3 className="font-medium">Filtrar por Status</h3>
          {currentStatus && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onStatusChange(null)}
              className="h-6 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Limpar
            </Button>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          Total: {counts?.total || 0} itens
        </div>
      </div>

      {/* Primary Status Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        {primaryStatuses.map((status) => {
          const config = statusConfig[status as keyof typeof statusConfig]
          const IconComponent = config.icon
          const count = getStatusCount(status)
          const isActive = currentStatus === status

          return (
            <Button
              key={status}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatusClick(status)}
              className={`justify-start h-auto py-3 px-3 ${
                isActive ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex flex-col items-start w-full">
                <div className="flex items-center gap-2 mb-1">
                  <IconComponent className="h-4 w-4" />
                  <span className="font-medium text-xs">{config.label}</span>
                </div>
                <div className="flex items-center justify-between w-full">
                  <span className="text-lg font-bold">{count}</span>
                  <Badge 
                    variant="secondary" 
                    className="text-xs h-5"
                  >
                    {config.description}
                  </Badge>
                </div>
              </div>
            </Button>
          )
        })}
      </div>

      {/* Toggle for Secondary Filters */}
      <div className="flex items-center justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAllFilters(!showAllFilters)}
          className="text-xs"
        >
          {showAllFilters ? 'Ocultar' : 'Mostrar'} filtros adicionais
        </Button>
      </div>

      {/* Secondary Status Filters */}
      {showAllFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
          {secondaryStatuses.map((status) => {
            const config = statusConfig[status as keyof typeof statusConfig]
            const IconComponent = config.icon
            const count = getStatusCount(status)
            const isActive = currentStatus === status

            return (
              <Button
                key={status}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusClick(status)}
                className={`justify-start h-auto py-2 px-3 ${
                  isActive ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <IconComponent className="h-3 w-3" />
                  <span className="text-xs">{config.label}</span>
                  <Badge variant="outline" className="text-xs h-4 px-1">
                    {count}
                  </Badge>
                </div>
              </Button>
            )
          })}
        </div>
      )}

      {/* Status Flow Indicator */}
      <div className="mt-4 pt-3 border-t">
        <div className="text-xs text-muted-foreground mb-2">Fluxo DMCA:</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">Detectado</span>
          <span>→</span>
          <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Revisado</span>
          <span>→</span>
          <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded">DMCA Enviado</span>
          <span>→</span>
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">Aguardando</span>
          <span>→</span>
          <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Removido</span>
        </div>
      </div>
    </Card>
  )
}
