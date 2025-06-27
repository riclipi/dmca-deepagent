import { RemovalVerificationAgent } from '../agents/RemovalVerificationAgent'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const verificationAgent = new RemovalVerificationAgent()

export class RemovalVerificationScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  /**
   * Iniciar agendamento automático
   */
  start(intervalHours: number = 24) {
    if (this.isRunning) {
      console.log('⚠️ Scheduler já está em execução')
      return
    }

    console.log(`🚀 Iniciando scheduler de verificação de remoção (intervalo: ${intervalHours}h)`)
    
    this.isRunning = true
    
    // Executar imediatamente
    this.executeVerifications()
    
    // Agendar execuções futuras
    this.intervalId = setInterval(() => {
      this.executeVerifications()
    }, intervalHours * 60 * 60 * 1000)
  }

  /**
   * Parar agendamento
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('🛑 Scheduler de verificação de remoção parado')
  }

  /**
   * Executar verificações agendadas
   */
  private async executeVerifications() {
    console.log('🔄 Executando verificações automáticas de remoção...')
    
    try {
      const startTime = Date.now()
      
      // Executar verificações via RemovalVerificationAgent
      await verificationAgent.scheduleRecurringVerifications()
      
      const duration = Date.now() - startTime
      console.log(`✅ Verificações concluídas em ${duration}ms`)
      
      // Registrar métricas
      await this.logSchedulerMetrics(duration)
      
    } catch (error) {
      console.error('❌ Erro durante verificações automáticas:', error)
      
      // Registrar erro no banco
      await this.logSchedulerError(error as Error)
    }
  }

  /**
   * Registrar métricas do scheduler
   */
  private async logSchedulerMetrics(duration: number) {
    try {
      await prisma.agentMetric.create({
        data: {
          agentType: 'REMOVAL_VERIFIER',
          metricType: 'PERFORMANCE',
          name: 'verification_cycle_duration',
          value: duration,
          unit: 'milliseconds',
          timestamp: new Date(),
          metadata: {
            source: 'removal_verification_scheduler',
            type: 'automatic'
          }
        }
      })
    } catch (error) {
      console.error('Erro ao registrar métricas do scheduler:', error)
    }
  }

  /**
   * Registrar erros do scheduler
   */
  private async logSchedulerError(error: Error) {
    try {
      await prisma.agentEvent.create({
        data: {
          type: 'SCHEDULER_ERROR',
          sessionId: 'removal_verification_scheduler',
          timestamp: new Date(),
          data: {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        }
      })
    } catch (logError) {
      console.error('Erro ao registrar erro do scheduler:', logError)
    }
  }

  /**
   * Obter status do scheduler
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalId: this.intervalId !== null,
      uptime: this.isRunning ? Date.now() : 0
    }
  }

  /**
   * Executar verificação manual para takedown específico
   */
  async executeManualVerification(takedownRequestId: string) {
    console.log(`🔍 Executando verificação manual para takedown: ${takedownRequestId}`)
    
    try {
      const sessionId = await verificationAgent.initiateRemovalVerification(takedownRequestId)
      
      console.log(`✅ Verificação manual iniciada - Session ID: ${sessionId}`)
      return sessionId
      
    } catch (error) {
      console.error('❌ Erro na verificação manual:', error)
      throw error
    }
  }

  /**
   * Gerar relatório de atividade do scheduler
   */
  async generateActivityReport(hours: number = 24) {
    try {
      const since = new Date(Date.now() - (hours * 60 * 60 * 1000))
      
      // Buscar métricas do scheduler
      const metrics = await prisma.agentMetric.findMany({
        where: {
          agentType: 'REMOVAL_VERIFIER',
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' }
      })

      // Buscar eventos de erro
      const errors = await prisma.agentEvent.findMany({
        where: {
          type: 'SCHEDULER_ERROR',
          sessionId: 'removal_verification_scheduler',
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' }
      })

      // Buscar provas de remoção criadas
      const proofs = await prisma.removalProof.findMany({
        where: {
          createdAt: { gte: since }
        },
        include: {
          takedownRequest: {
            include: {
              user: { select: { id: true, email: true } }
            }
          }
        }
      })

      // Calcular estatísticas
      const totalCycles = metrics.filter(m => m.name === 'verification_cycle_duration').length
      const avgDuration = metrics
        .filter(m => m.name === 'verification_cycle_duration')
        .reduce((sum, m) => sum + m.value, 0) / totalCycles || 0

      const verificationsByStatus = proofs.reduce((acc, proof) => {
        acc[proof.status] = (acc[proof.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        period: {
          hours,
          since: since.toISOString(),
          until: new Date().toISOString()
        },
        scheduler: {
          totalCycles,
          avgDurationMs: Math.round(avgDuration),
          errors: errors.length,
          uptime: this.isRunning ? 'RUNNING' : 'STOPPED'
        },
        verifications: {
          total: proofs.length,
          byStatus: verificationsByStatus,
          successful: (verificationsByStatus['CONTENT_REMOVED'] || 0) + (verificationsByStatus['CONTENT_BLOCKED'] || 0),
          failed: verificationsByStatus['CONTENT_STILL_ONLINE'] || 0,
          pending: verificationsByStatus['REQUIRES_MANUAL_REVIEW'] || 0
        },
        recentErrors: errors.map(error => ({
          timestamp: error.timestamp,
          message: error.data
        }))
      }

    } catch (error) {
      console.error('Erro ao gerar relatório de atividade:', error)
      throw error
    }
  }
}

// Instância singleton do scheduler
let schedulerInstance: RemovalVerificationScheduler | null = null

/**
 * Obter instância do scheduler (singleton)
 */
export function getRemovalVerificationScheduler(): RemovalVerificationScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new RemovalVerificationScheduler()
  }
  return schedulerInstance
}

/**
 * Configurar e iniciar scheduler se variável de ambiente estiver definida
 */
export function initializeSchedulerFromEnv() {
  if (process.env.ENABLE_REMOVAL_VERIFICATION_SCHEDULER === 'true') {
    const intervalHours = parseInt(process.env.REMOVAL_VERIFICATION_INTERVAL_HOURS || '24')
    const scheduler = getRemovalVerificationScheduler()
    scheduler.start(intervalHours)
    
    console.log(`🚀 Scheduler de verificação de remoção iniciado automaticamente (${intervalHours}h)`)
  }
}

// Cleanup quando o processo terminar
process.on('SIGINT', () => {
  if (schedulerInstance) {
    schedulerInstance.stop()
  }
})

process.on('SIGTERM', () => {
  if (schedulerInstance) {
    schedulerInstance.stop()
  }
})
