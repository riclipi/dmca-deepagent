import { PrismaClient, KnownSite } from '@prisma/client'

const prisma = new PrismaClient()

export interface FilterResult {
  new: string[]
  duplicates: string[]
  variations: string[]
}

export interface UrlAnalysis {
  normalized: string
  domain: string
  path: string
  isKnown: boolean
  isVariation: boolean
  confidence: number
}

export class DuplicateFilter {
  private knownSitesDb: KnownSite[] = []
  private historicalUrls: Set<string> = new Set()
  private domainVariations: Map<string, string[]> = new Map()

  constructor() {
    this.initialize()
  }

  /**
   * Inicializar filtro carregando dados do banco
   */
  private async initialize(): Promise<void> {
    try {
      // Carregar sites conhecidos
      this.knownSitesDb = await prisma.knownSite.findMany({
        select: {
          id: true,
          baseUrl: true,
          domain: true,
          category: true,
          platform: true,
          isActive: true,
          userId: true,
          riskScore: true,
          totalViolations: true,
          lastViolation: true,
          lastChecked: true,
          avgResponseTime: true,
          robotsTxtUrl: true,
          crawlDelay: true,
          lastCrawlSuccess: true,
          blockedByRobots: true,
          createdAt: true,
          updatedAt: true
        }
      })

      // Carregar URLs históricos (dos 17k URLs)
      await this.loadHistoricalUrls()

      // Pré-computar variações de domínios conhecidos
      await this.precomputeDomainVariations()

      console.log(`DuplicateFilter inicializado com ${this.knownSitesDb.length} sites conhecidos e ${this.historicalUrls.size} URLs históricos`)

    } catch (error) {
      console.error('Erro ao inicializar DuplicateFilter:', error)
    }
  }

  /**
   * Carregar URLs históricos dos 17k URLs derrubados
   */
  private async loadHistoricalUrls(): Promise<void> {
    try {
      // Carregar URLs históricos do banco de violações
      const historicalViolations = await prisma.violationHistory.findMany({
        select: { url: true },
        take: 20000 // Limitar a 20k para performance
      })

      for (const violation of historicalViolations) {
        this.historicalUrls.add(this.normalizeUrl(violation.url))
      }

      // Adicionar URLs dos sites conhecidos
      for (const site of this.knownSitesDb) {
        this.historicalUrls.add(this.normalizeUrl(site.baseUrl))
      }

    } catch (error) {
      console.warn('Erro ao carregar URLs históricos:', error)
    }
  }

  /**
   * Pré-computar variações de domínios conhecidos
   */
  private async precomputeDomainVariations(): Promise<void> {
    for (const site of this.knownSitesDb) {
      const domain = this.extractDomain(site.baseUrl)
      const variations = this.generateDomainVariations(domain)
      this.domainVariations.set(domain, variations)
    }
  }

  /**
   * Filtrar URLs já conhecidos ou processados
   */
  async filterDuplicates(newUrls: string[]): Promise<FilterResult> {
    const result: FilterResult = {
      new: [],
      duplicates: [],
      variations: []
    }

    for (const url of newUrls) {
      const category = await this.categorizeUrl(url)
      result[category].push(url)
    }

    return result
  }

  /**
   * Categorizar URL como novo, duplicata ou variação
   */
  private async categorizeUrl(url: string): Promise<keyof FilterResult> {
    // Normalizar URL
    const normalized = this.normalizeUrl(url)
    
    // Verificar se é URL conhecido exato
    if (this.historicalUrls.has(normalized)) {
      return 'duplicates'
    }

    // Verificar se é variação de URL conhecido
    if (await this.detectUrlVariations(url)) {
      return 'variations'
    }

    // Verificar se o domínio já existe
    const domain = this.extractDomain(url)
    if (this.isDomainKnown(domain)) {
      return 'duplicates'
    }

    // Se chegou até aqui, é novo
    return 'new'
  }

  /**
   * Verificar se domínio é conhecido
   */
  private isDomainKnown(domain: string): boolean {
    return this.knownSitesDb.some(site => site.domain === domain)
  }

  /**
   * Detecção de variações de URLs conhecidos
   */
  async detectUrlVariations(url: string): Promise<boolean> {
    const normalized = this.normalizeUrl(url)
    const domain = this.extractDomain(url)
    
    // Verificar variações diretas
    const variations = this.generateUrlVariations(normalized)
    for (const variation of variations) {
      if (this.historicalUrls.has(variation)) {
        return true
      }
    }

    // Verificar variações de domínio
    for (const [knownDomain, domainVars] of this.domainVariations) {
      if (domainVars.includes(domain)) {
        return true
      }
    }

    // Verificar similarity usando algoritmo de distância
    return this.checkUrlSimilarity(normalized)
  }

  /**
   * Verificar similaridade com URLs conhecidos
   */
  private checkUrlSimilarity(url: string): boolean {
    const threshold = 0.85 // 85% de similaridade

    for (const knownUrl of this.historicalUrls) {
      const similarity = this.calculateUrlSimilarity(url, knownUrl)
      if (similarity >= threshold) {
        return true
      }
    }

    return false
  }

  /**
   * Calcular similaridade entre duas URLs
   */
  private calculateUrlSimilarity(url1: string, url2: string): number {
    // Usar algoritmo de Levenshtein para calcular distância
    const distance = this.levenshteinDistance(url1, url2)
    const maxLength = Math.max(url1.length, url2.length)
    
    if (maxLength === 0) return 1.0
    
    return 1 - (distance / maxLength)
  }

  /**
   * Algoritmo de distância de Levenshtein
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = []

    // Incrementar ao longo da primeira coluna de cada linha
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    // Incrementar ao longo da primeira linha de cada coluna
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    // Preencher a matriz
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substituição
            matrix[i][j - 1] + 1,     // inserção
            matrix[i - 1][j] + 1      // remoção
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Normalização para detecção de duplicatas
   */
  private normalizeUrl(url: string): string {
    try {
      let normalized = url.toLowerCase().trim()

      // Remover protocolo
      normalized = normalized.replace(/^https?:\/\//, '')

      // Remover www.
      normalized = normalized.replace(/^www\./, '')

      // Remover parâmetros de tracking comuns
      normalized = this.removeTrackingParams(normalized)

      // Remover trailing slash
      normalized = normalized.replace(/\/$/, '')

      // Remover fragmentos (#)
      normalized = normalized.split('#')[0]

      // Normalizar múltiplas barras
      normalized = normalized.replace(/\/+/g, '/')

      return normalized

    } catch (error) {
      console.warn('Erro ao normalizar URL:', url, error)
      return url.toLowerCase()
    }
  }

  /**
   * Remover parâmetros de tracking
   */
  private removeTrackingParams(url: string): string {
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'mc_eid', 'mc_cid', '_ga', 'ref', 'referrer'
    ]

    try {
      const urlObj = new URL('http://' + url)
      
      for (const param of trackingParams) {
        urlObj.searchParams.delete(param)
      }

      return urlObj.toString().replace('http://', '')
    } catch {
      return url
    }
  }

  /**
   * Gerar variações de URL
   */
  private generateUrlVariations(url: string): string[] {
    const variations = new Set<string>()
    
    variations.add(url)
    
    // Variações com/sem trailing slash
    variations.add(url + '/')
    variations.add(url.replace(/\/$/, ''))
    
    // Variações com/sem www
    variations.add('www.' + url)
    variations.add(url.replace(/^www\./, ''))
    
    // Variações de protocolo
    variations.add('http://' + url)
    variations.add('https://' + url)
    
    // Variações de case
    variations.add(url.toUpperCase())
    variations.add(url.toLowerCase())
    
    return Array.from(variations)
  }

  /**
   * Gerar variações de domínio
   */
  private generateDomainVariations(domain: string): string[] {
    const variations = new Set<string>()
    const baseDomain = domain.replace(/^www\./, '')
    
    variations.add(domain)
    variations.add(baseDomain)
    variations.add('www.' + baseDomain)
    
    // Variações com diferentes TLDs
    const tlds = ['.com', '.org', '.net', '.to', '.cc', '.me', '.tv', '.io']
    const domainWithoutTld = baseDomain.split('.')[0]
    
    for (const tld of tlds) {
      variations.add(domainWithoutTld + tld)
      variations.add('www.' + domainWithoutTld + tld)
    }
    
    // Variações com subdomain comuns
    const subdomains = ['m', 'mobile', 'www', 'en', 'app', 'api']
    for (const sub of subdomains) {
      variations.add(sub + '.' + baseDomain)
    }
    
    // Variações com caracteres similares
    const charVariations = this.generateCharacterVariations(domainWithoutTld)
    for (const variation of charVariations) {
      variations.add(variation + baseDomain.substring(domainWithoutTld.length))
    }
    
    return Array.from(variations)
  }

  /**
   * Gerar variações de caracteres (para detectar typosquatting)
   */
  private generateCharacterVariations(domain: string): string[] {
    const variations = new Set<string>()
    
    // Substituições comuns
    const substitutions = {
      'o': ['0', 'ο'], // o para zero e omicron grego
      'a': ['@', 'а'], // a para @ e a cirílico
      'e': ['3', 'е'], // e para 3 e e cirílico
      'i': ['1', '!', 'і'], // i para 1, ! e i cirílico
      's': ['$', '5'],
      'l': ['1', '|'],
      'g': ['9', 'q']
    }
    
    for (let i = 0; i < domain.length; i++) {
      const char = domain[i].toLowerCase()
      const subs = substitutions[char as keyof typeof substitutions]
      
      if (subs) {
        for (const sub of subs) {
          const variation = domain.substring(0, i) + sub + domain.substring(i + 1)
          variations.add(variation)
        }
      }
    }
    
    return Array.from(variations)
  }

  /**
   * Extrair domínio da URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url)
      return urlObj.hostname.replace(/^www\./, '')
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
  }

  /**
   * Analisar URL em detalhes
   */
  async analyzeUrl(url: string): Promise<UrlAnalysis> {
    const normalized = this.normalizeUrl(url)
    const domain = this.extractDomain(url)
    const path = this.extractPath(url)
    
    const isKnown = this.historicalUrls.has(normalized) || this.isDomainKnown(domain)
    const isVariation = !isKnown && await this.detectUrlVariations(url)
    
    // Calcular confidence baseado em múltiplos fatores
    let confidence = 0
    
    if (isKnown) confidence = 1.0
    else if (isVariation) confidence = 0.8
    else {
      // Calcular confidence baseado em similarity com URLs conhecidos
      let maxSimilarity = 0
      for (const knownUrl of Array.from(this.historicalUrls).slice(0, 1000)) { // Limitar para performance
        const similarity = this.calculateUrlSimilarity(normalized, knownUrl)
        maxSimilarity = Math.max(maxSimilarity, similarity)
      }
      confidence = maxSimilarity
    }
    
    return {
      normalized,
      domain,
      path,
      isKnown,
      isVariation,
      confidence
    }
  }

  /**
   * Extrair path da URL
   */
  private extractPath(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url)
      return urlObj.pathname
    } catch {
      const parts = url.replace(/^https?:\/\//, '').split('/')
      return parts.length > 1 ? '/' + parts.slice(1).join('/') : '/'
    }
  }

  /**
   * Adicionar novo URL ao cache conhecido
   */
  async addKnownUrl(url: string): Promise<void> {
    const normalized = this.normalizeUrl(url)
    this.historicalUrls.add(normalized)
  }

  /**
   * Remover URL do cache conhecido
   */
  async removeKnownUrl(url: string): Promise<void> {
    const normalized = this.normalizeUrl(url)
    this.historicalUrls.delete(normalized)
  }

  /**
   * Obter estatísticas do filtro
   */
  getStats(): {
    knownSites: number
    historicalUrls: number
    domainVariations: number
  } {
    return {
      knownSites: this.knownSitesDb.length,
      historicalUrls: this.historicalUrls.size,
      domainVariations: this.domainVariations.size
    }
  }

  /**
   * Atualizar cache do filtro
   */
  async refreshCache(): Promise<void> {
    await this.initialize()
  }

  /**
   * Verificar se URL é potencialmente malicioso
   */
  async isUrlSuspicious(url: string): Promise<{ suspicious: boolean; reasons: string[] }> {
    const reasons: string[] = []
    const domain = this.extractDomain(url).toLowerCase()
    const path = this.extractPath(url).toLowerCase()
    
    // Verificar padrões suspeitos no domínio
    const suspiciousDomainPatterns = [
      /leaked/i, /nude/i, /free/i, /download/i, /torrent/i,
      /pirate/i, /crack/i, /hack/i, /xxx/i, /porn/i
    ]
    
    for (const pattern of suspiciousDomainPatterns) {
      if (pattern.test(domain)) {
        reasons.push(`Domínio suspeito: contém "${pattern.source}"`)
      }
    }
    
    // Verificar padrões suspeitos no path
    const suspiciousPathPatterns = [
      /\/leaked\//i, /\/nude\//i, /\/download\//i, /\/free\//i,
      /\/torrent\//i, /\/crack\//i, /\/pirate\//i
    ]
    
    for (const pattern of suspiciousPathPatterns) {
      if (pattern.test(path)) {
        reasons.push(`Path suspeito: contém "${pattern.source}"`)
      }
    }
    
    // Verificar TLDs suspeitos
    const suspiciousTlds = ['.tk', '.ml', '.ga', '.cf', '.to', '.cc']
    for (const tld of suspiciousTlds) {
      if (domain.endsWith(tld)) {
        reasons.push(`TLD suspeito: ${tld}`)
        break
      }
    }
    
    return {
      suspicious: reasons.length > 0,
      reasons
    }
  }
}
