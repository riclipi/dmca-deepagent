import { initializeSchedulerFromEnv } from '../scheduler/removal-verification-scheduler'

// Inicializar o scheduler quando o módulo for carregado
// Só será executado no servidor
if (typeof window === 'undefined') {
  // Aguardar um pouco para que a aplicação seja inicializada
  setTimeout(() => {
    try {
      initializeSchedulerFromEnv()
      console.log('🔧 Sistema de verificação de remoção inicializado')
    } catch (error) {
      console.error('❌ Erro ao inicializar scheduler de verificação:', error)
    }
  }, 5000) // 5 segundos de delay
}

export {}
