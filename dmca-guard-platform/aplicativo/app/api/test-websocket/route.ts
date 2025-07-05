import { NextResponse } from 'next/server'
import { emitToRoom, emitSessionProgress } from '@/lib/socket-server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { sessionId, progress, currentKeyword, action } = body

    if (action === 'emit-progress') {
      // Emitir progresso para uma sessão específica
      emitSessionProgress(
        sessionId || 'test-123',
        progress || Math.floor(Math.random() * 100),
        currentKeyword || 'test-keyword',
        { 
          status: 'scanning',
          sitesScanned: Math.floor(Math.random() * 50),
          violationsFound: Math.floor(Math.random() * 10)
        }
      )

      return NextResponse.json({ 
        success: true, 
        message: 'Progress event emitted',
        data: { sessionId, progress, currentKeyword }
      })
    }

    if (action === 'emit-test') {
      // Emitir evento de teste
      emitToRoom('/monitoring', `session:${sessionId || 'test-123'}`, 'test-message', {
        message: 'This is a test WebSocket message',
        timestamp: new Date().toISOString(),
        randomValue: Math.random()
      })

      return NextResponse.json({ 
        success: true, 
        message: 'Test event emitted' 
      })
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Invalid action' 
    }, { status: 400 })

  } catch (error) {
    console.error('WebSocket test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'WebSocket test endpoint',
    usage: {
      method: 'POST',
      body: {
        action: 'emit-progress | emit-test',
        sessionId: 'string (optional)',
        progress: 'number (optional for emit-progress)',
        currentKeyword: 'string (optional for emit-progress)'
      }
    }
  })
}