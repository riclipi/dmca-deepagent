// lib/services/security/abuse-monitoring.service.ts
import { AbuseState, ViolationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { emitToNamespace } from '@/lib/socket-server'

interface ViolationWeight {
  type: ViolationType
  baseWeight: number
  description: string
}

interface AbuseAction {
  state: AbuseState
  actions: string[]
  notifications: string[]
}

export class AbuseMonitoringService {
  // Pesos das violações
  private static readonly VIOLATION_WEIGHTS: ViolationWeight[] = [
    {
      type: ViolationType.SPAM_KEYWORDS,
      baseWeight: 0.15,
      description: 'Criação de keywords spam'
    },
    {
      type: ViolationType.EXCESSIVE_REQUESTS,
      baseWeight: 0.1,
      description: 'Requisições excessivas'
    },
    {
      type: ViolationType.SUSPICIOUS_PATTERNS,
      baseWeight: 0.2,
      description: 'Padrões suspeitos de uso'
    },
    {
      type: ViolationType.MULTIPLE_ACCOUNTS,
      baseWeight: 0.4,
      description: 'Múltiplas contas detectadas'
    },
    {
      type: ViolationType.COMPETITOR_MONITORING,
      baseWeight: 0.3,
      description: 'Monitoramento de concorrentes'
    },
    {
      type: ViolationType.FAKE_OWNERSHIP,
      baseWeight: 0.5,
      description: 'Tentativa de validação falsa'
    },
    {
      type: ViolationType.API_ABUSE,
      baseWeight: 0.35,
      description: 'Abuso de API'
    },
    {
      type: ViolationType.SCRAPING,
      baseWeight: 0.4,
      description: 'Tentativa de scraping'
    }
  ]

  // Ações por estado
  private static readonly STATE_ACTIONS: AbuseAction[] = [
    {
      state: AbuseState.CLEAN,
      actions: [],
      notifications: []
    },
    {
      state: AbuseState.WARNING,
      actions: [
        'Notificar usuário sobre comportamento suspeito',
        'Aumentar logging de atividades',
        'Aplicar rate limits mais restritivos'
      ],
      notifications: ['USER_WARNING']
    },
    {
      state: AbuseState.HIGH_RISK,
      actions: [
        'Pausar criação de novas sessões',
        'Requerer validação adicional',
        'Limitar funcionalidades avançadas',
        'Notificar administradores'
      ],
      notifications: ['USER_RESTRICTION', 'ADMIN_ALERT']
    },
    {
      state: AbuseState.BLOCKED,
      actions: [
        'Bloquear todas as operações',
        'Pausar sessões ativas',
        'Desativar API keys',
        'Requerer revisão manual para desbloqueio'
      ],
      notifications: ['USER_BLOCKED', 'ADMIN_URGENT']
    }
  ]

  // Decay do score (redução por hora sem violações)
  private static readonly SCORE_DECAY_RATE = 0.01
  private static readonly DECAY_INTERVAL_HOURS = 1

  /**
   * Monitora e atualiza score de abuso para um usuário
   */
  async monitorUser(userId: string): Promise<void> {
    console.log(`[Abuse Monitor] Monitoring user ${userId}`)

    const abuseScore = await prisma.abuseScore.findUnique({
      where: { userId },
      include: {
        violations: {
          orderBy: { occurredAt: 'desc' },
          take: 50 // Últimas 50 violações
        }
      }
    })

    if (!abuseScore) {
      console.log(`[Abuse Monitor] No abuse score found for user ${userId}`)
      return
    }

    // Aplicar decay temporal
    const updatedScore = await this.applyTemporalDecay(abuseScore)

    // Detectar padrões suspeitos
    await this.detectSuspiciousPatterns(userId, abuseScore.violations)

    // Verificar mudança de estado
    const newState = this.calculateState(updatedScore.currentScore)
    
    if (newState !== updatedScore.state) {
      await this.handleStateChange(userId, updatedScore.state, newState)
    }
  }

  /**
   * Aplica decay temporal ao score
   */
  private async applyTemporalDecay(abuseScore: any): Promise<any> {
    const now = new Date()
    const lastViolation = abuseScore.lastViolation || abuseScore.createdAt
    const hoursSinceLastViolation = (now.getTime() - lastViolation.getTime()) / (1000 * 60 * 60)

    if (hoursSinceLastViolation < AbuseMonitoringService.DECAY_INTERVAL_HOURS) {
      return abuseScore
    }

    // Calcular decay
    const decayPeriods = Math.floor(hoursSinceLastViolation / AbuseMonitoringService.DECAY_INTERVAL_HOURS)
    const decay = decayPeriods * AbuseMonitoringService.SCORE_DECAY_RATE
    const newScore = Math.max(0, abuseScore.currentScore - decay)

    console.log(`[Abuse Monitor] Applying decay: ${decay} to user ${abuseScore.userId}`)

    // Atualizar score
    return prisma.abuseScore.update({
      where: { id: abuseScore.id },
      data: {
        currentScore: newScore,
        state: this.calculateState(newScore)
      }
    })
  }

  /**
   * Detecta padrões suspeitos nas violações
   */
  private async detectSuspiciousPatterns(userId: string, violations: any[]): Promise<void> {
    if (violations.length < 3) return

    // Padrão 1: Múltiplas violações em curto período
    const recentViolations = violations.filter(v => {
      const hoursSince = (Date.now() - new Date(v.occurredAt).getTime()) / (1000 * 60 * 60)
      return hoursSince < 1
    })

    if (recentViolations.length >= 5) {
      await this.recordViolation(
        userId,
        ViolationType.SUSPICIOUS_PATTERNS,
        0.3,
        'Múltiplas violações em curto período',
        { count: recentViolations.length, period: '1 hour' }
      )
    }

    // Padrão 2: Tentativas repetidas do mesmo tipo
    const violationCounts = violations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    for (const [type, count] of Object.entries(violationCounts)) {
      if ((count as number) >= 10) {
        await this.recordViolation(
          userId,
          ViolationType.SUSPICIOUS_PATTERNS,
          0.25,
          `Padrão repetitivo detectado: ${type}`,
          { violationType: type, count }
        )
      }
    }

    // Padrão 3: Escalação de severidade
    const severityTrend = this.calculateSeverityTrend(violations.slice(0, 10))
    if (severityTrend > 0.5) {
      await this.recordViolation(
        userId,
        ViolationType.SUSPICIOUS_PATTERNS,
        0.35,
        'Escalação de comportamento abusivo',
        { trend: severityTrend }
      )
    }
  }

  /**
   * Calcula tendência de severidade
   */
  private calculateSeverityTrend(violations: any[]): number {
    if (violations.length < 2) return 0

    let increases = 0
    for (let i = 1; i < violations.length; i++) {
      if (violations[i].severity > violations[i - 1].severity) {
        increases++
      }
    }

    return increases / (violations.length - 1)
  }

  /**
   * Registra nova violação
   */
  async recordViolation(
    userId: string,
    type: ViolationType,
    customSeverity?: number,
    description?: string,
    metadata?: any
  ): Promise<void> {
    console.log(`[Abuse Monitor] Recording violation for user ${userId}: ${type}`)

    // Obter ou criar score
    const abuseScore = await prisma.abuseScore.upsert({
      where: { userId },
      update: {},
      create: { userId }
    })

    // Calcular severidade
    const weight = AbuseMonitoringService.VIOLATION_WEIGHTS.find(w => w.type === type)
    const severity = customSeverity || weight?.baseWeight || 0.1

    // Criar violação
    await prisma.abuseViolation.create({
      data: {
        userId,
        scoreId: abuseScore.id,
        type,
        severity,
        description: description || weight?.description,
        metadata
      }
    })

    // Atualizar score
    const newScore = Math.min(1.0, abuseScore.currentScore + severity)
    const newState = this.calculateState(newScore)

    await prisma.abuseScore.update({
      where: { id: abuseScore.id },
      data: {
        currentScore: newScore,
        state: newState,
        lastViolation: new Date()
      }
    })

    // Verificar mudança de estado
    if (newState !== abuseScore.state) {
      await this.handleStateChange(userId, abuseScore.state, newState)
    }

    // Emitir evento via WebSocket
    emitToNamespace('/monitoring', 'abuse-violation', {
      userId,
      type,
      severity,
      newScore,
      newState,
      timestamp: new Date()
    })
  }

  /**
   * Calcula estado baseado no score
   */
  private calculateState(score: number): AbuseState {
    if (score >= 0.8) return AbuseState.BLOCKED
    if (score >= 0.6) return AbuseState.HIGH_RISK
    if (score >= 0.3) return AbuseState.WARNING
    return AbuseState.CLEAN
  }

  /**
   * Gerencia mudança de estado
   */
  private async handleStateChange(
    userId: string,
    oldState: AbuseState,
    newState: AbuseState
  ): Promise<void> {
    console.log(`[Abuse Monitor] State change for user ${userId}: ${oldState} -> ${newState}`)

    const stateAction = AbuseMonitoringService.STATE_ACTIONS.find(
      a => a.state === newState
    )

    if (!stateAction) return

    // Executar ações
    for (const action of stateAction.actions) {
      await this.executeAction(userId, action)
    }

    // Enviar notificações
    for (const notification of stateAction.notifications) {
      await this.sendNotification(userId, notification, {
        oldState,
        newState,
        timestamp: new Date()
      })
    }

    // Log da mudança
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'ABUSE_STATE_CHANGE',
        metadata: {
          oldState,
          newState,
          actions: stateAction.actions
        }
      }
    })
  }

  /**
   * Executa ação específica
   */
  private async executeAction(userId: string, action: string): Promise<void> {
    console.log(`[Abuse Monitor] Executing action for user ${userId}: ${action}`)

    switch (action) {
      case 'Pausar criação de novas sessões':
        // Implementar lógica de pausa
        break

      case 'Pausar sessões ativas':
        await prisma.monitoringSession.updateMany({
          where: { 
            userId, 
            status: { in: ['RUNNING'] }
          },
          data: { status: 'PAUSED' }
        })
        break

      case 'Bloquear todas as operações':
        await prisma.user.update({
          where: { id: userId },
          data: { status: 'SUSPENDED' }
        })
        break

      default:
        console.log(`[Abuse Monitor] Action not implemented: ${action}`)
    }
  }

  /**
   * Envia notificação
   */
  private async sendNotification(
    userId: string,
    type: string,
    data: any
  ): Promise<void> {
    // Criar notificação no banco
    await prisma.notification.create({
      data: {
        userId,
        type: 'ABUSE_ALERT',
        title: this.getNotificationTitle(type),
        message: this.getNotificationMessage(type, data)
      }
    })

    // Emitir via WebSocket
    emitToNamespace('/monitoring', 'notification', {
      userId,
      type,
      data,
      timestamp: new Date()
    })
  }

  /**
   * Obtém título da notificação
   */
  private getNotificationTitle(type: string): string {
    const titles: Record<string, string> = {
      USER_WARNING: 'Aviso de Comportamento Suspeito',
      USER_RESTRICTION: 'Restrições Aplicadas à Conta',
      USER_BLOCKED: 'Conta Bloqueada',
      ADMIN_ALERT: 'Alerta: Usuário de Alto Risco',
      ADMIN_URGENT: 'Urgente: Usuário Bloqueado'
    }
    return titles[type] || 'Notificação de Segurança'
  }

  /**
   * Obtém mensagem da notificação
   */
  private getNotificationMessage(type: string, data: any): string {
    const messages: Record<string, string> = {
      USER_WARNING: 'Detectamos atividades suspeitas em sua conta. Por favor, revise suas ações.',
      USER_RESTRICTION: 'Algumas funcionalidades foram temporariamente limitadas devido a atividades suspeitas.',
      USER_BLOCKED: 'Sua conta foi bloqueada devido a violações dos termos de uso. Entre em contato com o suporte.',
      ADMIN_ALERT: `Usuário mudou para estado ${data.newState}. Ação pode ser necessária.`,
      ADMIN_URGENT: 'Usuário foi bloqueado automaticamente. Revisão manual necessária.'
    }
    return messages[type] || 'Ação de segurança foi tomada em sua conta.'
  }

  /**
   * Obtém relatório de abuso para um usuário
   */
  async getUserAbuseReport(userId: string): Promise<any> {
    const abuseScore = await prisma.abuseScore.findUnique({
      where: { userId },
      include: {
        violations: {
          orderBy: { occurredAt: 'desc' },
          take: 20
        }
      }
    })

    if (!abuseScore) {
      return {
        score: 0,
        state: AbuseState.CLEAN,
        violations: [],
        riskLevel: 'LOW'
      }
    }

    // Análise de violações
    const violationsByType = abuseScore.violations.reduce((acc, v) => {
      acc[v.type] = (acc[v.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Calcular nível de risco
    const riskLevel = 
      abuseScore.currentScore >= 0.8 ? 'CRITICAL' :
      abuseScore.currentScore >= 0.6 ? 'HIGH' :
      abuseScore.currentScore >= 0.3 ? 'MEDIUM' : 'LOW'

    return {
      score: abuseScore.currentScore,
      state: abuseScore.state,
      lastViolation: abuseScore.lastViolation,
      violations: abuseScore.violations,
      violationsByType,
      riskLevel,
      recommendations: this.getRecommendations(abuseScore)
    }
  }

  /**
   * Gera recomendações baseadas no histórico
   */
  private getRecommendations(abuseScore: any): string[] {
    const recommendations: string[] = []

    if (abuseScore.state === AbuseState.BLOCKED) {
      recommendations.push('Conta bloqueada. Requer revisão manual do administrador.')
    } else if (abuseScore.state === AbuseState.HIGH_RISK) {
      recommendations.push('Monitorar de perto as atividades.')
      recommendations.push('Considerar validação adicional de identidade.')
    } else if (abuseScore.state === AbuseState.WARNING) {
      recommendations.push('Educar usuário sobre uso apropriado da plataforma.')
    }

    return recommendations
  }

  /**
   * Monitora todos os usuários periodicamente
   */
  async monitorAllUsers(): Promise<void> {
    console.log('[Abuse Monitor] Starting periodic monitoring of all users')

    const users = await prisma.user.findMany({
      where: {
        status: { not: 'SUSPENDED' },
        abuseScore: { isNot: null }
      },
      select: { id: true }
    })

    for (const user of users) {
      try {
        await this.monitorUser(user.id)
      } catch (error) {
        console.error(`[Abuse Monitor] Error monitoring user ${user.id}:`, error)
      }
    }

    console.log(`[Abuse Monitor] Monitored ${users.length} users`)
  }
}

// Export singleton instance
export const abuseMonitoringService = new AbuseMonitoringService()