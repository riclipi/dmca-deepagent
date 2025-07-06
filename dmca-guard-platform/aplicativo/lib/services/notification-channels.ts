import { Notification, User } from '@prisma/client'
import { NotificationType } from './notification.service'

export interface EmailChannel {
  send(notification: Notification & { user: User }, metadata?: Record<string, any>): Promise<void>
}

export interface WebhookChannel {
  send(notification: Notification & { user: User }, metadata?: Record<string, any>): Promise<void>
}

export interface NotificationChannel {
  email: EmailChannel
  webhook: WebhookChannel
}

/**
 * Email notification channel using Resend
 */
class ResendEmailChannel implements EmailChannel {
  async send(notification: Notification & { user: User }, metadata?: Record<string, any>): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.warn('[EmailChannel] Resend API key not configured')
      return
    }

    try {
      // Dynamic import to avoid errors if resend is not installed
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      const emailContent = this.generateEmailContent(notification, metadata)

      await resend.emails.send({
        from: 'DMCA Guard <notifications@dmcaguard.com>',
        to: notification.user.email!,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text
      })

      console.log(`[EmailChannel] Email sent to ${notification.user.email} for notification ${notification.id}`)
    } catch (error) {
      console.error('[EmailChannel] Failed to send email:', error)
      // Don't throw - email failure shouldn't break the notification flow
    }
  }

  private generateEmailContent(
    notification: Notification,
    metadata?: Record<string, any>
  ): { subject: string; html: string; text: string } {
    const baseUrl = process.env.NEXTAUTH_URL || 'https://dmcaguard.com'
    
    switch (notification.type as NotificationType) {
      case NotificationType.VIOLATION_DETECTED:
        return {
          subject: `🚨 Nova violação detectada - ${notification.title}`,
          html: `
            <h2>Nova Violação Detectada</h2>
            <p>${notification.message}</p>
            ${metadata?.url ? `<p><strong>URL:</strong> <a href="${metadata.url}">${metadata.url}</a></p>` : ''}
            ${metadata?.platform ? `<p><strong>Plataforma:</strong> ${metadata.platform}</p>` : ''}
            <p><a href="${baseUrl}/dashboard/detected-content" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Detalhes</a></p>
          `,
          text: `${notification.title}\n\n${notification.message}\n\nAcesse ${baseUrl}/dashboard/detected-content para ver detalhes.`
        }

      case NotificationType.TAKEDOWN_SUCCESS:
        return {
          subject: `✅ Conteúdo removido com sucesso - ${notification.title}`,
          html: `
            <h2>Remoção Bem-sucedida</h2>
            <p>${notification.message}</p>
            <p style="color: #10b981;">O conteúdo foi removido com sucesso!</p>
            <p><a href="${baseUrl}/dashboard/takedown-requests" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Histórico</a></p>
          `,
          text: `${notification.title}\n\n${notification.message}\n\nO conteúdo foi removido com sucesso!`
        }

      case NotificationType.TAKEDOWN_FAILED:
        return {
          subject: `❌ Falha na remoção - ${notification.title}`,
          html: `
            <h2>Falha na Remoção</h2>
            <p>${notification.message}</p>
            <p style="color: #ef4444;">A tentativa de remoção falhou. Ação manual pode ser necessária.</p>
            <p><a href="${baseUrl}/dashboard/takedown-requests" style="background: #ef4444; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Tomar Ação</a></p>
          `,
          text: `${notification.title}\n\n${notification.message}\n\nA tentativa de remoção falhou. Ação manual pode ser necessária.`
        }

      case NotificationType.SCAN_COMPLETE:
        return {
          subject: `📊 Scan concluído - ${notification.title}`,
          html: `
            <h2>Scan de Monitoramento Concluído</h2>
            <p>${notification.message}</p>
            ${metadata?.violationsFound !== undefined ? `<p><strong>Violações encontradas:</strong> ${metadata.violationsFound}</p>` : ''}
            ${metadata?.sitesScanned !== undefined ? `<p><strong>Sites verificados:</strong> ${metadata.sitesScanned}</p>` : ''}
            <p><a href="${baseUrl}/dashboard/monitoring-sessions" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Relatório</a></p>
          `,
          text: `${notification.title}\n\n${notification.message}\n\nAcesse ${baseUrl}/dashboard/monitoring-sessions para ver o relatório completo.`
        }

      case NotificationType.ABUSE_WARNING:
        return {
          subject: `⚠️ Alerta de segurança - ${notification.title}`,
          html: `
            <h2>Alerta de Segurança</h2>
            <p style="color: #f59e0b;">${notification.message}</p>
            <p>Detectamos atividade suspeita em sua conta. Por favor, revise suas ações recentes.</p>
            <p><a href="${baseUrl}/dashboard/security" style="background: #f59e0b; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Detalhes de Segurança</a></p>
          `,
          text: `${notification.title}\n\n${notification.message}\n\nDetectamos atividade suspeita em sua conta. Acesse ${baseUrl}/dashboard/security para mais detalhes.`
        }

      case NotificationType.PLAN_LIMIT_WARNING:
        return {
          subject: `📈 Limite do plano próximo - ${notification.title}`,
          html: `
            <h2>Aproximando-se do Limite do Plano</h2>
            <p>${notification.message}</p>
            ${metadata?.usage !== undefined ? `<p><strong>Uso atual:</strong> ${metadata.usage}%</p>` : ''}
            <p>Considere fazer upgrade do seu plano para continuar usando todos os recursos sem interrupções.</p>
            <p><a href="${baseUrl}/pricing" style="background: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Planos</a></p>
          `,
          text: `${notification.title}\n\n${notification.message}\n\nConsidere fazer upgrade em ${baseUrl}/pricing`
        }

      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return {
          subject: `📢 ${notification.title}`,
          html: `
            <h2>Anúncio do Sistema</h2>
            <p>${notification.message}</p>
            <p><a href="${baseUrl}/dashboard" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Acessar Dashboard</a></p>
          `,
          text: `${notification.title}\n\n${notification.message}`
        }

      default:
        return {
          subject: notification.title,
          html: `<h2>${notification.title}</h2><p>${notification.message}</p>`,
          text: `${notification.title}\n\n${notification.message}`
        }
    }
  }
}

/**
 * Webhook notification channel
 */
class WebhookNotificationChannel implements WebhookChannel {
  async send(notification: Notification & { user: User }, metadata?: Record<string, any>): Promise<void> {
    // TODO: Implement webhook URL storage per user
    const webhookUrl = metadata?.webhookUrl || process.env.DEFAULT_WEBHOOK_URL

    if (!webhookUrl) {
      console.log('[WebhookChannel] No webhook URL configured for user', notification.userId)
      return
    }

    try {
      const payload = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        userId: notification.userId,
        createdAt: notification.createdAt,
        metadata
      }

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DMCA-Guard-Event': 'notification',
          'X-DMCA-Guard-Type': notification.type
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        throw new Error(`Webhook failed with status ${response.status}`)
      }

      console.log(`[WebhookChannel] Webhook sent to ${webhookUrl} for notification ${notification.id}`)
    } catch (error) {
      console.error('[WebhookChannel] Failed to send webhook:', error)
      // Don't throw - webhook failure shouldn't break the notification flow
    }
  }
}

/**
 * Notification channels manager
 */
export const notificationChannels: NotificationChannel = {
  email: new ResendEmailChannel(),
  webhook: new WebhookNotificationChannel()
}