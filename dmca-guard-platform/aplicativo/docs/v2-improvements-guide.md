# Guia de Melhorias V2 - DMCA Guard Platform

Este documento consolida todas as melhorias implementadas da V2 no projeto atual, fornecendo uma visão geral completa das novas funcionalidades.

## 📋 Índice

1. [WebSocket Infrastructure](#websocket-infrastructure)
2. [Sistema de Cache Multi-camadas](#sistema-de-cache-multi-camadas)
3. [Fair Queue Manager](#fair-queue-manager)
4. [Sistema Anti-Abuse](#sistema-anti-abuse)
5. [Rate Limiting Avançado](#rate-limiting-avançado)
6. [ApiResponse Padronizada](#apiresponse-padronizada)
7. [Keyword Intelligence Service](#keyword-intelligence-service)
8. [Próximos Passos](#próximos-passos)

## WebSocket Infrastructure

### Arquivos Principais
- `/server.js` - Servidor customizado com Socket.io
- `/lib/socket-server.ts` - Utilitários para emissão de eventos
- `/hooks/use-socket.ts` - Hook React para cliente

### Funcionalidades
- Comunicação bidirecional em tempo real
- Namespaces dedicados (`/monitoring`, `/agents`)
- Salas por sessão/usuário
- Reconexão automática

### Uso
```typescript
// Cliente
import { useSocket } from '@/hooks/use-socket'

const { socket, isConnected } = useSocket('/monitoring')

// Servidor
import { emitToRoom } from '@/lib/socket-server'

emitToRoom('/monitoring', `session:${sessionId}`, 'progress', data)
```

### Como Executar
```bash
npm run dev  # Executa node server.js automaticamente
```

## Sistema de Cache Multi-camadas

### Arquivos
- `/lib/cache/cache-manager.ts` - Cache manager principal
- `/lib/cache/agent-cache-manager.ts` - Cache específico para agentes

### Características
- LRU Cache em memória com TTLs específicos
- Persistência no banco de dados
- Cache híbrido: Memory-first com fallback para DB
- Tags para invalidação seletiva

### TTLs Configurados
- Content: 1 hora
- Robots.txt: 24 horas
- Metadata: 6 horas
- Screenshots: 2 horas

### Uso
```typescript
import { cacheManager } from '@/lib/cache/cache-manager'

// Buscar do cache
const cached = await cacheManager.get('my-key', 'content')

// Salvar no cache
await cacheManager.set('my-key', data, 'content', ['tag1', 'tag2'])

// Invalidar por tag
await cacheManager.invalidateByTags(['tag1'])
```

## Fair Queue Manager

### Arquivo Principal
- `/lib/services/security/fair-queue-manager.ts`

### Limites por Plano
- FREE: 1 scan simultâneo
- BASIC: 3 scans simultâneos
- PREMIUM: 10 scans simultâneos
- ENTERPRISE: 50 scans simultâneos
- SUPER_USER: Ilimitado

### Funcionalidades
- Sistema de prioridade baseado no plano
- Round-robin scheduler (previne starvation)
- Estimativa de tempo de início
- Integração com WebSocket para atualizações
- Limite global de 100 scans

### APIs
- `GET /api/queue/status` - Status da fila do usuário
- `POST /api/queue/cancel` - Cancelar scan enfileirado

### Uso
```typescript
import { fairQueueManager } from '@/lib/services/security/fair-queue-manager'

// Enfileirar scan
const response = await fairQueueManager.enqueueScan({
  userId,
  userPlan,
  siteIds,
  metadata
})

// Verificar status
const status = await fairQueueManager.getQueueStatus(userId)
```

## Sistema Anti-Abuse

### Componentes

#### 1. OwnershipValidationService
- `/lib/services/security/ownership-validation.service.ts`
- Validação via DNS TXT, Meta Tags, Redes Sociais
- Score de propriedade composto

#### 2. AntiFloodingService
- `/lib/services/security/anti-flooding.service.ts`
- Rate limiting por plano
- Análise de qualidade de keywords com IA
- Detecção de spam

#### 3. AbuseMonitoringService
- `/lib/services/security/abuse-monitoring.service.ts`
- Sistema de score com decay temporal
- Estados: CLEAN, WARNING, HIGH_RISK, BLOCKED
- Ações automáticas por estado

### Modelos Prisma
```prisma
model AbuseScore {
  currentScore  Float
  state         AbuseState
  violations    AbuseViolation[]
}

model OwnershipValidation {
  method        ValidationMethod
  status        ValidationStatus
  verificationToken String?
}
```

### APIs
- `GET/POST /api/brand-profiles/[id]/ownership` - Validação de propriedade

## Rate Limiting Avançado

### Arquivo Principal
- `/lib/middleware/rate-limit-advanced.ts`

### Tipos de Rate Limiting
- **Sliding Window**: Janela deslizante
- **Fixed Window**: Janela fixa
- **Token Bucket**: Bucket de tokens com burst

### Configuração por Plano e Endpoint
```typescript
FREE: {
  'api/monitoring-sessions': { type: 'fixed', requests: 10, window: '1h' },
  'api/agents/known-sites/scan': { type: 'token-bucket', requests: 5, window: '24h' }
}
```

### Integração
```typescript
// Em middleware.ts
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit-advanced'

// Em API routes
import { checkRateLimit } from '@/lib/middleware/rate-limit-advanced'

const { success, headers } = await checkRateLimit(request, {
  requests: 10,
  window: '1m'
})
```

### Dependências
```bash
npm install @upstash/ratelimit @upstash/redis
```

### Variáveis de Ambiente
```env
UPSTASH_REDIS_REST_URL=your-url
UPSTASH_REDIS_REST_TOKEN=your-token
```

## ApiResponse Padronizada

### Arquivo
- `/lib/api-response.ts`

### Métodos Disponíveis
- `success(data, meta?, status?)` - Resposta de sucesso
- `created(data, meta?)` - 201 Created
- `noContent()` - 204 No Content
- `error(message, status, errors?, meta?)` - Erro genérico
- `validationError(error)` - 400 Bad Request
- `unauthorized(message?)` - 401 Unauthorized
- `forbidden(message?)` - 403 Forbidden
- `notFound(resource?)` - 404 Not Found
- `conflict(message?)` - 409 Conflict
- `tooManyRequests(message?, retryAfter?)` - 429 Too Many Requests
- `serverError(error, isDev?)` - 500 Internal Server Error
- `paginated(data, total, page, limit, meta?)` - Resposta paginada

### Uso
```typescript
import { ApiResponse } from '@/lib/api-response'

// Sucesso
return ApiResponse.success(data)

// Erro de validação
return ApiResponse.validationError(zodError)

// Paginação
return ApiResponse.paginated(items, total, page, limit)

// Com headers customizados
return ApiResponse.withRateLimit(response, limit, remaining, reset)
```

## Keyword Intelligence Service

### Arquivo Principal
- `/lib/services/keyword-intelligence.service.ts`

### Funcionalidades
- Classificação automática (SAFE, MODERATE, DANGEROUS)
- Risk scoring (0-100)
- Análise com IA (Gemini)
- Geração de sugestões inteligentes
- Análise de efetividade histórica
- Sincronização perfil-sessão

### API
- `GET /api/brand-profiles/[id]/keywords` - Obter análise
- `POST /api/brand-profiles/[id]/keywords` - Analisar keywords
- `PUT /api/brand-profiles/[id]/keywords` - Gerar sugestões

### Uso
```typescript
import { keywordIntelligenceService } from '@/lib/services/keyword-intelligence.service'

// Analisar keywords
const analysis = await keywordIntelligenceService.analyzeAndClassifyKeywords(
  keywords,
  brandContext
)

// Gerar sugestões
const suggestions = await keywordIntelligenceService.generateKeywordSuggestions(
  brandProfile,
  currentKeywords
)

// Sincronizar com sessões
await KeywordIntelligenceService.syncProfileKeywordsWithSessions(brandProfileId)
```

## Próximos Passos

### Alta Prioridade
1. **Migração do Banco de Dados**
   ```bash
   npx prisma migrate dev --name add-abuse-system
   ```

2. **Configurar Redis (Upstash)**
   - Criar conta em upstash.com
   - Obter credenciais
   - Adicionar ao .env

3. **Testes Abrangentes**
   - Criar testes para cada serviço
   - Testes de integração
   - Testes de carga

### Média Prioridade
1. **Monitoring e Métricas**
   - Implementar OpenTelemetry
   - Dashboard de métricas
   - Alertas automáticos

2. **Jobs Agendados**
   - Configurar job de monitoramento de abuso
   - Cache warmup
   - Limpeza de dados antigos

### Baixa Prioridade
1. **Documentação da API**
   - Swagger/OpenAPI
   - Exemplos de uso
   - Guias de integração

2. **UI/UX Melhorias**
   - Dashboard de queue status
   - Visualização de abuse score
   - Analytics de keywords

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Gerar tipos do Prisma
npx prisma generate

# Executar migrações
npx prisma migrate deploy

# Visualizar banco
npx prisma studio

# Testes
npm test
npm run test:watch

# Verificar tipos
npm run typecheck
```

## Considerações de Produção

1. **Performance**
   - Cache está configurado mas precisa de Redis em produção
   - Fair Queue Manager usa memória - migrar para Redis/RabbitMQ
   - Rate limiting requer Upstash Redis

2. **Segurança**
   - Validar todas as variáveis de ambiente
   - Configurar CORS apropriadamente
   - Revisar permissões de API

3. **Monitoramento**
   - Implementar health checks
   - Configurar logging estruturado
   - Métricas de performance

4. **Escalabilidade**
   - WebSocket funciona single-instance
   - Para múltiplas instâncias, usar Redis adapter
   - Considerar microserviços para agentes

## Conclusão

As melhorias da V2 transformam o DMCA Guard em uma plataforma robusta e escalável, com:
- ✅ Comunicação em tempo real
- ✅ Cache inteligente multi-camadas
- ✅ Sistema de filas justo
- ✅ Proteção anti-abuse completa
- ✅ Rate limiting enterprise-grade
- ✅ APIs padronizadas
- ✅ Inteligência de keywords com IA

Todas as implementações seguem best practices e estão prontas para produção com as devidas configurações de infraestrutura.