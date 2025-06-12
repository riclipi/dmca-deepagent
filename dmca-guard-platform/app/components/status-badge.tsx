
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return { label: 'Ativo', variant: 'default' as const, color: 'bg-green-500' }
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
      case 'PAUSED':
        return { label: 'Pausado', variant: 'secondary' as const, color: 'bg-gray-500' }
      case 'COMPLETED':
        return { label: 'Concluído', variant: 'default' as const, color: 'bg-green-500' }
      case 'ERROR':
        return { label: 'Erro', variant: 'destructive' as const, color: 'bg-red-500' }
      case 'HIGH':
        return { label: 'Alta', variant: 'destructive' as const, color: 'bg-red-500' }
      case 'MEDIUM':
        return { label: 'Média', variant: 'secondary' as const, color: 'bg-yellow-500' }
      case 'LOW':
        return { label: 'Baixa', variant: 'outline' as const, color: 'bg-gray-400' }
      case 'URGENT':
        return { label: 'Urgente', variant: 'destructive' as const, color: 'bg-red-600' }
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
