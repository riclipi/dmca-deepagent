
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      // Status de Atividade/Sistema
      case 'ACTIVE':
        return { label: 'Ativo', variant: 'default' as const, color: 'bg-green-500' }
      case 'PAUSED':
        return { label: 'Pausado', variant: 'secondary' as const, color: 'bg-gray-500' }
      case 'COMPLETED':
        return { label: 'Concluído', variant: 'default' as const, color: 'bg-green-500' }
      case 'ERROR':
        return { label: 'Erro', variant: 'destructive' as const, color: 'bg-red-500' }
      
      // Status de Takedown
      case 'PENDING':
        return { label: 'Pendente', variant: 'secondary' as const, color: 'bg-yellow-500' }
      case 'SENT':
        return { label: 'Enviado', variant: 'default' as const, color: 'bg-blue-500' }
      case 'ACKNOWLEDGED':
        return { label: 'Reconhecido', variant: 'default' as const, color: 'bg-purple-500' }
      case 'REMOVED':
        return { label: 'Removido', variant: 'default' as const, color: 'bg-green-600' }
      case 'REJECTED':
        return { label: 'Rejeitado', variant: 'destructive' as const, color: 'bg-red-500' }
      case 'FAILED':
        return { label: 'Falhou', variant: 'destructive' as const, color: 'bg-red-600' }
      case 'DELISTED':
        return { label: 'Delisted', variant: 'default' as const, color: 'bg-green-700' }
      case 'CONTENT_REMOVED':
        return { label: 'Removido', variant: 'default' as const, color: 'bg-green-600' }
      case 'IN_REVIEW':
        return { label: 'Em Análise', variant: 'secondary' as const, color: 'bg-orange-500' }
      
      // Status de Conteúdo (ContentStatus)
      case 'DETECTED':
        return { label: 'Detectado', variant: 'secondary' as const, color: 'bg-orange-500' }
      case 'REVIEWED':
        return { label: 'Revisado', variant: 'default' as const, color: 'bg-blue-500' }
      case 'DMCA_SENT':
        return { label: 'DMCA Enviado', variant: 'default' as const, color: 'bg-blue-600' }
      case 'PENDING_REVIEW':
        return { label: 'Aguardando', variant: 'secondary' as const, color: 'bg-yellow-600' }
      case 'FALSE_POSITIVE':
        return { label: 'Falso Positivo', variant: 'outline' as const, color: 'bg-gray-500' }
      case 'IGNORED':
        return { label: 'Ignorado', variant: 'outline' as const, color: 'bg-gray-400' }
      
      // Status de Prioridade
      case 'HIGH':
        return { label: 'Alta', variant: 'destructive' as const, color: 'bg-red-500' }
      case 'MEDIUM':
        return { label: 'Média', variant: 'secondary' as const, color: 'bg-yellow-500' }
      case 'LOW':
        return { label: 'Baixa', variant: 'outline' as const, color: 'bg-gray-400' }
      case 'URGENT':
        return { label: 'Urgente', variant: 'destructive' as const, color: 'bg-red-600' }
      
      // Status Legados (mantidos para compatibilidade)
      case 'CONFIRMED':
        return { label: 'Confirmado', variant: 'default' as const, color: 'bg-green-500' }
      
      default:
        return { label: status, variant: 'outline' as const, color: 'bg-gray-400' }
    }
  }

  const config = getStatusConfig(status)

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        'text-white',
        config.color,
        className
      )}
    >
      {config.label}
    </Badge>
  )
}
