
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Criar configurações da plataforma
  const configs = [
    {
      key: 'platform_name',
      value: 'DMCA Guard',
      description: 'Nome da plataforma'
    },
    {
      key: 'support_email',
      value: 'suporte@dmcaguard.com',
      description: 'Email de suporte'
    },
    {
      key: 'max_free_brand_profiles',
      value: '5',
      description: 'Máximo de perfis de marca no plano gratuito'
    },
    {
      key: 'max_free_takedowns_per_month',
      value: '10',
      description: 'Máximo de takedowns por mês no plano gratuito'
    },
    {
      key: 'scan_frequency_free',
      value: '168',
      description: 'Frequência de scan em horas para plano gratuito (1 semana)'
    }
  ]

  for (const config of configs) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: { value: config.value },
      create: config
    })
  }

  // Criar templates DMCA
  const dmcaTemplates = [
    {
      name: 'Template Padrão Português',
      language: 'pt',
      subject: 'Notificação DMCA - Remoção de Conteúdo Não Autorizado',
      body: `Prezado(a) responsável,

Eu, {userName}, na qualidade de proprietário dos direitos autorais do conteúdo abaixo, notifico que o material localizado na(s) seguinte(s) URL(s) infringe meus direitos autorais:

URLs do conteúdo infrator:
- {infringingUrl}

Descrição do conteúdo original:
- Título/Descrição: {contentDescription}
- Localização original: {originalUrl}
- Prova de propriedade: Anexar evidências de criação/propriedade

Declaro, sob pena de perjúrio, que:
1. Acredito de boa-fé que o uso do material acima não está autorizado pelo proprietário dos direitos, seu agente ou pela lei
2. As informações aqui prestadas são verdadeiras e precisas
3. Sou o proprietário ou autorizado a agir em nome do proprietário dos direitos autorais

Solicito a remoção ou desativação imediata do acesso ao conteúdo infrator.

Meus dados de contato:
Nome: {userName}
E-mail: {userEmail}
Telefone: {userPhone}

Atenciosamente,
{userName}
Data: {currentDate}`,
      isDefault: true,
      isActive: true
    },
    {
      name: 'Template Padrão Inglês',
      language: 'en',
      subject: 'DMCA Takedown Notice - Unauthorized Content',
      body: `Dear DMCA Agent/Copyright Agent,

My name is {userName} and I am the copyright owner of the content described below. This is a notice in compliance with Section 512 of the Digital Millennium Copyright Act ("DMCA") requesting the cessation of access to copyrighted material.

Identification of Infringing Content:
- URL(s) of infringing content: {infringingUrl}
- Description of infringing material: {contentDescription}

Original Content Details:
- URL(s) of original content: {originalUrl}
- Description: {contentDescription}

Statement of Good Faith:
I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or law.

Legal Declaration:
I swear, under penalty of perjury, that the information in this notice is accurate, and I am authorized to act on behalf of the copyright owner.

Contact Information:
Name: {userName}
Email: {userEmail}
Phone: {userPhone}

Please confirm once the infringing content has been removed.

Signature: {userName}
Date: {currentDate}`,
      isDefault: false,
      isActive: true
    }
  ]

  for (const template of dmcaTemplates) {
    await prisma.dmcaTemplate.upsert({
      where: { 
        name_language: {
          name: template.name,
          language: template.language
        }
      },
      update: { 
        subject: template.subject,
        body: template.body,
        isActive: template.isActive
      },
      create: template
    })
  }

  console.log('✅ Seed concluído com sucesso!')
  console.log('📊 Dados criados:')
  console.log(`- ${configs.length} configurações da plataforma`)
  console.log(`- ${dmcaTemplates.length} templates DMCA`)
}

main()
  .catch((e) => {
    console.error('❌ Erro durante o seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
