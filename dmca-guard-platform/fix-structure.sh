#!/bin/bash

echo "🔧 Corrigindo estrutura do projeto..."

# Parar processos Next.js
echo "📛 Parando processos Node/Next.js..."
pkill -f next || true

# Mover arquivos da estrutura duplicada /app/app/ para /
echo "📁 Movendo arquivos da estrutura duplicada..."
if [ -d "app/app" ]; then
    echo "  📦 Movendo conteúdo de app/app/ para raiz..."
    cp -r app/app/* . 2>/dev/null || true
    cp -r app/app/.* . 2>/dev/null || true
    rm -rf app/app
    echo "  ✅ Estrutura duplicada removida"
else
    echo "  ✅ Estrutura já corrigida"
fi

# Limpar cache e dependências
echo "🧹 Limpando cache e dependências..."
rm -rf .next node_modules package-lock.json yarn.lock

# Verificar se existe pasta app na raiz (deveria existir para Next.js 13+)
if [ ! -d "app" ]; then
    echo "❌ Pasta 'app' não encontrada na raiz do projeto!"
    echo "   Certifique-se de que os arquivos estão na estrutura correta:"
    echo "   /workspaces/dmca-deepagent/dmca-guard-platform/app/"
    exit 1
fi

# Verificar variáveis de ambiente
echo "🔐 Verificando variáveis de ambiente..."
if [ ! -f ".env.local" ]; then
    echo "⚠️  Arquivo .env.local não encontrado"
    echo "  📝 Criando .env.local a partir de .env..."
    cp .env .env.local 2>/dev/null || echo "  ❌ Arquivo .env também não encontrado"
fi

# Verificar se NEXTAUTH_SECRET existe
if ! grep -q "NEXTAUTH_SECRET" .env.local 2>/dev/null; then
    echo "  🔑 Gerando NEXTAUTH_SECRET..."
    echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
fi

# Reinstalar dependências
echo "📦 Reinstalando dependências..."
npm install

echo "✅ Estrutura corrigida! Execute 'npm run dev' para iniciar."
