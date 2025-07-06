import { LRUCache } from 'lru-cache'
import { prisma } from '@/lib/prisma'

type CacheType = 'content' | 'robots' | 'metadata' | 'screenshot'

interface CacheEntry {
  key: string
  value: any
  type: CacheType
  timestamp: Date
  ttl: number
  hits: number
  tags: string[]
}

interface CacheOptions {
  memoryLimit?: number // MB
  dbCacheEnabled?: boolean
  warmupEnabled?: boolean
}

export class CacheManager {
  private static instance: CacheManager | null = null
  
  // Caches específicos por tipo com TTLs diferentes
  private contentCache: LRUCache<string, CacheEntry>
  private robotsCache: LRUCache<string, CacheEntry>
  private metadataCache: LRUCache<string, CacheEntry>
  private screenshotCache: LRUCache<string, CacheEntry>
  
  private dbCacheEnabled: boolean
  private warmupEnabled: boolean
  
  // TTLs em milissegundos
  private readonly TTL = {
    content: 60 * 60 * 1000,      // 1 hora
    robots: 24 * 60 * 60 * 1000,  // 24 horas
    metadata: 6 * 60 * 60 * 1000, // 6 horas
    screenshot: 2 * 60 * 60 * 1000 // 2 horas
  }

  private constructor(options: CacheOptions = {}) {
    const memoryLimit = options.memoryLimit || 100 // 100MB default
    this.dbCacheEnabled = options.dbCacheEnabled !== false
    this.warmupEnabled = options.warmupEnabled !== false

    // Configurar caches LRU
    this.contentCache = new LRUCache<string, CacheEntry>({
      max: 1000,
      ttl: this.TTL.content
    })

    this.robotsCache = new LRUCache<string, CacheEntry>({
      max: 500,
      ttl: this.TTL.robots
    })

    this.metadataCache = new LRUCache<string, CacheEntry>({
      max: 1000,
      ttl: this.TTL.metadata
    })

    this.screenshotCache = new LRUCache<string, CacheEntry>({
      max: 100,
      ttl: this.TTL.screenshot
    })

    // Iniciar warmup se habilitado
    if (this.warmupEnabled) {
      this.warmupCache()
    }

    // Limpar cache expirado periodicamente
    setInterval(() => this.cleanupExpiredEntries(), 5 * 60 * 1000) // 5 minutos
  }

  static getInstance(options?: CacheOptions): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(options)
    }
    return CacheManager.instance
  }

  /**
   * Obter valor do cache
   */
  async get(key: string, type: CacheType): Promise<any | null> {
    const cache = this.getCache(type)
    
    // Tentar obter da memória primeiro
    let entry = cache.get(key)
    
    if (!entry && this.dbCacheEnabled) {
      // Tentar obter do banco de dados
      const dbEntry = await this.getFromDatabase(key, type)
      
      if (dbEntry && !this.isExpired(dbEntry)) {
        // Restaurar para memória
        cache.set(key, dbEntry)
        entry = dbEntry
      }
    }
    
    if (entry && !this.isExpired(entry)) {
      // Incrementar contador de hits
      entry.hits++
      
      // Atualizar hit no banco se necessário
      if (this.dbCacheEnabled && entry.hits % 10 === 0) {
        this.updateHitsInDatabase(key, entry.hits)
      }
      
      return entry.value
    }
    
    return null
  }

  /**
   * Armazenar valor no cache
   */
  async set(
    key: string, 
    value: any, 
    type: CacheType, 
    tags: string[] = [],
    customTTL?: number
  ): Promise<void> {
    const cache = this.getCache(type)
    const ttl = customTTL || this.TTL[type]
    
    const entry: CacheEntry = {
      key,
      value,
      type,
      timestamp: new Date(),
      ttl,
      hits: 0,
      tags
    }
    
    // Armazenar na memória
    cache.set(key, entry)
    
    // Armazenar no banco se habilitado
    if (this.dbCacheEnabled) {
      await this.saveToDatabase(entry)
    }
  }

  /**
   * Invalidar cache por tag
   */
  async invalidateByTag(tag: string): Promise<void> {
    const caches = [this.contentCache, this.robotsCache, this.metadataCache, this.screenshotCache]
    
    for (const cache of caches) {
      for (const [key, entry] of cache.entries()) {
        if (entry.tags.includes(tag)) {
          cache.delete(key)
          
          if (this.dbCacheEnabled) {
            await this.deleteFromDatabase(key)
          }
        }
      }
    }
  }

  /**
   * Invalidar cache específico
   */
  async invalidate(key: string, type?: CacheType): Promise<void> {
    if (type) {
      const cache = this.getCache(type)
      cache.delete(key)
    } else {
      // Invalidar em todos os caches
      this.contentCache.delete(key)
      this.robotsCache.delete(key)
      this.metadataCache.delete(key)
      this.screenshotCache.delete(key)
    }
    
    if (this.dbCacheEnabled) {
      await this.deleteFromDatabase(key)
    }
  }

  /**
   * Obter estatísticas do cache
   */
  getStats(): {
    content: { size: number; hits: number; misses: number }
    robots: { size: number; hits: number; misses: number }
    metadata: { size: number; hits: number; misses: number }
    screenshot: { size: number; hits: number; misses: number }
    total: { size: number; hits: number; misses: number }
  } {
    const stats = {
      content: this.getCacheStats(this.contentCache),
      robots: this.getCacheStats(this.robotsCache),
      metadata: this.getCacheStats(this.metadataCache),
      screenshot: this.getCacheStats(this.screenshotCache),
      total: { size: 0, hits: 0, misses: 0 }
    }
    
    // Calcular totais
    stats.total.size = stats.content.size + stats.robots.size + stats.metadata.size + stats.screenshot.size
    stats.total.hits = stats.content.hits + stats.robots.hits + stats.metadata.hits + stats.screenshot.hits
    stats.total.misses = stats.content.misses + stats.robots.misses + stats.metadata.misses + stats.screenshot.misses
    
    return stats
  }

  /**
   * Warmup do cache com dados frequentes
   */
  private async warmupCache(): Promise<void> {
    if (!this.dbCacheEnabled) return
    
    try {
      // Buscar entradas mais acessadas das últimas 24 horas
      const recentEntries = await prisma.cacheEntry.findMany({
        where: {
          hits: { gte: 5 },
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        },
        orderBy: { hits: 'desc' },
        take: 100
      })
      
      for (const dbEntry of recentEntries) {
        const entry: CacheEntry = {
          key: dbEntry.key,
          value: dbEntry.value,
          type: dbEntry.type as CacheType,
          timestamp: dbEntry.createdAt,
          ttl: dbEntry.ttl,
          hits: dbEntry.hits,
          tags: dbEntry.tags
        }
        
        if (!this.isExpired(entry)) {
          const cache = this.getCache(entry.type)
          cache.set(entry.key, entry)
        }
      }
      
      console.log(`[Cache] Warmup completed: ${recentEntries.length} entries loaded`)
    } catch (error) {
      console.error('[Cache] Warmup error:', error)
    }
  }

  /**
   * Obter cache específico por tipo
   */
  private getCache(type: CacheType): LRUCache<string, CacheEntry> {
    switch (type) {
      case 'content': return this.contentCache
      case 'robots': return this.robotsCache
      case 'metadata': return this.metadataCache
      case 'screenshot': return this.screenshotCache
    }
  }

  /**
   * Verificar se entrada está expirada
   */
  private isExpired(entry: CacheEntry): boolean {
    const age = Date.now() - entry.timestamp.getTime()
    return age > entry.ttl
  }

  /**
   * Callback quando item é removido do cache
   */
  private async onEvict(key: string, entry: CacheEntry): Promise<void> {
    // Salvar no banco antes de remover da memória (se ainda válido)
    if (this.dbCacheEnabled && !this.isExpired(entry)) {
      await this.saveToDatabase(entry)
    }
  }

  /**
   * Obter do banco de dados
   */
  private async getFromDatabase(key: string, type: CacheType): Promise<CacheEntry | null> {
    try {
      const dbEntry = await prisma.cacheEntry.findUnique({
        where: { key }
      })
      
      if (!dbEntry || dbEntry.type !== type) {
        return null
      }
      
      return {
        key: dbEntry.key,
        value: dbEntry.value,
        type: dbEntry.type as CacheType,
        timestamp: dbEntry.createdAt,
        ttl: dbEntry.ttl,
        hits: dbEntry.hits,
        tags: dbEntry.tags
      }
    } catch (error) {
      console.error('[Cache] Database read error:', error)
      return null
    }
  }

  /**
   * Salvar no banco de dados
   */
  private async saveToDatabase(entry: CacheEntry): Promise<void> {
    try {
      await prisma.cacheEntry.upsert({
        where: { key: entry.key },
        update: {
          value: entry.value,
          type: entry.type,
          ttl: entry.ttl,
          hits: entry.hits,
          tags: entry.tags,
          expiresAt: new Date(entry.timestamp.getTime() + entry.ttl)
        },
        create: {
          key: entry.key,
          value: entry.value,
          type: entry.type,
          ttl: entry.ttl,
          hits: entry.hits,
          tags: entry.tags,
          expiresAt: new Date(entry.timestamp.getTime() + entry.ttl)
        }
      })
    } catch (error) {
      console.error('[Cache] Database write error:', error)
    }
  }

  /**
   * Atualizar hits no banco
   */
  private async updateHitsInDatabase(key: string, hits: number): Promise<void> {
    try {
      await prisma.cacheEntry.update({
        where: { key },
        data: { hits }
      })
    } catch (error) {
      // Ignorar erros de atualização de hits
    }
  }

  /**
   * Deletar do banco de dados
   */
  private async deleteFromDatabase(key: string): Promise<void> {
    try {
      await prisma.cacheEntry.delete({
        where: { key }
      })
    } catch (error) {
      // Ignorar erros de deleção
    }
  }

  /**
   * Limpar entradas expiradas
   */
  private async cleanupExpiredEntries(): Promise<void> {
    if (!this.dbCacheEnabled) return
    
    try {
      const result = await prisma.cacheEntry.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      })
      
      if (result.count > 0) {
        console.log(`[Cache] Cleaned up ${result.count} expired entries`)
      }
    } catch (error) {
      console.error('[Cache] Cleanup error:', error)
    }
  }

  /**
   * Obter estatísticas de um cache
   */
  private getCacheStats(cache: LRUCache<string, CacheEntry>): {
    size: number
    hits: number
    misses: number
  } {
    let hits = 0
    let misses = 0
    
    for (const entry of cache.values()) {
      hits += entry.hits
    }
    
    return {
      size: cache.size,
      hits,
      misses: 0 // LRUCache não rastreia misses nativamente
    }
  }

  /**
   * Invalidar cache por tags
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    let invalidated = 0
    
    // Percorrer todos os caches e remover entradas com as tags
    const caches = [
      this.contentCache,
      this.robotsCache, 
      this.metadataCache,
      this.screenshotCache
    ]
    
    for (const cache of caches) {
      const keysToRemove: string[] = []
      
      // Identificar chaves para remover
      cache.forEach((value: CacheEntry, key: string) => {
        if (value.tags && value.tags.some(tag => tags.includes(tag))) {
          keysToRemove.push(key)
        }
      })
      
      // Remover as chaves identificadas
      for (const key of keysToRemove) {
        cache.delete(key)
        invalidated++
      }
    }
    
    // Se usar cache no banco, invalidar lá também
    if (this.dbCacheEnabled) {
      try {
        const result = await prisma.cacheEntry.deleteMany({
          where: {
            tags: {
              hasSome: tags
            }
          }
        })
        invalidated += result.count
      } catch (error) {
        console.error('Error invalidating cache by tags in database:', error)
      }
    }
    
    return invalidated
  }

  /**
   * Criar chave de cache com namespace
   */
  static createKey(namespace: string, ...parts: string[]): string {
    return `${namespace}:${parts.join(':')}`
  }
}

// Export singleton instance
export const cacheManager = CacheManager.getInstance()
