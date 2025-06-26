import { PrismaClient, SiteCategory } from '@prisma/client'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'

const prisma = new PrismaClient()

// Schema de validação para dados importados
const ImportSiteDataSchema = z.object({
  url: z.string().url('URL inválida'),
  category: z.nativeEnum(SiteCategory).optional(),
  platform: z.string().optional(),
  violationCount: z.number().int().min(0).optional().default(0),
  lastSeen: z.string().optional(),
  riskScore: z.number().int().min(0).max(100).optional().default(50)
})

export interface ImportSiteData extends z.infer<typeof ImportSiteDataSchema> {}

export interface ImportResult {
  success: boolean
  totalProcessed: number
  totalImported: number
  errors: string[]
  duplicates: number
}

export class KnownSitesImporter {
  private userId: string

  constructor(userId: string) {
    this.userId = userId
  }

  /**
   * Importar lista de sites conhecidos de um arquivo CSV
   */
  async importFromCSV(filePath: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      totalProcessed: 0,
      totalImported: 0,
      errors: [],
      duplicates: 0
    }

    try {
      // Verificar se arquivo existe
      await fs.access(filePath)
      
      // Ler conteúdo do arquivo
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const lines = fileContent.split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        throw new Error('Arquivo CSV vazio')
      }

      // Processar header (primeira linha)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const dataLines = lines.slice(1)

      result.totalProcessed = dataLines.length

      for (let index = 0; index < dataLines.length; index++) {
        const line = dataLines[index]
        try {
          const values = line.split(',').map(v => v.trim())
          const siteData = this.parseCSVLine(headers, values)
          
          if (siteData) {
            const imported = await this.importSingleSite(siteData)
            if (imported === 'imported') {
              result.totalImported++
            } else if (imported === 'duplicate') {
              result.duplicates++
            }
          }
        } catch (error) {
          const errorMsg = `Linha ${index + 2}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          result.errors.push(errorMsg)
        }
      }

      result.success = result.errors.length < result.totalProcessed * 0.5 // Sucesso se menos de 50% de erros
      
    } catch (error) {
      result.errors.push(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }

    return result
  }

  /**
   * Importar dados de um array de objetos
   */
  async importFromArray(sites: ImportSiteData[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      totalProcessed: sites.length,
      totalImported: 0,
      errors: [],
      duplicates: 0
    }

    try {
      for (let index = 0; index < sites.length; index++) {
        const siteData = sites[index]
        try {
          const imported = await this.importSingleSite(siteData)
          if (imported === 'imported') {
            result.totalImported++
          } else if (imported === 'duplicate') {
            result.duplicates++
          }
        } catch (error) {
          const errorMsg = `Site ${index + 1}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
          result.errors.push(errorMsg)
        }
      }

      result.success = result.errors.length < result.totalProcessed * 0.5
    } catch (error) {
      result.errors.push(`Erro durante importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }

    return result
  }

  /**
   * Importar um único site
   */
  private async importSingleSite(data: ImportSiteData): Promise<'imported' | 'duplicate' | 'error'> {
    try {
      // Validar dados
      const validatedData = ImportSiteDataSchema.parse(data)
      
      // Normalizar URL
      const { baseUrl, domain } = this.normalizeUrl(validatedData.url)
      
      // Verificar se já existe
      const existing = await prisma.knownSite.findUnique({
        where: { baseUrl }
      })

      if (existing) {
        return 'duplicate'
      }

      // Categorizar automaticamente se não fornecido
      const category = validatedData.category || this.categorizeSite(validatedData.url)
      
      // Detectar plataforma se não fornecida
      const platform = validatedData.platform || this.detectPlatform(validatedData.url)

      // Criar no banco
      await prisma.knownSite.create({
        data: {
          baseUrl,
          domain,
          category,
          platform,
          totalViolations: validatedData.violationCount || 0,
          riskScore: validatedData.riskScore || 50,
          robotsTxtUrl: `${baseUrl}/robots.txt`,
          userId: this.userId,
          lastViolation: validatedData.lastSeen ? new Date(validatedData.lastSeen) : null
        }
      })

      return 'imported'
      
    } catch (error) {
      console.error('Erro ao importar site:', error)
      throw error
    }
  }

  /**
   * Parse de linha CSV para objeto
   */
  private parseCSVLine(headers: string[], values: string[]): ImportSiteData | null {
    if (values.length === 0 || !values[0]) return null

    const data: any = {}

    // Mapear headers para campos conhecidos
    headers.forEach((header, index) => {
      const value = values[index]?.replace(/['"]/g, '') // Remove aspas
      
      switch (header) {
        case 'url':
        case 'site':
        case 'website':
          data.url = value
          break
        case 'category':
        case 'categoria':
          data.category = this.mapCategoryString(value)
          break
        case 'platform':
        case 'plataforma':
          data.platform = value
          break
        case 'violations':
        case 'violacoes':
        case 'violation_count':
          data.violationCount = value ? parseInt(value) : 0
          break
        case 'last_seen':
        case 'last_violation':
        case 'ultima_violacao':
          data.lastSeen = value
          break
        case 'risk_score':
        case 'risk':
        case 'risco':
          data.riskScore = value ? parseInt(value) : 50
          break
      }
    })

    return data.url ? data : null
  }

  /**
   * Mapear string de categoria para enum
   */
  private mapCategoryString(categoryStr: string): SiteCategory | undefined {
    if (!categoryStr) return undefined

    const normalized = categoryStr.toLowerCase().trim()
    
    const mapping: Record<string, SiteCategory> = {
      'forum': SiteCategory.FORUM,
      'forums': SiteCategory.FORUM,
      'social': SiteCategory.SOCIAL_MEDIA,
      'social_media': SiteCategory.SOCIAL_MEDIA,
      'rede_social': SiteCategory.SOCIAL_MEDIA,
      'file_sharing': SiteCategory.FILE_SHARING,
      'compartilhamento': SiteCategory.FILE_SHARING,
      'sharing': SiteCategory.FILE_SHARING,
      'adult': SiteCategory.ADULT_CONTENT,
      'adulto': SiteCategory.ADULT_CONTENT,
      'adult_content': SiteCategory.ADULT_CONTENT,
      'messaging': SiteCategory.MESSAGING,
      'mensagem': SiteCategory.MESSAGING,
      'chat': SiteCategory.MESSAGING,
      'unknown': SiteCategory.UNKNOWN,
      'desconhecido': SiteCategory.UNKNOWN
    }

    return mapping[normalized] || SiteCategory.UNKNOWN
  }

  /**
   * Categorizar automaticamente sites baseado na URL
   */
  private categorizeSite(url: string): SiteCategory {
    const normalizedUrl = url.toLowerCase()
    const domain = this.extractDomain(normalizedUrl)

    // Patterns para categorização
    const patterns = {
      [SiteCategory.SOCIAL_MEDIA]: [
        'facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'linkedin',
        'pinterest', 'snapchat', 'tumblr', 'reddit', 'x.com'
      ],
      [SiteCategory.MESSAGING]: [
        'telegram', 'discord', 'whatsapp', 'slack', 'teams', 'signal',
        'matrix', 'element', 'riot'
      ],
      [SiteCategory.FILE_SHARING]: [
        'mediafire', 'mega', 'drive.google', 'dropbox', 'onedrive',
        'wetransfer', 'sendspace', '4shared', 'rapidgator', 'filesfm'
      ],
      [SiteCategory.FORUM]: [
        'stackoverflow', 'superuser', 'askubuntu', 'discourse', 'xda',
        'forum', 'community', 'discuss'
      ],
      [SiteCategory.ADULT_CONTENT]: [
        'pornhub', 'xvideos', 'xhamster', 'redtube', 'tube8',
        'youporn', 'spankbang', 'eporner', 'beeg', 'tnaflix'
      ]
    }

    // Verificar patterns
    for (const [category, keywords] of Object.entries(patterns)) {
      for (const keyword of keywords) {
        if (domain.includes(keyword) || normalizedUrl.includes(keyword)) {
          return category as SiteCategory
        }
      }
    }

    return SiteCategory.UNKNOWN
  }

  /**
   * Validar e normalizar URLs
   */
  private normalizeUrl(url: string): { baseUrl: string; domain: string } {
    try {
      // Adicionar protocolo se não presente
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }

      const urlObj = new URL(url)
      const baseUrl = `${urlObj.protocol}//${urlObj.hostname}`
      const domain = urlObj.hostname

      return { baseUrl, domain }
    } catch (error) {
      throw new Error(`URL inválida: ${url}`)
    }
  }

  /**
   * Extrair domínio de URL
   */
  private extractDomain(url: string): string {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url
      }
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  /**
   * Detectar plataforma baseada em padrões de URL
   */
  private detectPlatform(url: string): string | null {
    const domain = this.extractDomain(url.toLowerCase())

    const platformPatterns: Record<string, string> = {
      'reddit.com': 'reddit',
      'facebook.com': 'facebook',
      'instagram.com': 'instagram',
      'twitter.com': 'twitter',
      'x.com': 'twitter',
      'tiktok.com': 'tiktok',
      'youtube.com': 'youtube',
      'linkedin.com': 'linkedin',
      'telegram.org': 'telegram',
      'web.telegram.org': 'telegram',
      'discord.com': 'discord',
      'whatsapp.com': 'whatsapp',
      'slack.com': 'slack',
      'stackoverflow.com': 'stackoverflow',
      'discourse.org': 'discourse',
      'mediafire.com': 'mediafire',
      'mega.nz': 'mega',
      'drive.google.com': 'gdrive',
      'dropbox.com': 'dropbox'
    }

    // Busca exata primeiro
    if (platformPatterns[domain]) {
      return platformPatterns[domain]
    }

    // Busca por substrings
    for (const [pattern, platform] of Object.entries(platformPatterns)) {
      if (domain.includes(pattern.split('.')[0])) {
        return platform
      }
    }

    return null
  }

  /**
   * Obter estatísticas de sites importados
   */
  async getImportStats(): Promise<{
    totalSites: number
    byCategory: Record<SiteCategory, number>
    byPlatform: Record<string, number>
  }> {
    const [totalSites, byCategory, byPlatform] = await Promise.all([
      prisma.knownSite.count({ where: { userId: this.userId } }),
      prisma.knownSite.groupBy({
        by: ['category'],
        where: { userId: this.userId },
        _count: { id: true }
      }),
      prisma.knownSite.groupBy({
        by: ['platform'],
        where: { userId: this.userId, platform: { not: null } },
        _count: { id: true }
      })
    ])

    const categoryStats = byCategory.reduce((acc, item) => {
      acc[item.category] = item._count.id
      return acc
    }, {} as Record<SiteCategory, number>)

    const platformStats = byPlatform.reduce((acc, item) => {
      if (item.platform) {
        acc[item.platform] = item._count.id
      }
      return acc
    }, {} as Record<string, number>)

    return {
      totalSites,
      byCategory: categoryStats,
      byPlatform: platformStats
    }
  }
}