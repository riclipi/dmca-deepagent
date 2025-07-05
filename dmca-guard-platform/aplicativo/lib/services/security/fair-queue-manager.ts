// lib/services/security/fair-queue-manager.ts
import { PlanType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { emitQueueUpdate } from '@/lib/socket-server'

interface ScanRequest {
  id: string
  userId: string
  userPlan: PlanType
  siteIds: string[]
  priority: number
  queuedAt: Date
  metadata?: any
}

interface QueueResponse {
  status: 'QUEUED' | 'PROCESSING'
  position?: number
  estimatedStartTime?: Date
  queueId?: string
}

const CONCURRENT_SCAN_LIMITS = {
  FREE: 1,
  BASIC: 3,
  PREMIUM: 10,
  ENTERPRISE: 50,
  SUPER_USER: Infinity
}

export class FairQueueManager {
  // Em produção, usar Redis ou RabbitMQ
  private static userQueues = new Map<string, ScanRequest[]>()
  private static activeScans = new Map<string, number>()
  private static globalQueue: ScanRequest[] = []
  private static isSchedulerRunning = false

  /**
   * Enfileira ou inicia um scan, respeitando os limites do plano do usuário
   */
  async enqueueScan(request: Omit<ScanRequest, 'id' | 'queuedAt'>): Promise<QueueResponse> {
    const scanRequest: ScanRequest = {
      ...request,
      id: this.generateRequestId(),
      queuedAt: new Date(),
      priority: this.calculatePriority(request.userPlan)
    }

    const limit = CONCURRENT_SCAN_LIMITS[request.userPlan]
    const activeUserScans = FairQueueManager.activeScans.get(request.userId) || 0

    // Se usuário está no limite, enfileirar
    if (activeUserScans >= limit && limit !== Infinity) {
      return this.addToQueue(scanRequest)
    }

    // Verificar se há recursos globais disponíveis
    const totalActiveScans = this.getTotalActiveScans()
    const globalLimit = 100 // Limite global do sistema

    if (totalActiveScans >= globalLimit) {
      return this.addToQueue(scanRequest)
    }

    // Processar imediatamente
    this.incrementActiveScans(request.userId)
    this.processScan(scanRequest)
    
    return { status: 'PROCESSING' }
  }

  /**
   * Adiciona scan à fila
   */
  private addToQueue(request: ScanRequest): QueueResponse {
    // Adicionar à fila do usuário
    const userQueue = FairQueueManager.userQueues.get(request.userId) || []
    userQueue.push(request)
    FairQueueManager.userQueues.set(request.userId, userQueue)

    // Adicionar à fila global para round-robin
    FairQueueManager.globalQueue.push(request)
    FairQueueManager.globalQueue.sort((a, b) => b.priority - a.priority)

    // Iniciar scheduler se não estiver rodando
    if (!FairQueueManager.isSchedulerRunning) {
      this.startGlobalScheduler()
    }

    const position = this.calculateQueuePosition(request)
    const estimatedStartTime = this.estimateStartTime(request, position)

    console.log(`[Queue] Scan enqueued for user ${request.userId}. Position: ${position}`)

    // Emit WebSocket event
    emitQueueUpdate({
      userId: request.userId,
      queueId: request.id,
      status: 'QUEUED',
      position,
      estimatedStartTime
    })

    return {
      status: 'QUEUED',
      position,
      estimatedStartTime,
      queueId: request.id
    }
  }

  /**
   * Calcula prioridade baseada no plano
   */
  private calculatePriority(plan: PlanType): number {
    const priorities = {
      FREE: 1,
      BASIC: 2,
      PREMIUM: 3,
      ENTERPRISE: 4,
      SUPER_USER: 5
    }
    return priorities[plan] || 1
  }

  /**
   * Calcula posição na fila
   */
  private calculateQueuePosition(request: ScanRequest): number {
    let position = 1
    
    for (const queued of FairQueueManager.globalQueue) {
      if (queued.id === request.id) break
      
      // Considerar prioridade e tempo de espera
      if (queued.priority > request.priority) {
        position++
      } else if (queued.priority === request.priority && queued.queuedAt < request.queuedAt) {
        position++
      }
    }
    
    return position
  }

  /**
   * Estima tempo de início
   */
  private estimateStartTime(request: ScanRequest, position: number): Date {
    // Estimativa: 2 minutos por scan na frente
    const estimatedMinutes = position * 2
    return new Date(Date.now() + estimatedMinutes * 60000)
  }

  /**
   * Processa scan
   */
  private async processScan(request: ScanRequest) {
    console.log(`[Queue] Processing scan for user ${request.userId}...`)
    
    try {
      // Emit WebSocket event
      emitQueueUpdate({
        userId: request.userId,
        queueId: request.id,
        status: 'PROCESSING',
        startedAt: new Date()
      })

      // Criar sessão de monitoramento
      const session = await prisma.monitoringSession.create({
        data: {
          userId: request.userId,
          brandProfileId: request.metadata?.brandProfileId,
          status: 'IN_PROGRESS',
          metadata: {
            siteIds: request.siteIds,
            queuedAt: request.queuedAt,
            startedAt: new Date()
          }
        }
      })

      // Import KnownSitesAgent dynamically to avoid circular dependencies
      const { KnownSitesAgent } = await import('@/lib/agents/KnownSitesAgent')
      const agent = new KnownSitesAgent()
      
      // Execute scan with the created session
      await agent.scanKnownSites(request.metadata?.brandProfileId, session.id)

      this.onScanComplete(request.userId, request.id)

    } catch (error) {
      console.error(`[Queue] Error processing scan:`, error)
      this.onScanComplete(request.userId, request.id)
    }
  }

  /**
   * Callback quando scan completa
   */
  private onScanComplete(userId: string, requestId: string) {
    // Decrementar contador de scans ativos
    this.decrementActiveScans(userId)

    // Remover da fila global se ainda estiver lá
    FairQueueManager.globalQueue = FairQueueManager.globalQueue.filter(
      r => r.id !== requestId
    )

    console.log(`[Queue] Scan completed for user ${userId}`)

    // Emit WebSocket event
    emitQueueUpdate({
      userId,
      queueId: requestId,
      status: 'COMPLETED',
      completedAt: new Date()
    })

    // Processar próximo da fila
    this.processNextInQueue()
  }

  /**
   * Sistema de fairness - previne starvation
   */
  private async startGlobalScheduler() {
    if (FairQueueManager.isSchedulerRunning) return
    
    FairQueueManager.isSchedulerRunning = true
    console.log('[Queue] Global scheduler started')

    while (FairQueueManager.globalQueue.length > 0 || this.hasActiveScans()) {
      await this.schedulerTick()
      await this.sleep(1000) // Check a cada segundo
    }

    FairQueueManager.isSchedulerRunning = false
    console.log('[Queue] Global scheduler stopped')
  }

  /**
   * Tick do scheduler
   */
  private async schedulerTick() {
    // Round-robin entre usuários para fairness
    const usersWithQueues = Array.from(FairQueueManager.userQueues.keys())
    
    for (const userId of usersWithQueues) {
      const userQueue = FairQueueManager.userQueues.get(userId) || []
      const userPlan = userQueue[0]?.userPlan || 'FREE'
      const limit = CONCURRENT_SCAN_LIMITS[userPlan as keyof typeof CONCURRENT_SCAN_LIMITS]
      const activeScans = FairQueueManager.activeScans.get(userId) || 0

      // Se usuário tem espaço para mais scans
      if (activeScans < limit && userQueue.length > 0) {
        const canProcess = this.canProcessMore()
        
        if (canProcess) {
          const request = userQueue.shift()!
          FairQueueManager.userQueues.set(userId, userQueue)
          
          // Remover da fila global
          FairQueueManager.globalQueue = FairQueueManager.globalQueue.filter(
            r => r.id !== request.id
          )
          
          this.incrementActiveScans(userId)
          this.processScan(request)
        }
      }

      // Limpar fila vazia
      if (userQueue.length === 0) {
        FairQueueManager.userQueues.delete(userId)
      }
    }
  }

  /**
   * Processa próximo da fila
   */
  private processNextInQueue() {
    if (FairQueueManager.globalQueue.length === 0) return
    
    // Pegar próximo respeitando prioridade
    const next = FairQueueManager.globalQueue[0]
    
    if (next && this.canUserProcessMore(next.userId, next.userPlan)) {
      FairQueueManager.globalQueue.shift()
      
      // Remover da fila do usuário
      const userQueue = FairQueueManager.userQueues.get(next.userId) || []
      const index = userQueue.findIndex(r => r.id === next.id)
      if (index !== -1) {
        userQueue.splice(index, 1)
        FairQueueManager.userQueues.set(next.userId, userQueue)
      }
      
      this.incrementActiveScans(next.userId)
      this.processScan(next)
    }
  }

  /**
   * Verifica se pode processar mais globalmente
   */
  private canProcessMore(): boolean {
    const total = this.getTotalActiveScans()
    return total < 100 // Limite global
  }

  /**
   * Verifica se usuário pode processar mais
   */
  private canUserProcessMore(userId: string, plan: PlanType): boolean {
    const active = FairQueueManager.activeScans.get(userId) || 0
    const limit = CONCURRENT_SCAN_LIMITS[plan]
    return active < limit
  }

  /**
   * Helpers para contadores
   */
  private incrementActiveScans(userId: string) {
    const current = FairQueueManager.activeScans.get(userId) || 0
    FairQueueManager.activeScans.set(userId, current + 1)
  }

  private decrementActiveScans(userId: string) {
    const current = FairQueueManager.activeScans.get(userId) || 1
    FairQueueManager.activeScans.set(userId, Math.max(0, current - 1))
  }

  private getTotalActiveScans(): number {
    let total = 0
    for (const count of FairQueueManager.activeScans.values()) {
      total += count
    }
    return total
  }

  private hasActiveScans(): boolean {
    return this.getTotalActiveScans() > 0
  }

  private generateRequestId(): string {
    return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Obtém status da fila para um usuário
   */
  async getQueueStatus(userId: string): Promise<{
    activeScans: number
    queuedScans: number
    position?: number
  }> {
    const activeScans = FairQueueManager.activeScans.get(userId) || 0
    const userQueue = FairQueueManager.userQueues.get(userId) || []
    
    let position: number | undefined
    if (userQueue.length > 0) {
      position = this.calculateQueuePosition(userQueue[0])
    }
    
    return {
      activeScans,
      queuedScans: userQueue.length,
      position
    }
  }

  /**
   * Cancela scan na fila
   */
  async cancelQueuedScan(userId: string, queueId: string): Promise<boolean> {
    // Remover da fila do usuário
    const userQueue = FairQueueManager.userQueues.get(userId) || []
    const index = userQueue.findIndex(r => r.id === queueId)
    
    if (index !== -1) {
      userQueue.splice(index, 1)
      FairQueueManager.userQueues.set(userId, userQueue)
      
      // Remover da fila global
      FairQueueManager.globalQueue = FairQueueManager.globalQueue.filter(
        r => r.id !== queueId
      )
      
      // Emit WebSocket event
      emitQueueUpdate({
        userId,
        queueId,
        status: 'CANCELLED',
        cancelledAt: new Date()
      })
      
      return true
    }
    
    return false
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    cancelled: number
  }> {
    const stats = await prisma.monitoringSession.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    })

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    }

    stats.forEach(stat => {
      const status = stat.status.toLowerCase()
      if (status in result) {
        result[status as keyof typeof result] = stat._count.status
      }
    })

    return result
  }
}

// Export singleton instance
export const fairQueueManager = new FairQueueManager()