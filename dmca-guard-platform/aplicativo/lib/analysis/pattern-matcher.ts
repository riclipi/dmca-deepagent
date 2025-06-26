import { ExtractedContent } from '../extraction/content-extractor'
import { BrandProfile } from '../agents/types'

export interface PatternAnalysisResult {
  suspiciousKeywords: string[]
  suspiciousLinks: any[]
  downloadTriggers: any[]
  socialMediaLinks: string[]
  riskScoreContribution: number
}

export class PatternMatcher {
  private suspiciousKeywords: string[]
  private suspiciousLinkPatterns: RegExp[]

  constructor() {
    this.suspiciousKeywords = [
      'download grátis', 'download free', 'leaked', 'vazado', 'nulled',
      'cracked', 'pirateado', 'torrent', 'magnet link', 'serial key',
      'keygen', 'ativador', 'unlock premium', 'conteúdo exclusivo',
      'apenas para membros', 'onlyfans rip', 'privacy policy violation'
    ]

    this.suspiciousLinkPatterns = [
      /mega\.nz/i, /drive\.google\.com/i, /dropbox\.com/i, /mediafire\.com/i,
      /zippyshare\.com/i, /rapidgator\.net/i, /4shared\.com/i,
      /telegram\.me/i, /t\.me/i, /discord\.gg/i,
      /(?:magnet|torrent):/i
    ]
  }

  /**
   * Analisar conteúdo em busca de padrões suspeitos
   */
  analyze(content: ExtractedContent, brandProfile: BrandProfile): PatternAnalysisResult {
    const customKeywords = [...this.suspiciousKeywords, ...(brandProfile.keywords || [])]

    const suspiciousKeywordsFound = this.findSuspiciousKeywords(content.bodyText, customKeywords)
    const suspiciousLinksFound = this.analyzeLinkPatterns(content.links)
    const downloadTriggersFound = this.checkForDownloadTriggers(content.bodyText, content.links)
    const socialMediaLinks = this.findSocialMediaLinks(content.links)

    const riskScoreContribution = 
      (suspiciousKeywordsFound.length * 5) +
      (suspiciousLinksFound.length * 10) +
      (downloadTriggersFound.length * 15)

    return {
      suspiciousKeywords: suspiciousKeywordsFound,
      suspiciousLinks: suspiciousLinksFound,
      downloadTriggers: downloadTriggersFound,
      socialMediaLinks,
      riskScoreContribution: Math.min(30, riskScoreContribution) // Cap at 30
    }
  }

  /**
   * Encontrar palavras-chave suspeitas no texto
   */
  findSuspiciousKeywords(text: string, keywords: string[]): string[] {
    const found: string[] = []
    const lowerText = text.toLowerCase()

    for (const keyword of keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        found.push(keyword)
      }
    }
    return [...new Set(found)]
  }

  /**
   * Analisar padrões de links suspeitos
   */
  analyzeLinkPatterns(links: string[]): any[] {
    const suspiciousLinks: any[] = []

    for (const link of links) {
      for (const pattern of this.suspiciousLinkPatterns) {
        if (pattern.test(link)) {
          suspiciousLinks.push({
            link,
            reason: `Padrão suspeito: ${pattern.source}`
          })
          break // Para não adicionar o mesmo link múltiplas vezes
        }
      }
    }
    return suspiciousLinks
  }

  /**
   * Verificar triggers de download
   */
  checkForDownloadTriggers(text: string, links: string[]): any[] {
    const triggers: any[] = []
    const lowerText = text.toLowerCase()
    const downloadKeywords = ['download', 'baixar', 'get now', 'obter agora', 'download here']

    // Verificar texto
    for (const keyword of downloadKeywords) {
      if (lowerText.includes(keyword)) {
        triggers.push({
          type: 'text',
          keyword,
          description: `Texto de download encontrado: "${keyword}"`
        })
      }
    }

    // Verificar links
    for (const link of links) {
      const lowerLink = link.toLowerCase()
      if (downloadKeywords.some(kw => lowerLink.includes(kw))) {
         triggers.push({
          type: 'link',
          link,
          description: `Link de download direto suspeito`
        })
      }
    }

    return triggers
  }

  /**
   * Encontrar links de redes sociais
   */
  findSocialMediaLinks(links: string[]): string[] {
    const socialPatterns = [
      /instagram\.com/i, /facebook\.com/i, /twitter\.com/i, /tiktok\.com/i,
      /youtube\.com/i, /linkedin\.com/i, /pinterest\.com/i, /t\.me/i
    ]

    return links.filter(link => 
      socialPatterns.some(pattern => pattern.test(link))
    )
  }
}

