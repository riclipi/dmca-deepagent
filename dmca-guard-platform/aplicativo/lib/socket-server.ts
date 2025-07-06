import { Server as ServerIO } from 'socket.io'

declare global {
  var dmcaIo: ServerIO | undefined
}

/**
 * Obtém a instância global do servidor Socket.io
 * @returns A instância do servidor Socket.io ou undefined se não estiver disponível
 */
export function getIO(): ServerIO | undefined {
  if (typeof global !== 'undefined' && global.dmcaIo) {
    return global.dmcaIo
  }
  return undefined
}

/**
 * Emite um evento para um namespace e sala específicos
 * @param namespace - O namespace do Socket.io (ex: '/monitoring', '/agents')
 * @param room - A sala para emitir o evento (ex: 'session:123')
 * @param event - O nome do evento
 * @param data - Os dados a serem enviados
 */
export function emitToRoom(namespace: string, room: string, event: string, data: any) {
  const io = getIO()
  if (!io) {
    console.error('[Socket Server] Instância do Socket.io não disponível')
    return
  }
  
  io.of(namespace).to(room).emit(event, data)
}

/**
 * Emite um evento para todos os clientes em um namespace
 * @param namespace - O namespace do Socket.io
 * @param event - O nome do evento
 * @param data - Os dados a serem enviados
 */
export function emitToNamespace(namespace: string, event: string, data: any) {
  const io = getIO()
  if (!io) {
    console.error('[Socket Server] Instância do Socket.io não disponível')
    return
  }
  
  io.of(namespace).emit(event, data)
}

/**
 * Emite um evento de progresso para uma sessão específica
 * @param sessionId - O ID da sessão
 * @param progress - O progresso atual (0-100)
 * @param currentKeyword - A palavra-chave atual sendo processada
 * @param additionalData - Dados adicionais opcionais
 */
export function emitSessionProgress(
  sessionId: string, 
  progress: number, 
  currentKeyword: string,
  additionalData?: any
) {
  const room = `session:${sessionId}`
  emitToRoom('/monitoring', room, 'progress', {
    sessionId,
    progress,
    currentKeyword,
    timestamp: new Date().toISOString(),
    ...additionalData
  })
}

/**
 * Emite um evento de status para um agente específico
 * @param agentId - O ID do agente
 * @param status - O status atual
 * @param data - Dados adicionais
 */
export function emitAgentStatus(agentId: string, status: string, data?: any) {
  const room = `agent:${agentId}`
  emitToRoom('/agents', room, 'status', {
    agentId,
    status,
    timestamp: new Date().toISOString(),
    ...data
  })
}

/**
 * Emite um evento de atualização da fila
 * @param data - Dados da atualização da fila
 */
export function emitQueueUpdate(data: {
  userId: string
  queueId: string
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'
  position?: number
  estimatedStartTime?: Date
  startedAt?: Date
  completedAt?: Date
  cancelledAt?: Date
}) {
  const room = `user:${data.userId}`
  emitToRoom('/monitoring', room, 'queue-update', {
    ...data,
    timestamp: new Date().toISOString()
  })
}