# 🚀 DMCA Guard - Deploy no Railway

## ✅ Preparação Completa

Todos os arquivos estão prontos para deploy em produção!

## 🔧 Configuração no Railway Dashboard

### 1. Conectar GitHub Repository

1. Acesse https://railway.app/dashboard
2. Vá no projeto `dmca-guard`
3. Clique em "Connect Repo"
4. Selecione `riclipi/dmca-deepagent`
5. **Root Directory:** `dmca-guard-platform/aplicativo`

### 2. Configurar Variáveis de Ambiente

Adicione estas variáveis em **Project Settings > Variables**:

```bash
# NextAuth
NEXTAUTH_SECRET="kWrhE8mMrJfoQUyrY+VebOAwpLtzthZsU6IBrPr72nw="
NODE_ENV="production"

# Email (Resend) - USAR SUAS CHAVES REAIS
RESEND_API_KEY="re_5o5VaZXz_A5WtSqKjc27VaA4Yg7AhQLUF"
RESEND_SENDER_FROM_EMAIL="guard@dmcaguard.online"
RESEND_DOMAIN="dmcaguard.online"
RESEND_SENDER_NAME="DMCA Guard"

# Super User
SUPER_USER_EMAIL="larys.cubas@hotmail.com"
```

**⚠️ IMPORTANTE:** 
- `DATABASE_URL` será gerado automaticamente pelo Railway
- `NEXTAUTH_URL` será gerado automaticamente pelo Railway

### 3. Configurar Build Settings

- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Node Version:** 18.x (automático via nixpacks.toml)

### 4. Deploy

1. Clique em "Deploy Now"
2. Aguarde o build completar
3. O Railway executará automaticamente:
   - `npm ci`
   - `prisma generate`
   - `npm run build`
   - `prisma migrate deploy` (via postbuild)
   - `npm start`

## 📋 Pós-Deploy

### 1. Criar Super User

Execute no Railway terminal:
```bash
node scripts/create-super-user.js
```

**Credenciais do Super User:**
- Email: `larys.cubas@hotmail.com`
- Senha: `DmcaGuard2024!`
- ⚠️ **Trocar senha no primeiro login!**

### 2. Testar Aplicação

1. Acesse a URL gerada pelo Railway
2. Faça login com as credenciais do Super User
3. Teste as funcionalidades principais:
   - ✅ Dashboard carregando
   - ✅ Criar perfil de marca
   - ✅ Envio de email funcionando
   - ✅ Todas as páginas respondendo

### 3. Configurar Domínio Customizado (Opcional)

1. No Railway Dashboard
2. **Settings > Custom Domain**
3. Adicionar `dmca-guard.online`
4. Configurar DNS:
   ```
   CNAME @ dmca-guard-production.railway.app
   CNAME www dmca-guard-production.railway.app
   ```

## 🔍 Monitoramento

### Logs
```bash
railway logs
```

### Status
```bash
railway status
```

### Conectar ao Banco
```bash
railway connect postgresql
```

## ✅ Checklist Final

- [ ] Build executado com sucesso
- [ ] Aplicação acessível via URL
- [ ] Login funcionando
- [ ] Dashboard carregando
- [ ] Envio de email testado
- [ ] Super User criado
- [ ] Domínio customizado configurado (opcional)

## 🆘 Troubleshooting

### Build Failing
- Verificar logs no Railway Dashboard
- Confirmar que todas as env vars estão definidas

### Database Connection
- Verificar se PostgreSQL está ativo
- Confirmar se migrations rodaram

### Email Não Funciona
- Verificar RESEND_API_KEY
- Confirmar domínio verificado no Resend

## 🎉 Deploy Concluído!

Sua aplicação DMCA Guard estará acessível em:
`https://dmca-guard-production.railway.app`

---

**📞 Suporte:** Se precisar de ajuda, os logs do Railway mostrarão detalhes de qualquer erro.