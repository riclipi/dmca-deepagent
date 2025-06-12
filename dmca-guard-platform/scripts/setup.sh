
#!/bin/bash

# DMCA Guard Platform - Setup Automático
# Este script automatiza a instalação completa da plataforma

set -e

echo "🛡️ DMCA Guard Platform - Setup Automático"
echo "=========================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
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

# Verificar se está executando como root
if [[ $EUID -eq 0 ]]; then
   log_error "Este script não deve ser executado como root"
   exit 1
fi

# Detectar sistema operacional
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            OS="debian"
        elif [ -f /etc/redhat-release ]; then
            OS="redhat"
        else
            OS="linux"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        OS="unknown"
    fi
    
    log_info "Sistema operacional detectado: $OS"
}

# Verificar pré-requisitos
check_prerequisites() {
    log_info "Verificando pré-requisitos..."
    
    # Verificar Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d'v' -f2)
        REQUIRED_VERSION="18.0.0"
        
        if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
            log_success "Node.js $NODE_VERSION encontrado"
        else
            log_error "Node.js $REQUIRED_VERSION ou superior é necessário. Versão atual: $NODE_VERSION"
            exit 1
        fi
    else
        log_error "Node.js não encontrado. Instalando..."
        install_nodejs
    fi
    
    # Verificar Yarn
    if ! command -v yarn &> /dev/null; then
        log_info "Yarn não encontrado. Instalando..."
        npm install -g yarn
    fi
    log_success "Yarn encontrado"
    
    # Verificar Git
    if ! command -v git &> /dev/null; then
        log_error "Git não encontrado. Por favor, instale o Git primeiro."
        exit 1
    fi
    log_success "Git encontrado"
    
    # Verificar PostgreSQL
    if ! command -v psql &> /dev/null; then
        log_warning "PostgreSQL não encontrado. Será instalado automaticamente."
        INSTALL_POSTGRES=true
    else
        log_success "PostgreSQL encontrado"
        INSTALL_POSTGRES=false
    fi
}

# Instalar Node.js
install_nodejs() {
    log_info "Instalando Node.js..."
    
    if [[ "$OS" == "debian" ]]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [[ "$OS" == "redhat" ]]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    elif [[ "$OS" == "macos" ]]; then
        if command -v brew &> /dev/null; then
            brew install node@18
        else
            log_error "Homebrew não encontrado. Instale o Node.js manualmente."
            exit 1
        fi
    fi
    
    log_success "Node.js instalado com sucesso"
}

# Instalar PostgreSQL
install_postgresql() {
    if [[ "$INSTALL_POSTGRES" == true ]]; then
        log_info "Instalando PostgreSQL..."
        
        if [[ "$OS" == "debian" ]]; then
            sudo apt update
            sudo apt install -y postgresql postgresql-contrib
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        elif [[ "$OS" == "redhat" ]]; then
            sudo yum install -y postgresql-server postgresql-contrib
            sudo postgresql-setup initdb
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        elif [[ "$OS" == "macos" ]]; then
            brew install postgresql
            brew services start postgresql
        fi
        
        log_success "PostgreSQL instalado com sucesso"
    fi
}

# Configurar banco de dados
setup_database() {
    log_info "Configurando banco de dados..."
    
    # Criar usuário e banco
    DB_NAME="dmca_guard"
    DB_USER="dmca_user"
    DB_PASSWORD=$(openssl rand -base64 32)
    
    if [[ "$OS" == "macos" ]]; then
        createdb $DB_NAME 2>/dev/null || true
        psql $DB_NAME -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
        psql $DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
    else
        sudo -u postgres createdb $DB_NAME 2>/dev/null || true
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" 2>/dev/null || true
    fi
    
    DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
    
    log_success "Banco de dados configurado"
}

# Instalar dependências
install_dependencies() {
    log_info "Instalando dependências do projeto..."
    
    cd app
    
    # Instalar dependências
    yarn install
    
    log_success "Dependências instaladas"
}

# Configurar variáveis de ambiente
setup_environment() {
    log_info "Configurando variáveis de ambiente..."
    
    # Gerar secrets
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # Criar arquivo .env.local
    cat > .env.local << EOF
# Banco de Dados
DATABASE_URL="$DATABASE_URL"

# NextAuth.js
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI API (configure manualmente)
OPENAI_API_KEY="sk-your-openai-api-key-here"

# SendGrid (configure manualmente)
SENDGRID_API_KEY="SG.your-sendgrid-api-key-here"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

# Configurações da Aplicação
APP_URL="http://localhost:3000"
APP_NAME="DMCA Guard"

# Configurações de Upload
UPLOAD_MAX_SIZE="10485760"
ALLOWED_FILE_TYPES="image/jpeg,image/png,image/webp,video/mp4"

# Rate Limiting
RATE_LIMIT_REQUESTS="100"
RATE_LIMIT_WINDOW="900000"

# Monitoramento
MONITORING_INTERVAL="3600000"
MAX_CONCURRENT_SCANS="5"

# Ambiente
NODE_ENV="development"
EOF
    
    log_success "Arquivo .env.local criado"
    log_warning "IMPORTANTE: Configure suas chaves de API no arquivo .env.local"
}

# Configurar banco de dados
setup_prisma() {
    log_info "Configurando Prisma e banco de dados..."
    
    # Gerar cliente Prisma
    npx prisma generate
    
    # Executar migrações
    npx prisma migrate dev --name init
    
    log_success "Prisma configurado e migrações executadas"
}

# Criar diretórios necessários
create_directories() {
    log_info "Criando diretórios necessários..."
    
    mkdir -p uploads
    mkdir -p logs
    mkdir -p temp
    
    # Configurar permissões
    chmod 755 uploads logs temp
    
    log_success "Diretórios criados"
}

# Instalar ferramentas de desenvolvimento (opcional)
install_dev_tools() {
    read -p "Deseja instalar ferramentas de desenvolvimento? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Instalando ferramentas de desenvolvimento..."
        
        # ESLint, Prettier, etc.
        yarn add -D eslint prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
        
        # Husky para git hooks
        yarn add -D husky lint-staged
        npx husky install
        
        log_success "Ferramentas de desenvolvimento instaladas"
    fi
}

# Configurar SSL para desenvolvimento (opcional)
setup_ssl() {
    read -p "Deseja configurar SSL para desenvolvimento? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Configurando SSL para desenvolvimento..."
        
        # Instalar mkcert
        if [[ "$OS" == "macos" ]]; then
            brew install mkcert
        elif [[ "$OS" == "debian" ]]; then
            sudo apt install libnss3-tools
            curl -JLO "https://dl.filippo.io/mkcert/latest?for=linux/amd64"
            chmod +x mkcert-v*-linux-amd64
            sudo mv mkcert-v*-linux-amd64 /usr/local/bin/mkcert
        fi
        
        # Gerar certificados
        mkcert -install
        mkcert localhost 127.0.0.1 ::1
        
        log_success "SSL configurado para desenvolvimento"
    fi
}

# Executar testes
run_tests() {
    log_info "Executando testes básicos..."
    
    # Testar conexão com banco
    if npx prisma db pull > /dev/null 2>&1; then
        log_success "Conexão com banco de dados OK"
    else
        log_error "Falha na conexão com banco de dados"
    fi
    
    # Testar build
    if yarn build > /dev/null 2>&1; then
        log_success "Build da aplicação OK"
    else
        log_warning "Falha no build - verifique as configurações"
    fi
}

# Configurar serviços do sistema (opcional)
setup_systemd() {
    if [[ "$OS" != "macos" ]]; then
        read -p "Deseja configurar serviço systemd? (y/n): " -n 1 -r
        echo
        
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "Configurando serviço systemd..."
            
            sudo tee /etc/systemd/system/dmca-guard.service > /dev/null << EOF
[Unit]
Description=DMCA Guard Platform
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=NODE_ENV=production
ExecStart=/usr/bin/yarn start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
            
            sudo systemctl daemon-reload
            sudo systemctl enable dmca-guard
            
            log_success "Serviço systemd configurado"
        fi
    fi
}

# Mostrar informações finais
show_final_info() {
    echo
    echo "🎉 Setup concluído com sucesso!"
    echo "================================"
    echo
    echo "📋 Próximos passos:"
    echo "1. Configure suas chaves de API no arquivo .env.local:"
    echo "   - OpenAI API Key"
    echo "   - SendGrid API Key"
    echo
    echo "2. Inicie a aplicação:"
    echo "   cd app"
    echo "   yarn dev"
    echo
    echo "3. Acesse: http://localhost:3000"
    echo
    echo "📚 Documentação:"
    echo "   - Manual do usuário: docs/user_guide.md"
    echo "   - Configuração de APIs: docs/api_config.md"
    echo "   - Deploy: docs/deploy.md"
    echo
    echo "🆘 Suporte:"
    echo "   - Email: suporte@dmcaguard.com"
    echo "   - Discord: discord.gg/dmcaguard"
    echo
    
    if [[ "$INSTALL_POSTGRES" == true ]]; then
        echo "🔐 Credenciais do banco:"
        echo "   Database: $DB_NAME"
        echo "   User: $DB_USER"
        echo "   Password: $DB_PASSWORD"
        echo "   URL: $DATABASE_URL"
        echo
    fi
}

# Função principal
main() {
    detect_os
    check_prerequisites
    install_postgresql
    setup_database
    install_dependencies
    setup_environment
    setup_prisma
    create_directories
    install_dev_tools
    setup_ssl
    run_tests
    setup_systemd
    show_final_info
}

# Executar setup
main "$@"

