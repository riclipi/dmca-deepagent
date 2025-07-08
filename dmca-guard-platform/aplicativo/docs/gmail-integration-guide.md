# Guia de Integração Gmail - DMCA Guard

## Visão Geral

A integração com Gmail permite que o DMCA Guard monitore automaticamente os Google Alerts configurados para sua marca, extraindo URLs potencialmente infratoras diretamente da sua caixa de entrada.

## Configuração

### 1. Configurar Credenciais OAuth

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Crie um novo projeto ou selecione um existente
3. Ative a Gmail API
4. Crie credenciais OAuth 2.0
5. Configure as variáveis de ambiente:

```bash
GMAIL_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=seu-client-secret
GMAIL_REDIRECT_URI=https://seudominio.com/api/auth/gmail/callback
```

### 2. URLs de Callback

Adicione as seguintes URLs autorizadas no Google Cloud Console:

- Desenvolvimento: `http://localhost:3000/api/auth/gmail/callback`
- Produção: `https://seudominio.com/api/auth/gmail/callback`

## Fluxo de Autenticação

### 1. Conectar Gmail

```typescript
// Frontend - Iniciar autenticação
const response = await fetch('/api/integrations/gmail?action=auth-url')
const { authUrl } = await response.json()
window.location.href = authUrl
```

### 2. Callback Handler

O usuário será redirecionado de volta após autorizar:
- Sucesso: `/settings?tab=integrations&success=gmail_connected`
- Erro: `/settings?tab=integrations&error=error_type`

### 3. Verificar Status

```typescript
// Verificar se Gmail está conectado
const response = await fetch('/api/integrations/gmail')
const { isConnected, lastSync, expiresAt } = await response.json()
```

## Uso da API

### Buscar Google Alerts

```typescript
// POST /api/integrations/gmail
const response = await fetch('/api/integrations/gmail', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    maxResults: 50,    // Máximo de emails para buscar
    daysBack: 7        // Dias retroativos
  })
})

const { alerts, count } = await response.json()

// Estrutura de um alerta
{
  id: string,
  subject: string,
  alertKeyword: string,      // Keyword do Google Alert
  date: Date,
  snippet: string,           // Preview do conteúdo
  urls: string[],           // URLs extraídas e limpas
  urlCount: number,
  hasHtmlContent: boolean,
  metadata: {
    threadId: string,
    labelIds: string[]
  }
}
```

### Desconectar Gmail

```typescript
// DELETE /api/integrations/gmail
await fetch('/api/integrations/gmail', { method: 'DELETE' })
```

## Segurança

### Armazenamento de Tokens

- Tokens OAuth são armazenados criptografados no banco de dados
- Modelo `UserIntegration` com isolamento por usuário
- Cache Redis para tokens ativos (TTL: 58 minutos)
- Renovação automática de tokens expirados

### Permissões

- Escopo limitado: `gmail.readonly`
- Acesso apenas a leitura de emails
- Sem capacidade de enviar ou modificar emails

### Melhores Práticas

1. **Nunca commitar tokens**: Use `.gitignore` para `gmail_token.json`
2. **Rotação de credenciais**: Renove client secret periodicamente
3. **Monitoramento**: Implemente logs para falhas de autenticação
4. **Rate Limiting**: Respeite limites da API do Gmail

## Solução de Problemas

### Token Expirado

```typescript
// O sistema tenta renovar automaticamente
// Se falhar, o usuário precisa reconectar
```

### Erro 401 - Não Autenticado

Verifique se:
- O usuário está logado no DMCA Guard
- A integração foi autorizada no Gmail
- As credenciais OAuth estão configuradas

### Erro 403 - Acesso Negado

Possíveis causas:
- Escopo insuficiente
- App não verificado pelo Google
- Limite de quota excedido

## Exemplos de Integração

### Component React para Status

```tsx
function GmailIntegrationStatus() {
  const [status, setStatus] = useState(null)
  
  useEffect(() => {
    fetch('/api/integrations/gmail')
      .then(res => res.json())
      .then(setStatus)
  }, [])
  
  if (!status) return <Loading />
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gmail Integration</CardTitle>
      </CardHeader>
      <CardContent>
        {status.isConnected ? (
          <>
            <Badge variant="success">Conectado</Badge>
            <p>Última sincronização: {formatDate(status.lastSync)}</p>
            <Button onClick={syncAlerts}>Sincronizar Agora</Button>
          </>
        ) : (
          <>
            <Badge variant="secondary">Desconectado</Badge>
            <Button onClick={connectGmail}>Conectar Gmail</Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

### Processamento de Alertas

```typescript
async function processGoogleAlerts() {
  const { alerts } = await fetchGoogleAlerts()
  
  for (const alert of alerts) {
    // Filtrar URLs relevantes
    const suspiciousUrls = alert.urls.filter(url => 
      !isWhitelisted(url) && hasLeakIndicators(url)
    )
    
    // Criar detecções para URLs suspeitas
    for (const url of suspiciousUrls) {
      await createDetectedContent({
        url,
        source: 'GOOGLE_ALERTS',
        keyword: alert.alertKeyword,
        confidence: calculateConfidence(url, alert)
      })
    }
  }
}
```

## Migração do Sistema Antigo

Se você estava usando o sistema antigo com token local:

1. Delete o arquivo `gmail_token.json`
2. Execute a migração do Prisma para criar a tabela `user_integrations`
3. Reconecte o Gmail através da nova interface
4. Atualize imports:

```typescript
// Antigo
import { fetchGoogleAlertsFromGmail } from '@/lib/services/gmail'

// Novo
import { gmailService } from '@/lib/services/gmail-secure'
```

## Suporte

Para problemas com a integração Gmail:
- Verifique os logs do servidor
- Confirme configurações OAuth no Google Cloud Console
- Entre em contato com suporte@dmcaguard.com