
# DMCA Guard Platform 🛡️

Uma plataforma SaaS completa para detecção e remoção automatizada de conteúdo não autorizado, desenvolvida especialmente para criadoras de conteúdo adulto brasileiras.

## 🚀 Visão Geral

A DMCA Guard Platform oferece uma solução abrangente para proteção de direitos autorais, incluindo:

- **Detecção Automatizada**: Monitoramento contínuo de plataformas para identificar conteúdo vazado
- **Notificações DMCA**: Envio automatizado de notificações de remoção
- **Dashboard Intuitivo**: Interface completa para gerenciamento de marcas e monitoramento
- **Sistema Freemium**: Planos flexíveis para diferentes necessidades
- **Compliance LGPD**: Totalmente conforme com a legislação brasileira de proteção de dados

## 🏗️ Arquitetura

```
dmca-guard-platform/
├── app/                    # Aplicação Next.js principal
│   ├── app/               # App Router do Next.js 13+
│   ├── components/        # Componentes React reutilizáveis
│   ├── lib/              # Utilitários e configurações
│   ├── prisma/           # Schema e migrações do banco
│   └── types/            # Definições TypeScript
├── docs/                 # Documentação completa
├── scripts/              # Scripts de automação
└── README.md            # Este arquivo
```

## 🛠️ Stack Tecnológica

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Banco de Dados**: PostgreSQL
- **Autenticação**: NextAuth.js
- **UI Components**: shadcn/ui
- **Integrações**: OpenAI API, SendGrid
- **Deploy**: Railway, Vercel, AWS (suporte completo)

## ⚡ Início Rápido

### Pré-requisitos

- Node.js 18+ 
- PostgreSQL 14+
- Yarn ou npm
- Contas nas APIs: OpenAI, SendGrid

### Instalação Local

```bash
# Clone o repositório
git clone <repository-url>
cd dmca-guard-platform/app

# Instale as dependências
yarn install

# Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas configurações

# Execute as migrações do banco
npx prisma migrate dev

# Inicie o servidor de desenvolvimento
yarn dev
```

A aplicação estará disponível em `http://localhost:3000`

### Instalação Automatizada

Use nossos scripts de automação para setup rápido:

```bash
# Setup completo local
./scripts/setup.sh

# Deploy no Railway
./scripts/deploy_railway.sh

# Deploy no Vercel
./scripts/deploy_vercel.sh

# Deploy na AWS
./scripts/deploy_aws.sh
```

## 📚 Documentação

- **[Guia de Instalação](docs/installation.md)** - Setup detalhado e configuração
- **[Configuração de APIs](docs/api_config.md)** - OpenAI e SendGrid
- **[Guia de Deploy](docs/deploy.md)** - Railway, Vercel e AWS
- **[Manual do Usuário](docs/user_guide.md)** - Para criadoras de conteúdo
- **[Guia de Administração](docs/admin_guide.md)** - Gestão da plataforma
- **[Troubleshooting](docs/troubleshooting.md)** - Soluções para problemas comuns

## 🔐 Segurança e Compliance

### LGPD Compliance
- ✅ Consentimento explícito para dados sensíveis
- ✅ Direitos dos titulares implementados
- ✅ Criptografia de dados em trânsito e repouso
- ✅ Logs de auditoria completos
- ✅ Política de privacidade específica para conteúdo adulto

### Segurança
- 🔒 Autenticação multi-fator
- 🔒 Isolamento de tenants
- 🔒 Criptografia AES-256
- 🔒 Headers de segurança configurados
- 🔒 Rate limiting implementado

## 💰 Modelo de Negócio

### Plano Gratuito
- 5 perfis de marca
- 10 sessões de monitoramento/mês
- Suporte por email

### Plano Pro (R$ 97/mês)
- Perfis ilimitados
- Monitoramento contínuo
- Notificações DMCA automatizadas
- Suporte prioritário
- Analytics avançados

### Plano Enterprise (R$ 297/mês)
- Todos os recursos Pro
- API personalizada
- Integração com sistemas externos
- Suporte dedicado
- Consultoria jurídica

## 🚀 Deploy em Produção

### Railway (Recomendado)
```bash
# Deploy automático
./scripts/deploy_railway.sh
```

### Vercel
```bash
# Deploy frontend + Serverless
./scripts/deploy_vercel.sh
```

### AWS
```bash
# Deploy completo na AWS
./scripts/deploy_aws.sh
```

## 🔧 Configuração de Ambiente

### Variáveis Obrigatórias

```env
# Banco de Dados
DATABASE_URL="postgresql://user:password@localhost:5432/dmca_guard"

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# OpenAI
OPENAI_API_KEY="sk-your-openai-key"

# SendGrid
SENDGRID_API_KEY="SG.your-sendgrid-key"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"

# Aplicação
APP_URL="http://localhost:3000"
```

## 📊 Monitoramento

### Métricas Importantes
- Taxa de detecção de vazamentos
- Tempo de resposta para remoção DMCA
- Satisfação do cliente (NPS)
- Uptime da plataforma

### Alertas Configurados
- Novo conteúdo detectado
- Falha na remoção após 72h
- Tentativas de acesso não autorizado
- Violações de compliance

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🆘 Suporte

- **Documentação**: [docs/](docs/)
- **Issues**: GitHub Issues
- **Email**: suporte@dmcaguard.com
- **Discord**: [Comunidade DMCA Guard](https://discord.gg/dmcaguard)

## 🗺️ Roadmap

### Q2 2025
- [x] MVP com funcionalidades básicas
- [x] Sistema de autenticação
- [x] Dashboard inicial
- [x] Compliance LGPD

### Q3 2025
- [ ] Integração com múltiplas plataformas
- [ ] IA avançada para detecção
- [ ] API pública
- [ ] Mobile app

### Q4 2025
- [ ] Expansão internacional
- [ ] Parcerias estratégicas
- [ ] Recursos enterprise
- [ ] Compliance global (GDPR)

---

**Desenvolvido com ❤️ para proteger criadoras de conteúdo brasileiras**

Para mais informações, consulte nossa [documentação completa](docs/) ou entre em contato com nossa equipe de suporte.

