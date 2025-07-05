# Sistema Anti-Abuse - Documentação

O Sistema Anti-Abuse do DMCA Guard protege a plataforma contra uso malicioso, spam e comportamentos abusivos através de múltiplas camadas de segurança.

## Componentes Principais

### 1. OwnershipValidationService
Valida a propriedade de marcas através de múltiplos métodos.

**Funcionalidades:**
- Verificação DNS TXT
- Verificação Meta Tag HTML
- Verificação de Redes Sociais
- Score de propriedade composto

**Uso:**
```typescript
import { ownershipValidationService } from '@/lib/services/security/ownership-validation.service'

// Validar propriedade
await ownershipValidationService.validateBrandOwnership(userId, brandProfile)

// Obter instruções de verificação
const instructions = await ownershipValidationService.getVerificationInstructions(brandProfileId)
```

### 2. AntiFloodingService
Previne spam e flooding através de rate limiting e análise de qualidade.

**Funcionalidades:**
- Rate limiting por plano
- Análise de qualidade de keywords via IA
- Detecção de padrões de spam
- Normalização e deduplicação

**Limites por Plano (por hora):**
- FREE: 50 keywords, 1 sessão, 5 scans
- BASIC: 200 keywords, 3 sessões, 20 scans
- PREMIUM: 1000 keywords, 10 sessões, 100 scans
- ENTERPRISE: 5000 keywords, 50 sessões, 500 scans

**Uso:**
```typescript
import { antiFloodingService } from '@/lib/services/security/anti-flooding.service'

// Validar criação de keywords
const validKeywords = await antiFloodingService.validateKeywordCreation(
  userId,
  keywords,
  brandProfileId
)

// Verificar se usuário pode realizar ação
const canPerform = await antiFloodingService.canUserPerformAction(userId, 'SCAN_REQUEST')
```

### 3. AbuseMonitoringService
Sistema de score e monitoramento contínuo de comportamento abusivo.

**Estados de Abuso:**
- CLEAN (0-0.3): Usuário normal
- WARNING (0.3-0.6): Comportamento suspeito
- HIGH_RISK (0.6-0.8): Alto risco, restrições aplicadas
- BLOCKED (0.8+): Conta bloqueada

**Tipos de Violação e Pesos:**
- SPAM_KEYWORDS: 0.15
- EXCESSIVE_REQUESTS: 0.1
- SUSPICIOUS_PATTERNS: 0.2
- MULTIPLE_ACCOUNTS: 0.4
- COMPETITOR_MONITORING: 0.3
- FAKE_OWNERSHIP: 0.5
- API_ABUSE: 0.35
- SCRAPING: 0.4

**Decay Temporal:**
- Redução de 0.01 por hora sem violações
- Score nunca fica negativo

**Uso:**
```typescript
import { abuseMonitoringService } from '@/lib/services/security/abuse-monitoring.service'

// Registrar violação
await abuseMonitoringService.recordViolation(
  userId,
  ViolationType.SPAM_KEYWORDS,
  0.3, // severidade customizada
  'Descrição da violação'
)

// Monitorar usuário
await abuseMonitoringService.monitorUser(userId)

// Obter relatório
const report = await abuseMonitoringService.getUserAbuseReport(userId)
```

## Modelos de Dados (Prisma)

### AbuseScore
```prisma
model AbuseScore {
  id            String         @id @default(cuid())
  userId        String         @unique
  currentScore  Float          @default(0)
  state         AbuseState     @default(CLEAN)
  lastViolation DateTime?
  violations    AbuseViolation[]
}
```

### AbuseViolation
```prisma
model AbuseViolation {
  id           String       @id @default(cuid())
  userId       String
  scoreId      String
  type         ViolationType
  severity     Float        // 0.1 to 1.0
  description  String?
  metadata     Json?
  occurredAt   DateTime     @default(now())
}
```

### OwnershipValidation
```prisma
model OwnershipValidation {
  id            String              @id @default(cuid())
  userId        String
  brandProfileId String
  domain        String?
  method        ValidationMethod
  status        ValidationStatus
  verificationToken String?
  validatedAt   DateTime?
  expiresAt     DateTime?
  score         Float               @default(0)
}
```

## Middleware de Detecção

O middleware `abuseDetectionMiddleware` intercepta requisições e:
- Bloqueia usuários com estado BLOCKED
- Aplica rate limiting adaptativo baseado no estado
- Detecta padrões suspeitos (scraping, API abuse)
- Registra atividades suspeitas

**Configuração no middleware.ts:**
```typescript
import { abuseDetectionMiddleware } from '@/lib/middleware/abuse-detection'

export async function middleware(request: NextRequest) {
  // Para rotas de API protegidas
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return abuseDetectionMiddleware(request)
  }
}
```

## Integração com APIs

### Exemplo de API com Validação Completa
```typescript
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // 1. Verificar rate limit
  const canCreate = await antiFloodingService.canUserPerformAction(
    session.user.id,
    'BRAND_PROFILE_CREATE'
  )
  
  if (!canCreate) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }
  
  // 2. Validar dados e keywords
  const validatedKeywords = await antiFloodingService.validateKeywordCreation(
    session.user.id,
    data.keywords,
    brandProfileId
  )
  
  // 3. Criar recurso
  const brandProfile = await prisma.brandProfile.create({...})
  
  // 4. Validar propriedade (background)
  ownershipValidationService.validateBrandOwnership(
    session.user.id,
    brandProfile
  ).catch(console.error)
  
  return NextResponse.json({ success: true })
}
```

## Jobs e Monitoramento

### Job de Monitoramento (Executar a cada hora)
```typescript
import { runAbuseMonitoringJob } from '@/lib/jobs/abuse-monitoring-job'

// Configurar no cron ou scheduler
schedule.scheduleJob('0 * * * *', runAbuseMonitoringJob)
```

## Componentes UI

### OwnershipValidationStatus
Exibe status de validação e instruções para o usuário.

```tsx
import { OwnershipValidationStatus } from '@/components/brand-profile/ownership-validation-status'

<OwnershipValidationStatus brandProfileId={brandProfile.id} />
```

## Notificações e Ações

### Por Estado:
- **WARNING**: Notifica usuário, aumenta logging, rate limits mais restritivos
- **HIGH_RISK**: Pausa criação de sessões, requer validação adicional, notifica admins
- **BLOCKED**: Bloqueia todas operações, pausa sessões ativas, requer revisão manual

### WebSocket Events
O sistema emite eventos em tempo real:
- `abuse-violation`: Nova violação registrada
- `notification`: Notificação de mudança de estado

## Boas Práticas

1. **Sempre validar propriedade** antes de permitir monitoramento
2. **Usar rate limiting** em todas as operações que criam recursos
3. **Monitorar scores** regularmente via job
4. **Implementar retry** com backoff para validações
5. **Logar todas as atividades** suspeitas para auditoria

## Configuração de Segurança

### Variáveis de Ambiente
```env
# Limites globais (opcional, usa defaults se não definido)
GLOBAL_SCAN_LIMIT=100
ABUSE_SCORE_DECAY_RATE=0.01

# Configurações de validação
OWNERSHIP_TOKEN_EXPIRY_HOURS=48
DNS_VERIFICATION_PREFIX=_dmcaguard
```

## Troubleshooting

### Usuário bloqueado incorretamente
1. Verificar histórico de violações
2. Analisar score e decay temporal
3. Resetar score manualmente se necessário

### Validação de propriedade falhando
1. Verificar TTL do token
2. Confirmar propagação DNS (pode levar até 48h)
3. Verificar formato correto da meta tag

### Rate limiting muito restritivo
1. Ajustar limites por plano
2. Verificar multipliers por estado
3. Considerar upgrade de plano