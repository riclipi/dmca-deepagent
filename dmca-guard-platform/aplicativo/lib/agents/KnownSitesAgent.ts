import { PrismaClient, KnownSite, SiteCategory } from '@prisma/client'
import { 
  ScanSession, 
  ViolationResult, 
  ScanOptions, 
  BrandProfile, 
  ProgressUpdate,
  ScanReport,
  AgentEvent
} from './types'
import { SmartScraper } from '../scraping/smart-scraper'
import { ViolationDetector } from '../detection/violation-detector'
import { SessionManager } from './session-manager'
import { z } from 'zod'
import { emitSessionProgress, emitToRoom } from '../socket-server'
import { 
  createSpan, 
  addSpanAttributes, 
  addSpanEvent,
  scanCounter,
  violationCounter,
  scanDurationHistogram 
} from '../monitoring/telemetry'

const prisma = new PrismaClient()

export class KnownSitesAgent {
  private userId: string
  private brandProfile: BrandProfile | null = null
  private session: ScanSession | null = null
  private scraper: SmartScraper
  private detector: ViolationDetector | null = null
  private sessionManager: SessionManager
  private options: ScanOptions

  constructor(userId: string, options?: Partial<ScanOptions>) {
    this.userId = userId
    this.scraper = new SmartScraper()
    this.sessionManager = new SessionManager()
    
    this.options = {
      respectRobots: true,
      maxConcurrency: 3,
      timeout: 30000,
      screenshotViolations: true,
      skipRecentlyScanned: true,
      recentThreshold: 24, // 24 hours
      ...options
    }
  }

  /**
   * Iniciar varredura dos sites conhecidos
   */
  async scanKnownSites(brandProfileId: string): Promise<string> {
    try {
      // Carregar perfil da marca
      this.brandProfile = await this.loadBrandProfile(brandProfileId)
      if (!this.brandProfile) {
        throw new Error('Perfil da marca não encontrado')
      }

      // Inicializar detector com perfil da marca
      this.detector = new ViolationDetector(this.brandProfile)

      // Criar nova sessão de scan
      const sessionId = await this.sessionManager.startScanSession(
        this.userId, 
        brandProfileId
      )

      // Obter lista priorizada de sites
      const prioritizedSites = await this.getPrioritizedSites()
      
      // Inicializar sessão
      this.session = {
        sessionId,
        userId: this.userId,
        brandProfileId,
        totalSites: prioritizedSites.length,
        sitesScanned: 0,
        violationsFound: 0,
        status: 'RUNNING',
        startedAt: new Date(),
        errorCount: 0
      }

      // Atualizar sessão no banco
      await this.sessionManager.updateSession(sessionId, this.session)

      // Emitir evento de início
      await this.emitEvent('session_started', {
        totalSites: prioritizedSites.length,
        brandProfile: this.brandProfile.name
      })

      // Executar scan em background
      this.executeScanInBackground(prioritizedSites, sessionId)

      return sessionId
      
    } catch (error) {
      console.error('Erro ao iniciar scan:', error)
      throw error
    }
  }

  /**
   * Executar scan em background
   */
  private async executeScanInBackground(sites: KnownSite[], sessionId: string) {
    const results: ViolationResult[] = []
    const concurrencyLimit = this.options.maxConcurrency
    let currentIndex = 0

    try {
      // Processar sites em lotes para controlar concorrência
      while (currentIndex < sites.length && this.session?.status === 'RUNNING') {
        const batch = sites.slice(currentIndex, currentIndex + concurrencyLimit)
        
        const batchPromises = batch.map(site => this.scanSiteWithErrorHandling(site))
        const batchResults = await Promise.allSettled(batchPromises)

        // Processar resultados do lote
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i]
          const site = batch[i]

          if (result.status === 'fulfilled' && result.value) {
            results.push(...result.value)
          }

          // Atualizar progresso
          await this.updateProgress({
            sitesScanned: this.session!.sitesScanned + 1,
            violationsFound: results.length,
            currentSite: site.domain
          })
        }

        currentIndex += batch.length
        
        // Delay entre lotes para evitar sobrecarga
        if (currentIndex < sites.length) {
          await this.sleep(1000)
        }
      }

      // Finalizar sessão
      await this.completeSession(results)

    } catch (error) {
      console.error('Erro durante scan:', error)
      await this.handleScanError(error as Error)
    }
  }

  /**
   * Scan de um site com tratamento de erro
   */
  private async scanSiteWithErrorHandling(site: KnownSite): Promise<ViolationResult[]> {
    try {
      await this.emitEvent('site_scanning', { site: site.domain })
      
      const violations = await this.scanSite(site)
      
      // Atualizar estatísticas do site
      await this.updateSiteStats(site, violations.length)
      
      await this.emitEvent('site_completed', { 
        site: site.domain, 
        violations: violations.length 
      })

      return violations

    } catch (error) {
      console.error(`Erro ao escanear ${site.domain}:`, error)
      
      await this.updateProgress({
        sitesScanned: this.session!.sitesScanned,
        violationsFound: this.session!.violationsFound,
        errorCount: this.session!.errorCount + 1,
        lastError: `${site.domain}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      })

      return []
    }
  }

  /**
   * Varredura específica de um site
   */
  private async scanSite(site: KnownSite): Promise<ViolationResult[]> {
    if (!this.detector) {
      throw new Error('Detector não inicializado')
    }

    // Verificar se deve pular site escaneado recentemente
    if (this.options.skipRecentlyScanned && this.isRecentlyScanned(site)) {
      return []
    }

    // Gerar URLs de busca específicas para o site
    const searchUrls = this.generateSearchUrls(site, this.brandProfile!)
    const violations: ViolationResult[] = []

    for (const searchUrl of searchUrls) {
      try {
        // Respeitar crawl delay
        await this.respectCrawlDelay(site)

        // Scraping da página
        const content = await this.scraper.scrapePage(searchUrl, {
          timeout: this.options.timeout,
          respectRobots: this.options.respectRobots,
          userAgent: 'DMCA-Guard/1.0 (+https://dmca-guard.com/bot)',
          maxRetries: 2,
          delay: 1000,
          screenshot: this.options.screenshotViolations,
          followRedirects: true,
          headers: {}
        })

        if (!content) continue

        // Analisar conteúdo em busca de violações
        const violation = await this.detector.analyzeContent(content)
        
        if (violation) {
          violations.push({
            ...violation,
            brandProfileId: this.brandProfile!.id,
            knownSiteId: site.id,
            detectedAt: new Date()
          })

          await this.emitEvent('violation_found', {
            site: site.domain,
            url: violation.url,
            riskLevel: violation.riskLevel
          })

          // Emitir via WebSocket
          emitToRoom('/monitoring', `session:${this.session!.sessionId}`, 'violation-detected', {
            sessionId: this.session!.sessionId,
            violation: {
              url: violation.url,
              violationType: violation.violationType,
              confidence: violation.confidence,
              evidence: violation.evidence,
              site: site.domain
            },
            timestamp: new Date().toISOString()
          })
        }

      } catch (error) {
        console.warn(`Erro ao processar ${searchUrl}:`, error)
        continue
      }
    }

    return violations
  }

  /**
   * Obter sites priorizados para scan
   */
  private async getPrioritizedSites(): Promise<KnownSite[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const sites = await prisma.knownSite.findMany({
      where: {
        userId: this.userId,
        isActive: true
      },
      orderBy: [
        // Prioridade 1: Sites com violações recentes
        { lastViolation: { sort: 'desc', nulls: 'last' } },
        // Prioridade 2: Alto risco
        { riskScore: 'desc' },
        // Prioridade 3: Não verificados há mais tempo
        { lastChecked: { sort: 'asc', nulls: 'first' } },
        // Prioridade 4: Sites com histórico de violações
        { totalViolations: 'desc' }
      ]
    })

    return sites
  }

  /**
   * Gerar URLs de busca específicas para o site
   */
  private generateSearchUrls(site: KnownSite, brandProfile: BrandProfile): string[] {
    const urls: string[] = []
    const baseUrl = site.baseUrl
    
    // URLs baseadas no tipo de site
    switch (site.category) {
      case SiteCategory.SOCIAL_MEDIA:
        // Buscar perfis e posts
        urls.push(`${baseUrl}/search?q=${encodeURIComponent(brandProfile.name)}`)
        brandProfile.variations.forEach(variation => {
          urls.push(`${baseUrl}/search?q=${encodeURIComponent(variation)}`)
        })
        break
        
      case SiteCategory.FORUM:
        // Buscar tópicos e discussões
        urls.push(`${baseUrl}/search?q=${encodeURIComponent(brandProfile.name)}`)
        urls.push(`${baseUrl}/search?search=${encodeURIComponent(brandProfile.name)}`)
        break
        
      case SiteCategory.FILE_SHARING:
        // Buscar arquivos
        brandProfile.keywords.forEach(keyword => {
          urls.push(`${baseUrl}/search?q=${encodeURIComponent(`${brandProfile.name} ${keyword}`)}`)
        })
        break
        
      default:
        // Busca genérica
        urls.push(`${baseUrl}/search?q=${encodeURIComponent(brandProfile.name)}`)
    }

    return urls.slice(0, 5) // Limitar a 5 URLs por site
  }

  /**
   * Verificar se site foi escaneado recentemente
   */
  private isRecentlyScanned(site: KnownSite): boolean {
    if (!site.lastChecked) return false
    
    const threshold = this.options.recentThreshold * 60 * 60 * 1000 // horas em ms
    return (Date.now() - site.lastChecked.getTime()) < threshold
  }

  /**
   * Respeitar crawl delay do site
   */
  private async respectCrawlDelay(site: KnownSite): Promise<void> {
    // Delays específicos por categoria
    const delays = {
      [SiteCategory.SOCIAL_MEDIA]: 2000,
      [SiteCategory.FILE_SHARING]: 3000,
      [SiteCategory.FORUM]: 1500,
      [SiteCategory.MESSAGING]: 2500,
      [SiteCategory.ADULT_CONTENT]: 4000,
      [SiteCategory.UNKNOWN]: 2000
    }

    const delay = delays[site.category] || 2000
    await this.sleep(delay)
  }

  /**
   * Atualizar progresso da sessão
   */
  private async updateProgress(update: Partial<ProgressUpdate>): Promise<void> {
    if (!this.session) return

    // Atualizar sessão local
    Object.assign(this.session, update)
    
    // Calcular estimativa de conclusão
    if (this.session.sitesScanned > 0) {
      const elapsed = Date.now() - this.session.startedAt.getTime()
      const avgTimePerSite = elapsed / this.session.sitesScanned
      const remaining = this.session.totalSites - this.session.sitesScanned
      
      this.session.estimatedCompletion = new Date(
        Date.now() + (remaining * avgTimePerSite)
      )
    }

    // Atualizar no banco
    await this.sessionManager.updateSession(this.session.sessionId, this.session)
    
    // Emitir evento de progresso via WebSocket
    const progress = Math.round((this.session.sitesScanned / this.session.totalSites) * 100)
    emitSessionProgress(
      this.session.sessionId,
      progress,
      update.currentSite || '',
      {
        status: this.session.status,
        sitesScanned: this.session.sitesScanned,
        violationsFound: this.session.violationsFound,
        totalSites: this.session.totalSites,
        estimatedCompletion: this.session.estimatedCompletion
      }
    )
  }

  /**
   * Atualizar estatísticas do site
   */
  private async updateSiteStats(site: KnownSite, violationsFound: number): Promise<void> {
    await prisma.knownSite.update({
      where: { id: site.id },
      data: {
        lastChecked: new Date(),
        totalViolations: { increment: violationsFound },
        ...(violationsFound > 0 && { lastViolation: new Date() })
      }
    })
  }

  /**
   * Carregar perfil da marca
   */
  private async loadBrandProfile(brandProfileId: string): Promise<BrandProfile | null> {
    const profile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        userId: this.userId
      }
    })

    return profile as BrandProfile | null
  }

  /**
   * Finalizar sessão com relatório
   */
  private async completeSession(results: ViolationResult[]): Promise<void> {
    if (!this.session) return

    this.session.status = 'COMPLETED'
    this.session.violationsFound = results.length

    // Salvar violações encontradas
    for (const violation of results) {
      await prisma.violationHistory.create({
        data: {
          url: violation.url,
          title: violation.title,
          description: violation.description,
          riskLevel: violation.riskLevel as any,
          aiConfidence: violation.confidence,
          detectionMethod: violation.detectionMethod as any,
          knownSiteId: violation.knownSiteId
        }
      })
    }

    // Gerar relatório
    const report = await this.generateScanReport(results)
    
    // Finalizar sessão
    await this.sessionManager.completeSession(this.session.sessionId, report)
    
    await this.emitEvent('session_completed', {
      totalViolations: results.length,
      duration: Date.now() - this.session.startedAt.getTime()
    })
  }

  /**
   * Gerar relatório de scan
   */
  private async generateScanReport(results: ViolationResult[]): Promise<ScanReport> {
    if (!this.session) throw new Error('Sessão não encontrada')

    const duration = Date.now() - this.session.startedAt.getTime()
    
    return {
      sessionId: this.session.sessionId,
      totalSites: this.session.totalSites,
      sitesScanned: this.session.sitesScanned,
      violationsFound: results.length,
      errorCount: this.session.errorCount,
      duration,
      averageTimePerSite: this.session.sitesScanned > 0 ? duration / this.session.sitesScanned : 0,
      violationsByRisk: this.groupViolationsByRisk(results),
      topViolationSites: await this.getTopViolationSites(results),
      errors: [] // TODO: implementar coleta de erros
    }
  }

  /**
   * Agrupar violações por nível de risco
   */
  private groupViolationsByRisk(results: ViolationResult[]): Record<string, number> {
    return results.reduce((acc, violation) => {
      acc[violation.riskLevel] = (acc[violation.riskLevel] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Obter sites com mais violações
   */
  private async getTopViolationSites(results: ViolationResult[]): Promise<Array<{
    domain: string
    violations: number
    highestRisk: string
  }>> {
    const siteViolations = new Map<string, { count: number; risks: string[] }>()

    for (const violation of results) {
      const site = await prisma.knownSite.findUnique({
        where: { id: violation.knownSiteId },
        select: { domain: true }
      })

      if (site) {
        const current = siteViolations.get(site.domain) || { count: 0, risks: [] }
        current.count++
        current.risks.push(violation.riskLevel)
        siteViolations.set(site.domain, current)
      }
    }

    const riskPriority = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 }

    return Array.from(siteViolations.entries())
      .map(([domain, data]) => ({
        domain,
        violations: data.count,
        highestRisk: data.risks.reduce((highest, current) => 
          riskPriority[current as keyof typeof riskPriority] > riskPriority[highest as keyof typeof riskPriority] 
            ? current : highest
        )
      }))
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 10)
  }

  /**
   * Tratar erro de scan
   */
  private async handleScanError(error: Error): Promise<void> {
    if (!this.session) return

    this.session.status = 'ERROR'
    this.session.lastError = error.message

    await this.sessionManager.updateSession(this.session.sessionId, this.session)
    
    await this.emitEvent('session_error', {
      error: error.message,
      stack: error.stack
    })
  }

  /**
   * Emitir evento do agente
   */
  private async emitEvent(type: string, data: Record<string, any>): Promise<void> {
    if (!this.session) return

    const event: AgentEvent = {
      type: type as any,
      sessionId: this.session.sessionId,
      timestamp: new Date(),
      data
    }

    await this.sessionManager.emitEvent(event)
  }

  /**
   * Pausar sessão
   */
  async pauseSession(): Promise<void> {
    if (!this.session) return

    this.session.status = 'PAUSED'
    await this.sessionManager.updateSession(this.session.sessionId, this.session)
    await this.emitEvent('session_paused', {})
  }

  /**
   * Retomar sessão
   */
  async resumeSession(): Promise<void> {
    if (!this.session) return

    this.session.status = 'RUNNING'
    await this.sessionManager.updateSession(this.session.sessionId, this.session)
    await this.emitEvent('session_resumed', {})
  }

  /**
   * Obter status da sessão
   */
  async getSessionStatus(sessionId: string): Promise<ScanSession | null> {
    return await this.sessionManager.getSession(sessionId)
  }

  /**
   * Utility: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}