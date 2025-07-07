// lib/auth-helpers.ts
import { prisma } from './prisma'
import { PlanType } from '@prisma/client'

/**
 * Verifica o estado de abuso de um usuário
 */
export async function checkAbuseState(userId: string): Promise<string> {
  const abuseScore = await prisma.abuseScore.findUnique({
    where: { userId }
  })
  
  return abuseScore?.state || 'CLEAN'
}

/**
 * Verifica se o usuário pode realizar uma ação baseado nos limites do plano
 */
export async function checkPlanLimit(
  userId: string, 
  action: 'BRAND_PROFILE_CREATE' | 'KEYWORD_CREATE' | 'SCAN_REQUEST'
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      brandProfiles: true,
      keywordSearches: true,
      monitoringSessions: {
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // última hora
          }
        }
      }
    }
  })

  if (!user) return false

  const limits = getPlanLimits(user.planType)

  switch (action) {
    case 'BRAND_PROFILE_CREATE':
      return user.brandProfiles.length < limits.brandProfiles
    
    case 'KEYWORD_CREATE':
      // Contar keywords criadas na última hora
      const recentKeywords = user.keywordSearches.filter(
        k => k.createdAt > new Date(Date.now() - 60 * 60 * 1000)
      )
      return recentKeywords.length < limits.keywordsPerHour
    
    case 'SCAN_REQUEST':
      return user.monitoringSessions.length < limits.scansPerHour
    
    default:
      return false
  }
}

/**
 * Retorna os limites por tipo de plano
 */
function getPlanLimits(planType: PlanType) {
  const limits = {
    FREE: {
      brandProfiles: 1,
      keywordsPerHour: 50,
      scansPerHour: 5
    },
    BASIC: {
      brandProfiles: 3,
      keywordsPerHour: 200,
      scansPerHour: 20
    },
    PREMIUM: {
      brandProfiles: 10,
      keywordsPerHour: 1000,
      scansPerHour: 100
    },
    ENTERPRISE: {
      brandProfiles: 999999, // Praticamente ilimitado
      keywordsPerHour: 5000,
      scansPerHour: 500
    },
    SUPER_USER: {
      brandProfiles: 999999,
      keywordsPerHour: 999999,
      scansPerHour: 999999
    }
  }

  return limits[planType]
}