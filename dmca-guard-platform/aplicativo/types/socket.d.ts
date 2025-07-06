import { Socket as SocketIOClient } from 'socket.io-client'

declare module 'socket.io-client' {
  interface Socket extends SocketIOClient {
    auth?: {
      userId?: string
    }
  }
}

export type SocketClient = SocketIOClient