'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export const useSocket = (namespace: string) => {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // O cliente Socket.io só deve ser instanciado no lado do cliente
    if (typeof window === 'undefined') return

    // Conecta ao servidor de sockets, especificando o path e o namespace
    const socketInstance: Socket = io({
      path: '/api/socket/io',
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    }).of(namespace)

    socketInstance.on('connect', () => {
      console.log(`[useSocket] Conectado ao namespace: ${namespace}`)
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log(`[useSocket] Desconectado do namespace: ${namespace}`)
      setIsConnected(false)
    })

    socketInstance.on('connect_error', (error) => {
      console.error(`[useSocket] Erro de conexão:`, error.message)
    })

    setSocket(socketInstance)

    // Função de limpeza para desconectar o socket quando o componente for desmontado
    return () => {
      if (socketInstance) {
        socketInstance.disconnect()
      }
    }
  }, [namespace])

  return { socket, isConnected }
}