import { io, Socket } from 'socket.io-client'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { AddressInfo } from 'net'

describe('WebSocket Monitoring Namespace Tests', () => {
  let ioServer: SocketIOServer
  let serverUrl: string
  let clientSocket: Socket
  let httpServer: any
  let monitoringNamespace: any

  beforeAll((done) => {
    httpServer = createServer()
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Setup monitoring namespace
    monitoringNamespace = ioServer.of('/monitoring')
    
    // Mock monitoring events
    monitoringNamespace.on('connection', (socket: any) => {
      console.log('Client connected to monitoring namespace')
      
      // Simulate periodic updates
      const interval = setInterval(() => {
        socket.emit('queue:update', {
          pending: Math.floor(Math.random() * 100),
          processing: Math.floor(Math.random() * 10),
          completed: Math.floor(Math.random() * 1000),
          failed: Math.floor(Math.random() * 5)
        })
      }, 1000)
      
      socket.on('disconnect', () => {
        clearInterval(interval)
      })
      
      // Handle subscription requests
      socket.on('subscribe:metrics', (metrics: string[]) => {
        socket.join('metrics-room')
        socket.emit('subscription:confirmed', { metrics })
      })
      
      socket.on('unsubscribe:metrics', () => {
        socket.leave('metrics-room')
        socket.emit('subscription:removed')
      })
    })

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

  describe('Monitoring Connection', () => {
    it('should connect to monitoring namespace', (done) => {
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true)
        expect(clientSocket.nsp).toBe('/monitoring')
        done()
      })
    })

    it('should receive queue updates', (done) => {
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      clientSocket.on('queue:update', (data) => {
        expect(data).toHaveProperty('pending')
        expect(data).toHaveProperty('processing')
        expect(data).toHaveProperty('completed')
        expect(data).toHaveProperty('failed')
        expect(typeof data.pending).toBe('number')
        done()
      })
    })
  })

  describe('Metrics Subscription', () => {
    it('should subscribe to specific metrics', (done) => {
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        const metricsToSubscribe = ['cpu', 'memory', 'disk']
        clientSocket.emit('subscribe:metrics', metricsToSubscribe)
      })

      clientSocket.on('subscription:confirmed', (data) => {
        expect(data.metrics).toEqual(['cpu', 'memory', 'disk'])
        done()
      })
    })

    it('should unsubscribe from metrics', (done) => {
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe:metrics', ['cpu'])
      })

      clientSocket.on('subscription:confirmed', () => {
        clientSocket.emit('unsubscribe:metrics')
      })

      clientSocket.on('subscription:removed', () => {
        done()
      })
    })
  })

  describe('Real-time Events', () => {
    it('should handle multiple event types', (done) => {
      const receivedEvents: string[] = []
      const expectedEvents = ['queue:update', 'agent:status', 'cache:hit']
      
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      // Mock server events
      clientSocket.on('connect', () => {
        // Simulate server sending different event types
        monitoringNamespace.to(clientSocket.id).emit('queue:update', { pending: 10 })
        monitoringNamespace.to(clientSocket.id).emit('agent:status', { active: 5 })
        monitoringNamespace.to(clientSocket.id).emit('cache:hit', { rate: 0.85 })
      })

      clientSocket.on('queue:update', () => {
        receivedEvents.push('queue:update')
        checkComplete()
      })

      clientSocket.on('agent:status', () => {
        receivedEvents.push('agent:status')
        checkComplete()
      })

      clientSocket.on('cache:hit', () => {
        receivedEvents.push('cache:hit')
        checkComplete()
      })

      function checkComplete() {
        if (receivedEvents.length === expectedEvents.length) {
          expect(receivedEvents.sort()).toEqual(expectedEvents.sort())
          done()
        }
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle server errors gracefully', (done) => {
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        // Simulate server error
        monitoringNamespace.to(clientSocket.id).emit('error', {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        })
      })

      clientSocket.on('error', (error) => {
        expect(error.message).toBe('Internal server error')
        expect(error.code).toBe('INTERNAL_ERROR')
        done()
      })
    })

    it('should handle invalid event data', (done) => {
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      const mockErrorHandler = jest.fn()
      
      clientSocket.on('connect', () => {
        // Send invalid data
        clientSocket.emit('subscribe:metrics', null)
      })

      clientSocket.on('error', mockErrorHandler)

      // Give time for error to propagate
      setTimeout(() => {
        // Server should handle gracefully without crashing
        expect(clientSocket.connected).toBe(true)
        done()
      }, 100)
    })
  })

  describe('Performance Monitoring', () => {
    it('should track event latency', (done) => {
      const latencies: number[] = []
      
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        // Send multiple pings to measure latency
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now()
          
          clientSocket.emit('ping', { timestamp: startTime })
          
          clientSocket.once('pong', (data) => {
            const latency = Date.now() - data.timestamp
            latencies.push(latency)
            
            if (latencies.length === 5) {
              // All latencies should be reasonable (< 100ms for local)
              expect(Math.max(...latencies)).toBeLessThan(100)
              done()
            }
          })
        }
      })

      // Mock server pong response
      monitoringNamespace.on('connection', (socket: any) => {
        socket.on('ping', (data: any) => {
          socket.emit('pong', data)
        })
      })
    })
  })

  describe('Room Management', () => {
    it('should join and leave rooms correctly', (done) => {
      let joinedRooms: string[] = []
      
      clientSocket = io(`${serverUrl}/monitoring`, {
        transports: ['websocket']
      })

      // Track rooms on server
      monitoringNamespace.on('connection', (socket: any) => {
        socket.on('join:room', (room: string) => {
          socket.join(room)
          joinedRooms = Array.from(socket.rooms)
          socket.emit('room:joined', { room, rooms: joinedRooms })
        })
        
        socket.on('leave:room', (room: string) => {
          socket.leave(room)
          joinedRooms = Array.from(socket.rooms)
          socket.emit('room:left', { room, rooms: joinedRooms })
        })
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('join:room', 'queue-updates')
      })

      clientSocket.on('room:joined', (data) => {
        expect(data.room).toBe('queue-updates')
        expect(data.rooms).toContain('queue-updates')
        
        // Now leave the room
        clientSocket.emit('leave:room', 'queue-updates')
      })

      clientSocket.on('room:left', (data) => {
        expect(data.room).toBe('queue-updates')
        expect(data.rooms).not.toContain('queue-updates')
        done()
      })
    })
  })
})