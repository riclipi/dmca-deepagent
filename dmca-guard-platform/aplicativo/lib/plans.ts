
export const plans = {
  FREE: {
    name: 'Gratuito',
    price: 0,
    currency: 'BRL',
    interval: 'month',
    features: [
      'Até 5 perfis de marca',
      'Monitoramento básico (1x por semana)',
      'Até 10 takedowns por mês',
      'Suporte por email'
    ],
    limits: {
      brandProfiles: 5,
      monitoringSessions: 3,
      takedownsPerMonth: 10,
      scanFrequency: 1 // 1 semana em horas
    }
  },
  BASIC: {
    name: 'Básico',
    price: 49.90,
    currency: 'BRL',
    interval: 'month',
    features: [
      'Até 15 perfis de marca',
      'Monitoramento diário',
      'Até 50 takedowns por mês',
      'Relatórios básicos',
      'Suporte prioritário'
    ],
    limits: {
      brandProfiles: 15,
      monitoringSessions: 10,
      takedownsPerMonth: 50,
      scanFrequency: 24 // 1 dia em horas
    }
  },
  PREMIUM: {
    name: 'Premium',
    price: 99.90,
    currency: 'BRL',
    interval: 'month',
    features: [
      'Perfis de marca ilimitados',
      'Monitoramento em tempo real',
      'Takedowns ilimitados',
      'Relatórios avançados',
      'API de integração',
      'Suporte 24/7'
    ],
    limits: {
      brandProfiles: -1, // ilimitado
      monitoringSessions: -1,
      takedownsPerMonth: -1,
      scanFrequency: 1 // 1 hora
    }
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 299.90,
    currency: 'BRL',
    interval: 'month',
    features: [
      'Tudo do Premium',
      'Gerenciamento de equipe',
      'Whitelabel',
      'Integração personalizada',
      'Gerente de conta dedicado'
    ],
    limits: {
      brandProfiles: -1,
      monitoringSessions: -1,
      takedownsPerMonth: -1,
      scanFrequency: 1
    }
  },
  SUPER_USER: {
    name: 'Super User',
    price: 0,
    currency: 'BRL',
    interval: 'month',
    features: [
      'Acesso ilimitado total',
      'Bypass de todos os limites',
      'Acesso administrativo'
    ],
    limits: {
      brandProfiles: -1,
      monitoringSessions: -1,
      takedownsPerMonth: -1,
      scanFrequency: 1
    }
  }
}

export function getPlanLimits(planType: string) {
  return plans[planType as keyof typeof plans]?.limits || plans.FREE.limits
}

export function canPerformAction(
  planType: string,
  action: string,
  currentUsage: number,
  userEmail?: string
): boolean {
  // Super User bypass
  if (planType === 'SUPER_USER' || userEmail === 'larys.cubas@hotmail.com') {
    return true
  }
  
  const limits = getPlanLimits(planType)
  
  switch (action) {
    case 'createBrandProfile':
      return limits.brandProfiles === -1 || currentUsage < limits.brandProfiles
    case 'createMonitoringSession':
      return limits.monitoringSessions === -1 || currentUsage < limits.monitoringSessions
    case 'sendTakedown':
      return limits.takedownsPerMonth === -1 || currentUsage < limits.takedownsPerMonth
    case 'dmcaContactDetection':
      // DMCA contact detection limits per month
      const dmcaLimits = {
        FREE: 10,
        BASIC: 50,
        PREMIUM: -1, // unlimited
        ENTERPRISE: -1,
        SUPER_USER: -1
      }
      const dmcaLimit = dmcaLimits[planType as keyof typeof dmcaLimits] || dmcaLimits.FREE
      return dmcaLimit === -1 || currentUsage < dmcaLimit
    case 'keywordSearch':
      // Keyword search limits per month
      const keywordLimits = {
        FREE: 50,
        BASIC: 200,
        PREMIUM: -1,
        ENTERPRISE: -1,
        SUPER_USER: -1
      }
      const keywordLimit = keywordLimits[planType as keyof typeof keywordLimits] || keywordLimits.FREE
      return keywordLimit === -1 || currentUsage < keywordLimit
    case 'faceRecognition':
      // Face recognition scans per month
      const faceLimits = {
        FREE: 20,
        BASIC: 100,
        PREMIUM: -1,
        ENTERPRISE: -1,
        SUPER_USER: -1
      }
      const faceLimit = faceLimits[planType as keyof typeof faceLimits] || faceLimits.FREE
      return faceLimit === -1 || currentUsage < faceLimit
    default:
      return true
  }
}
