import { LRUCache } from 'lru-cache'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Interface para entradas do cache
interface CacheEntry<T = any> {
  key: string
  data: T
  timestamp: Date
  ttl: number
  hits: number
  tags: string[]
}

// Configuração dos diferentes tipos de cache
interface CacheConfig {
  max: number // máximo de entradas
  ttl: number // TTL padrão em ms
  updateAgeOnGet: boolean
}

export class AgentCacheManager {
  private contentCache: LRUCache<string, CacheEntry>
  private robotsCache: LRUCache<string, CacheEntry>
  private siteMetadataCache: LRUCache<string, CacheEntry>
  private screenshotCache: LRUCache<string, CacheEntry>
  private dbCacheEnabled: boolean

  constructor(options: {
    contentCacheSize?: number
    robotsCacheSize?: number
    metadataCacheSize?: number
    screenshotCacheSize?: number
    enableDbCache?: boolean
  } = {}) {
    // Cache de conteúdo de páginas (1 hora TTL)
    this.contentCache = new LRUCache<string, CacheEntry>({
      max: options.contentCacheSize || 1000,
      ttl: 60 * 60 * 1000, // 1 hora
      updateAgeOnGet: true
    })

    // Cache de robots.txt (24 horas TTL)
    this.robotsCache = new LRUCache<string, CacheEntry>({
      max: options.robotsCacheSize || 500,
      ttl: 24 * 60 * 60 * 1000, // 24 horas
      updateAgeOnGet: true
    })

    // Cache de metadados de sites (6 horas TTL)
    this.siteMetadataCache = new LRUCache<string, CacheEntry>({
      max: options.metadataCacheSize || 2000,
      ttl: 6 * 60 * 60 * 1000, // 6 horas
      updateAgeOnGet: true
    })

    // Cache de screenshots (2 horas TTL)
    this.screenshotCache = new LRUCache<string, CacheEntry>({
      max: options.screenshotCacheSize || 200,
      ttl: 2 * 60 * 60 * 1000, // 2 horas
      updateAgeOnGet: false // Screenshots não precisam de age update
    })

    this.dbCacheEnabled = options.enableDbCache !== false
  }

  /**
   * Cache de conteúdo de páginas
   */
  async cachePageContent(url: string, content: any, tags: string[] = []): Promise<void> {
    const entry: CacheEntry = {
      key: url,
      data: content,
      timestamp: new Date(),
      ttl: this.contentCache.ttl || 3600000,
      hits: 0,
      tags: ['page-content', ...tags]
    }

    this.contentCache.set(url, entry)

    // Salvar no banco se habilitado
    if (this.dbCacheEnabled) {
      try {
        await prisma.cacheEntry.upsert({
          where: { key: url },
          update: {
            data: entry.data,
            timestamp: entry.timestamp,
            ttl: entry.ttl,
            tags: entry.tags,
            hits: { increment: 0 }
          },
          create: {
            key: url,
            type: 'page-content',
            data: entry.data,
            timestamp: entry.timestamp,
            ttl: entry.ttl,
            tags: entry.tags,
            hits: 0
          }
        })
      } catch (error) {
        console.warn('Erro ao salvar cache no banco:', error)
      }
    }
  }

  async getPageContent(url: string): Promise<any | null> {
    // Buscar em memória primeiro
    const memoryEntry = this.contentCache.get(url)
    if (memoryEntry) {
      memoryEntry.hits++
      return memoryEntry.data
    }

    // Buscar no banco se habilitado
    if (this.dbCacheEnabled) {
      try {
        const dbEntry = await prisma.cacheEntry.findFirst({
          where: {
            key: url,
            type: 'page-content',
            timestamp: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // 1 hora
            }
          }
        })

        if (dbEntry) {
          // Recarregar na memória
          const entry: CacheEntry = {
            key: dbEntry.key,
            data: dbEntry.data,
            timestamp: dbEntry.timestamp,
            ttl: dbEntry.ttl,
            hits: dbEntry.hits + 1,
            tags: dbEntry.tags
          }

          this.contentCache.set(url, entry)

          // Incrementar hits no banco
          await prisma.cacheEntry.update({
            where: { id: dbEntry.id },
            data: { hits: { increment: 1 } }
          })

          return entry.data
        }
      } catch (error) {
        console.warn('Erro ao buscar cache no banco:', error)
      }
    }

    return null
  }

  /**
   * Cache de robots.txt
   */
  async cacheRobotsTxt(domain: string, robotsData: any): Promise<void> {
    const key = `robots:${domain}`
    const entry: CacheEntry = {
      key,
      data: robotsData,
      timestamp: new Date(),
      ttl: this.robotsCache.ttl || 86400000, // 24 horas
      hits: 0,
      tags: ['robots', domain]
    }

    this.robotsCache.set(key, entry)

    if (this.dbCacheEnabled) {
      try {
        await prisma.cacheEntry.upsert({
          where: { key },
          update: {
            data: entry.data,
            timestamp: entry.timestamp,
            ttl: entry.ttl,
            tags: entry.tags
          },
          create: {
            key,
            type: 'robots',
            data: entry.data,
            timestamp: entry.timestamp,
            ttl: entry.ttl,
            tags: entry.tags,
            hits: 0
          }
        })
      } catch (error) {
        console.warn('Erro ao salvar robots.txt no cache:', error)
      }
    }
  }

  async getRobotsTxt(domain: string): Promise<any | null> {
    const key = `robots:${domain}`
    
    const memoryEntry = this.robotsCache.get(key)
    if (memoryEntry) {
      memoryEntry.hits++
      return memoryEntry.data
    }

    if (this.dbCacheEnabled) {
      try {
        const dbEntry = await prisma.cacheEntry.findFirst({
          where: {
            key,
            type: 'robots',
            timestamp: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 horas
            }
          }
        })

        if (dbEntry) {
          const entry: CacheEntry = {
            key: dbEntry.key,
            data: dbEntry.data,
            timestamp: dbEntry.timestamp,
            ttl: dbEntry.ttl,
            hits: dbEntry.hits + 1,
            tags: dbEntry.tags
          }

          this.robotsCache.set(key, entry)
          return entry.data
        }
      } catch (error) {
        console.warn('Erro ao buscar robots.txt do cache:', error)
      }
    }

    return null
  }

  /**
   * Cache de metadados de sites
   */
  async cacheSiteMetadata(siteId: string, metadata: any): Promise<void> {
    const key = `site-meta:${siteId}`
    const entry: CacheEntry = {
      key,
      data: metadata,
      timestamp: new Date(),
      ttl: this.siteMetadataCache.ttl || 21600000, // 6 horas
      hits: 0,
      tags: ['site-metadata', siteId]
    }

    this.siteMetadataCache.set(key, entry)

    if (this.dbCacheEnabled) {
      try {
        await prisma.cacheEntry.upsert({
          where: { key },
          update: {
            data: entry.data,
            timestamp: entry.timestamp,
            ttl: entry.ttl,
            tags: entry.tags
          },
          create: {
            key,
            type: 'site-metadata',
            data: entry.data,
            timestamp: entry.timestamp,
            ttl: entry.ttl,
            tags: entry.tags,
            hits: 0
          }
        })
      } catch (error) {
        console.warn('Erro ao salvar metadados no cache:', error)
      }
    }
  }

  async getSiteMetadata(siteId: string): Promise<any | null> {
    const key = `site-meta:${siteId}`
    
    const memoryEntry = this.siteMetadataCache.get(key)
    if (memoryEntry) {
      memoryEntry.hits++
      return memoryEntry.data
    }

    if (this.dbCacheEnabled) {
      try {
        const dbEntry = await prisma.cacheEntry.findFirst({
          where: {
            key,
            type: 'site-metadata',
            timestamp: {
              gte: new Date(Date.now() - 6 * 60 * 60 * 1000) // 6 horas
            }
          }
        })

        if (dbEntry) {
          const entry: CacheEntry = {
            key: dbEntry.key,
            data: dbEntry.data,
            timestamp: dbEntry.timestamp,
            ttl: dbEntry.ttl,
            hits: dbEntry.hits + 1,
            tags: dbEntry.tags
          }

          this.siteMetadataCache.set(key, entry)
          return entry.data
        }
      } catch (error) {
        console.warn('Erro ao buscar metadados do cache:', error)
      }
    }

    return null
  }

  /**
   * Cache de screenshots
   */
  async cacheScreenshot(url: string, screenshotData: Buffer | string): Promise<void> {
    const key = `screenshot:${this.hashUrl(url)}`
    const entry: CacheEntry = {
      key,
      data: screenshotData,
      timestamp: new Date(),
      ttl: this.screenshotCache.ttl || 7200000, // 2 horas
      hits: 0,
      tags: ['screenshot']
    }

    this.screenshotCache.set(key, entry)

    // Screenshots geralmente são grandes, então apenas cache em memória
    // Se necessário, implementar storage em disco ou S3
  }

  async getScreenshot(url: string): Promise<Buffer | string | null> {
    const key = `screenshot:${this.hashUrl(url)}`
    
    const memoryEntry = this.screenshotCache.get(key)
    if (memoryEntry) {
      memoryEntry.hits++
      return memoryEntry.data
    }

    return null
  }

  /**
   * Operações de limpeza e manutenção
   */
  
  // Limpar cache por tags
  async clearByTags(tags: string[]): Promise<number> {
    let cleared = 0

    // Limpar cache de memória
    for (const cache of [this.contentCache, this.robotsCache, this.siteMetadataCache, this.screenshotCache]) {
      for (const [key, entry] of cache.entries()) {
        if (entry.tags.some(tag => tags.includes(tag))) {
          cache.delete(key)
          cleared++
        }
      }
    }

    // Limpar cache do banco
    if (this.dbCacheEnabled) {
      try {
        const result = await prisma.cacheEntry.deleteMany({
          where: {
            tags: {
              hasSome: tags
            }
          }
        })
        cleared += result.count
      } catch (error) {
        console.warn('Erro ao limpar cache do banco:', error)
      }
    }

    return cleared
  }

  // Limpar cache expirado
  async clearExpired(): Promise<number> {
    let cleared = 0
    const now = Date.now()

    // Limpar cache de memória (LRU cuida disso automaticamente, mas vamos verificar TTL personalizado)
    for (const cache of [this.contentCache, this.robotsCache, this.siteMetadataCache, this.screenshotCache]) {
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp.getTime() > entry.ttl) {
          cache.delete(key)
          cleared++
        }
      }
    }

    // Limpar cache expirado do banco
    if (this.dbCacheEnabled) {
      try {
        const result = await prisma.cacheEntry.deleteMany({
          where: {
            timestamp: {
              lt: new Date(now - 24 * 60 * 60 * 1000) // Limpar entradas mais antigas que 24h
            }
          }
        })
        cleared += result.count
      } catch (error) {
        console.warn('Erro ao limpar cache expirado do banco:', error)
      }
    }

    return cleared
  }

  // Obter estatísticas do cache
  getStats(): {
    memory: {
      content: { size: number; maxSize: number }
      robots: { size: number; maxSize: number }
      metadata: { size: number; maxSize: number }
      screenshots: { size: number; maxSize: number }
    }
    hits: {
      content: number
      robots: number
      metadata: number
      screenshots: number
    }
  } {
    const getHits = (cache: LRUCache<string, CacheEntry>) => {
      let totalHits = 0
      for (const entry of cache.values()) {
        totalHits += entry.hits
      }
      return totalHits
    }

    return {
      memory: {
        content: { size: this.contentCache.size, maxSize: this.contentCache.max },
        robots: { size: this.robotsCache.size, maxSize: this.robotsCache.max },
        metadata: { size: this.siteMetadataCache.size, maxSize: this.siteMetadataCache.max },
        screenshots: { size: this.screenshotCache.size, maxSize: this.screenshotCache.max }
      },
      hits: {
        content: getHits(this.contentCache),
        robots: getHits(this.robotsCache),
        metadata: getHits(this.siteMetadataCache),
        screenshots: getHits(this.screenshotCache)
      }
    }
  }

  // Hash simples para URLs
  private hashUrl(url: string): string {
    let hash = 0
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  // Invalidar cache de um site específico
  async invalidateSite(siteId: string): Promise<void> {
    await this.clearByTags([siteId])
  }

  // Pré-aquecer cache com sites frequentemente acessados
  async warmupCache(siteIds: string[]): Promise<void> {
    console.log(`Pré-aquecendo cache para ${siteIds.length} sites...`)
    
    // Este método pode ser implementado para fazer requests
    // preventivos aos sites mais importantes
    
    // TODO: Implementar lógica de warmup baseada em:
    // - Sites com maior número de violações
    // - Sites checados mais frequentemente
    // - Sites com maior risco
  }

  // Limpar todo o cache
  async clearAll(): Promise<void> {
    this.contentCache.clear()
    this.robotsCache.clear()
    this.siteMetadataCache.clear()
    this.screenshotCache.clear()

    if (this.dbCacheEnabled) {
      try {
        await prisma.cacheEntry.deleteMany({})
      } catch (error) {
        console.warn('Erro ao limpar cache do banco:', error)
      }
    }
  }
}

// Instância singleton do gerenciador de cache
export const agentCache = new AgentCacheManager({
  contentCacheSize: 1000,
  robotsCacheSize: 500,
  metadataCacheSize: 2000,
  screenshotCacheSize: 200,
  enableDbCache: true
})

// Tarefa de limpeza automática (executar a cada hora)
if (typeof setInterval !== 'undefined') {
  setInterval(async () => {
    try {
      const cleared = await agentCache.clearExpired()
      console.log(`Cache automático: ${cleared} entradas expiradas removidas`)
    } catch (error) {
      console.error('Erro na limpeza automática do cache:', error)
    }
  }, 60 * 60 * 1000) // 1 hora
}