import { z } from 'zod'

// Schemas de validação
export const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string().optional(),
  displayUrl: z.string().optional(),
  rank: z.number().optional(),
  source: z.enum(['serper', 'google', 'bing']),
  thumbnail: z.string().url().optional(),
  date: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export const SearchOptionsSchema = z.object({
  limit: z.number().min(1).max(100).default(10),
  country: z.string().default('br'),
  language: z.string().default('pt'),
  safeSearch: z.boolean().default(true),
  includeImages: z.boolean().default(false),
  dateRange: z.enum(['day', 'week', 'month', 'year', 'all']).default('all'),
  site: z.string().optional(),
  excludeSites: z.array(z.string()).optional(),
  timeout: z.number().default(10000)
})

export type SearchResult = z.infer<typeof SearchResultSchema>
export type SearchOptions = z.infer<typeof SearchOptionsSchema>

// Interfaces para DiscoveryAgent
export interface SearchQuery {
  terms: string[]
  excludeTerms?: string[]
  siteRestriction?: string
  dateRange?: DateRange
  maxResults: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface DateRange {
  start?: Date
  end?: Date
}

export interface APIRotator {
  getOptimalProvider(query: SearchQuery): Promise<string>
}

export interface RateLimiter {
  canMakeRequest(provider: string): boolean
  recordRequest(provider: string): void
}

export interface SearchCache {
  get(query: SearchQuery): Promise<CachedResult | null>
  store(query: SearchQuery, results: SearchResult[]): Promise<void>
}

export interface CachedResult {
  results: SearchResult[]
  timestamp: Date
}

export interface SearchStats {
  totalResults: number
  searchTime: number
  source: string
  query: string
  timestamp: Date
}

export interface IntelligentSearchResult {
  results: SearchResult[]
  stats: SearchStats
  suggestions: string[]
  relatedQueries: string[]
}

export class SearchClient {
  private serperApiKey: string
  private googleApiKey: string
  private googleEngineId: string
  private bingApiKey: string
  
  // Rate limiting
  private lastRequest: { [key: string]: number } = {}
  private requestCounts: { [key: string]: number } = {}
  
  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY || ''
    this.googleApiKey = process.env.GOOGLE_SEARCH_API_KEY || ''
    this.googleEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID || ''
    this.bingApiKey = process.env.BING_SEARCH_API_KEY || ''
  }

  /**
   * Busca usando Serper API
   */
  async searchWithSerper(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
    if (!this.serperApiKey) {
      throw new Error('SERPER_API_KEY não configurada')
    }

    const opts = SearchOptionsSchema.parse(options || {})
    
    try {
      await this.checkRateLimit('serper')
      
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.serperApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: query,
          num: opts.limit,
          gl: opts.country,
          hl: opts.language,
          safe: opts.safeSearch ? 'active' : 'off',
          tbs: this.buildTimeFilter(opts.dateRange)
        }),
        signal: AbortSignal.timeout(opts.timeout)
      })

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`)
      }

      const data = await response.json()
      return this.parseSerperResults(data)
      
    } catch (error) {
      console.error('Erro na busca Serper:', error)
      throw new Error(`Falha na busca Serper: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  /**
   * Busca usando Google Custom Search API
   */
  async searchWithGoogle(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
    if (!this.googleApiKey || !this.googleEngineId) {
      throw new Error('Google Search API não configurada')
    }

    const opts = SearchOptionsSchema.parse(options || {})
    
    try {
      await this.checkRateLimit('google')
      
      const params = new URLSearchParams({
        key: this.googleApiKey,
        cx: this.googleEngineId,
        q: query,
        num: opts.limit.toString(),
        gl: opts.country,
        hl: opts.language,
        safe: opts.safeSearch ? 'active' : 'off'
      })

      if (opts.site) {
        params.set('siteSearch', opts.site)
      }

      const response = await fetch(
        `https://www.googleapis.com/customsearch/v1?${params}`,
        { signal: AbortSignal.timeout(opts.timeout) }
      )

      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`)
      }

      const data = await response.json()
      return this.parseGoogleResults(data)
      
    } catch (error) {
      console.error('Erro na busca Google:', error)
      throw new Error(`Falha na busca Google: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  /**
   * Busca usando Bing Search API
   */
  async searchWithBing(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
    if (!this.bingApiKey) {
      throw new Error('BING_SEARCH_API_KEY não configurada')
    }

    const opts = SearchOptionsSchema.parse(options || {})
    
    try {
      await this.checkRateLimit('bing')
      
      const params = new URLSearchParams({
        q: query,
        count: opts.limit.toString(),
        mkt: `${opts.language}-${opts.country}`,
        safeSearch: opts.safeSearch ? 'Moderate' : 'Off'
      })

      const response = await fetch(
        `https://api.bing.microsoft.com/v7.0/search?${params}`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.bingApiKey
          },
          signal: AbortSignal.timeout(opts.timeout)
        }
      )

      if (!response.ok) {
        throw new Error(`Bing API error: ${response.status}`)
      }

      const data = await response.json()
      return this.parseBingResults(data)
      
    } catch (error) {
      console.error('Erro na busca Bing:', error)
      throw new Error(`Falha na busca Bing: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  /**
   * Sistema de busca inteligente com rotação de APIs
   */
  async intelligentSearch(query: string, options?: Partial<SearchOptions>): Promise<IntelligentSearchResult> {
    const opts = SearchOptionsSchema.parse(options || {})
    const startTime = Date.now()
    
    // Determinar ordem de preferência das APIs
    const apiOrder = this.getApiOrder()
    let results: SearchResult[] = []
    let usedApi = 'none'
    let error: Error | null = null

    // Tentar APIs em ordem de preferência
    for (const api of apiOrder) {
      try {
        switch (api) {
          case 'serper':
            if (this.serperApiKey) {
              results = await this.searchWithSerper(query, opts)
              usedApi = 'serper'
            }
            break
          case 'google':
            if (this.googleApiKey && this.googleEngineId) {
              results = await this.searchWithGoogle(query, opts)
              usedApi = 'google'
            }
            break
          case 'bing':
            if (this.bingApiKey) {
              results = await this.searchWithBing(query, opts)
              usedApi = 'bing'
            }
            break
        }
        
        if (results.length > 0) break
        
      } catch (err) {
        error = err as Error
        console.warn(`Falha na API ${api}:`, err)
        continue
      }
    }

    if (results.length === 0 && error) {
      throw error
    }

    // Filtrar resultados se necessário
    if (opts.excludeSites) {
      results = results.filter(result => 
        !opts.excludeSites!.some(site => result.url.includes(site))
      )
    }

    // Gerar estatísticas
    const stats: SearchStats = {
      totalResults: results.length,
      searchTime: Date.now() - startTime,
      source: usedApi,
      query,
      timestamp: new Date()
    }

    // Gerar sugestões e consultas relacionadas
    const suggestions = this.generateSuggestions(query, results)
    const relatedQueries = this.generateRelatedQueries(query)

    return {
      results,
      stats,
      suggestions,
      relatedQueries
    }
  }

  /**
   * Busca especializada para detecção DMCA
   */
  async dmcaSearch(
    brandName: string, 
    keywords: string[], 
    options?: Partial<SearchOptions>
  ): Promise<IntelligentSearchResult> {
    // Construir query otimizada para DMCA
    const dmcaQueries = [
      `"${brandName}" ${keywords.join(' OR ')}`,
      `${brandName} piracy download`,
      `${brandName} leaked free`,
      `${brandName} torrent magnet`,
      `"${brandName}" unauthorized copy`
    ]

    let allResults: SearchResult[] = []
    let totalTime = 0
    let usedApi = 'multiple'

    // Executar buscas para cada query
    for (const query of dmcaQueries) {
      try {
        const result = await this.intelligentSearch(query, {
          ...options,
          limit: Math.ceil((options?.limit || 10) / dmcaQueries.length)
        })
        
        allResults = [...allResults, ...result.results]
        totalTime += result.stats.searchTime
        
      } catch (error) {
        console.warn(`Erro na query DMCA "${query}":`, error)
      }
    }

    // Remover duplicatas
    const uniqueResults = this.removeDuplicates(allResults)

    return {
      results: uniqueResults.slice(0, options?.limit || 10),
      stats: {
        totalResults: uniqueResults.length,
        searchTime: totalTime,
        source: usedApi,
        query: `DMCA search for: ${brandName}`,
        timestamp: new Date()
      },
      suggestions: this.generateSuggestions(brandName, uniqueResults),
      relatedQueries: dmcaQueries
    }
  }

  /**
   * Verificar rate limiting
   */
  private async checkRateLimit(api: string): Promise<void> {
    const now = Date.now()
    const lastReq = this.lastRequest[api] || 0
    const count = this.requestCounts[api] || 0

    // Reset contador a cada minuto
    if (now - lastReq > 60000) {
      this.requestCounts[api] = 0
    }

    // Limites por API (por minuto)
    const limits = { serper: 100, google: 100, bing: 100 }
    
    if (count >= (limits[api as keyof typeof limits] || 10)) {
      throw new Error(`Rate limit excedido para ${api}`)
    }

    // Delay mínimo entre requests
    const minDelay = 100 // 100ms
    if (now - lastReq < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - (now - lastReq)))
    }

    this.lastRequest[api] = Date.now()
    this.requestCounts[api] = (this.requestCounts[api] || 0) + 1
  }

  /**
   * Determinar ordem de preferência das APIs
   */
  private getApiOrder(): string[] {
    const available = []
    
    if (this.serperApiKey) available.push('serper')
    if (this.googleApiKey && this.googleEngineId) available.push('google')
    if (this.bingApiKey) available.push('bing')

    // Rotacionar baseado no tempo para distribuir carga
    const rotation = Math.floor(Date.now() / 60000) % available.length
    return [...available.slice(rotation), ...available.slice(0, rotation)]
  }

  /**
   * Construir filtro de tempo
   */
  private buildTimeFilter(dateRange: string): string {
    const filters = {
      day: 'qdr:d',
      week: 'qdr:w', 
      month: 'qdr:m',
      year: 'qdr:y',
      all: ''
    }
    return filters[dateRange as keyof typeof filters] || ''
  }

  /**
   * Parse resultados Serper
   */
  private parseSerperResults(data: any): SearchResult[] {
    if (!data.organic) return []
    
    return data.organic.map((item: any, index: number) => ({
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || '',
      displayUrl: item.displayLink || item.link,
      rank: index + 1,
      source: 'serper' as const,
      date: item.date,
      metadata: { sitelinks: item.sitelinks }
    }))
  }

  /**
   * Parse resultados Google
   */
  private parseGoogleResults(data: any): SearchResult[] {
    if (!data.items) return []
    
    return data.items.map((item: any, index: number) => ({
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || '',
      displayUrl: item.displayLink || item.link,
      rank: index + 1,
      source: 'google' as const,
      thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src,
      metadata: { pagemap: item.pagemap }
    }))
  }

  /**
   * Parse resultados Bing
   */
  private parseBingResults(data: any): SearchResult[] {
    if (!data.webPages?.value) return []
    
    return data.webPages.value.map((item: any, index: number) => ({
      title: item.name || '',
      url: item.url || '',
      snippet: item.snippet || '',
      displayUrl: item.displayUrl || item.url,
      rank: index + 1,
      source: 'bing' as const,
      date: item.dateLastCrawled,
      metadata: { deepLinks: item.deepLinks }
    }))
  }

  /**
   * Remover resultados duplicados
   */
  private removeDuplicates(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>()
    return results.filter(result => {
      const key = result.url.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Gerar sugestões baseadas nos resultados
   */
  private generateSuggestions(query: string, results: SearchResult[]): string[] {
    const suggestions = new Set<string>()
    
    // Sugestões baseadas em domínios frequentes
    const domains = results.map(r => new URL(r.url).hostname)
    const uniqueDomains = Array.from(new Set(domains))
    const topDomains = uniqueDomains.slice(0, 3)
    
    topDomains.forEach(domain => {
      suggestions.add(`site:${domain} ${query}`)
    })

    // Sugestões baseadas em palavras-chave dos títulos
    const titleWords = results
      .flatMap(r => r.title.toLowerCase().split(/\s+/))
      .filter(word => word.length > 3 && !query.toLowerCase().includes(word))
    
    const topWords = Array.from(new Set(titleWords)).slice(0, 2)
    topWords.forEach(word => {
      suggestions.add(`${query} ${word}`)
    })

    return Array.from(suggestions)
  }

  /**
   * Gerar consultas relacionadas
   */
  private generateRelatedQueries(query: string): string[] {
    const related = [
      `${query} download`,
      `${query} free`,
      `${query} torrent`,
      `${query} piracy`,
      `${query} leaked`,
      `${query} unauthorized`,
      `${query} copy`,
      `${query} illegal`
    ]

    return related.slice(0, 5)
  }

  /**
   * Obter estatísticas de uso das APIs
   */
  getApiStats(): { [api: string]: { requests: number; lastUsed: number } } {
    return {
      serper: {
        requests: this.requestCounts.serper || 0,
        lastUsed: this.lastRequest.serper || 0
      },
      google: {
        requests: this.requestCounts.google || 0,
        lastUsed: this.lastRequest.google || 0
      },
      bing: {
        requests: this.requestCounts.bing || 0,
        lastUsed: this.lastRequest.bing || 0
      }
    }
  }

  /**
   * Testar conectividade das APIs
   */
  async testApis(): Promise<{ [api: string]: boolean }> {
    const results: { [api: string]: boolean } = {}

    // Testar Serper
    try {
      if (this.serperApiKey) {
        await this.searchWithSerper('test', { limit: 1 })
        results.serper = true
      }
    } catch {
      results.serper = false
    }

    // Testar Google
    try {
      if (this.googleApiKey && this.googleEngineId) {
        await this.searchWithGoogle('test', { limit: 1 })
        results.google = true
      }
    } catch {
      results.google = false
    }

    // Testar Bing
    try {
      if (this.bingApiKey) {
        await this.searchWithBing('test', { limit: 1 })
        results.bing = true
      }
    } catch {
      results.bing = false
    }

    return results
  }

  /**
   * Método principal para DiscoveryAgent - busca com provider específico
   */
  async search(provider: string, query: SearchQuery): Promise<SearchResult[]> {
    // Converter SearchQuery para query string
    const queryString = this.buildQueryString(query)
    
    // Converter para SearchOptions
    const options: Partial<SearchOptions> = {
      limit: query.maxResults,
      site: query.siteRestriction
    }

    switch (provider) {
      case 'serper':
        return this.searchWithSerper(queryString, options)
      case 'google':
        return this.searchWithGoogle(queryString, options)
      case 'bing':
        return this.searchWithBing(queryString, options)
      default:
        throw new Error(`Provider não suportado: ${provider}`)
    }
  }

  /**
   * Busca inteligente com múltiplos provedores
   */
  async intelligentSearchWithQuery(query: SearchQuery): Promise<SearchResult[]> {
    const queryString = this.buildQueryString(query)
    const options: Partial<SearchOptions> = {
      limit: query.maxResults,
      site: query.siteRestriction
    }

    const result = await this.intelligentSearch(queryString, options)
    return result.results
  }

  /**
   * Busca específica em sites suspeitos baseada em padrões
   */
  async targetedSiteSearch(patterns: any[]): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    
    for (const pattern of patterns) {
      try {
        const query: SearchQuery = {
          terms: pattern.commonKeywords || ['leaked'],
          siteRestriction: pattern.platformType,
          maxResults: 20,
          priority: 'MEDIUM'
        }
        
        const patternResults = await this.intelligentSearchWithQuery(query)
        results.push(...patternResults)
        
      } catch (error) {
        console.warn('Erro na busca por padrão:', error)
      }
    }
    
    return this.removeDuplicates(results)
  }

  /**
   * Construir query string a partir de SearchQuery
   */
  private buildQueryString(query: SearchQuery): string {
    let queryString = query.terms.join(' ')
    
    // Adicionar exclusões
    if (query.excludeTerms && query.excludeTerms.length > 0) {
      const exclusions = query.excludeTerms.map(term => `-"${term}"`).join(' ')
      queryString += ` ${exclusions}`
    }
    
    // Adicionar restrição de site
    if (query.siteRestriction) {
      queryString += ` site:${query.siteRestriction}`
    }
    
    return queryString
  }

  /**
   * Gerar queries para descoberta de novos sites
   */
  generateDiscoveryQueries(brandName: string, keywords: string[]): SearchQuery[] {
    const queries: SearchQuery[] = []
    
    // Queries principais
    queries.push({
      terms: [brandName, 'leaked'],
      excludeTerms: ['official', 'store'],
      maxResults: 50,
      priority: 'HIGH'
    })
    
    queries.push({
      terms: [brandName, 'nude'],
      excludeTerms: ['news', 'official'],
      maxResults: 50, 
      priority: 'HIGH'
    })
    
    // Queries com keywords
    for (const keyword of keywords) {
      queries.push({
        terms: [brandName, keyword],
        maxResults: 30,
        priority: 'MEDIUM'
      })
    }
    
    // Queries específicas para plataformas
    const platforms = ['.to', '.cc', 'telegram', 'discord']
    for (const platform of platforms) {
      queries.push({
        terms: [brandName],
        siteRestriction: platform,
        maxResults: 25,
        priority: 'LOW'
      })
    }
    
    return queries
  }
}
