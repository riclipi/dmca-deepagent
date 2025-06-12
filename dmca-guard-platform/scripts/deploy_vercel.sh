
#!/bin/bash

# DMCA Guard Platform - Deploy Vercel
# Script para deploy automatizado no Vercel

set -e

echo "▲ DMCA Guard Platform - Deploy Vercel"
echo "====================================="

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

# Verificar se Vercel CLI está instalado
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        log_info "Vercel CLI não encontrado. Instalando..."
        npm install -g vercel
        log_success "Vercel CLI instalado"
    else
        log_success "Vercel CLI encontrado"
    fi
}

# Fazer login no Vercel
vercel_login() {
    log_info "Verificando autenticação Vercel..."
    
    if ! vercel whoami &> /dev/null; then
        log_info "Fazendo login no Vercel..."
        vercel login
    else
        log_success "Já autenticado no Vercel"
    fi
}

# Configurar banco de dados externo
setup_external_database() {
    log_warning "Vercel não inclui banco PostgreSQL"
    echo "Escolha uma opção para banco de dados:"
    echo "1. Supabase (Recomendado)"
    echo "2. PlanetScale"
    echo "3. Railway PostgreSQL"
    echo "4. Já tenho um banco configurado"
    
    read -p "Escolha uma opção (1-4): " -n 1 -r
    echo
    
    case $REPLY in
        1)
            setup_supabase
            ;;
        2)
            setup_planetscale
            ;;
        3)
            setup_railway_db
            ;;
        4)
            log_info "Usando banco existente"
            ;;
        *)
            log_error "Opção inválida"
            exit 1
            ;;
    esac
}

# Configurar Supabase
setup_supabase() {
    log_info "Configurando Supabase..."
    
    echo "1. Acesse: https://supabase.com"
    echo "2. Crie um novo projeto"
    echo "3. Vá em Settings > Database"
    echo "4. Copie a Connection String"
    echo
    
    read -p "Cole a Connection String do Supabase: " SUPABASE_URL
    
    if [ ! -z "$SUPABASE_URL" ]; then
        DATABASE_URL="$SUPABASE_URL"
        log_success "Supabase configurado"
    else
        log_error "URL do Supabase é obrigatória"
        exit 1
    fi
}

# Configurar PlanetScale
setup_planetscale() {
    log_info "Configurando PlanetScale..."
    
    echo "1. Acesse: https://planetscale.com"
    echo "2. Crie um novo banco"
    echo "3. Obtenha a connection string"
    echo
    
    read -p "Cole a Connection String do PlanetScale: " PLANETSCALE_URL
    
    if [ ! -z "$PLANETSCALE_URL" ]; then
        DATABASE_URL="$PLANETSCALE_URL"
        log_success "PlanetScale configurado"
    else
        log_error "URL do PlanetScale é obrigatória"
        exit 1
    fi
}

# Configurar Railway DB
setup_railway_db() {
    log_info "Configurando Railway PostgreSQL..."
    
    if ! command -v railway &> /dev/null; then
        log_info "Instalando Railway CLI..."
        npm install -g @railway/cli
    fi
    
    echo "1. Faça login no Railway: railway login"
    echo "2. Crie um projeto: railway init"
    echo "3. Adicione PostgreSQL: railway add postgresql"
    echo "4. Obtenha a URL: railway variables"
    echo
    
    read -p "Cole a DATABASE_URL do Railway: " RAILWAY_DB_URL
    
    if [ ! -z "$RAILWAY_DB_URL" ]; then
        DATABASE_URL="$RAILWAY_DB_URL"
        log_success "Railway PostgreSQL configurado"
    else
        log_error "URL do Railway é obrigatória"
        exit 1
    fi
}

# Configurar projeto Vercel
setup_vercel_project() {
    log_info "Configurando projeto Vercel..."
    
    cd app
    
    # Verificar se vercel.json existe
    if [ ! -f "vercel.json" ]; then
        log_info "Criando configuração Vercel..."
        
        cat > vercel.json << EOF
{
  "framework": "nextjs",
  "buildCommand": "yarn build",
  "devCommand": "yarn dev",
  "installCommand": "yarn install",
  "outputDirectory": ".next",
  "functions": {
    "app/api/**/*.js": {
      "maxDuration": 30
    },
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "env": {
    "NEXTAUTH_URL": "https://\$VERCEL_URL"
  },
  "build": {
    "env": {
      "NEXT_TELEMETRY_DISABLED": "1"
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "GET, POST, PUT, DELETE, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "Content-Type, Authorization"
        }
      ]
    }
  ]
}
EOF
        log_success "Arquivo vercel.json criado"
    fi
    
    # Verificar next.config.js
    if [ ! -f "next.config.js" ]; then
        log_info "Criando next.config.js otimizado para Vercel..."
        
        cat > next.config.js << EOF
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@prisma/client');
    }
    return config;
  },
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  output: 'standalone',
};

module.exports = nextConfig;
EOF
        log_success "next.config.js criado"
    fi
    
    cd ..
}

# Configurar variáveis de ambiente
setup_environment() {
    log_info "Configurando variáveis de ambiente..."
    
    # Verificar se .env.production existe
    if [ ! -f "app/.env.production" ]; then
        create_production_env
    fi
    
    # Configurar variáveis no Vercel
    log_info "Configurando variáveis no Vercel..."
    
    cd app
    
    # Ler e configurar cada variável
    while IFS= read -r line; do
        if [[ $line =~ ^[A-Z_]+=.* ]]; then
            var_name=$(echo "$line" | cut -d'=' -f1)
            var_value=$(echo "$line" | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
            
            # Configurar para todos os ambientes
            vercel env add "$var_name" production <<< "$var_value"
            vercel env add "$var_name" preview <<< "$var_value"
            vercel env add "$var_name" development <<< "$var_value"
        fi
    done < .env.production
    
    cd ..
    
    log_success "Variáveis de ambiente configuradas"
}

# Criar arquivo .env.production
create_production_env() {
    log_info "Criando arquivo .env.production..."
    
    echo "Por favor, forneça as seguintes informações:"
    
    read -p "OpenAI API Key: " OPENAI_API_KEY
    read -p "SendGrid API Key: " SENDGRID_API_KEY
    read -p "SendGrid From Email: " SENDGRID_FROM_EMAIL
    read -p "NextAuth Secret (deixe vazio para gerar): " NEXTAUTH_SECRET
    
    if [ -z "$NEXTAUTH_SECRET" ]; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
    fi
    
    cat > app/.env.production << EOF
# Banco de Dados
DATABASE_URL="$DATABASE_URL"

# NextAuth.js
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="https://\$VERCEL_URL"

# OpenAI API
OPENAI_API_KEY="$OPENAI_API_KEY"

# SendGrid
SENDGRID_API_KEY="$SENDGRID_API_KEY"
SENDGRID_FROM_EMAIL="$SENDGRID_FROM_EMAIL"

# Configurações da Aplicação
APP_URL="https://\$VERCEL_URL"
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

# Vercel específico
NEXT_TELEMETRY_DISABLED="1"
EOF
    
    log_success "Arquivo .env.production criado"
}

# Preparar aplicação para deploy
prepare_app() {
    log_info "Preparando aplicação para deploy..."
    
    cd app
    
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

# Configurar domínio customizado
setup_custom_domain() {
    read -p "Deseja configurar um domínio customizado? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Digite o domínio (ex: dmcaguard.com): " CUSTOM_DOMAIN
        
        if [ ! -z "$CUSTOM_DOMAIN" ]; then
            log_info "Configurando domínio customizado: $CUSTOM_DOMAIN"
            
            cd app
            vercel domains add "$CUSTOM_DOMAIN"
            cd ..
            
            echo
            log_warning "Configure os seguintes registros DNS:"
            echo "CNAME www cname.vercel-dns.com"
            echo "A @ 76.76.19.61"
            echo
        fi
    fi
}

# Executar deploy
deploy_app() {
    log_info "Iniciando deploy..."
    
    cd app
    
    # Deploy para produção
    vercel --prod
    
    cd ..
    
    log_success "Deploy iniciado"
}

# Executar migrações do banco
run_migrations() {
    log_info "Executando migrações do banco..."
    
    cd app
    
    # Aguardar deploy completar
    sleep 30
    
    # Executar migrações usando Vercel CLI
    vercel env pull .env.vercel
    source .env.vercel
    npx prisma migrate deploy
    
    cd ..
    
    log_success "Migrações executadas"
}

# Verificar deploy
verify_deployment() {
    log_info "Verificando deploy..."
    
    cd app
    
    # Obter URL da aplicação
    APP_URL=$(vercel ls --scope=$(vercel whoami) | grep "$(basename $(pwd))" | awk '{print $2}' | head -1)
    
    if [ ! -z "$APP_URL" ]; then
        FULL_URL="https://$APP_URL"
        log_info "Testando aplicação em: $FULL_URL"
        
        # Aguardar aplicação ficar disponível
        for i in {1..30}; do
            if curl -f "$FULL_URL/api/health" > /dev/null 2>&1; then
                log_success "Aplicação está respondendo!"
                break
            else
                log_info "Aguardando aplicação... ($i/30)"
                sleep 10
            fi
        done
        
        # Verificar se aplicação está funcionando
        if curl -f "$FULL_URL/api/health" > /dev/null 2>&1; then
            log_success "Deploy verificado com sucesso!"
            echo
            echo "🎉 Aplicação disponível em: $FULL_URL"
        else
            log_error "Aplicação não está respondendo"
            log_info "Verificando logs..."
            vercel logs
        fi
    else
        log_error "Não foi possível obter URL da aplicação"
        vercel ls
    fi
    
    cd ..
}

# Configurar monitoramento
setup_monitoring() {
    log_info "Configurando monitoramento..."
    
    cd app
    
    # Configurar analytics do Vercel
    vercel env add NEXT_PUBLIC_VERCEL_ANALYTICS_ID production <<< "auto"
    
    cd ..
    
    log_info "Monitoramento básico configurado"
    log_warning "Configure alertas adicionais no dashboard do Vercel"
}

# Configurar CI/CD com GitHub
setup_github_integration() {
    read -p "Deseja configurar integração com GitHub? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Configurando integração GitHub..."
        
        echo "1. Acesse: https://vercel.com/dashboard"
        echo "2. Vá em 'Import Project'"
        echo "3. Conecte seu repositório GitHub"
        echo "4. Configure auto-deploy para branch main"
        echo
        
        log_success "Siga as instruções no dashboard do Vercel"
    fi
}

# Mostrar informações finais
show_final_info() {
    echo
    echo "🎉 Deploy no Vercel concluído!"
    echo "============================="
    echo
    
    cd app
    APP_URL=$(vercel ls --scope=$(vercel whoami) | grep "$(basename $(pwd))" | awk '{print $2}' | head -1)
    cd ..
    
    echo "📋 Informações do Deploy:"
    echo "• URL da Aplicação: https://$APP_URL"
    echo "• Dashboard Vercel: https://vercel.com/dashboard"
    echo "• Logs: vercel logs"
    echo "• Redeploy: vercel --prod"
    echo
    echo "🔧 Comandos Úteis:"
    echo "• Ver logs: vercel logs"
    echo "• Listar deploys: vercel ls"
    echo "• Configurar domínio: vercel domains add <domain>"
    echo "• Variáveis de ambiente: vercel env"
    echo
    echo "📚 Próximos Passos:"
    echo "1. Configure domínio customizado (se necessário)"
    echo "2. Configure integração GitHub para CI/CD"
    echo "3. Configure monitoramento avançado"
    echo "4. Teste todas as funcionalidades"
    echo
    echo "⚠️ Limitações do Vercel:"
    echo "• Funções serverless têm timeout de 30s"
    echo "• Sem banco PostgreSQL incluído"
    echo "• Limite de execução por função"
    echo
    echo "🆘 Suporte:"
    echo "• Documentação: docs/deploy.md"
    echo "• Vercel Docs: https://vercel.com/docs"
    echo "• Suporte: suporte@dmcaguard.com"
}

# Função principal
main() {
    check_vercel_cli
    vercel_login
    setup_external_database
    setup_vercel_project
    setup_environment
    prepare_app
    setup_custom_domain
    deploy_app
    run_migrations
    verify_deployment
    setup_monitoring
    setup_github_integration
    show_final_info
}

# Executar deploy
main "$@"

