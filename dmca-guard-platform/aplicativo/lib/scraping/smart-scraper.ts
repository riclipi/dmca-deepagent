import { KnownSite } from '@prisma/client'
import { PageContent, ScrapingOptions, RobotsInfo, CacheEntry } from '../agents/types'
import * as cheerio from 'cheerio'
import { z } from 'zod'
import { getAgentCache } from '../cache/agent-cache-manager'

export class SmartScraper {
  private agentCache = getAgentCache()
  private userAgent: string
  private respectRobots: boolean
  private maxConcurrency: number
  private activeRequests = new Set<string>()

  constructor(options: {
    userAgent?: string
    respectRobots?: boolean
    maxConcurrency?: number
  } = {}) {
    this.userAgent = options.userAgent || 'DMCA-Guard/1.0 (+https://dmca-guard.com/bot)'
    this.respectRobots = options.respectRobots !== false
    this.maxConcurrency = options.maxConcurrency || 3
  }

  /**
   * Scraping principal de página
   */
  async scrapePage(url: string, options: ScrapingOptions): Promise<PageContent | null> {
    const startTime = Date.now()
    
    try {
      // Verificar cache primeiro
      const cached = await this.agentCache.getPageContent(url)
      if (cached) {
        console.log(`[Cache] Hit for URL: ${url}`)
        return JSON.parse(cached) as PageContent
      }

      // Verificar robots.txt se necessário
      if (this.respectRobots && options.respectRobots) {
        const allowed = await this.checkRobotsPermission(url, options.userAgent || this.userAgent)
        if (!allowed) {
          console.warn(`Robots.txt proíbe acesso a ${url}`)
          return null
        }
      }

      // Controlar concorrência
      while (this.activeRequests.size >= this.maxConcurrency) {
        await this.sleep(100)
      }

      this.activeRequests.add(url)

      try {
        // Fazer requisição HTTP
        const response = await this.makeRequest(url, options)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const html = await response.text()
        const responseTime = Date.now() - startTime

        // Parse do HTML
        const content = this.parseHtmlContent(url, html, responseTime)

        // Cache do conteúdo
        await this.agentCache.setPageContent(url, JSON.stringify(content), [`domain:${new URL(url).hostname}`])

        return content

      } finally {
        this.activeRequests.delete(url)
      }

    } catch (error) {
      console.error(`Erro ao scraping ${url}:`, error)
      
      // Verificar se é bloqueio e tentar adaptação
      if (this.isBlockedResponse(error)) {
        await this.handleBlockedRequest(url)
      }

      return null
    }
  }

  /**
   * Verificar permissão no robots.txt
   */
  async checkRobotsPermission(url: string, userAgent: string = this.userAgent): Promise<boolean> {
    try {
      const urlObj = new URL(url)
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`
      const domain = urlObj.host

      // Verificar cache persistente primeiro
      const cachedRobots = await this.agentCache.getRobotsTxt(domain)
      if (cachedRobots) {
        const robotsInfo = this.parseRobotsTxt(cachedRobots, userAgent, urlObj.pathname)
        return robotsInfo.allowed
      }

      // Buscar robots.txt
      const robotsContent = await this.fetchRobotsTxt(robotsUrl)
      
      // Armazenar no cache persistente
      if (robotsContent) {
        await this.agentCache.setRobotsTxt(domain, robotsContent)
      }
      
      const robotsInfo = this.parseRobotsTxt(robotsContent, userAgent, urlObj.pathname)
      return robotsInfo.allowed

    } catch (error) {
      console.warn(`Erro ao verificar robots.txt para ${url}:`, error)
      // Em caso de erro, assumir que é permitido
      return true
    }
  }

  /**
   * Buscar conteúdo do robots.txt
   */
  private async fetchRobotsTxt(robotsUrl: string): Promise<string> {
    try {
      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.userAgent },
        signal: AbortSignal.timeout(5000)
      })

      if (response.ok) {
        return await response.text()
      } else {
        return ''
      }
    } catch (error) {
      console.warn(`Erro ao buscar ${robotsUrl}:`, error)
      return ''
    }
  }

  /**
   * Parse do robots.txt
   */
  private parseRobotsTxt(content: string, userAgent: string, path: string): RobotsInfo {
    const lines = content.split('\n').map(line => line.trim())
    let isRelevantSection = false
    let allowed = true
    let crawlDelay = 1000 // 1 segundo padrão
    let sitemap: string | undefined

    for (const line of lines) {
      if (line === '' || line.startsWith('#')) continue

      if (line.toLowerCase().startsWith('user-agent:')) {
        const agent = line.substring(11).trim()
        isRelevantSection = agent === '*' || 
                           userAgent.toLowerCase().includes(agent.toLowerCase()) ||
                           agent.toLowerCase().includes('dmca') ||
                           agent.toLowerCase().includes('guard')
        continue
      }

      if (!isRelevantSection) continue

      if (line.toLowerCase().startsWith('disallow:')) {
        const disallowPath = line.substring(9).trim()
        if (disallowPath === '/' || path.startsWith(disallowPath)) {
          allowed = false
        }
      } else if (line.toLowerCase().startsWith('allow:')) {
        const allowPath = line.substring(6).trim()
        if (path.startsWith(allowPath)) {
          allowed = true
        }
      } else if (line.toLowerCase().startsWith('crawl-delay:')) {
        const delay = parseInt(line.substring(12).trim())
        if (!isNaN(delay)) {
          crawlDelay = delay * 1000 // converter para ms
        }
      } else if (line.toLowerCase().startsWith('sitemap:')) {
        sitemap = line.substring(8).trim()
      }
    }

    return {
      allowed,
      crawlDelay,
      sitemap,
      userAgent,
      lastChecked: new Date()
    }
  }

  /**
   * Fazer requisição HTTP
   */
  private async makeRequest(url: string, options: ScrapingOptions): Promise<Response> {
    const headers = {
      'User-Agent': options.userAgent || this.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      ...options.headers
    }

    let attempt = 0
    const maxRetries = options.maxRetries || 3

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), options.timeout)

        const response = await fetch(url, {
          headers,
          signal: controller.signal,
          redirect: options.followRedirects ? 'follow' : 'manual'
        })

        clearTimeout(timeoutId)
        return response

      } catch (error) {
        attempt++
        if (attempt > maxRetries) throw error

        // Delay exponencial entre tentativas
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await this.sleep(delay)
      }
    }

    throw new Error('Máximo de tentativas excedido')
  }

  /**
   * Parse do conteúdo HTML
   */
  private parseHtmlContent(url: string, html: string, responseTime: number): PageContent {
    const $ = cheerio.load(html)

    // Extrair título
    const title = $('title').text().trim() || 
                  $('meta[property="og:title"]').attr('content') || 
                  $('h1').first().text().trim() || ''

    // Extrair descrição
    const description = $('meta[name="description"]').attr('content') || 
                       $('meta[property="og:description"]').attr('content') || 
                       $('meta[name="twitter:description"]').attr('content') || ''

    // Extrair texto do body
    $('script, style, nav, header, footer, aside').remove()
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()

    // Extrair imagens
    const images: string[] = []
    $('img').each((_, element) => {
      const src = $(element).attr('src')
      if (src) {
        const absoluteUrl = this.resolveUrl(url, src)
        images.push(absoluteUrl)
      }
    })

    // Extrair links
    const links: string[] = []
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href')
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        const absoluteUrl = this.resolveUrl(url, href)
        links.push(absoluteUrl)
      }
    })

    // Extrair metadados
    const metadata: Record<string, any> = {}
    
    // Open Graph
    $('meta[property^="og:"]').each((_, element) => {
      const property = $(element).attr('property')
      const content = $(element).attr('content')
      if (property && content) {
        metadata[property] = content
      }
    })

    // Twitter Cards
    $('meta[name^="twitter:"]').each((_, element) => {
      const name = $(element).attr('name')
      const content = $(element).attr('content')
      if (name && content) {
        metadata[name] = content
      }
    })

    // Schema.org
    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const json = JSON.parse($(element).html() || '{}')
        metadata.schema = json
      } catch (error) {
        // Ignorar JSON inválido
      }
    })

    return {
      url,
      title,
      description,
      bodyText,
      images: images.slice(0, 20), // Limitar a 20 imagens
      links: links.slice(0, 50),   // Limitar a 50 links
      metadata,
      scrapedAt: new Date(),
      size: html.length,
      responseTime
    }
  }

  /**
   * Resolver URL relativa para absoluta
   */
  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    try {
      return new URL(relativeUrl, baseUrl).href
    } catch (error) {
      return relativeUrl
    }
  }

  /**
   * Verificar se resposta indica bloqueio
   */
  private isBlockedResponse(error: any): boolean {
    if (error.name === 'AbortError') return false
    
    const message = error.message?.toLowerCase() || ''
    const blockedIndicators = [
      'blocked',
      'captcha',
      'rate limit',
      'too many requests',
      'access denied',
      'forbidden'
    ]

    return blockedIndicators.some(indicator => message.includes(indicator))
  }

  /**
   * Lidar com requisições bloqueadas
   */
  async handleBlockedRequest(url: string): Promise<void> {
    const domain = new URL(url).hostname
    
    console.warn(`Detectado bloqueio para ${domain}`)
    
    // Implementar estratégias de contorno:
    // 1. Aumentar delay para este domínio
    // 2. Trocar User-Agent
    // 3. Marcar domínio como problemático
    
    // Por enquanto, apenas aguardar mais tempo
    await this.sleep(5000)
  }

  /**
   * Cache de conteúdo
   */
  async cacheContent(url: string, content: PageContent): Promise<void> {
    const ttl = 60 * 60 * 1000 // 1 hora
    
    const entry: CacheEntry = {
      key: url,
      data: content,
      timestamp: new Date(),
      ttl,
      hits: 0
    }

    this.contentCache.set(url, entry)

    // Limpeza automática do cache (manter apenas últimas 1000 entradas)
    if (this.contentCache.size > 1000) {
      const oldestKey = Array.from(this.contentCache.keys())[0]
      this.contentCache.delete(oldestKey)
    }
  }

  /**
   * Obter conteúdo do cache
   */
  async getCachedContent(url: string): Promise<PageContent | null> {
    const entry = this.contentCache.get(url)
    
    if (!entry) return null

    // Verificar se expirou
    if (Date.now() - entry.timestamp.getTime() > entry.ttl) {
      this.contentCache.delete(url)
      return null
    }

    // Incrementar contador de hits
    entry.hits++
    
    return entry.data as PageContent
  }

  /**
   * Obter estatísticas do scraper
   */
  getStats(): {
    robotsCacheSize: number
    contentCacheSize: number
    activeRequests: number
    totalCacheHits: number
  } {
    const totalHits = Array.from(this.contentCache.values())
      .reduce((total, entry) => total + entry.hits, 0)

    return {
      robotsCacheSize: this.robotsCache.size,
      contentCacheSize: this.contentCache.size,
      activeRequests: this.activeRequests.size,
      totalCacheHits: totalHits
    }
  }

  /**
   * Limpar caches
   */
  clearCaches(): void {
    this.robotsCache.clear()
    this.contentCache.clear()
  }

  /**
   * Utility: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}