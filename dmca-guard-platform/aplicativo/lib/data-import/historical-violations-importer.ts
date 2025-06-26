import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import csv from 'csv-parser'
import { z } from 'zod'

const prisma = new PrismaClient()

export interface ViolationData {
  url: string
  domain: string
  title?: string
  description?: string
  platform?: string
  category: string
  dateDetected: Date
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  keywords: string[]
  takedownDate?: Date
  isResolved: boolean
}

export interface ImportResult {
  totalImported: number
  totalSkipped: number
  totalErrors: number
  patternsExtracted: PatternAnalysis
  platformsIdentified: PlatformAnalysis
  duplicatesFound: number
  processingTime: number
}

export interface PatternAnalysis {
  commonDomainPatterns: Array<{
    pattern: string
    frequency: number
    examples: string[]
  }>
  pathStructures: Array<{
    structure: string
    frequency: number
    riskLevel: string
  }>
  keywordFrequency: Record<string, number>
  platformDistribution: Record<string, number>
  temporalPatterns: Array<{
    period: string
    count: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }>
}

export interface PlatformAnalysis {
  identifiedPlatforms: Array<{
    name: string
    count: number
    commonTlds: string[]
    riskScore: number
    examples: string[]
  }>
  platformCategories: Record<string, number>
  suspiciousDomains: string[]
}

// Schema para validação de dados de entrada
const ViolationDataSchema = z.object({
  url: z.string().url('URL inválida'),
  domain: z.string().min(1, 'Domínio é obrigatório'),
  title: z.string().optional(),
  description: z.string().optional(),
  platform: z.string().optional(),
  category: z.enum(['FORUM', 'SOCIAL_MEDIA', 'FILE_SHARING', 'ADULT_CONTENT', 'MESSAGING', 'UNKNOWN']),
  dateDetected: z.date(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  keywords: z.array(z.string()),
  takedownDate: z.date().optional(),
  isResolved: z.boolean().default(false)
})

export class HistoricalViolationsImporter {
  private importedCount = 0
  private skippedCount = 0
  private errorCount = 0
  private startTime = Date.now()

  /**
   * Importar e processar lista de 17k URLs derrubados
   */
  async importHistoricalData(filePath: string, options: {
    batchSize?: number
    validateUrls?: boolean
    extractPatterns?: boolean
    userId?: string
  } = {}): Promise<ImportResult> {
    console.log(`Iniciando importação de dados históricos: ${filePath}`)
    
    const {
      batchSize = 100,
      validateUrls = true,
      extractPatterns = true,
      userId = 'system'
    } = options

    this.resetCounters()

    try {
      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`)
      }

      // Detectar formato do arquivo
      const fileExtension = path.extname(filePath).toLowerCase()
      let violations: ViolationData[]

      switch (fileExtension) {
        case '.csv':
          violations = await this.parseCsvFile(filePath)
          break
        case '.json':
          violations = await this.parseJsonFile(filePath)
          break
        case '.txt':
          violations = await this.parseTextFile(filePath)
          break
        default:
          throw new Error(`Formato de arquivo não suportado: ${fileExtension}`)
      }

      console.log(`${violations.length} registros carregados do arquivo`)

      // Validar dados se solicitado
      if (validateUrls) {
        violations = await this.validateViolations(violations)
      }

      // Processar em lotes
      const processed = await this.processViolationsBatch(violations, batchSize, userId)

      // Armazenar no banco de dados
      await this.storeInDatabase(processed, userId)

      // Extrair padrões se solicitado
      const patternsExtracted = extractPatterns ? 
        await this.extractPatterns(processed) : 
        this.getEmptyPatternAnalysis()

      // Identificar plataformas
      const platformsIdentified = await this.identifyPlatforms(processed)

      const result: ImportResult = {
        totalImported: this.importedCount,
        totalSkipped: this.skippedCount,
        totalErrors: this.errorCount,
        patternsExtracted,
        platformsIdentified,
        duplicatesFound: await this.countDuplicates(processed),
        processingTime: Date.now() - this.startTime
      }

      console.log('Importação concluída:', result)
      return result

    } catch (error) {
      console.error('Erro durante importação:', error)
      throw error
    }
  }

  /**
   * Parse arquivo CSV
   */
  private async parseCsvFile(filePath: string): Promise<ViolationData[]> {
    return new Promise((resolve, reject) => {
      const violations: ViolationData[] = []
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const violation = this.mapCsvRowToViolation(row)
            if (violation) {
              violations.push(violation)
            }
          } catch (error) {
            console.warn('Erro ao processar linha CSV:', error)
            this.errorCount++
          }
        })
        .on('end', () => {
          console.log(`${violations.length} registros processados do CSV`)
          resolve(violations)
        })
        .on('error', reject)
    })
  }

  /**
   * Parse arquivo JSON
   */
  private async parseJsonFile(filePath: string): Promise<ViolationData[]> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(fileContent)
      
      // Assumir que é um array de objetos ou um objeto com array
      const rawViolations = Array.isArray(data) ? data : data.violations || data.data || []
      
      return rawViolations.map((item: any) => this.mapJsonToViolation(item)).filter(Boolean)
    } catch (error) {
      console.error('Erro ao processar arquivo JSON:', error)
      throw error
    }
  }

  /**
   * Parse arquivo de texto (URLs simples)
   */
  private async parseTextFile(filePath: string): Promise<ViolationData[]> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      const urls = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))

      return urls.map(url => this.createViolationFromUrl(url)).filter((v): v is ViolationData => v !== null)
    } catch (error) {
      console.error('Erro ao processar arquivo de texto:', error)
      throw error
    }
  }

  /**
   * Mapear linha CSV para ViolationData
   */
  private mapCsvRowToViolation(row: any): ViolationData | null {
    try {
      const url = row.url || row.URL || row.link
      if (!url) return null

      return {
        url,
        domain: this.extractDomain(url),
        title: row.title || row.Title,
        description: row.description || row.Description,
        platform: row.platform || row.Platform,
        category: this.categorizeUrl(url),
        dateDetected: this.parseDate(row.dateDetected || row.date_detected || row.date),
        riskLevel: this.determineRiskLevel(url, row),
        keywords: this.extractKeywords(row.keywords || row.title || ''),
        takedownDate: this.parseDate(row.takedownDate || row.takedown_date),
        isResolved: this.parseBoolean(row.isResolved || row.is_resolved)
      }
    } catch (error) {
      console.warn('Erro ao mapear linha CSV:', error)
      return null
    }
  }

  /**
   * Mapear JSON para ViolationData
   */
  private mapJsonToViolation(item: any): ViolationData | null {
    try {
      if (!item.url) return null

      return {
        url: item.url,
        domain: item.domain || this.extractDomain(item.url),
        title: item.title,
        description: item.description,
        platform: item.platform,
        category: item.category || this.categorizeUrl(item.url),
        dateDetected: new Date(item.dateDetected || item.date_detected || Date.now()),
        riskLevel: item.riskLevel || this.determineRiskLevel(item.url, item),
        keywords: Array.isArray(item.keywords) ? item.keywords : this.extractKeywords(item.keywords || ''),
        takedownDate: item.takedownDate ? new Date(item.takedownDate) : undefined,
        isResolved: Boolean(item.isResolved)
      }
    } catch (error) {
      console.warn('Erro ao mapear JSON:', error)
      return null
    }
  }

  /**
   * Criar ViolationData a partir de URL simples
   */
  private createViolationFromUrl(url: string): ViolationData | null {
    try {
      if (!this.isValidUrl(url)) return null

      return {
        url,
        domain: this.extractDomain(url),
        category: this.categorizeUrl(url),
        dateDetected: new Date(),
        riskLevel: this.determineRiskLevel(url, {}),
        keywords: this.extractKeywordsFromUrl(url),
        isResolved: false
      }
    } catch (error) {
      console.warn('Erro ao criar violação de URL:', error)
      return null
    }
  }

  /**
   * Validar violações
   */
  private async validateViolations(violations: ViolationData[]): Promise<ViolationData[]> {
    const validated: ViolationData[] = []

    for (const violation of violations) {
      try {
        ViolationDataSchema.parse(violation)
        validated.push(violation)
      } catch (error) {
        console.warn('Violação inválida ignorada:', error)
        this.skippedCount++
      }
    }

    return validated
  }

  /**
   * Processar violações em lotes
   */
  private async processViolationsBatch(
    violations: ViolationData[], 
    batchSize: number,
    userId: string
  ): Promise<ViolationData[]> {
    const processed: ViolationData[] = []
    
    for (let i = 0; i < violations.length; i += batchSize) {
      const batch = violations.slice(i, i + batchSize)
      
      for (const violation of batch) {
        try {
          // Enriquecer dados
          const enriched = await this.enrichViolationData(violation)
          processed.push(enriched)
          this.importedCount++
          
          if (this.importedCount % 1000 === 0) {
            console.log(`Processados ${this.importedCount} registros...`)
          }
        } catch (error) {
          console.warn('Erro ao processar violação:', error)
          this.errorCount++
        }
      }

      // Pequena pausa entre lotes para não sobrecarregar
      await this.sleep(100)
    }

    return processed
  }

  /**
   * Enriquecer dados da violação
   */
  private async enrichViolationData(violation: ViolationData): Promise<ViolationData> {
    // Melhorar categorização
    const betterCategory = await this.improveCategorizationWithAI(violation.url)
    if (betterCategory) {
      violation.category = betterCategory
    }

    // Extrair mais keywords
    const additionalKeywords = this.extractAdvancedKeywords(violation.url, violation.title, violation.description)
    violation.keywords = [...new Set([...violation.keywords, ...additionalKeywords])]

    // Melhorar level de risco
    violation.riskLevel = this.calculateAdvancedRiskLevel(violation)

    return violation
  }

  /**
   * Armazenar no banco de dados
   */
  private async storeInDatabase(violations: ViolationData[], userId: string): Promise<void> {
    console.log(`Armazenando ${violations.length} violações no banco...`)

    // Primeiro, criar ou encontrar sites conhecidos
    const siteMap = new Map<string, string>() // domain -> siteId

    for (const violation of violations) {
      if (!siteMap.has(violation.domain)) {
        try {
          const site = await prisma.knownSite.upsert({
            where: { 
              baseUrl: violation.url // Usar URL como chave única
            },
            update: {
              totalViolations: { increment: 1 },
              lastViolation: violation.dateDetected
            },
            create: {
              baseUrl: violation.url,
              domain: violation.domain,
              category: violation.category as any,
              platform: violation.platform,
              riskScore: this.riskLevelToScore(violation.riskLevel),
              totalViolations: 1,
              lastViolation: violation.dateDetected,
              userId: userId,
              isActive: true
            }
          })
          
          siteMap.set(violation.domain, site.id)
        } catch (error) {
          console.warn(`Erro ao criar site ${violation.domain}:`, error)
        }
      }
    }

    // Agora criar registros de violação
    const violationPromises = violations.map(async (violation) => {
      const siteId = siteMap.get(violation.domain)
      if (!siteId) return

      try {
        await prisma.violationHistory.create({
          data: {
            knownSiteId: siteId,
            url: violation.url,
            title: violation.title,
            description: violation.description,
            detectionMethod: 'MANUAL_REVIEW',
            riskLevel: violation.riskLevel as any,
            aiConfidence: 0.8, // Confiança padrão para dados históricos
            takedownSent: violation.isResolved,
            takedownDate: violation.takedownDate,
            resolved: violation.isResolved,
            resolvedDate: violation.isResolved ? violation.takedownDate : undefined,
            detectedAt: violation.dateDetected
          }
        })
      } catch (error) {
        console.warn(`Erro ao criar violação ${violation.url}:`, error)
        this.errorCount++
      }
    })

    await Promise.all(violationPromises)
    console.log('Dados armazenados no banco com sucesso')
  }

  /**
   * Análise automática de padrões dos dados históricos
   */
  private async extractPatterns(violations: ViolationData[]): Promise<PatternAnalysis> {
    console.log('Extraindo padrões dos dados históricos...')

    // Analisar padrões de domínio
    const domainPatterns = this.analyzeDomainPatterns(violations)
    
    // Analisar estruturas de path
    const pathStructures = this.analyzePathStructures(violations)
    
    // Analisar frequência de keywords
    const keywordFrequency = this.analyzeKeywordFrequency(violations)
    
    // Analisar distribuição de plataformas
    const platformDistribution = this.analyzePlatformDistribution(violations)
    
    // Analisar padrões temporais
    const temporalPatterns = this.analyzeTemporalPatterns(violations)

    return {
      commonDomainPatterns: domainPatterns,
      pathStructures,
      keywordFrequency,
      platformDistribution,
      temporalPatterns
    }
  }

  /**
   * Identificar e analisar plataformas
   */
  private async identifyPlatforms(violations: ViolationData[]): Promise<PlatformAnalysis> {
    console.log('Identificando plataformas...')

    const platformCounts = new Map<string, number>()
    const platformTlds = new Map<string, Set<string>>()
    const platformExamples = new Map<string, string[]>()
    const suspiciousDomains = new Set<string>()

    for (const violation of violations) {
      const platform = violation.platform || this.identifyPlatformFromUrl(violation.url)
      const tld = this.extractTld(violation.domain)

      // Contar plataformas
      platformCounts.set(platform, (platformCounts.get(platform) || 0) + 1)

      // Coletar TLDs por plataforma
      if (!platformTlds.has(platform)) {
        platformTlds.set(platform, new Set())
      }
      platformTlds.get(platform)!.add(tld)

      // Coletar exemplos
      if (!platformExamples.has(platform)) {
        platformExamples.set(platform, [])
      }
      if (platformExamples.get(platform)!.length < 5) {
        platformExamples.get(platform)!.push(violation.url)
      }

      // Identificar domínios suspeitos
      if (this.isDomainSuspicious(violation.domain)) {
        suspiciousDomains.add(violation.domain)
      }
    }

    const identifiedPlatforms = Array.from(platformCounts.entries()).map(([name, count]) => ({
      name,
      count,
      commonTlds: Array.from(platformTlds.get(name) || []),
      riskScore: this.calculatePlatformRiskScore(name, violations),
      examples: platformExamples.get(name) || []
    }))

    const platformCategories = this.categorizePlatforms(identifiedPlatforms)

    return {
      identifiedPlatforms,
      platformCategories,
      suspiciousDomains: Array.from(suspiciousDomains)
    }
  }

  // Métodos utilitários
  private resetCounters(): void {
    this.importedCount = 0
    this.skippedCount = 0
    this.errorCount = 0
    this.startTime = Date.now()
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url)
      return urlObj.hostname.replace(/^www\./, '')
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
  }

  private categorizeUrl(url: string): ViolationData['category'] {
    const urlLower = url.toLowerCase()
    const domain = this.extractDomain(url).toLowerCase()

    if (domain.includes('forum') || urlLower.includes('/forum/')) return 'FORUM'
    if (domain.includes('telegram') || domain.includes('discord')) return 'MESSAGING'
    if (domain.includes('mega') || urlLower.includes('download')) return 'FILE_SHARING'
    if (domain.includes('xxx') || urlLower.includes('adult')) return 'ADULT_CONTENT'
    if (domain.includes('twitter') || domain.includes('reddit')) return 'SOCIAL_MEDIA'
    
    return 'UNKNOWN'
  }

  private determineRiskLevel(url: string, data: any): ViolationData['riskLevel'] {
    let score = 0
    const urlLower = url.toLowerCase()

    // Fatores de risco
    if (urlLower.includes('leaked')) score += 30
    if (urlLower.includes('nude')) score += 25
    if (urlLower.includes('free')) score += 15
    if (urlLower.includes('download')) score += 20
    if (data.title?.toLowerCase().includes('leaked')) score += 20

    if (score >= 40) return 'CRITICAL'
    if (score >= 25) return 'HIGH'
    if (score >= 10) return 'MEDIUM'
    return 'LOW'
  }

  private extractKeywords(text: string): string[] {
    if (!text) return []
    
    const keywords = text
      .toLowerCase()
      .split(/[\s,;.!?]+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(word))

    return [...new Set(keywords)].slice(0, 10)
  }

  private extractKeywordsFromUrl(url: string): string[] {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : 'http://' + url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)
      return pathParts.slice(0, 5)
    } catch {
      return []
    }
  }

  private parseDate(dateStr: any): Date {
    if (!dateStr) return new Date()
    if (dateStr instanceof Date) return dateStr
    return new Date(dateStr)
  }

  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'sim'].includes(value.toLowerCase())
    }
    return Boolean(value)
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url.startsWith('http') ? url : 'http://' + url)
      return true
    } catch {
      return false
    }
  }

  private riskLevelToScore(riskLevel: ViolationData['riskLevel']): number {
    const scores = { 'LOW': 25, 'MEDIUM': 50, 'HIGH': 75, 'CRITICAL': 100 }
    return scores[riskLevel] || 50
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Métodos de análise de padrões (implementação básica)
  private analyzeDomainPatterns(violations: ViolationData[]) {
    // Implementar análise de padrões de domínio
    return []
  }

  private analyzePathStructures(violations: ViolationData[]) {
    // Implementar análise de estruturas de path
    return []
  }

  private analyzeKeywordFrequency(violations: ViolationData[]) {
    const frequency: Record<string, number> = {}
    violations.forEach(v => {
      v.keywords.forEach(keyword => {
        frequency[keyword] = (frequency[keyword] || 0) + 1
      })
    })
    return frequency
  }

  private analyzePlatformDistribution(violations: ViolationData[]) {
    const distribution: Record<string, number> = {}
    violations.forEach(v => {
      const platform = v.platform || 'unknown'
      distribution[platform] = (distribution[platform] || 0) + 1
    })
    return distribution
  }

  private analyzeTemporalPatterns(violations: ViolationData[]) {
    // Implementar análise temporal
    return []
  }

  private async improveCategorizationWithAI(url: string): Promise<string | null> {
    // Implementar categorização melhorada com IA
    return null
  }

  private extractAdvancedKeywords(url: string, title?: string, description?: string): string[] {
    // Implementar extração avançada de keywords
    return []
  }

  private calculateAdvancedRiskLevel(violation: ViolationData): ViolationData['riskLevel'] {
    // Implementar cálculo avançado de risco
    return violation.riskLevel
  }

  private identifyPlatformFromUrl(url: string): string {
    const domain = this.extractDomain(url).toLowerCase()
    
    if (domain.includes('telegram')) return 'telegram'
    if (domain.includes('discord')) return 'discord'
    if (domain.includes('reddit')) return 'reddit'
    if (domain.includes('twitter')) return 'twitter'
    if (domain.includes('mega')) return 'mega'
    if (domain.includes('forum')) return 'forum'
    
    return 'unknown'
  }

  private extractTld(domain: string): string {
    const parts = domain.split('.')
    return parts.length > 1 ? '.' + parts[parts.length - 1] : ''
  }

  private isDomainSuspicious(domain: string): boolean {
    const suspiciousPatterns = [
      /leaked/i, /nude/i, /free/i, /download/i, /crack/i,
      /pirate/i, /torrent/i, /xxx/i, /porn/i
    ]
    
    return suspiciousPatterns.some(pattern => pattern.test(domain))
  }

  private calculatePlatformRiskScore(platform: string, violations: ViolationData[]): number {
    const platformViolations = violations.filter(v => v.platform === platform)
    const riskScores = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 }
    
    const totalRisk = platformViolations.reduce((sum, v) => sum + riskScores[v.riskLevel], 0)
    return Math.round((totalRisk / platformViolations.length) * 25) || 50
  }

  private categorizePlatforms(platforms: any[]): Record<string, number> {
    const categories: Record<string, number> = {
      'social': 0,
      'messaging': 0,
      'file_sharing': 0,
      'forum': 0,
      'adult': 0,
      'unknown': 0
    }

    platforms.forEach(platform => {
      const name = platform.name.toLowerCase()
      if (['twitter', 'reddit', 'facebook'].some(p => name.includes(p))) {
        categories.social += platform.count
      } else if (['telegram', 'discord', 'whatsapp'].some(p => name.includes(p))) {
        categories.messaging += platform.count
      } else if (['mega', 'drive', 'dropbox'].some(p => name.includes(p))) {
        categories.file_sharing += platform.count
      } else if (name.includes('forum')) {
        categories.forum += platform.count
      } else if (['xxx', 'porn', 'adult'].some(p => name.includes(p))) {
        categories.adult += platform.count
      } else {
        categories.unknown += platform.count
      }
    })

    return categories
  }

  private async countDuplicates(violations: ViolationData[]): Promise<number> {
    const urlSet = new Set<string>()
    let duplicates = 0

    violations.forEach(v => {
      if (urlSet.has(v.url)) {
        duplicates++
      } else {
        urlSet.add(v.url)
      }
    })

    return duplicates
  }

  private getEmptyPatternAnalysis(): PatternAnalysis {
    return {
      commonDomainPatterns: [],
      pathStructures: [],
      keywordFrequency: {},
      platformDistribution: {},
      temporalPatterns: []
    }
  }

  /**
   * Exportar dados processados
   */
  async exportProcessedData(outputPath: string, format: 'json' | 'csv' = 'json'): Promise<void> {
    console.log(`Exportando dados processados para: ${outputPath}`)
    
    const violations = await prisma.violationHistory.findMany({
      include: {
        knownSite: true
      },
      take: 10000 // Limitar para performance
    })

    if (format === 'json') {
      fs.writeFileSync(outputPath, JSON.stringify(violations, null, 2))
    } else {
      // Implementar exportação CSV se necessário
      console.log('Exportação CSV não implementada ainda')
    }

    console.log('Exportação concluída')
  }
}
