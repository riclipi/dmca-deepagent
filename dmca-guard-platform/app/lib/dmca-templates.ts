
export const dmcaTemplates = {
  pt: {
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
Data: {currentDate}`
  },
  en: {
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
Date: {currentDate}`
  }
}

export function generateDmcaNotice(
  template: 'pt' | 'en',
  data: {
    userName: string
    userEmail: string
    userPhone?: string
    infringingUrl: string
    contentDescription: string
    originalUrl?: string
  }
) {
  const tmpl = dmcaTemplates[template]
  const currentDate = new Date().toLocaleDateString('pt-BR')
  
  let body = tmpl.body
    .replace(/{userName}/g, data.userName)
    .replace(/{userEmail}/g, data.userEmail)
    .replace(/{userPhone}/g, data.userPhone || 'Não informado')
    .replace(/{infringingUrl}/g, data.infringingUrl)
    .replace(/{contentDescription}/g, data.contentDescription)
    .replace(/{originalUrl}/g, data.originalUrl || 'Conteúdo original privado')
    .replace(/{currentDate}/g, currentDate)

  return {
    subject: tmpl.subject,
    body
  }
}
