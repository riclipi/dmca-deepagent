import { Server as NetServer, Socket } from 'net'
import { NextApiRequest, NextApiResponse } from 'next'
import { Server as ServerIO } from 'socket.io'

type NextApiResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: NetServer & {
      io: ServerIO
    }
  }
}

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  // Socket.io precisa ser configurado em um servidor personalizado
  // Retornamos uma mensagem indicando isso
  return new Response(
    JSON.stringify({ 
      message: 'Socket.io endpoint. Configure um servidor customizado para WebSockets.' 
    }),
    { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

export async function POST(req: Request) {
  return GET(req)
}