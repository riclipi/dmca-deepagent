# Sistema de Status DMCA - Documentação

## Visão Geral

O sistema de status DMCA permite rastrear o ciclo de vida completo de conteúdo infrator detectado, desde a detecção inicial até a remoção bem-sucedida ou outras resoluções.

## Fluxo de Status

### 1. Detecção e Revisão
```
DETECTED → REVIEWED → DMCA_SENT
```

### 2. Processamento DMCA
```
DMCA_SENT → PENDING_REVIEW → [DELISTED | REJECTED]
```

### 3. Casos Especiais
```
DETECTED → FALSE_POSITIVE
DETECTED → IGNORED
```

## Status Disponíveis

### ContentStatus Enum

| Status | Descrição | Próximos Estados | Cor |
|--------|-----------|------------------|-----|
| `DETECTED` | Conteúdo detectado, aguardando revisão | REVIEWED, FALSE_POSITIVE, IGNORED | 🟠 Laranja |
| `REVIEWED` | Conteúdo revisado e confirmado como infração | DMCA_SENT | 🔵 Azul |
| `DMCA_SENT` | Solicitação DMCA enviada | PENDING_REVIEW | 🔵 Azul Escuro |
| `PENDING_REVIEW` | Aguardando resposta do provedor | DELISTED, REJECTED | 🟡 Amarelo |
| `DELISTED` | Conteúdo removido/delisted com sucesso | - | 🟢 Verde |
| `REJECTED` | Solicitação DMCA rejeitada | DMCA_SENT (reenvio) | 🔴 Vermelho |
| `FALSE_POSITIVE` | Falso positivo - não é infração | - | ⚫ Cinza |
| `IGNORED` | Usuário escolheu ignorar este conteúdo | - | ⚫ Cinza Claro |

## Implementação Técnica

### Banco de Dados

```sql
-- Campo adicionado à tabela detected_content
ALTER TABLE "detected_content" ADD COLUMN "status" "ContentStatus" NOT NULL DEFAULT 'DETECTED';
ALTER TABLE "detected_content" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "detected_content" ADD COLUMN "reviewedBy" TEXT;
```

### APIs

#### Atualizar Status Manualmente
```typescript
PATCH /api/detected-content/[id]/status
{
  "status": "REVIEWED",
  "notes": "Confirmado como infração após análise manual"
}
```

#### Filtrar por Status
```typescript
GET /api/detected-content?status=DETECTED
GET /api/detected-content?status=DMCA_SENT
```

### Componentes React

#### StatusBadge
```typescript
<StatusBadge status="DMCA_SENT" />
```

#### ContentStatusFilters
```typescript
<ContentStatusFilters 
  currentStatus={currentStatus}
  onStatusChange={setCurrentStatus}
  counts={statusCounts}
/>
```

## Automação de Status

### Automático via Takedown Request
Quando um takedown request é criado:
```typescript
// No momento da criação do takedown
await prisma.$transaction(async (tx) => {
  // 1. Criar takedown request
  const request = await tx.takedownRequest.create({...})
  
  // 2. Atualizar status do conteúdo
  await tx.detectedContent.update({
    where: { id: detectedContentId },
    data: {
      status: 'DMCA_SENT',
      reviewedAt: new Date(),
      reviewedBy: session.user.id
    }
  })
})
```

### Manual via Interface
O usuário pode atualizar o status manualmente através de:
- Botões de ação rápida na tabela
- Modal de edição
- Operações em lote

## Dashboard e Métricas

### Cards de Status
```typescript
// Novos cards no dashboard
<StatsCard
  title="Detectados"
  value={stats.overview.detectedContent}
  icon={AlertTriangle}
  description="Conteúdos aguardando revisão"
/>

<StatsCard
  title="DMCA Enviados"
  value={stats.overview.dmcaSent}
  icon={Mail}
  description="Solicitações DMCA enviadas"
/>

<StatsCard
  title="Removidos"
  value={stats.overview.delisted}
  icon={CheckCircle}
  description="Conteúdos removidos com sucesso"
/>
```

### Filtros de Status
Os usuários podem filtrar conteúdo por qualquer status através do componente `ContentStatusFilters`.

## Compatibilidade

### Legacy Support
O sistema mantém compatibilidade com campos existentes:
- `isConfirmed`: usado como fallback quando `status` não está disponível
- APIs antigas continuam funcionando normalmente

### Migração Gradual
- Conteúdo existente recebe status `DETECTED` por padrão
- Campos legacy são atualizados automaticamente quando possível

## Exemplos de Uso

### Fluxo Típico
1. **Detecção**: Sistema detecta conteúdo → `DETECTED`
2. **Revisão IA/Manual**: Confirma infração → `REVIEWED`
3. **Envio DMCA**: Cria takedown request → `DMCA_SENT`
4. **Aguardo**: Notificação enviada → `PENDING_REVIEW`
5. **Sucesso**: Provedor remove conteúdo → `DELISTED`

### Casos Especiais
1. **Falso Positivo**: `DETECTED` → `FALSE_POSITIVE`
2. **Ignorar**: `DETECTED` → `IGNORED`
3. **Rejeição**: `PENDING_REVIEW` → `REJECTED` → `DMCA_SENT` (reenvio)

## Próximos Passos

1. **Webhooks**: Implementar webhooks para atualização automática de status via provedores
2. **Analytics**: Relatórios de eficácia por status
3. **Automação**: Regras automáticas de transição de status
4. **Integração**: APIs de terceiros para verificação de remoção

## Benefícios

1. **Rastreabilidade**: Visão completa do ciclo de vida
2. **Métricas**: Dados precisos de eficácia
3. **Automação**: Redução de trabalho manual
4. **Conformidade**: Documentação para auditoria
5. **UX**: Interface clara do progresso das solicitações
