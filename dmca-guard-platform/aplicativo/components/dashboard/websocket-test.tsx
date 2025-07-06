'use client'

import { useEffect, useState } from 'react'
import { useSocket } from '@/hooks/use-socket'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Wifi, WifiOff } from 'lucide-react'

export function WebSocketTest() {
  const { socket, isConnected } = useSocket('/monitoring')
  const [messages, setMessages] = useState<any[]>([])
  const [room, setRoom] = useState<string>('')

  useEffect(() => {
    if (!socket) return

    // Escutar eventos de teste
    socket.on('test-message', (data: any) => {
      setMessages(prev => [...prev, { type: 'received', data, timestamp: new Date() }])
    })

    socket.on('progress', (data: any) => {
      setMessages(prev => [...prev, { type: 'progress', data, timestamp: new Date() }])
    })

    return () => {
      socket.off('test-message')
      socket.off('progress')
    }
  }, [socket])

  const joinRoom = (roomName: string) => {
    if (socket && roomName) {
      socket.emit('join', roomName)
      setRoom(roomName)
      setMessages(prev => [...prev, { 
        type: 'system', 
        data: { message: `Entrou na sala: ${roomName}` }, 
        timestamp: new Date() 
      }])
    }
  }

  const leaveRoom = () => {
    if (socket && room) {
      socket.emit('leave', room)
      setMessages(prev => [...prev, { 
        type: 'system', 
        data: { message: `Saiu da sala: ${room}` }, 
        timestamp: new Date() 
      }])
      setRoom('')
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>WebSocket Test</CardTitle>
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? (
              <><Wifi className="w-3 h-3 mr-1" /> Conectado</>
            ) : (
              <><WifiOff className="w-3 h-3 mr-1" /> Desconectado</>
            )}
          </Badge>
        </div>
        <CardDescription>
          Teste de conexão WebSocket com namespace /monitoring
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={() => joinRoom('session:test-123')} 
              disabled={!isConnected || room === 'session:test-123'}
              size="sm"
            >
              Entrar na sala de teste
            </Button>
            <Button 
              onClick={leaveRoom} 
              disabled={!isConnected || !room}
              variant="outline"
              size="sm"
            >
              Sair da sala
            </Button>
          </div>
          
          {room && (
            <Badge variant="secondary">Sala atual: {room}</Badge>
          )}

          <div className="border rounded-lg p-4 h-64 overflow-y-auto space-y-2">
            <p className="text-sm text-muted-foreground">Mensagens:</p>
            {messages.map((msg, idx) => (
              <div key={idx} className="text-sm">
                <span className="text-muted-foreground">
                  [{msg.timestamp.toLocaleTimeString()}]
                </span>{' '}
                <span className={
                  msg.type === 'system' ? 'text-blue-600' : 
                  msg.type === 'progress' ? 'text-green-600' : 
                  'text-gray-800'
                }>
                  {msg.type}: {JSON.stringify(msg.data)}
                </span>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-muted-foreground">Nenhuma mensagem ainda...</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}