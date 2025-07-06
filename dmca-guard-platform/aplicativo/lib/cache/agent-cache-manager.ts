import { CacheManager } from './cache-manager'

interface AgentCacheOptions {
  memoryLimit?: number
  dbEnabled?: boolean
}

export class AgentCacheManager {
  private cacheManager: CacheManager
  
  constructor(options: AgentCacheOptions = {}) {
    this.cacheManager = CacheManager.getInstance({
      memoryLimit: options.memoryLimit || 50, // 50MB para agentes
      dbCacheEnabled: options.dbEnabled !== false,
      warmupEnabled: process.env.NODE_ENV === 'production' && !process.env.NEXT_PHASE
    })
  }

  /**
   * Cache de conteúdo de página
   */
  async getPageContent(url: string): Promise<string | null> {
    const key = CacheManager.createKey('agent', 'content', this.hashUrl(url))
    return await this.cacheManager.get(key, 'content')
  }

  async setPageContent(url: string, content: string, tags: string[] = []): Promise<void> {
    const key = CacheManager.createKey('agent', 'content', this.hashUrl(url))
    await this.cacheManager.set(key, content, 'content', [...tags, 'page-content'])
  }

  /**
   * Cache de robots.txt
   */
  async getRobotsTxt(domain: string): Promise<string | null> {
    const key = CacheManager.createKey('agent', 'robots', domain)
    return await this.cacheManager.get(key, 'robots')
  }

  async setRobotsTxt(domain: string, content: string): Promise<void> {
    const key = CacheManager.createKey('agent', 'robots', domain)
    await this.cacheManager.set(key, content, 'robots', ['robots-txt'])
  }

  /**
   * Cache de metadata de sites
   */
  async getSiteMetadata(domain: string): Promise<any | null> {
    const key = CacheManager.createKey('agent', 'metadata', domain)
    return await this.cacheManager.get(key, 'metadata')
  }

  async setSiteMetadata(domain: string, metadata: any): Promise<void> {
    const key = CacheManager.createKey('agent', 'metadata', domain)
    await this.cacheManager.set(key, metadata, 'metadata', ['site-metadata'])
  }

  /**
   * Cache de screenshots
   */
  async getScreenshot(url: string): Promise<string | null> {
    const key = CacheManager.createKey('agent', 'screenshot', this.hashUrl(url))
    const cached = await this.cacheManager.get(key, 'screenshot')
    
    // Screenshots grandes podem estar apenas no banco
    if (!cached || (cached.length < 100 && cached.includes('db-ref:'))) {
      return await this.getScreenshotFromDatabase(cached)
    }
    
    return cached
  }

  async setScreenshot(url: string, screenshot: string, violation?: boolean): Promise<void> {
    const key = CacheManager.createKey('agent', 'screenshot', this.hashUrl(url))
    const tags = ['screenshot']
    
    if (violation) {
      tags.push('violation-screenshot')
    }
    
    // Se screenshot for muito grande (>500KB), armazenar apenas referência na memória
    if (screenshot.length > 500 * 1024) {
      await this.storeScreenshotInDatabase(key, screenshot)
      await this.cacheManager.set(key, `db-ref:${key}`, 'screenshot', tags)
    } else {
      await this.cacheManager.set(key, screenshot, 'screenshot', tags)
    }
  }

  /**
   * Cache de resultados de análise
   */
  async getAnalysisResult(contentHash: string): Promise<any | null> {
    const key = CacheManager.createKey('agent', 'analysis', contentHash)
    return await this.cacheManager.get(key, 'metadata')
  }

  async setAnalysisResult(contentHash: string, result: any): Promise<void> {
    const key = CacheManager.createKey('agent', 'analysis', contentHash)
    await this.cacheManager.set(
      key, 
      result, 
      'metadata', 
      ['analysis-result'],
      30 * 60 * 1000 // 30 minutos TTL para resultados de análise
    )
  }

  /**
   * Invalidar cache por sessão
   */
  async invalidateSession(sessionId: string): Promise<void> {
    await this.cacheManager.invalidateByTag(`session:${sessionId}`)
  }

  /**
   * Invalidar cache por domínio
   */
  async invalidateDomain(domain: string): Promise<void> {
    await this.cacheManager.invalidateByTag(`domain:${domain}`)
  }

  /**
   * Obter estatísticas do cache
   */
  getStats() {
    return this.cacheManager.getStats()
  }

  /**
   * Criar hash de URL para chave de cache
   */
  private hashUrl(url: string): string {
    // Simples hash para URLs
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Armazenar screenshot grande no banco
   */
  private async storeScreenshotInDatabase(key: string, screenshot: string): Promise<void> {
    // Implementação específica para screenshots grandes
    // Poderia usar uma tabela separada ou blob storage
    console.log(`[Cache] Storing large screenshot in database: ${key}`)
  }

  /**
   * Recuperar screenshot do banco
   */
  private async getScreenshotFromDatabase(reference: string): Promise<string | null> {
    // Implementação específica para recuperar screenshots grandes
    console.log(`[Cache] Retrieving screenshot from database: ${reference}`)
    return null
  }
}

// Singleton para uso global
let agentCacheInstance: AgentCacheManager | null = null

export function getAgentCache(): AgentCacheManager {
  if (!agentCacheInstance) {
    agentCacheInstance = new AgentCacheManager()
  }
  return agentCacheInstance
}