
# Guia de Instalação - DMCA Guard Platform

Este guia fornece instruções detalhadas para instalação e configuração da plataforma DMCA Guard em diferentes ambientes.

## 📋 Pré-requisitos

### Sistema Operacional
- **Linux**: Ubuntu 20.04+ (recomendado)
- **macOS**: 10.15+
- **Windows**: 10+ com WSL2

### Software Necessário
- **Node.js**: 18.0.0 ou superior
- **PostgreSQL**: 14.0 ou superior
- **Git**: Para controle de versão
- **Yarn**: Gerenciador de pacotes (recomendado)

### Contas de Serviços Externos
- **OpenAI**: Para processamento de IA
- **SendGrid**: Para envio de emails
- **Railway/Vercel/AWS**: Para deploy (opcional)

## 🚀 Instalação Local

### 1. Clone do Repositório

```bash
# Clone o repositório
git clone <repository-url>
cd dmca-guard-platform

# Navegue para o diretório da aplicação
cd app
```

### 2. Instalação de Dependências

```bash
# Usando Yarn (recomendado)
yarn install

# Ou usando npm
npm install
```

### 3. Configuração do Banco de Dados

#### PostgreSQL Local

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS com Homebrew
brew install postgresql
brew services start postgresql

# Criar banco de dados
sudo -u postgres createdb dmca_guard
sudo -u postgres createuser dmca_user --pwprompt
```

#### PostgreSQL com Docker

```bash
# Executar PostgreSQL em container
docker run --name dmca-postgres \
  -e POSTGRES_DB=dmca_guard \
  -e POSTGRES_USER=dmca_user \
  -e POSTGRES_PASSWORD=your_password \
  -p 5432:5432 \
  -d postgres:14
```

### 4. Configuração de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env.local

# Editar variáveis de ambiente
nano .env.local
```

#### Variáveis Obrigatórias

```env
# Banco de Dados
DATABASE_URL="postgresql://dmca_user:your_password@localhost:5432/dmca_guard"

# NextAuth.js
NEXTAUTH_SECRET="generate-a-secure-random-string-here"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI API
OPENAI_API_KEY="sk-your-openai-api-key-here"

# SendGrid
SENDGRID_API_KEY="SG.your-sendgrid-api-key-here"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

# Configurações da Aplicação
APP_URL="http://localhost:3000"
APP_NAME="DMCA Guard"

# Configurações de Upload (opcional)
UPLOAD_MAX_SIZE="10485760" # 10MB
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/webp,video/mp4"

# Configurações de Rate Limiting
RATE_LIMIT_REQUESTS="100"
RATE_LIMIT_WINDOW="900000" # 15 minutos

# Configurações de Monitoramento
MONITORING_INTERVAL="3600000" # 1 hora
MAX_CONCURRENT_SCANS="5"
```

### 5. Configuração do Banco de Dados

```bash
# Gerar cliente Prisma
npx prisma generate

# Executar migrações
npx prisma migrate dev --name init

# Seed inicial (opcional)
npx prisma db seed
```

### 6. Inicialização da Aplicação

```bash
# Modo desenvolvimento
yarn dev

# Ou com npm
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

## 🔧 Configuração Avançada

### SSL/TLS Local (Desenvolvimento)

```bash
# Instalar mkcert
# Ubuntu/Debian
sudo apt install libnss3-tools
wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert
sudo mv mkcert /usr/local/bin/

# Gerar certificados
mkcert -install
mkcert localhost 127.0.0.1 ::1

# Configurar Next.js para HTTPS
# Adicionar ao package.json:
"dev:https": "next dev --experimental-https --experimental-https-key ./localhost-key.pem --experimental-https-cert ./localhost.pem"
```

### Configuração de Proxy Reverso

#### Nginx

```nginx
# /etc/nginx/sites-available/dmca-guard
server {
    listen 80;
    server_name localhost;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Apache

```apache
# /etc/apache2/sites-available/dmca-guard.conf
<VirtualHost *:80>
    ServerName localhost
    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
</VirtualHost>
```

### Configuração de Logs

```bash
# Criar diretório de logs
mkdir -p logs

# Configurar rotação de logs
sudo nano /etc/logrotate.d/dmca-guard
```

```
/home/ubuntu/dmca-guard-platform/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 ubuntu ubuntu
}
```

## 🐳 Instalação com Docker

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://dmca_user:password@db:5432/dmca_guard
      - NEXTAUTH_SECRET=your-secret-here
      - OPENAI_API_KEY=your-openai-key
      - SENDGRID_API_KEY=your-sendgrid-key
    depends_on:
      - db
    volumes:
      - ./uploads:/app/uploads

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=dmca_guard
      - POSTGRES_USER=dmca_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Instalar dependências
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copiar código fonte
COPY . .

# Gerar Prisma client
RUN npx prisma generate

# Build da aplicação
RUN yarn build

EXPOSE 3000

CMD ["yarn", "start"]
```

### Executar com Docker

```bash
# Build e execução
docker-compose up -d

# Executar migrações
docker-compose exec app npx prisma migrate deploy

# Verificar logs
docker-compose logs -f app
```

## 🔍 Verificação da Instalação

### Checklist de Verificação

```bash
# 1. Verificar conexão com banco
npx prisma db pull

# 2. Verificar variáveis de ambiente
node -e "console.log(process.env.DATABASE_URL ? '✅ DATABASE_URL' : '❌ DATABASE_URL missing')"

# 3. Verificar APIs externas
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

# 4. Verificar aplicação
curl http://localhost:3000/api/health

# 5. Verificar autenticação
curl http://localhost:3000/api/auth/providers
```

### Testes Automatizados

```bash
# Executar testes unitários
yarn test

# Executar testes de integração
yarn test:integration

# Executar testes E2E
yarn test:e2e

# Coverage de testes
yarn test:coverage
```

## 🚨 Troubleshooting

### Problemas Comuns

#### Erro de Conexão com Banco

```bash
# Verificar status do PostgreSQL
sudo systemctl status postgresql

# Verificar conexão
psql -h localhost -U dmca_user -d dmca_guard -c "SELECT version();"
```

#### Erro de Permissões

```bash
# Corrigir permissões de arquivos
chmod +x scripts/*.sh
chown -R $USER:$USER .
```

#### Erro de Porta em Uso

```bash
# Verificar processos na porta 3000
lsof -i :3000

# Matar processo se necessário
kill -9 $(lsof -t -i:3000)
```

#### Erro de Memória

```bash
# Aumentar limite de memória do Node.js
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Logs de Debug

```bash
# Habilitar logs detalhados
export DEBUG="*"
export LOG_LEVEL="debug"

# Executar com logs verbosos
yarn dev 2>&1 | tee logs/debug.log
```

## 📊 Monitoramento Local

### Health Checks

```bash
# Script de health check
#!/bin/bash
# scripts/health_check.sh

echo "🔍 Verificando saúde da aplicação..."

# Verificar aplicação
if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Aplicação: OK"
else
    echo "❌ Aplicação: FALHA"
fi

# Verificar banco
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "✅ Banco de dados: OK"
else
    echo "❌ Banco de dados: FALHA"
fi

# Verificar APIs externas
if curl -f -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models > /dev/null 2>&1; then
    echo "✅ OpenAI API: OK"
else
    echo "❌ OpenAI API: FALHA"
fi
```

### Métricas Básicas

```javascript
// lib/metrics.js
export const collectMetrics = () => {
  return {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    timestamp: new Date().toISOString()
  };
};
```

## 🔄 Atualizações

### Processo de Atualização

```bash
# 1. Backup do banco
pg_dump dmca_guard > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Pull das atualizações
git pull origin main

# 3. Atualizar dependências
yarn install

# 4. Executar migrações
npx prisma migrate deploy

# 5. Rebuild da aplicação
yarn build

# 6. Reiniciar serviços
pm2 restart dmca-guard
```

### Rollback

```bash
# 1. Reverter código
git checkout <previous-commit>

# 2. Restaurar banco (se necessário)
psql dmca_guard < backup_YYYYMMDD_HHMMSS.sql

# 3. Rebuild
yarn build && pm2 restart dmca-guard
```

## 📚 Próximos Passos

Após a instalação bem-sucedida:

1. **[Configurar APIs](api_config.md)** - Setup do OpenAI e SendGrid
2. **[Deploy em Produção](deploy.md)** - Railway, Vercel ou AWS
3. **[Manual do Usuário](user_guide.md)** - Como usar a plataforma
4. **[Guia de Administração](admin_guide.md)** - Gestão avançada

---

**💡 Dica**: Use o script `./scripts/setup.sh` para automatizar todo este processo de instalação!

