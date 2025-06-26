import { PrismaClient } from '@prisma/client'
import { BrandProfile, AgentStatus, ScanSession } from './types'
import { SearchClient, SearchQuery, SearchResult } from '../integrations/search-client'
import { HistoricalAnalyzer, ViolationPattern } from '../analysis/historical-analyzer'
import { DuplicateFilter, FilterResult } from '../filtering/duplicate-filter'
import { SessionManager } from './session-manager'

const prisma = new PrismaClient()

export interface DiscoverySession {
  sessionId: string
  userId: string
  brandProfileId: string
  searchQueries: string[]
  totalQueries: number
  queriesProcessed: number
  newSitesFound: number
  duplicatesFiltered: number
  status: AgentStatus
  startedAt: Date
  estimatedCompletion?: Date
  currentQuery?: string
  lastError?: string
}

export interface DiscoveryResult {
  url: string
  domain: string
  title?: string
  description?: string
  platform?: string
  category: string
  riskScore: number
  confidence: number
  discoveryMethod: string
  matchingPatterns: string[]
  keywords: string[]
  detectedAt: Date
}

export interface DiscoveryConfig {
  maxQueriesPerSession?: number
  minConfidenceThreshold?: number
  enableHistoricalAnalysis?: boolean
  searchProviders?: string[]
  concurrency?: number
  respectRateLimits?: boolean
}

export class DiscoveryAgent {
  private userId: string
  private brandProfileId: string
  private brandProfile: BrandProfile | null = null
  private searchClient: SearchClient
  private historicalAnalyzer: HistoricalAnalyzer
  private duplicateFilter: DuplicateFilter
  private sessionManager: SessionManager
  private config: DiscoveryConfig
  private session: DiscoverySession | null = null

  constructor(userId: string, brandProfileId: string, config?: Partial<DiscoveryConfig>) {
    this.userId = userId
    this.brandProfileId = brandProfileId
    this.searchClient = new SearchClient()
    this.historicalAnalyzer = new HistoricalAnalyzer()
    this.duplicateFilter = new DuplicateFilter()
    this.sessionManager = new SessionManager()
    
    this.config = {
      maxQueriesPerSession: 100,
      minConfidenceThreshold: 0.6,
      enableHistoricalAnalysis: true,
      searchProviders: ['serper', 'google', 'bing'],
      concurrency: 3,
      respectRateLimits: true,
      ...config
    }
  }

  /**
   * Iniciar sessão de descoberta
   */
  async startDiscoverySession(): Promise<string> {
    try {
      // Carregar perfil da marca
      this.brandProfile = await this.loadBrandProfile()
      if (!this.brandProfile) {
        throw new Error('Perfil da marca não encontrado')
      }

      // Gerar queries inteligentes
      const intelligentQueries = await this.generateIntelligentQueries()
      
      // Criar sessão
      const sessionId = await this.sessionManager.startScanSession(
        this.userId, 
        this.brandProfileId
      )

      this.session = {
        sessionId,
        userId: this.userId,
        brandProfileId: this.brandProfileId,
        searchQueries: intelligentQueries.map(q => q.terms.join(' ')),
        totalQueries: intelligentQueries.length,
        queriesProcessed: 0,
        newSitesFound: 0,
        duplicatesFiltered: 0,
        status: 'RUNNING',
        startedAt: new Date()
      }

      // Executar descoberta em background
      this.executeDiscoveryInBackground(intelligentQueries)

      await this.emitEvent('discovery_started', {
        totalQueries: intelligentQueries.length,
        brandProfile: this.brandProfile.name
      })

      return sessionId

    } catch (error) {
      console.error('Erro ao iniciar sessão de descoberta:', error)
      throw error
    }
  }

  /**
   * Descoberta inteligente baseada em padrões históricos
   */
  async discoverNewSites(): Promise<DiscoveryResult[]> {
    if (!this.brandProfile) {
      throw new Error('Perfil da marca não carregado')
    }

    const intelligentQueries = await this.generateIntelligentQueries()
    const results: DiscoveryResult[] = []
    
    for (const query of intelligentQueries) {
      try {
        await this.emitEvent('query_processing', { query: query.terms.join(' ') })
        
        const searchResults = await this.executeMultiAPISearch(query)
        const filteredResults = await this.filterAndAnalyze(searchResults)
        results.push(...filteredResults)
        
        await this.updateDiscoveryProgress(query)
        
        // Delay entre queries para respeitar rate limits
        if (this.config.respectRateLimits) {
          await this.sleep(2000)
        }
        
      } catch (error) {
        console.error(`Erro ao processar query: ${query.terms.join(' ')}`, error)
        await this.handleQueryError(query, error as Error)
      }
    }
    
    return this.deduplicate(results)
  }

  /**
   * Geração de queries baseada em análise dos 17k URLs históricos
   */
  private async generateIntelligentQueries(): Promise<SearchQuery[]> {
    const queries: SearchQuery[] = []
    
    // Queries baseadas no perfil da marca
    const brandQueries = this.generateBrandQueries()
    queries.push(...brandQueries)
    
    // Queries baseadas em análise histórica se habilitada
    if (this.config.enableHistoricalAnalysis) {
      const historicalPatterns = await this.historicalAnalyzer.analyzePatterns()
      const patternQueries = this.generatePatternBasedQueries(historicalPatterns)
      queries.push(...patternQueries)
    }
    
    // Queries baseadas em descoberta de domínios similares
    const similarDomainQueries = await this.generateSimilarDomainQueries()
    queries.push(...similarDomainQueries)
    
    // Priorizar e limitar queries
    return this.prioritizeQueries(queries).slice(0, this.config.maxQueriesPerSession)
  }

  /**
   * Gerar queries baseadas no perfil da marca
   */
  private generateBrandQueries(): SearchQuery[] {
    if (!this.brandProfile) return []
    
    const queries: SearchQuery[] = []
    const brandName = this.brandProfile.name
    const keywords = this.brandProfile.keywords || []
    const variations = this.brandProfile.variations || []
    
    // Queries principais da marca
    queries.push({
      terms: [brandName, 'leaked'],
      excludeTerms: ['official', 'store', 'shop'],
      maxResults: 50,
      priority: 'HIGH'
    })
    
    queries.push({
      terms: [brandName, 'nude'],
      excludeTerms: ['official', 'news'],
      maxResults: 50,
      priority: 'HIGH'
    })
    
    queries.push({
      terms: [brandName, 'onlyfans'],
      maxResults: 30,
      priority: 'HIGH'
    })
    
    // Queries com variações do nome
    for (const variation of variations) {
      queries.push({
        terms: [variation, 'leaked'],
        maxResults: 30,
        priority: 'MEDIUM'
      })
    }
    
    // Queries com keywords específicas
    for (const keyword of keywords) {
      queries.push({
        terms: [brandName, keyword, 'leaked'],
        maxResults: 20,
        priority: 'MEDIUM'
      })
    }
    
    return queries
  }

  /**
   * Gerar queries baseadas em padrões históricos
   */
  private generatePatternBasedQueries(patterns: ViolationPattern[]): SearchQuery[] {
    const queries: SearchQuery[] = []
    
    for (const pattern of patterns.slice(0, 20)) { // Limitar a 20 padrões mais relevantes
      if (pattern.commonKeywords.length > 0) {
        queries.push({
          terms: [this.brandProfile!.name, ...pattern.commonKeywords.slice(0, 2)],
          maxResults: 25,
          priority: 'MEDIUM'
        })
      }
      
      // Queries específicas para tipos de plataforma
      if (pattern.platformType) {
        queries.push({
          terms: [this.brandProfile!.name],
          siteRestriction: pattern.platformType,
          maxResults: 20,
          priority: 'LOW'
        })
      }
    }
    
    return queries
  }

  /**
   * Gerar queries para descoberta de domínios similares
   */
  private async generateSimilarDomainQueries(): Promise<SearchQuery[]> {
    const queries: SearchQuery[] = []
    const brandName = this.brandProfile!.name.toLowerCase()
    
    // Variações comuns de domínios
    const domainVariations = [
      `${brandName}leaked`,
      `${brandName}nude`,
      `${brandName}free`,
      `${brandName}premium`,
      `leaked${brandName}`,
      `nude${brandName}`,
      `free${brandName}`
    ]
    
    for (const variation of domainVariations) {
      queries.push({
        terms: [`site:${variation}.com OR site:${variation}.to OR site:${variation}.cc`],
        maxResults: 15,
        priority: 'LOW'
      })
    }
    
    return queries
  }

  /**
   * Priorizar queries baseado em relevância e histórico
   */
  private prioritizeQueries(queries: SearchQuery[]): SearchQuery[] {
    return queries.sort((a, b) => {
      const priorityOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
  }

  /**
   * Busca em múltiplas APIs com rotação inteligente
   */
  private async executeMultiAPISearch(query: SearchQuery): Promise<SearchResult[]> {
    const providers = this.config.searchProviders || ['serper', 'google', 'bing']
    const results: SearchResult[] = []
    
    for (const provider of providers) {
      try {
        const providerResults = await this.searchClient.search(provider, query)
        results.push(...providerResults)
        
        if (results.length >= query.maxResults) break
        
      } catch (error) {
        console.warn(`Erro no provedor ${provider}:`, error)
        await this.handleProviderError(provider, error as Error)
      }
    }
    
    return results
  }

  /**
   * Filtrar e analisar resultados de busca
   */
  private async filterAndAnalyze(searchResults: SearchResult[]): Promise<DiscoveryResult[]> {
    const discoveryResults: DiscoveryResult[] = []
    
    // Extrair URLs únicos
    const urls = Array.from(new Set(searchResults.map(r => r.url)))
    
    // Filtrar duplicatas conhecidas
    const filterResult = await this.duplicateFilter.filterDuplicates(urls)
    
    // Analisar apenas URLs novos
    for (const url of filterResult.new) {
      try {
        const analysis = await this.analyzeDiscoveredUrl(url, searchResults)
        
        if (analysis && analysis.confidence >= this.config.minConfidenceThreshold!) {
          discoveryResults.push(analysis)
        }
        
      } catch (error) {
        console.warn(`Erro ao analisar URL ${url}:`, error)
      }
    }
    
    // Atualizar estatísticas de duplicatas
    if (this.session) {
      this.session.duplicatesFiltered += filterResult.duplicates.length + filterResult.variations.length
    }
    
    return discoveryResults
  }

  /**
   * Analisar URL descoberto
   */
  private async analyzeDiscoveredUrl(url: string, searchResults: SearchResult[]): Promise<DiscoveryResult | null> {
    try {
      // Encontrar resultado correspondente
      const searchResult = searchResults.find(r => r.url === url)
      if (!searchResult) return null
      
      // Extrair domínio
      const domain = this.extractDomain(url)
      
      // Calcular score de risco baseado em múltiplos fatores
      const riskScore = await this.calculateRiskScore(url, searchResult)
      
      // Detectar plataforma
      const platform = this.detectPlatform(url, searchResult)
      
      // Categorizar site
      const category = this.categorizeSite(url, searchResult)
      
      // Extrair keywords relevantes
      const keywords = this.extractRelevantKeywords(searchResult)
      
      // Identificar padrões correspondentes
      const matchingPatterns = await this.identifyMatchingPatterns(url, searchResult)
      
      return {
        url,
        domain,
        title: searchResult.title,
        description: searchResult.snippet || '',
        platform,
        category,
        riskScore,
        confidence: riskScore / 100, // Normalizar para 0-1
        discoveryMethod: 'multi-api-search',
        matchingPatterns,
        keywords,
        detectedAt: new Date()
      }
      
    } catch (error) {
      console.error(`Erro ao analisar URL ${url}:`, error)
      return null
    }
  }

  /**
   * Calcular score de risco do site descoberto
   */
  private async calculateRiskScore(url: string, searchResult: SearchResult): Promise<number> {
    let score = 0
    const text = `${searchResult.title} ${searchResult.snippet || ''}`.toLowerCase()
    const brandName = this.brandProfile!.name.toLowerCase()
    
    // Score baseado em menções da marca
    if (text.includes(brandName)) score += 30
    
    // Score baseado em keywords suspeitas
    const suspiciousKeywords = ['leaked', 'nude', 'naked', 'sex', 'porn', 'nsfw', 'onlyfans', 'premium', 'exclusive']
    const foundSuspicious = suspiciousKeywords.filter(kw => text.includes(kw))
    score += foundSuspicious.length * 10
    
    // Score baseado no domínio
    const domain = this.extractDomain(url).toLowerCase()
    if (domain.includes(brandName)) score += 25
    if (domain.includes('leaked') || domain.includes('nude')) score += 20
    
    // Score baseado em análise histórica
    if (this.config.enableHistoricalAnalysis) {
      const historicalScore = await this.historicalAnalyzer.calculateSimilarity(url)
      score += historicalScore * 20
    }
    
    // Score baseado na estrutura da URL
    if (url.includes('/leaked/') || url.includes('/nude/')) score += 15
    if (url.includes('/download/') || url.includes('/free/')) score += 10
    
    return Math.min(score, 100)
  }

  /**
   * Detectar tipo de plataforma
   */
  private detectPlatform(url: string, searchResult: SearchResult): string {
    const domain = this.extractDomain(url).toLowerCase()
    const text = `${searchResult.title} ${searchResult.snippet || ''}`.toLowerCase()
    
    // Plataformas conhecidas
    if (domain.includes('telegram') || text.includes('telegram')) return 'telegram'
    if (domain.includes('discord') || text.includes('discord')) return 'discord'
    if (domain.includes('reddit') || text.includes('reddit')) return 'reddit'
    if (domain.includes('twitter') || text.includes('twitter')) return 'twitter'
    if (domain.includes('onlyfans') || text.includes('onlyfans')) return 'onlyfans'
    if (domain.includes('mega') || text.includes('mega')) return 'file-sharing'
    if (domain.includes('forum') || text.includes('forum')) return 'forum'
    
    // Detecção baseada em TLD
    if (domain.endsWith('.to') || domain.endsWith('.cc')) return 'file-sharing'
    
    return 'unknown'
  }

  /**
   * Categorizar site baseado em características
   */
  private categorizeSite(url: string, searchResult: SearchResult): string {
    const text = `${searchResult.title} ${searchResult.snippet || ''}`.toLowerCase()
    const domain = this.extractDomain(url).toLowerCase()
    
    if (text.includes('forum') || domain.includes('forum')) return 'FORUM'
    if (text.includes('social') || domain.includes('social')) return 'SOCIAL_MEDIA'
    if (text.includes('download') || text.includes('file')) return 'FILE_SHARING'
    if (text.includes('adult') || text.includes('xxx')) return 'ADULT_CONTENT'
    if (text.includes('telegram') || text.includes('discord')) return 'MESSAGING'
    
    return 'UNKNOWN'
  }

  /**
   * Extrair keywords relevantes do resultado
   */
  private extractRelevantKeywords(searchResult: SearchResult): string[] {
    const text = `${searchResult.title} ${searchResult.snippet || ''}`.toLowerCase()
    const brandName = this.brandProfile!.name.toLowerCase()
    const keywords: string[] = []
    
    // Keywords relacionadas à marca
    if (text.includes(brandName)) keywords.push(brandName)
    
    // Keywords suspeitas
    const suspiciousKeywords = ['leaked', 'nude', 'naked', 'sex', 'porn', 'nsfw', 'onlyfans', 'premium', 'exclusive', 'free', 'download']
    for (const keyword of suspiciousKeywords) {
      if (text.includes(keyword)) keywords.push(keyword)
    }
    
    return Array.from(new Set(keywords))
  }

  /**
   * Identificar padrões históricos correspondentes
   */
  private async identifyMatchingPatterns(url: string, searchResult: SearchResult): Promise<string[]> {
    if (!this.config.enableHistoricalAnalysis) return []
    
    try {
      const patterns = await this.historicalAnalyzer.findMatchingPatterns(url)
      return patterns.map(p => p.urlPattern)
    } catch (error) {
      console.warn('Erro ao identificar padrões:', error)
      return []
    }
  }

  /**
   * Deduplicate final results
   */
  private deduplicate(results: DiscoveryResult[]): DiscoveryResult[] {
    const seen = new Set<string>()
    const deduplicated: DiscoveryResult[] = []
    
    for (const result of results) {
      const key = this.extractDomain(result.url)
      if (!seen.has(key)) {
        seen.add(key)
        deduplicated.push(result)
      }
    }
    
    return deduplicated
  }

  /**
   * Atualizar progresso da descoberta
   */
  private async updateDiscoveryProgress(query: SearchQuery): Promise<void> {
    if (!this.session) return
    
    this.session.queriesProcessed++
    this.session.currentQuery = query.terms.join(' ')
    
    // Calcular estimativa de conclusão
    if (this.session.queriesProcessed > 0) {
      const elapsed = Date.now() - this.session.startedAt.getTime()
      const avgTimePerQuery = elapsed / this.session.queriesProcessed
      const remaining = this.session.totalQueries - this.session.queriesProcessed
      
      this.session.estimatedCompletion = new Date(
        Date.now() + (remaining * avgTimePerQuery)
      )
    }
    
    // Atualizar no banco
    await this.sessionManager.updateSession(this.session.sessionId, {
      sitesScanned: this.session.queriesProcessed,
      totalSites: this.session.totalQueries,
      violationsFound: this.session.newSitesFound,
      currentSite: this.session.currentQuery,
      estimatedCompletion: this.session.estimatedCompletion
    })
    
    // Emitir evento de progresso
    await this.emitEvent('discovery_progress', {
      queriesProcessed: this.session.queriesProcessed,
      totalQueries: this.session.totalQueries,
      newSitesFound: this.session.newSitesFound,
      currentQuery: this.session.currentQuery
    })
  }

  /**
   * Executar descoberta em background
   */
  private async executeDiscoveryInBackground(queries: SearchQuery[]): Promise<void> {
    try {
      const results = await this.discoverNewSites()
      
      // Salvar novos sites descobertos
      for (const result of results) {
        await this.saveDiscoveredSite(result)
      }
      
      if (this.session) {
        this.session.status = 'COMPLETED'
        this.session.newSitesFound = results.length
      }
      
      await this.emitEvent('discovery_completed', {
        newSitesFound: results.length,
        totalQueries: queries.length
      })
      
    } catch (error) {
      console.error('Erro durante descoberta:', error)
      
      if (this.session) {
        this.session.status = 'ERROR'
        this.session.lastError = error instanceof Error ? error.message : 'Erro desconhecido'
      }
      
      await this.emitEvent('discovery_error', { error: error instanceof Error ? error.message : 'Erro desconhecido' })
    }
  }

  /**
   * Salvar site descoberto no banco
   */
  private async saveDiscoveredSite(result: DiscoveryResult): Promise<void> {
    try {
      await prisma.knownSite.create({
        data: {
          baseUrl: result.url,
          domain: result.domain,
          category: result.category as any,
          platform: result.platform,
          riskScore: Math.round(result.riskScore),
          totalViolations: 0,
          lastChecked: null,
          userId: this.userId,
          isActive: true
        }
      })
      
      console.log(`Novo site descoberto salvo: ${result.domain}`)
      
    } catch (error) {
      // Site pode já existir - ignorar erro de duplicata
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('Unique constraint')) {
        console.error('Erro ao salvar site descoberto:', error)
      }
    }
  }

  /**
   * Carregar perfil da marca
   */
  private async loadBrandProfile(): Promise<BrandProfile | null> {
    const profile = await prisma.brandProfile.findFirst({
      where: {
        id: this.brandProfileId,
        userId: this.userId
      }
    })
    
    return profile as BrandProfile | null
  }

  /**
   * Extrair domínio da URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0]
    }
  }

  /**
   * Tratar erro de provedor de busca
   */
  private async handleProviderError(provider: string, error: Error): Promise<void> {
    console.error(`Erro no provedor ${provider}:`, error)
    
    await this.emitEvent('provider_error', {
      provider,
      error: error.message
    })
  }

  /**
   * Tratar erro de query
   */
  private async handleQueryError(query: SearchQuery, error: Error): Promise<void> {
    console.error(`Erro na query ${query.terms.join(' ')}:`, error)
    
    if (this.session) {
      this.session.lastError = `Query "${query.terms.join(' ')}": ${error.message}`
    }
  }

  /**
   * Emitir evento do agente
   */
  private async emitEvent(type: string, data: Record<string, any>): Promise<void> {
    if (!this.session) return
    
    try {
      await this.sessionManager.emitEvent({
        type: type as any,
        sessionId: this.session.sessionId,
        timestamp: new Date(),
        data
      })
    } catch (error) {
      console.error('Erro ao emitir evento:', error)
    }
  }

  /**
   * Utility: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Obter status da sessão atual
   */
  getSessionStatus(): DiscoverySession | null {
    return this.session
  }

  /**
   * Pausar descoberta
   */
  async pauseDiscovery(): Promise<void> {
    if (this.session) {
      this.session.status = 'PAUSED'
      await this.emitEvent('discovery_paused', {})
    }
  }

  /**
   * Retomar descoberta
   */
  async resumeDiscovery(): Promise<void> {
    if (this.session) {
      this.session.status = 'RUNNING'
      await this.emitEvent('discovery_resumed', {})
    }
  }
}
