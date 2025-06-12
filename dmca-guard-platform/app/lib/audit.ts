
import { prisma } from './db'

export async function createAuditLog(
  userId: string | null,
  action: string,
  resource?: string,
  details?: any,
  request?: {
    ip?: string
    userAgent?: string
  }
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        details,
        ipAddress: request?.ip,
        userAgent: request?.userAgent
      }
    })
  } catch (error) {
    console.error('Erro ao criar log de auditoria:', error)
  }
}

export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return 'unknown'
}
