# 🤖 Guia Completo dos Agentes DMCA Guard

Este guia mostra como interagir com todos os agentes do sistema DMCA Guard através das interfaces web e APIs.

## 📋 Visão Geral dos Agentes

O sistema possui **6 marcos principais** com múltiplos agentes:

1. **Marco 1**: Sistema Base de Monitoramento
2. **Marco 2**: Agente de Descoberta com Pesquisa Real
3. **Marco 3**: Agente de Sites Conhecidos
4. **Marco 4**: Agente de Análise Contextual com Gemini
5. **Marco 5**: Sistema de Aprendizagem Contínua
6. **Marco 6**: Otimização e Feedback

## 🚀 Como Começar

### 1. Inicie o Servidor
```bash
npm run dev
```

### 2. Acesse a Plataforma
- **URL Principal**: http://localhost:3000
- **Dashboard**: http://localhost:3000/dashboard
- **Painel Admin**: http://localhost:3000/admin

### 3. Login de Admin
- **Email**: `current.user@dmcaguard.com`
- **Password**: `admin123`

---

## 🎯 Marco 1: Sistema Base de Monitoramento

### Interface Web
1. **Dashboard Principal**: `/dashboard`
   - Visão geral de estatísticas
   - Monitoramento em tempo real
   - Gráficos de atividade

2. **Perfis de Marca**: `/brand-profiles`
   - Criar e gerenciar marcas
   - Configurar palavras-chave
   - Definir URLs oficiais

3. **Sessões de Monitoramento**: `/monitoring`
   - Criar sessões de monitoramento
   - Acompanhar progresso
   - Ver resultados em tempo real

### APIs Principais
```bash
# Criar perfil de marca
POST /api/brand-profiles
{
  "brandName": "Minha Marca",
  "description": "Descrição da marca",
  "officialUrls": ["https://site-oficial.com"],
  "keywords": ["palavra1", "palavra2"]
}

# Criar sessão de monitoramento
POST /api/monitoring-sessions
{
  "name": "Monitoramento Teste",
  "brandProfileId": "brand_id",
  "targetPlatforms": ["google", "youtube", "social"]
}

# Ver estatísticas do dashboard
GET /api/dashboard/stats?userId=USER_ID
```

---

## 🔍 Marco 2: Agente de Descoberta

### Interface Web
1. **Descoberta Inteligente**: `/discovery`
   - Pesquisa em tempo real
   - Resultados com IA
   - Análise de similaridade

### APIs do Agente
```bash
# Iniciar descoberta
POST /api/agents/discovery/start
{
  "brandProfileId": "brand_id",
  "searchTerms": ["termo1", "termo2"],
  "platforms": ["google", "youtube"],
  "maxResults": 100
}

# Verificar status da descoberta
GET /api/agents/discovery/{sessionId}

# Controlar descoberta
POST /api/agents/discovery/{sessionId}
{
  "action": "pause" | "resume" | "stop"
}
```

### Como Usar
1. Acesse `/discovery`
2. Selecione um perfil de marca
3. Configure termos de busca
4. Inicie a descoberta
5. Acompanhe resultados em tempo real

---

## 🌐 Marco 3: Agente de Sites Conhecidos

### Interface Web
1. **Sites Conhecidos**: `/known-sites`
   - Lista de sites monitorados
   - Estatísticas de violações
   - Histórico de escaneamento

### APIs do Agente
```bash
# Iniciar escaneamento
POST /api/agents/known-sites/scan
{
  "siteIds": ["site1", "site2"],
  "brandProfileId": "brand_id",
  "scanType": "full" | "quick"
}

# Status do escaneamento
GET /api/agents/known-sites/{sessionId}/status

# Controlar escaneamento
POST /api/agents/known-sites/{sessionId}/control
{
  "action": "pause" | "resume" | "stop"
}

# Relatório do escaneamento
GET /api/agents/known-sites/{sessionId}/report
```

### Como Usar
1. Acesse `/known-sites`
2. Veja sites cadastrados
3. Selecione sites para escanear
4. Configure tipo de escaneamento
5. Monitore progresso e resultados

---

## 🧠 Marco 4: Agente de Análise Contextual

### Interface Web
1. **Análise Contextual**: `/admin/contextual-analysis`
   - Configurações do Gemini
   - Relatórios de análise
   - Métricas de IA

### APIs do Agente
```bash
# Análise contextual de conteúdo
POST /api/agents/contextual/analyze
{
  "contentUrl": "https://site-suspeito.com",
  "brandProfileId": "brand_id",
  "analysisType": "full" | "quick" | "image_only"
}

# Status da análise
GET /api/agents/contextual/{analysisId}/status

# Resultados da análise
GET /api/agents/contextual/{analysisId}/results
```

### Recursos do Gemini
- **Análise de Texto**: Detecta similaridades textuais
- **Análise de Imagem**: Reconhecimento facial e visual
- **Análise Estrutural**: Padrões de layout e design
- **Consolidação IA**: Relatórios inteligentes

---

## 📚 Marco 5: Sistema de Aprendizagem

### Interface Web
1. **Aprendizagem**: `/admin/learning`
   - Métricas de aprendizado
   - Feedback do sistema
   - Otimizações automáticas

### APIs do Sistema
```bash
# Feedback para aprendizagem
POST /api/learning/feedback
{
  "sessionId": "session_id",
  "feedback": "positive" | "negative",
  "context": "detection_accuracy",
  "details": "Comentários opcionais"
}

# Métricas de aprendizagem
GET /api/learning/metrics

# Otimizações de prompt
GET /api/learning/prompt-optimizations
```

---

## ⚡ Marco 6: Otimização e Feedback

### Interface Web
1. **Otimização**: `/admin/optimization`
   - Performance do sistema
   - Otimizações automáticas
   - Relatórios de eficiência

### APIs de Otimização
```bash
# Otimizar sistema
POST /api/optimization/optimize
{
  "component": "detection" | "search" | "analysis",
  "strategy": "performance" | "accuracy" | "speed"
}

# Métricas de performance
GET /api/optimization/performance
```

---

## 🔄 Fluxo Completo de Uso

### 1. Configuração Inicial
```bash
# 1. Criar perfil de marca
curl -X POST http://localhost:3000/api/brand-profiles \
  -H "Content-Type: application/json" \
  -d '{
    "brandName": "Minha Empresa",
    "description": "Empresa de tecnologia",
    "officialUrls": ["https://minhaempresa.com"],
    "keywords": ["minha empresa", "logo marca"]
  }'
```

### 2. Iniciar Monitoramento Integrado
```bash
# 2. Criar monitoramento integrado (recomendado)
curl -X POST http://localhost:3000/api/integrated-monitoring \
  -H "Content-Type: application/json" \
  -d '{
    "brandName": "Minha Empresa",
    "description": "Monitoramento completo",
    "officialUrls": ["https://minhaempresa.com"],
    "targetPlatforms": ["google", "youtube", "social"],
    "autoStart": true
  }'
```

### 3. Acompanhar Resultados
```bash
# 3. Ver resultados em tempo real
curl http://localhost:3000/api/monitoring-sessions/realtime-stats
```

---

## 🛠️ Ferramentas de Debug e Administração

### Painel Admin
- **URL**: `/admin`
- **Usuários**: Gerenciar contas
- **Sistemas**: Status dos agentes
- **Configurações**: Parâmetros globais

### APIs de Debug
```bash
# Status geral do sistema
GET /api/admin/system/status

# Logs dos agentes
GET /api/admin/agents/logs

# Métricas de performance
GET /api/admin/metrics
```

---

## 📊 Monitoramento em Tempo Real

### WebSocket Endpoints (Planejado)
```javascript
// Conectar ao WebSocket para updates em tempo real
const ws = new WebSocket('ws://localhost:3000/ws/monitoring');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

### Polling de Status
```bash
# Status de todas as sessões ativas
GET /api/monitoring-sessions/realtime-stats

# Status específico de uma sessão
GET /api/monitoring-sessions/{sessionId}/status
```

---

## 🔐 Autenticação e Segurança

### Headers Necessários
```bash
# Para APIs autenticadas, inclua o cookie de sessão
curl -X GET http://localhost:3000/api/dashboard/stats \
  -H "Cookie: next-auth.session-token=TOKEN"
```

### Níveis de Acesso
- **USER**: Acesso básico ao dashboard
- **SUPER_USER**: Acesso admin completo
- **API**: Acesso via chaves de API (futuro)

---

## 🚀 Próximos Passos

1. **Inicie o servidor**: `npm run dev`
2. **Acesse o admin**: http://localhost:3000/admin
3. **Crie um perfil de marca**: `/brand-profiles`
4. **Configure monitoramento**: `/monitoring`
5. **Monitore resultados**: Dashboard principal

## 💡 Dicas Importantes

- Use o **monitoramento integrado** para configuração automática
- Configure **palavras-chave seguras** para melhores resultados
- Monitore o **status em tempo real** para acompanhar progresso
- Use o **painel admin** para configurações avançadas
- Revise **keywords suspeitas** antes de aprovar

---

**Sistema totalmente funcional e pronto para uso! 🎉**
