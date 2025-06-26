import { PrismaClient } from '@prisma/client'
import { EventEmitter } from 'events'

const prisma = new PrismaClient()

// Interfaces para métricas
interface AgentMetric {
  id: string
  agentType: 'known-sites' | 'web-search' | 'social-media'
  metricType: 'performance' | 'accuracy' | 'usage' | 'error'
  name: string
  value: number
  unit: string
  timestamp: Date
  sessionId?: string
  userId?: string
  metadata?: Record<string, any>
}

interface PerformanceMetrics {
  scanDuration: number
  sitesProcessed: number
  averageTimePerSite: number
  throughput: number // sites por minuto
  successRate: number
  errorRate: number
  violationRate: number
}

interface AccuracyMetrics {
  truePositives: number
  falsePositives: number
  trueNegatives: number
  falseNegatives: number
  precision: number
  recall: number
  f1Score: number
  confidence: number
}

interface UsageMetrics {
  totalScans: number
  totalUsers: number
  totalViolations: number
  averageSessionDuration: number
  peakConcurrency: number
  resourceUtilization: number
}

interface ErrorMetrics {
  totalErrors: number
  errorsByType: Record<string, number>
  errorRate: number
  recoveryTime: number
  criticalErrors: number
}

export class AgentMetricsCollector extends EventEmitter {
  private activeMetrics = new Map<string, any>()
  private bufferSize: number
  private flushInterval: number
  private metricsBuffer: AgentMetric[] = []
  private flushTimer?: NodeJS.Timeout

  constructor(options: {
    bufferSize?: number
    flushInterval?: number // em ms
  } = {}) {
    super()
    this.bufferSize = options.bufferSize || 100
    this.flushInterval = options.flushInterval || 30000 // 30 segundos
    
    this.startPeriodicFlush()
  }

  /**
   * Coletar métricas de performance
   */
  async collectPerformanceMetrics(
    sessionId: string,
    userId: string,
    metrics: PerformanceMetrics
  ): Promise<void> {
    const baseMetric = {
      agentType: 'known-sites' as const,
      metricType: 'performance' as const,
      sessionId,
      userId,
      timestamp: new Date()
    }

    const metricsToCollect: Omit<AgentMetric, 'id'>[] = [
      {
        ...baseMetric,
        name: 'scan_duration',
        value: metrics.scanDuration,
        unit: 'ms'
      },
      {
        ...baseMetric,
        name: 'sites_processed',
        value: metrics.sitesProcessed,
        unit: 'count'
      },
      {
        ...baseMetric,
        name: 'average_time_per_site',
        value: metrics.averageTimePerSite,
        unit: 'ms'
      },
      {
        ...baseMetric,
        name: 'throughput',
        value: metrics.throughput,
        unit: 'sites_per_minute'
      },
      {
        ...baseMetric,
        name: 'success_rate',
        value: metrics.successRate,
        unit: 'percentage'
      },
      {
        ...baseMetric,
        name: 'error_rate',
        value: metrics.errorRate,
        unit: 'percentage'
      },
      {
        ...baseMetric,
        name: 'violation_rate',
        value: metrics.violationRate,
        unit: 'percentage'
      }
    ]

    for (const metric of metricsToCollect) {
      await this.addMetric(metric)
    }

    this.emit('performance_metrics_collected', { sessionId, metrics })
  }

  /**
   * Coletar métricas de precisão
   */
  async collectAccuracyMetrics(
    sessionId: string,
    userId: string,
    metrics: AccuracyMetrics
  ): Promise<void> {
    const baseMetric = {
      agentType: 'known-sites' as const,
      metricType: 'accuracy' as const,
      sessionId,
      userId,
      timestamp: new Date()
    }

    const metricsToCollect: Omit<AgentMetric, 'id'>[] = [
      {
        ...baseMetric,
        name: 'precision',
        value: metrics.precision,
        unit: 'ratio'
      },
      {
        ...baseMetric,
        name: 'recall',
        value: metrics.recall,
        unit: 'ratio'
      },
      {
        ...baseMetric,
        name: 'f1_score',
        value: metrics.f1Score,
        unit: 'ratio'
      },
      {
        ...baseMetric,
        name: 'confidence',
        value: metrics.confidence,
        unit: 'percentage'
      },
      {
        ...baseMetric,
        name: 'true_positives',
        value: metrics.truePositives,
        unit: 'count'
      },
      {
        ...baseMetric,
        name: 'false_positives',
        value: metrics.falsePositives,
        unit: 'count'
      }
    ]

    for (const metric of metricsToCollect) {
      await this.addMetric(metric)
    }

    this.emit('accuracy_metrics_collected', { sessionId, metrics })
  }

  /**
   * Coletar métricas de uso
   */
  async collectUsageMetrics(metrics: UsageMetrics): Promise<void> {
    const baseMetric = {
      agentType: 'known-sites' as const,
      metricType: 'usage' as const,
      timestamp: new Date()
    }

    const metricsToCollect: Omit<AgentMetric, 'id'>[] = [
      {
        ...baseMetric,
        name: 'total_scans',
        value: metrics.totalScans,
        unit: 'count'
      },
      {
        ...baseMetric,
        name: 'total_users',
        value: metrics.totalUsers,
        unit: 'count'
      },
      {
        ...baseMetric,
        name: 'total_violations',
        value: metrics.totalViolations,
        unit: 'count'
      },
      {
        ...baseMetric,
        name: 'average_session_duration',
        value: metrics.averageSessionDuration,
        unit: 'ms'
      },
      {
        ...baseMetric,
        name: 'peak_concurrency',
        value: metrics.peakConcurrency,
        unit: 'count'
      },
      {
        ...baseMetric,
        name: 'resource_utilization',
        value: metrics.resourceUtilization,
        unit: 'percentage'
      }
    ]

    for (const metric of metricsToCollect) {
      await this.addMetric(metric)
    }

    this.emit('usage_metrics_collected', { metrics })
  }

  /**
   * Coletar métricas de erro
   */
  async collectErrorMetrics(
    sessionId: string,
    userId: string,
    metrics: ErrorMetrics
  ): Promise<void> {
    const baseMetric = {
      agentType: 'known-sites' as const,
      metricType: 'error' as const,
      sessionId,
      userId,
      timestamp: new Date()
    }

    const metricsToCollect: Omit<AgentMetric, 'id'>[] = [
      {
        ...baseMetric,
        name: 'total_errors',
        value: metrics.totalErrors,
        unit: 'count'
      },
      {
        ...baseMetric,
        name: 'error_rate',
        value: metrics.errorRate,
        unit: 'percentage'
      },
      {
        ...baseMetric,
        name: 'recovery_time',
        value: metrics.recoveryTime,
        unit: 'ms'
      },
      {
        ...baseMetric,
        name: 'critical_errors',
        value: metrics.criticalErrors,
        unit: 'count'
      }
    ]

    // Adicionar métricas específicas por tipo de erro
    for (const [errorType, count] of Object.entries(metrics.errorsByType)) {
      metricsToCollect.push({
        ...baseMetric,
        name: `error_${errorType}`,
        value: count,
        unit: 'count',
        metadata: { errorType }
      })
    }

    for (const metric of metricsToCollect) {
      await this.addMetric(metric)
    }

    this.emit('error_metrics_collected', { sessionId, metrics })
  }

  /**
   * Registrar evento de métrica customizada
   */
  async recordCustomMetric(
    name: string,
    value: number,
    unit: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.addMetric({
      agentType: 'known-sites',
      metricType: 'performance',
      name,
      value,
      unit,
      timestamp: new Date(),
      metadata
    })
  }

  /**
   * Calcular métricas agregadas por período
   */
  async getAggregatedMetrics(
    period: 'hour' | 'day' | 'week' | 'month',
    metricName?: string
  ): Promise<Array<{
    period: string
    average: number
    min: number
    max: number
    count: number
    sum: number
  }>> {
    const periodFormats = {
      hour: "DATE_TRUNC('hour', timestamp)",
      day: "DATE_TRUNC('day', timestamp)",
      week: "DATE_TRUNC('week', timestamp)",
      month: "DATE_TRUNC('month', timestamp)"
    }

    const query = `
      SELECT 
        ${periodFormats[period]} as period,
        AVG(value) as average,
        MIN(value) as min,
        MAX(value) as max,
        COUNT(*) as count,
        SUM(value) as sum
      FROM agent_metrics 
      WHERE 1=1
      ${metricName ? `AND name = '${metricName}'` : ''}
      GROUP BY ${periodFormats[period]}
      ORDER BY period DESC
      LIMIT 100
    `

    try {
      const result = await prisma.$queryRawUnsafe(query)
      return result as any[]
    } catch (error) {
      console.error('Erro ao buscar métricas agregadas:', error)
      return []
    }
  }

  /**
   * Obter métricas em tempo real
   */
  async getRealTimeMetrics(): Promise<{
    activeSessions: number
    currentThroughput: number
    averageResponseTime: number
    errorRate: number
    violationsPerHour: number
  }> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    try {
      const [
        activeSessions,
        throughputMetrics,
        responseTimeMetrics,
        errorMetrics,
        violationCount
      ] = await Promise.all([
        // Sessões ativas
        prisma.scanSession.count({
          where: { status: { in: ['RUNNING', 'PAUSED'] } }
        }),

        // Throughput atual
        prisma.agentMetric.findMany({
          where: {
            name: 'throughput',
            timestamp: { gte: oneHourAgo }
          },
          select: { value: true }
        }),

        // Tempo de resposta médio
        prisma.agentMetric.findMany({
          where: {
            name: 'average_time_per_site',
            timestamp: { gte: oneHourAgo }
          },
          select: { value: true }
        }),

        // Taxa de erro
        prisma.agentMetric.findMany({
          where: {
            name: 'error_rate',
            timestamp: { gte: oneHourAgo }
          },
          select: { value: true }
        }),

        // Violações na última hora
        prisma.violationHistory.count({
          where: {
            detectedAt: { gte: oneHourAgo }
          }
        })
      ])

      const avgThroughput = throughputMetrics.length > 0 
        ? throughputMetrics.reduce((sum, m) => sum + m.value, 0) / throughputMetrics.length 
        : 0

      const avgResponseTime = responseTimeMetrics.length > 0
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
        : 0

      const avgErrorRate = errorMetrics.length > 0
        ? errorMetrics.reduce((sum, m) => sum + m.value, 0) / errorMetrics.length
        : 0

      return {
        activeSessions,
        currentThroughput: Math.round(avgThroughput),
        averageResponseTime: Math.round(avgResponseTime),
        errorRate: Math.round(avgErrorRate * 100) / 100,
        violationsPerHour: violationCount
      }

    } catch (error) {
      console.error('Erro ao obter métricas em tempo real:', error)
      return {
        activeSessions: 0,
        currentThroughput: 0,
        averageResponseTime: 0,
        errorRate: 0,
        violationsPerHour: 0
      }
    }
  }

  /**
   * Gerar relatório de performance
   */
  async generatePerformanceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: {
      totalScans: number
      averageDuration: number
      totalViolations: number
      overallSuccessRate: number
    }
    trends: {
      throughput: Array<{ date: string; value: number }>
      errorRate: Array<{ date: string; value: number }>
      violationRate: Array<{ date: string; value: number }>
    }
    topErrors: Array<{ type: string; count: number; percentage: number }>
  }> {
    try {
      // Resumo geral
      const [scans, violations, metrics] = await Promise.all([
        prisma.scanSession.count({
          where: {
            startedAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.violationHistory.count({
          where: {
            detectedAt: { gte: startDate, lte: endDate }
          }
        }),
        prisma.agentMetric.findMany({
          where: {
            timestamp: { gte: startDate, lte: endDate },
            name: { in: ['scan_duration', 'success_rate'] }
          }
        })
      ])

      const durationMetrics = metrics.filter(m => m.name === 'scan_duration')
      const successMetrics = metrics.filter(m => m.name === 'success_rate')

      const averageDuration = durationMetrics.length > 0
        ? durationMetrics.reduce((sum, m) => sum + m.value, 0) / durationMetrics.length
        : 0

      const overallSuccessRate = successMetrics.length > 0
        ? successMetrics.reduce((sum, m) => sum + m.value, 0) / successMetrics.length
        : 0

      // Tendências diárias
      const dailyThroughput = await this.getAggregatedMetrics('day', 'throughput')
      const dailyErrorRate = await this.getAggregatedMetrics('day', 'error_rate')
      const dailyViolationRate = await this.getAggregatedMetrics('day', 'violation_rate')

      // Top erros
      const errorMetrics = await prisma.agentMetric.findMany({
        where: {
          timestamp: { gte: startDate, lte: endDate },
          name: { startsWith: 'error_' }
        }
      })

      const errorCounts = new Map<string, number>()
      errorMetrics.forEach(metric => {
        const errorType = metric.name.replace('error_', '')
        errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + metric.value)
      })

      const totalErrors = Array.from(errorCounts.values()).reduce((sum, count) => sum + count, 0)
      const topErrors = Array.from(errorCounts.entries())
        .map(([type, count]) => ({
          type,
          count,
          percentage: totalErrors > 0 ? (count / totalErrors) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        summary: {
          totalScans: scans,
          averageDuration: Math.round(averageDuration),
          totalViolations: violations,
          overallSuccessRate: Math.round(overallSuccessRate * 100) / 100
        },
        trends: {
          throughput: dailyThroughput.map(d => ({
            date: d.period,
            value: Math.round(d.average)
          })),
          errorRate: dailyErrorRate.map(d => ({
            date: d.period,
            value: Math.round(d.average * 100) / 100
          })),
          violationRate: dailyViolationRate.map(d => ({
            date: d.period,
            value: Math.round(d.average * 100) / 100
          }))
        },
        topErrors
      }

    } catch (error) {
      console.error('Erro ao gerar relatório de performance:', error)
      throw error
    }
  }

  /**
   * Adicionar métrica ao buffer
   */
  private async addMetric(metric: Omit<AgentMetric, 'id'>): Promise<void> {
    const fullMetric: AgentMetric = {
      ...metric,
      id: this.generateMetricId()
    }

    this.metricsBuffer.push(fullMetric)

    // Flush se buffer estiver cheio
    if (this.metricsBuffer.length >= this.bufferSize) {
      await this.flushMetrics()
    }
  }

  /**
   * Flush de métricas para o banco
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return

    const metricsToFlush = [...this.metricsBuffer]
    this.metricsBuffer = []

    try {
      await prisma.agentMetric.createMany({
        data: metricsToFlush.map(metric => ({
          id: metric.id,
          agentType: metric.agentType,
          metricType: metric.metricType,
          name: metric.name,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp,
          sessionId: metric.sessionId,
          userId: metric.userId,
          metadata: metric.metadata || {}
        }))
      })

      this.emit('metrics_flushed', { count: metricsToFlush.length })

    } catch (error) {
      console.error('Erro ao salvar métricas:', error)
      // Recolocar métricas no buffer em caso de erro
      this.metricsBuffer.unshift(...metricsToFlush)
    }
  }

  /**
   * Iniciar flush periódico
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushMetrics()
    }, this.flushInterval)
  }

  /**
   * Parar coleta de métricas
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    await this.flushMetrics() // Flush final
  }

  /**
   * Gerar ID único para métrica
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// Instância singleton do coletor de métricas
export const agentMetrics = new AgentMetricsCollector({
  bufferSize: 50,
  flushInterval: 30000 // 30 segundos
})

// Middleware para automaticamente coletar métricas de sessões
export function withMetricsCollection<T extends (...args: any[]) => any>(
  fn: T,
  metricName: string
): T {
  return (async (...args: any[]) => {
    const startTime = Date.now()
    let error: Error | null = null

    try {
      const result = await fn(...args)
      return result
    } catch (err) {
      error = err as Error
      throw err
    } finally {
      const duration = Date.now() - startTime
      
      await agentMetrics.recordCustomMetric(
        `${metricName}_duration`,
        duration,
        'ms',
        {
          success: !error,
          error: error?.message
        }
      )

      if (error) {
        await agentMetrics.recordCustomMetric(
          `${metricName}_error`,
          1,
          'count',
          {
            errorType: error.constructor.name,
            errorMessage: error.message
          }
        )
      }
    }
  }) as T
}

// Função utilitária para calcular métricas de precisão
export function calculateAccuracyMetrics(
  truePositives: number,
  falsePositives: number,
  trueNegatives: number,
  falseNegatives: number
): AccuracyMetrics {
  const precision = truePositives + falsePositives > 0 
    ? truePositives / (truePositives + falsePositives) 
    : 0

  const recall = truePositives + falseNegatives > 0
    ? truePositives / (truePositives + falseNegatives)
    : 0

  const f1Score = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0

  const accuracy = truePositives + trueNegatives + falsePositives + falseNegatives > 0
    ? (truePositives + trueNegatives) / (truePositives + trueNegatives + falsePositives + falseNegatives)
    : 0

  return {
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    precision,
    recall,
    f1Score,
    confidence: accuracy * 100
  }
}