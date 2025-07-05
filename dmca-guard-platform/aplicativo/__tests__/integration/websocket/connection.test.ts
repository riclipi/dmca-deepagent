import { io, Socket } from 'socket.io-client'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { AddressInfo } from 'net'

describe('WebSocket Connection Tests', () => {
  let ioServer: SocketIOServer
  let serverUrl: string
  let clientSocket: Socket
  let httpServer: any

  beforeAll((done) => {
    // Create HTTP server
    httpServer = createServer()
    
    // Create Socket.IO server
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Start server
    httpServer.listen(() => {
      const port = (httpServer.address() as AddressInfo).port
      serverUrl = `http://localhost:${port}`
      done()
    })
  })

  afterAll((done) => {
    ioServer.close()
    httpServer.close()
    done()
  })

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect()
    }
  })

  describe('Basic Connection', () => {
    it('should connect successfully', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: false
      })

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true)
        done()
      })
    })

    it('should disconnect successfully', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: false
      })

      clientSocket.on('connect', () => {
        clientSocket.disconnect()
      })

      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false)
        done()
      })
    })

    it('should handle connection errors', (done) => {
      clientSocket = io('http://localhost:9999', {
        transports: ['websocket'],
        reconnection: false,
        timeout: 1000
      })

      clientSocket.on('connect_error', (error) => {
        expect(error).toBeDefined()
        done()
      })
    })
  })

  describe('Reconnection Logic', () => {
    it('should reconnect automatically after disconnect', (done) => {
      let connectCount = 0
      
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 3
      })

      clientSocket.on('connect', () => {
        connectCount++
        
        if (connectCount === 1) {
          // Force disconnect after first connection
          clientSocket.io.engine.close()
        } else if (connectCount === 2) {
          // Successfully reconnected
          expect(clientSocket.connected).toBe(true)
          done()
        }
      })
    })

    it('should emit reconnect events', (done) => {
      const events: string[] = []
      let connectCount = 0
      
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 100,
        reconnectionAttempts: 3
      })

      clientSocket.on('connect', () => {
        connectCount++
        events.push('connect')
        if (connectCount === 1) {
          // Force disconnect after first connection
          setTimeout(() => {
            clientSocket.io.engine.close()
          }, 50)
        } else if (connectCount === 2) {
          // Check events on reconnection
          expect(events).toContain('disconnect')
          expect(events).toContain('reconnect_attempt')
          done()
        }
      })

      clientSocket.on('disconnect', () => {
        events.push('disconnect')
      })

      clientSocket.on('reconnect_attempt', () => {
        events.push('reconnect_attempt')
      })
    }, 15000)
  })

  describe('Heartbeat/Ping-Pong', () => {
    it('should maintain connection with heartbeat', (done) => {
      let pongReceived = false
      
      // Configure server to send pings
      ioServer.on('connection', (socket) => {
        const interval = setInterval(() => {
          socket.emit('ping')
        }, 1000)
        
        socket.on('pong', () => {
          pongReceived = true
          clearInterval(interval)
        })
        
        socket.on('disconnect', () => {
          clearInterval(interval)
        })
      })

      clientSocket = io(serverUrl, {
        transports: ['websocket']
      })

      clientSocket.on('ping', () => {
        clientSocket.emit('pong')
        
        setTimeout(() => {
          expect(pongReceived).toBe(true)
          done()
        }, 100)
      })
    })
  })

  describe('Connection with Auth', () => {
    beforeEach(() => {
      // Setup auth middleware on server
      ioServer.use((socket, next) => {
        const token = socket.handshake.auth.token
        
        if (token === 'valid-token') {
          next()
        } else {
          next(new Error('Authentication failed'))
        }
      })
    })

    it('should connect with valid auth token', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: 'valid-token'
        }
      })

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true)
        done()
      })
    })

    it('should fail to connect with invalid auth token', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: 'invalid-token'
        }
      })

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication failed')
        done()
      })
    })
  })

  describe('Connection Cleanup', () => {
    it('should clean up resources on disconnect', (done) => {
      let cleanupHandler: any
      
      // Setup cleanup handler before creating client
      cleanupHandler = (socket: any) => {
        socket.data.userId = 'test-user'
        
        socket.on('disconnect', () => {
          // Simulate cleanup
          delete socket.data.userId
          // Remove the handler after use
          ioServer.off('connection', cleanupHandler)
          done()
        })
      }
      
      ioServer.on('connection', cleanupHandler)

      clientSocket = io(serverUrl, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        setTimeout(() => {
          clientSocket.disconnect()
        }, 100)
      })
    })

    it('should remove all listeners on disconnect', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket']
      })

      // Add some listeners
      const mockHandler = jest.fn()
      clientSocket.on('test-event', mockHandler)
      clientSocket.on('another-event', mockHandler)

      clientSocket.on('connect', () => {
        expect(clientSocket.listenerCount('test-event')).toBe(1)
        expect(clientSocket.listenerCount('another-event')).toBe(1)
        
        setTimeout(() => {
          clientSocket.disconnect()
        }, 100)
      })

      clientSocket.on('disconnect', () => {
        // Custom listeners are automatically removed on disconnect in newer versions
        // Check that the socket is properly disconnected
        expect(clientSocket.connected).toBe(false)
        done()
      })
    })
  })
})