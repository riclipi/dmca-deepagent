import { PrismaClient } from '@prisma/client'
import { ScanSession, ScanReport, AgentEvent, ProgressUpdate } from './types'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema do banco para sessões de scan
const ScanSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  brandProfileId: z.string(),
  status: z.enum(['RUNNING', 'PAUSED', 'COMPLETED', 'ERROR']),
  totalSites: z.number(),
  sitesScanned: z.number(),
  violationsFound: z.number(),
  errorCount: z.number(),
  startedAt: z.date(),
  completedAt: z.date().optional(),
  estimatedCompletion: z.date().optional(),
  currentSite: z.string().optional(),
  lastError: z.string().optional(),
  metadata: z.record(z.any()).optional()
})

export class SessionManager {
  private activeSessions = new Map<string, ScanSession>()
  private eventHandlers = new Map<string, Function[]>()

  /**
   * Iniciar nova sessão de scan
   */
  async startScanSession(userId: string, brandProfileId: string): Promise<string> {
    const sessionId = this.generateSessionId()
    
    try {
      // Verificar se já existe sessão ativa para o usuário
      const existingSession = await prisma.scanSession.findFirst({
        where: {
          userId,
          brandProfileId,
          status: { in: ['RUNNING', 'PAUSED'] }
        }
      })

      if (existingSession) {
        throw new Error('Já existe uma sessão ativa para este perfil. Finalize ou pause a sessão atual primeiro.')
      }

      // Criar sessão no banco
      await prisma.scanSession.create({
        data: {
          id: sessionId,
          userId,
          brandProfileId,
          status: 'RUNNING',
          totalSites: 0,
          sitesScanned: 0,
          violationsFound: 0,
          errorCount: 0,
          startedAt: new Date(),
          metadata: {}
        }
      })

      // Inicializar sessão em memória
      const session: ScanSession = {
        sessionId,
        userId,
        brandProfileId,
        totalSites: 0,
        sitesScanned: 0,
        violationsFound: 0,
        status: 'RUNNING',
        startedAt: new Date(),
        errorCount: 0
      }

      this.activeSessions.set(sessionId, session)

      console.log(`Sessão de scan iniciada: ${sessionId}`)
      return sessionId

    } catch (error) {
      console.error('Erro ao iniciar sessão:', error)
      throw error
    }
  }

  /**
   * Atualizar sessão existente
   */
  async updateSession(sessionId: string, updates: Partial<ScanSession>): Promise<void> {
    try {
      // Atualizar sessão em memória
      const session = this.activeSessions.get(sessionId)
      if (session) {
        Object.assign(session, updates)
      }

      // Preparar dados para o banco
      const dbData: any = {}
      
      if (updates.status) dbData.status = updates.status
      if (updates.totalSites !== undefined) dbData.totalSites = updates.totalSites
      if (updates.sitesScanned !== undefined) dbData.sitesScanned = updates.sitesScanned
      if (updates.violationsFound !== undefined) dbData.violationsFound = updates.violationsFound
      if (updates.errorCount !== undefined) dbData.errorCount = updates.errorCount
      if (updates.currentSite) dbData.currentSite = updates.currentSite
      if (updates.lastError) dbData.lastError = updates.lastError
      if (updates.estimatedCompletion) dbData.estimatedCompletion = updates.estimatedCompletion

      // Atualizar no banco
      if (Object.keys(dbData).length > 0) {
        await prisma.scanSession.update({
          where: { id: sessionId },
          data: {
            ...dbData,
            updatedAt: new Date()
          }
        })
      }

    } catch (error) {
      console.error(`Erro ao atualizar sessão ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Obter sessão por ID
   */
  async getSession(sessionId: string): Promise<ScanSession | null> {
    try {
      // Tentar buscar em memória primeiro
      const memorySession = this.activeSessions.get(sessionId)
      if (memorySession) {
        return memorySession
      }

      // Buscar no banco
      const dbSession = await prisma.scanSession.findUnique({
        where: { id: sessionId }
      })

      if (!dbSession) return null

      // Converter para formato da aplicação
      const session: ScanSession = {
        sessionId: dbSession.id,
        userId: dbSession.userId,
        brandProfileId: dbSession.brandProfileId,
        totalSites: dbSession.totalSites,
        sitesScanned: dbSession.sitesScanned,
        violationsFound: dbSession.violationsFound,
        status: dbSession.status as any,
        startedAt: dbSession.startedAt,
        estimatedCompletion: dbSession.estimatedCompletion || undefined,
        currentSite: dbSession.currentSite || undefined,
        errorCount: dbSession.errorCount,
        lastError: dbSession.lastError || undefined
      }

      return session

    } catch (error) {
      console.error(`Erro ao buscar sessão ${sessionId}:`, error)
      return null
    }
  }

  /**
   * Listar sessões do usuário
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<ScanSession[]> {
    try {
      const dbSessions = await prisma.scanSession.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: limit
      })

      return dbSessions.map(dbSession => ({
        sessionId: dbSession.id,
        userId: dbSession.userId,
        brandProfileId: dbSession.brandProfileId,
        totalSites: dbSession.totalSites,
        sitesScanned: dbSession.sitesScanned,
        violationsFound: dbSession.violationsFound,
        status: dbSession.status as any,
        startedAt: dbSession.startedAt,
        estimatedCompletion: dbSession.estimatedCompletion || undefined,
        currentSite: dbSession.currentSite || undefined,
        errorCount: dbSession.errorCount,
        lastError: dbSession.lastError || undefined
      }))

    } catch (error) {
      console.error(`Erro ao listar sessões do usuário ${userId}:`, error)
      return []
    }
  }

  /**
   * Pausar sessão
   */
  async pauseSession(sessionId: string): Promise<void> {
    try {
      await this.updateSession(sessionId, { status: 'PAUSED' })
      
      await this.emitEvent({
        type: 'session_paused',
        sessionId,
        timestamp: new Date(),
        data: {}
      })

      console.log(`Sessão pausada: ${sessionId}`)

    } catch (error) {
      console.error(`Erro ao pausar sessão ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Retomar sessão
   */
  async resumeSession(sessionId: string): Promise<void> {
    try {
      await this.updateSession(sessionId, { status: 'RUNNING' })
      
      await this.emitEvent({
        type: 'session_resumed',
        sessionId,
        timestamp: new Date(),
        data: {}
      })

      console.log(`Sessão retomada: ${sessionId}`)

    } catch (error) {
      console.error(`Erro ao retomar sessão ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Finalizar sessão com relatório
   */
  async completeSession(sessionId: string, report: ScanReport): Promise<void> {
    try {
      const completedAt = new Date()

      // Atualizar status da sessão
      await this.updateSession(sessionId, { 
        status: 'COMPLETED',
        violationsFound: report.violationsFound 
      })

      // Salvar relatório
      await prisma.scanReport.create({
        data: {
          sessionId,
          totalSites: report.totalSites,
          sitesScanned: report.sitesScanned,
          violationsFound: report.violationsFound,
          errorCount: report.errorCount,
          duration: report.duration,
          averageTimePerSite: report.averageTimePerSite,
          violationsByRisk: report.violationsByRisk,
          topViolationSites: report.topViolationSites,
          errors: report.errors,
          generatedAt: new Date()
        }
      })

      // Marcar sessão como finalizada no banco
      await prisma.scanSession.update({
        where: { id: sessionId },
        data: { 
          status: 'COMPLETED', 
          completedAt 
        }
      })

      // Remover da memória
      this.activeSessions.delete(sessionId)

      await this.emitEvent({
        type: 'session_completed',
        sessionId,
        timestamp: new Date(),
        data: {
          report: {
            violationsFound: report.violationsFound,
            duration: report.duration,
            sitesScanned: report.sitesScanned
          }
        }
      })

      console.log(`Sessão finalizada: ${sessionId}`)

    } catch (error) {
      console.error(`Erro ao finalizar sessão ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Marcar sessão como erro
   */
  async errorSession(sessionId: string, error: string): Promise<void> {
    try {
      await this.updateSession(sessionId, { 
        status: 'ERROR',
        lastError: error 
      })

      await this.emitEvent({
        type: 'session_error',
        sessionId,
        timestamp: new Date(),
        data: { error }
      })

      // Remover da memória
      this.activeSessions.delete(sessionId)

      console.log(`Sessão marcada como erro: ${sessionId} - ${error}`)

    } catch (dbError) {
      console.error(`Erro ao marcar sessão como erro ${sessionId}:`, dbError)
      throw dbError
    }
  }

  /**
   * Emitir atualização de progresso
   */
  async emitProgressUpdate(sessionId: string, session: ScanSession): Promise<void> {
    try {
      const progressData = {
        sessionId,
        totalSites: session.totalSites,
        sitesScanned: session.sitesScanned,
        violationsFound: session.violationsFound,
        errorCount: session.errorCount,
        currentSite: session.currentSite,
        estimatedCompletion: session.estimatedCompletion,
        progress: session.totalSites > 0 ? (session.sitesScanned / session.totalSites) * 100 : 0
      }

      // Emitir evento para WebSocket/Server-Sent Events
      await this.emitEvent({
        type: 'site_scanning',
        sessionId,
        timestamp: new Date(),
        data: progressData
      })

      // Salvar progresso no banco para persistência
      await this.saveProgressSnapshot(sessionId, progressData)

    } catch (error) {
      console.error(`Erro ao emitir progresso ${sessionId}:`, error)
    }
  }

  /**
   * Salvar snapshot do progresso
   */
  private async saveProgressSnapshot(sessionId: string, progressData: any): Promise<void> {
    try {
      await prisma.sessionProgress.upsert({
        where: { sessionId },
        update: {
          ...progressData,
          updatedAt: new Date()
        },
        create: {
          sessionId,
          ...progressData,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
    } catch (error) {
      console.warn(`Erro ao salvar snapshot de progresso: ${error}`)
    }
  }

  /**
   * Emitir evento do agente
   */
  async emitEvent(event: AgentEvent): Promise<void> {
    try {
      // Salvar evento no banco para auditoria
      await prisma.agentEvent.create({
        data: {
          type: event.type,
          sessionId: event.sessionId,
          timestamp: event.timestamp,
          data: event.data
        }
      })

      // Emitir para handlers registrados
      const handlers = this.eventHandlers.get(event.sessionId) || []
      handlers.forEach(handler => {
        try {
          handler(event)
        } catch (error) {
          console.error('Erro no handler de evento:', error)
        }
      })

      // Emitir para WebSocket se disponível
      await this.broadcastEvent(event)

    } catch (error) {
      console.error('Erro ao emitir evento:', error)
    }
  }

  /**
   * Broadcast evento via WebSocket
   */
  private async broadcastEvent(event: AgentEvent): Promise<void> {
    // TODO: Implementar integração com WebSocket
    // Por enquanto, apenas log
    console.log(`[${event.type}] ${event.sessionId}:`, event.data)
  }

  /**
   * Registrar handler de eventos
   */
  onEvent(sessionId: string, handler: Function): void {
    const handlers = this.eventHandlers.get(sessionId) || []
    handlers.push(handler)
    this.eventHandlers.set(sessionId, handlers)
  }

  /**
   * Remover handlers de eventos
   */
  removeEventHandlers(sessionId: string): void {
    this.eventHandlers.delete(sessionId)
  }

  /**
   * Obter estatísticas do sistema
   */
  async getSystemStats(): Promise<{
    activeSessions: number
    totalSessions: number
    completedToday: number
    violationsFoundToday: number
  }> {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [activeSessions, totalSessions, completedToday, violationsToday] = await Promise.all([
        prisma.scanSession.count({
          where: { status: { in: ['RUNNING', 'PAUSED'] } }
        }),
        prisma.scanSession.count(),
        prisma.scanSession.count({
          where: {
            status: 'COMPLETED',
            completedAt: { gte: today }
          }
        }),
        prisma.violationHistory.count({
          where: {
            detectedAt: { gte: today }
          }
        })
      ])

      return {
        activeSessions,
        totalSessions,
        completedToday,
        violationsFoundToday: violationsToday
      }

    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
      return {
        activeSessions: 0,
        totalSessions: 0,
        completedToday: 0,
        violationsFoundToday: 0
      }
    }
  }

  /**
   * Limpar sessões antigas
   */
  async cleanupOldSessions(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const deleted = await prisma.scanSession.deleteMany({
        where: {
          startedAt: { lt: cutoffDate },
          status: { in: ['COMPLETED', 'ERROR'] }
        }
      })

      console.log(`Limpeza realizada: ${deleted.count} sessões antigas removidas`)
      return deleted.count

    } catch (error) {
      console.error('Erro na limpeza de sessões:', error)
      return 0
    }
  }

  /**
   * Gerar ID único para sessão
   */
  private generateSessionId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substr(2, 9)
    return `scan_${timestamp}_${random}`
  }

  /**
   * Obter relatório de sessão
   */
  async getSessionReport(sessionId: string): Promise<ScanReport | null> {
    try {
      const report = await prisma.scanReport.findUnique({
        where: { sessionId }
      })

      if (!report) return null

      return {
        sessionId: report.sessionId,
        totalSites: report.totalSites,
        sitesScanned: report.sitesScanned,
        violationsFound: report.violationsFound,
        errorCount: report.errorCount,
        duration: report.duration,
        averageTimePerSite: report.averageTimePerSite,
        violationsByRisk: report.violationsByRisk as Record<string, number>,
        topViolationSites: report.topViolationSites as Array<{
          domain: string
          violations: number
          highestRisk: string
        }>,
        errors: report.errors as Array<{
          site: string
          error: string
          timestamp: Date
        }>
      }

    } catch (error) {
      console.error(`Erro ao buscar relatório ${sessionId}:`, error)
      return null
    }
  }

  /**
   * Cancelar sessão ativa
   */
  async cancelSession(sessionId: string): Promise<void> {
    try {
      await this.updateSession(sessionId, { status: 'ERROR', lastError: 'Cancelado pelo usuário' })
      this.activeSessions.delete(sessionId)
      this.removeEventHandlers(sessionId)

      await this.emitEvent({
        type: 'session_error',
        sessionId,
        timestamp: new Date(),
        data: { error: 'Sessão cancelada pelo usuário' }
      })

      console.log(`Sessão cancelada: ${sessionId}`)

    } catch (error) {
      console.error(`Erro ao cancelar sessão ${sessionId}:`, error)
      throw error
    }
  }
}