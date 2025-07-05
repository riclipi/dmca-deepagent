const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

// Initialize OpenTelemetry before anything else
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_TELEMETRY === 'true') {
  require('./lib/monitoring/telemetry').initializeTelemetry()
}

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Configurar Socket.io
  const io = new Server(server, {
    path: '/api/socket/io',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${port}`,
      methods: ['GET', 'POST']
    }
  })

  // Salvar instância global do io
  global.io = io

  // Namespace para monitoramento
  const monitoringNamespace = io.of('/monitoring')
  
  monitoringNamespace.on('connection', (socket) => {
    console.log(`[Socket.io] Cliente conectado ao namespace /monitoring: ${socket.id}`)
    
    // Entrar em salas específicas de sessão ou usuário
    socket.on('join', (room) => {
      socket.join(room)
      console.log(`[Socket.io] Socket ${socket.id} entrou na sala: ${room}`)
      
      // Se for uma sala de usuário, também enviar o status atual da fila
      if (room.startsWith('user:')) {
        socket.emit('connection-established', { room, timestamp: new Date().toISOString() })
      }
    })

    socket.on('leave', (room) => {
      socket.leave(room)
      console.log(`[Socket.io] Socket ${socket.id} saiu da sala: ${room}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Cliente desconectado do namespace /monitoring: ${socket.id}`)
    })
  })

  // Namespace para agentes
  const agentsNamespace = io.of('/agents')
  
  agentsNamespace.on('connection', (socket) => {
    console.log(`[Socket.io] Cliente conectado ao namespace /agents: ${socket.id}`)
    
    socket.on('join', (room) => {
      socket.join(room)
      console.log(`[Socket.io] Socket ${socket.id} entrou na sala: ${room}`)
    })

    socket.on('leave', (room) => {
      socket.leave(room)
      console.log(`[Socket.io] Socket ${socket.id} saiu da sala: ${room}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Cliente desconectado do namespace /agents: ${socket.id}`)
    })
  })

  server.once('error', (err) => {
    console.error(err)
    process.exit(1)
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log('> Socket.io server configured')
  })
})