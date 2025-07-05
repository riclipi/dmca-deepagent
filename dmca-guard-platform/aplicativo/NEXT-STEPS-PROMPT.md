# Prompt para Continuar Implementação - DMCA Guard Platform

## Contexto do Projeto

Você está trabalhando no DMCA Guard Platform, um sistema SaaS de proteção de direitos autorais. Acabamos de implementar melhorias significativas da V2, incluindo WebSocket, Cache Multi-camadas, Fair Queue Manager, Sistema Anti-Abuse completo, Rate Limiting Avançado, ApiResponse padronizada e Keyword Intelligence Service.

## Status Atual

### ✅ Implementações Concluídas:

1. **WebSocket Infrastructure**
   - Arquivo: `/server.js` (servidor customizado)
   - Hook: `/hooks/use-socket.ts`
   - Utilitários: `/lib/socket-server.ts`

2. **Sistema de Cache**
   - Cache Manager: `/lib/cache/cache-manager.ts`
   - Agent Cache: `/lib/cache/agent-cache-manager.ts`

3. **Fair Queue Manager**
   - Implementação: `/lib/services/security/fair-queue-manager.ts`
   - APIs: `/api/queue/status` e `/api/queue/cancel`

4. **Sistema Anti-Abuse**
   - OwnershipValidation: `/lib/services/security/ownership-validation.service.ts`
   - AntiFlooding: `/lib/services/security/anti-flooding.service.ts`
   - AbuseMonitoring: `/lib/services/security/abuse-monitoring.service.ts`
   - Modelos Prisma adicionados ao schema

5. **Rate Limiting Avançado**
   - Middleware: `/lib/middleware/rate-limit-advanced.ts`
   - Integrado em: `/middleware.ts`
   - Dependências: @upstash/ratelimit e @upstash/redis instaladas

6. **ApiResponse**
   - Classe: `/lib/api-response.ts`

7. **Keyword Intelligence**
   - Service: `/lib/services/keyword-intelligence.service.ts`
   - API: `/api/brand-profiles/[brandProfileId]/keywords`

## 🎯 Tarefas Prioritárias para Implementar

### 1. Migração do Banco de Dados (CRÍTICO)
```bash
# Execute estes comandos na ordem:
npx prisma generate
npx prisma migrate dev --name add-v2-improvements
```

**Modelos adicionados que precisam da migração:**
- AbuseScore
- AbuseViolation
- OwnershipValidation
- UserActivity
- Enums: AbuseState, ViolationType, ValidationMethod, ValidationStatus

### 2. Configuração do Redis/Upstash (CRÍTICO)

**Passos:**
1. Criar conta em https://upstash.com
2. Criar um database Redis
3. Copiar as credenciais
4. Adicionar ao `.env`:
```env
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...
```

### 3. Suite de Testes Abrangente

**Criar testes para:**

#### a) Fair Queue Manager Tests
```typescript
// __tests__/services/security/fair-queue-manager.test.ts
// - Testar limites por plano
// - Testar round-robin scheduling
// - Testar estimativas de tempo
// - Testar cancelamento de queue
```

#### b) Anti-Abuse System Tests
```typescript
// __tests__/services/security/ownership-validation.test.ts
// - Testar validação DNS (mock)
// - Testar validação meta tags
// - Testar score calculation

// __tests__/services/security/anti-flooding.test.ts
// - Testar rate limits
// - Testar detecção de spam
// - Testar análise de keywords

// __tests__/services/security/abuse-monitoring.test.ts
// - Testar state transitions
// - Testar decay temporal
// - Testar ações automáticas
```

#### c) Integration Tests
```typescript
// __tests__/integration/websocket.test.ts
// - Testar conexão WebSocket
// - Testar eventos em tempo real
// - Testar reconexão

// __tests__/integration/rate-limiting.test.ts
// - Testar rate limiting por endpoint
// - Testar headers de resposta
// - Testar diferentes planos
```

### 4. Jobs e Cron Tasks

#### a) Abuse Monitoring Job
```typescript
// Implementar em: /app/api/cron/abuse-monitoring/route.ts
// Usar: /lib/jobs/abuse-monitoring-job.ts
// Configurar para executar a cada hora
```

#### b) Cache Cleanup Job
```typescript
// Criar: /lib/jobs/cache-cleanup-job.ts
// Limpar entradas expiradas do cache no banco
// Executar diariamente
```

#### c) Queue Metrics Job
```typescript
// Criar: /lib/jobs/queue-metrics-job.ts
// Coletar métricas de performance da fila
// Executar a cada 5 minutos
```

### 5. Sistema de Monitoramento e Métricas

#### a) OpenTelemetry Setup
```bash
npm install @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

Criar: `/lib/monitoring/telemetry.ts`

#### b) Métricas Customizadas
- Queue wait time
- Cache hit rate
- Abuse score distribution
- API response times
- WebSocket connection count

#### c) Health Check Endpoint
```typescript
// Criar: /app/api/health/route.ts
// Verificar:
// - Database connection
// - Redis connection
// - WebSocket server
// - Memory usage
// - Queue status
```

### 6. UI Components e Dashboards

#### a) Queue Status Dashboard
```typescript
// Criar: /app/dashboard/queue/page.tsx
// Usar: /components/dashboard/queue-status-widget.tsx
// Mostrar:
// - Fila global
// - Status por usuário
// - Métricas de performance
```

#### b) Abuse Monitoring Dashboard
```typescript
// Criar: /app/dashboard/security/page.tsx
// Components:
// - User abuse scores chart
// - Recent violations table
// - State distribution pie chart
// - Actions log
```

#### c) Keyword Intelligence UI
```typescript
// Criar: /components/brand-profile/keyword-analyzer.tsx
// Features:
// - Análise visual de keywords
// - Drag & drop para reclassificar
// - Histórico de efetividade
// - Sugestões interativas
```

### 7. Documentação da API (OpenAPI/Swagger)

```bash
npm install @asteasolutions/zod-to-openapi swagger-ui-react
```

Criar:
- `/lib/openapi/spec.ts` - Especificação OpenAPI
- `/app/api-docs/page.tsx` - UI do Swagger
- Documentar todos os endpoints com schemas Zod

### 8. Performance Optimizations

#### a) Database Indexes
```sql
-- Adicionar ao schema.prisma:
@@index([userId, createdAt]) em UserActivity
@@index([state, currentScore]) em AbuseScore
@@index([sessionId, progress]) em MonitoringSession
```

#### b) Query Optimization
- Implementar cursor-based pagination
- Adicionar database views para queries complexas
- Implementar connection pooling otimizado

#### c) Caching Strategy
- Implementar cache warming para dados frequentes
- Cache de sessão do usuário
- Cache de configurações por plano

### 9. Segurança Adicional

#### a) Request Signing
```typescript
// Criar: /lib/security/request-signing.ts
// Implementar HMAC signing para APIs críticas
```

#### b) Audit Logging Enhancement
```typescript
// Melhorar: /lib/audit.ts
// Adicionar:
// - Detailed change tracking
// - Compliance reports
// - Data retention policies
```

### 10. Ferramentas de Desenvolvimento

#### a) Seed Script Melhorado
```typescript
// Melhorar: /prisma/seed.ts
// Adicionar:
// - Dados de teste para abuse system
// - Múltiplos usuários com diferentes planos
// - Histórico de violations
```

#### b) Development Tools
```typescript
// Criar: /scripts/dev-tools.ts
// - Reset abuse scores
// - Clear all queues
// - Generate test data
// - Simulate load
```

## Estrutura de Arquivos Relevantes

```
/dmca-guard-platform/aplicativo/
├── server.js                          # Servidor com WebSocket
├── middleware.ts                      # Middleware principal com rate limiting
├── lib/
│   ├── api-response.ts               # Classe ApiResponse
│   ├── socket-server.ts              # Utilitários WebSocket
│   ├── cache/
│   │   ├── cache-manager.ts          # Cache manager principal
│   │   └── agent-cache-manager.ts    # Cache para agentes
│   ├── middleware/
│   │   ├── rate-limit-advanced.ts    # Rate limiting avançado
│   │   └── abuse-detection.ts        # Detecção de abuso
│   ├── services/
│   │   ├── keyword-intelligence.service.ts
│   │   └── security/
│   │       ├── fair-queue-manager.ts
│   │       ├── ownership-validation.service.ts
│   │       ├── anti-flooding.service.ts
│   │       └── abuse-monitoring.service.ts
│   └── jobs/
│       └── abuse-monitoring-job.ts
├── hooks/
│   └── use-socket.ts                  # Hook React para WebSocket
├── components/
│   ├── dashboard/
│   │   ├── queue-status-widget.tsx
│   │   └── websocket-test.tsx
│   └── brand-profile/
│       └── ownership-validation-status.tsx
├── app/api/
│   ├── queue/
│   │   ├── status/route.ts
│   │   └── cancel/route.ts
│   └── brand-profiles/
│       └── [brandProfileId]/
│           ├── ownership/route.ts
│           └── keywords/route.ts
└── docs/
    ├── fair-queue-usage.md
    ├── anti-abuse-system.md
    └── v2-improvements-guide.md
```

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev

# Prisma
npx prisma generate
npx prisma migrate dev
npx prisma studio
npx prisma db push (para desenvolvimento rápido)

# Testes
npm test
npm run test:watch
npm run test:coverage

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

## Variáveis de Ambiente Necessárias

```env
# Existentes
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# Novas - ADICIONAR
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Opcionais
GEMINI_API_KEY= (se não estiver configurado)
NODE_ENV=development
```

## Notas Importantes

1. **WebSocket**: O servidor customizado (`server.js`) DEVE ser usado em desenvolvimento e produção
2. **Cache**: Atualmente usa memória + DB. Redis melhorará performance significativamente
3. **Queue**: Fair Queue Manager usa memória. Migrar para Redis em produção
4. **Testes**: Jest já está configurado, mas precisa de mais cobertura
5. **Tipos**: Sempre executar `npx prisma generate` após mudanças no schema

## Priorização Sugerida

1. **Imediato** (Bloqueadores):
   - Migração Prisma
   - Configuração Redis

2. **Alta Prioridade** (Esta semana):
   - Testes críticos
   - Health check endpoint
   - Abuse monitoring job

3. **Média Prioridade** (Próximas 2 semanas):
   - UI Dashboards
   - Monitoring setup
   - API documentation

4. **Baixa Prioridade** (Futuro):
   - Performance optimizations
   - Advanced security features
   - Developer tools

Boa sorte com a continuação do projeto! 🚀