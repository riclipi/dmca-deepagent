
#!/bin/bash

# DMCA Guard Platform - Deploy Railway
# Script para deploy automatizado no Railway

set -e

echo "🚂 DMCA Guard Platform - Deploy Railway"
echo "======================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ️ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar se Railway CLI está instalado
check_railway_cli() {
    if ! command -v railway &> /dev/null; then
        log_info "Railway CLI não encontrado. Instalando..."
        npm install -g @railway/cli
        log_success "Railway CLI instalado"
    else
        log_success "Railway CLI encontrado"
    fi
}

# Fazer login no Railway
railway_login() {
    log_info "Verificando autenticação Railway..."
    
    if ! railway whoami &> /dev/null; then
        log_info "Fazendo login no Railway..."
        railway login
    else
        log_success "Já autenticado no Railway"
    fi
}

# Verificar se projeto existe
check_project() {
    log_info "Verificando projeto Railway..."
    
    if [ ! -f "railway.json" ]; then
        log_info "Criando configuração Railway..."
        
        cat > railway.json << EOF
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd app && yarn start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
EOF
        log_success "Arquivo railway.json criado"
    fi
    
    # Verificar se projeto está inicializado
    if [ ! -f ".railway" ]; then
        log_info "Inicializando projeto Railway..."
        railway init
        log_success "Projeto Railway inicializado"
    fi
}

# Configurar variáveis de ambiente
setup_environment() {
    log_info "Configurando variáveis de ambiente..."
    
    # Verificar se .env.production existe
    if [ ! -f "app/.env.production" ]; then
        log_warning "Arquivo .env.production não encontrado"
        
        read -p "Deseja criar arquivo .env.production? (y/n): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            create_production_env
        else
            log_error "Arquivo .env.production é necessário para deploy"
            exit 1
        fi
    fi
    
    # Configurar variáveis no Railway
    log_info "Configurando variáveis no Railway..."
    
    # Ler variáveis do arquivo .env.production
    while IFS= read -r line; do
        if [[ $line =~ ^[A-Z_]+=.* ]]; then
            var_name=$(echo "$line" | cut -d'=' -f1)
            var_value=$(echo "$line" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
            
            # Pular variáveis específicas do Railway
            if [[ $var_name != "DATABASE_URL" && $var_name != "RAILWAY_"* ]]; then
                railway variables set "$var_name=$var_value"
            fi
        fi
    done < app/.env.production
    
    log_success "Variáveis de ambiente configuradas"
}

# Criar arquivo .env.production
create_production_env() {
    log_info "Criando arquivo .env.production..."
    
    # Solicitar informações necessárias
    echo "Por favor, forneça as seguintes informações:"
    
    read -p "OpenAI API Key: " OPENAI_API_KEY
    read -p "SendGrid API Key: " SENDGRID_API_KEY
    read -p "SendGrid From Email: " SENDGRID_FROM_EMAIL
    read -p "NextAuth Secret (deixe vazio para gerar): " NEXTAUTH_SECRET
    
    if [ -z "$NEXTAUTH_SECRET" ]; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
    fi
    
    cat > app/.env.production << EOF
# Banco de Dados (Railway fornece automaticamente)
DATABASE_URL=\${{Postgres.DATABASE_URL}}

# NextAuth.js
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL=\${{RAILWAY_PUBLIC_DOMAIN}}

# OpenAI API
OPENAI_API_KEY="$OPENAI_API_KEY"

# SendGrid
SENDGRID_API_KEY="$SENDGRID_API_KEY"
SENDGRID_FROM_EMAIL="$SENDGRID_FROM_EMAIL"

# Configurações da Aplicação
APP_URL=\${{RAILWAY_PUBLIC_DOMAIN}}
APP_NAME="DMCA Guard"
NODE_ENV="production"

# Configurações de Upload
UPLOAD_MAX_SIZE="10485760"
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/webp,video/mp4"

# Rate Limiting
RATE_LIMIT_REQUESTS="1000"
RATE_LIMIT_WINDOW="900000"

# Monitoramento
MONITORING_INTERVAL="3600000"
MAX_CONCURRENT_SCANS="10"
EOF
    
    log_success "Arquivo .env.production criado"
}

# Adicionar PostgreSQL
add_postgresql() {
    log_info "Verificando banco PostgreSQL..."
    
    # Verificar se PostgreSQL já está adicionado
    if railway service list | grep -q "postgres"; then
        log_success "PostgreSQL já configurado"
    else
        log_info "Adicionando PostgreSQL..."
        railway add postgresql
        log_success "PostgreSQL adicionado"
    fi
}

# Preparar aplicação para deploy
prepare_app() {
    log_info "Preparando aplicação para deploy..."
    
    cd app
    
    # Verificar package.json
    if [ ! -f "package.json" ]; then
        log_error "package.json não encontrado"
        exit 1
    fi
    
    # Verificar se scripts de build existem
    if ! grep -q '"build"' package.json; then
        log_error "Script 'build' não encontrado no package.json"
        exit 1
    fi
    
    if ! grep -q '"start"' package.json; then
        log_error "Script 'start' não encontrado no package.json"
        exit 1
    fi
    
    # Instalar dependências
    log_info "Instalando dependências..."
    yarn install --frozen-lockfile
    
    # Gerar cliente Prisma
    log_info "Gerando cliente Prisma..."
    npx prisma generate
    
    # Testar build local
    log_info "Testando build..."
    yarn build
    
    cd ..
    
    log_success "Aplicação preparada"
}

# Configurar domínio customizado (opcional)
setup_custom_domain() {
    read -p "Deseja configurar um domínio customizado? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Digite o domínio (ex: dmcaguard.com): " CUSTOM_DOMAIN
        
        if [ ! -z "$CUSTOM_DOMAIN" ]; then
            log_info "Configurando domínio customizado: $CUSTOM_DOMAIN"
            railway domain add "$CUSTOM_DOMAIN"
            
            echo
            log_warning "Configure os seguintes registros DNS:"
            echo "CNAME www $CUSTOM_DOMAIN.railway.app"
            echo "CNAME @ $CUSTOM_DOMAIN.railway.app"
            echo
        fi
    fi
}

# Executar deploy
deploy_app() {
    log_info "Iniciando deploy..."
    
    # Fazer commit das mudanças se necessário
    if [ -n "$(git status --porcelain)" ]; then
        log_info "Fazendo commit das mudanças..."
        git add .
        git commit -m "Deploy to Railway - $(date)"
    fi
    
    # Deploy
    railway up
    
    log_success "Deploy iniciado"
}

# Executar migrações do banco
run_migrations() {
    log_info "Executando migrações do banco..."
    
    # Aguardar deploy completar
    sleep 30
    
    # Executar migrações
    railway run npx prisma migrate deploy
    
    log_success "Migrações executadas"
}

# Verificar deploy
verify_deployment() {
    log_info "Verificando deploy..."
    
    # Obter URL da aplicação
    APP_URL=$(railway status --json | jq -r '.deployments[0].url')
    
    if [ "$APP_URL" != "null" ] && [ ! -z "$APP_URL" ]; then
        log_info "Testando aplicação em: $APP_URL"
        
        # Aguardar aplicação ficar disponível
        for i in {1..30}; do
            if curl -f "$APP_URL/api/health" > /dev/null 2>&1; then
                log_success "Aplicação está respondendo!"
                break
            else
                log_info "Aguardando aplicação... ($i/30)"
                sleep 10
            fi
        done
        
        # Verificar se aplicação está funcionando
        if curl -f "$APP_URL/api/health" > /dev/null 2>&1; then
            log_success "Deploy verificado com sucesso!"
            echo
            echo "🎉 Aplicação disponível em: $APP_URL"
        else
            log_error "Aplicação não está respondendo"
            log_info "Verificando logs..."
            railway logs
        fi
    else
        log_error "Não foi possível obter URL da aplicação"
        railway status
    fi
}

# Configurar monitoramento
setup_monitoring() {
    log_info "Configurando monitoramento..."
    
    # Configurar health checks
    railway variables set HEALTH_CHECK_PATH="/api/health"
    railway variables set HEALTH_CHECK_INTERVAL="30"
    
    # Configurar alertas (se disponível)
    log_info "Monitoramento básico configurado"
    log_warning "Configure alertas adicionais no dashboard do Railway"
}

# Mostrar informações finais
show_final_info() {
    echo
    echo "🎉 Deploy no Railway concluído!"
    echo "==============================="
    echo
    
    APP_URL=$(railway status --json | jq -r '.deployments[0].url' 2>/dev/null || echo "Verifique no dashboard")
    
    echo "📋 Informações do Deploy:"
    echo "• URL da Aplicação: $APP_URL"
    echo "• Dashboard Railway: https://railway.app/dashboard"
    echo "• Logs: railway logs"
    echo "• Status: railway status"
    echo
    echo "🔧 Comandos Úteis:"
    echo "• Ver logs: railway logs"
    echo "• Conectar ao banco: railway connect postgresql"
    echo "• Executar comando: railway run <comando>"
    echo "• Redeploy: railway up"
    echo
    echo "📚 Próximos Passos:"
    echo "1. Configure domínio customizado (se necessário)"
    echo "2. Configure alertas de monitoramento"
    echo "3. Teste todas as funcionalidades"
    echo "4. Configure backup automático"
    echo
    echo "🆘 Suporte:"
    echo "• Documentação: docs/deploy.md"
    echo "• Railway Docs: https://docs.railway.app"
    echo "• Suporte: suporte@dmcaguard.com"
}

# Função principal
main() {
    check_railway_cli
    railway_login
    check_project
    add_postgresql
    setup_environment
    prepare_app
    setup_custom_domain
    deploy_app
    run_migrations
    verify_deployment
    setup_monitoring
    show_final_info
}

# Executar deploy
main "$@"

