# Fair Queue Manager - Guia de Uso

O Fair Queue Manager é um sistema de enfileiramento justo que gerencia a execução de scans respeitando os limites de cada plano de usuário.

## Características Principais

### Limites de Concorrência por Plano
- **FREE**: 1 scan simultâneo
- **BASIC**: 3 scans simultâneos  
- **PREMIUM**: 10 scans simultâneos
- **ENTERPRISE**: 50 scans simultâneos
- **SUPER_USER**: Ilimitado

### Sistema de Prioridade
Os scans são priorizados baseados no plano do usuário:
- SUPER_USER: Prioridade 5 (máxima)
- ENTERPRISE: Prioridade 4
- PREMIUM: Prioridade 3
- BASIC: Prioridade 2
- FREE: Prioridade 1 (mínima)

### Fairness (Justiça)
O sistema implementa um scheduler round-robin que previne starvation, garantindo que todos os usuários tenham suas requisições processadas de forma justa.

## Integração com WebSocket

O Fair Queue Manager emite eventos em tempo real através do WebSocket:

```typescript
// Eventos emitidos para a sala user:{userId}
{
  event: 'queue-update',
  data: {
    userId: string,
    queueId: string,
    status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED',
    position?: number,
    estimatedStartTime?: Date,
    startedAt?: Date,
    completedAt?: Date,
    cancelledAt?: Date,
    timestamp: string
  }
}
```

## API Endpoints

### GET /api/queue/status
Retorna o status atual da fila para o usuário autenticado.

**Response:**
```json
{
  "success": true,
  "data": {
    "activeScans": 1,
    "queuedScans": 2,
    "position": 5
  }
}
```

### POST /api/queue/cancel
Cancela um scan enfileirado.

**Request:**
```json
{
  "queueId": "scan_1234567890_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Scan cancelled successfully"
}
```

## Integração no Frontend

### Hook useSocket
```typescript
import { useSocket } from '@/hooks/use-socket'

export function MyComponent() {
  const { socket, isConnected } = useSocket('/monitoring')
  const [queueUpdates, setQueueUpdates] = useState([])

  useEffect(() => {
    if (socket && isConnected) {
      // Join user room
      socket.emit('join', `user:${userId}`)

      // Listen for queue updates
      socket.on('queue-update', (update) => {
        setQueueUpdates(prev => [...prev, update])
      })

      return () => {
        socket.emit('leave', `user:${userId}`)
      }
    }
  }, [socket, isConnected, userId])
}
```

### Widget de Status da Fila
```typescript
import { QueueStatusWidget } from '@/components/dashboard/queue-status-widget'

export function Dashboard() {
  return (
    <div>
      <QueueStatusWidget />
    </div>
  )
}
```

## Fluxo de Trabalho

1. **Usuário solicita scan** através da API `/api/agents/known-sites/scan`
2. **Fair Queue Manager** verifica:
   - Limite de scans simultâneos do plano
   - Limite global do sistema (100 scans)
3. **Se houver capacidade**: Scan inicia imediatamente
4. **Se não houver capacidade**: Scan é enfileirado com prioridade baseada no plano
5. **WebSocket** emite atualizações em tempo real
6. **Scheduler** processa a fila usando round-robin entre usuários
7. **Quando um scan completa**, o próximo da fila é processado

## Estimativas de Tempo

O sistema calcula uma estimativa de tempo de início baseada em:
- Posição na fila
- Tempo médio de processamento (2 minutos por scan)

## Limitações Atuais

1. **Persistência**: A fila é mantida em memória. Em produção, deve-se usar Redis ou RabbitMQ
2. **Distribuição**: Atualmente single-instance. Para múltiplas instâncias, necessário sistema de fila distribuído
3. **Recuperação**: Não há recuperação automática em caso de crash do servidor

## Melhorias Futuras

1. **Persistência com Redis**: Manter estado da fila em Redis para resiliência
2. **Métricas detalhadas**: Tempo médio de espera, taxa de processamento, etc.
3. **Priorização dinâmica**: Ajustar prioridades baseado em histórico de uso
4. **Reservas antecipadas**: Permitir agendamento de scans para horários específicos