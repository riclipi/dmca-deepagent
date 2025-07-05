import { io, Socket } from 'socket.io-client'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { AddressInfo } from 'net'

describe('WebSocket Agents Namespace Tests', () => {
  let ioServer: SocketIOServer
  let serverUrl: string
  let clientSocket: Socket
  let httpServer: any
  let agentsNamespace: any

  beforeAll((done) => {
    httpServer = createServer()
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Setup agents namespace
    agentsNamespace = ioServer.of('/agents')
    
    // Mock agent behavior
    agentsNamespace.on('connection', (socket: any) => {
      console.log('Client connected to agents namespace')
      
      // Handle agent lifecycle events
      socket.on('agent:start', (data: any) => {
        const { agentId, type, config } = data
        
        // Validate input
        if (!agentId || !type) {
          socket.emit('agent:error', {
            agentId,
            error: 'Missing required fields'
          })
          return
        }
        
        // Simulate agent starting
        socket.emit('agent:started', {
          agentId,
          type,
          status: 'running',
          startedAt: new Date().toISOString()
        })
        
        // Simulate agent progress
        let progress = 0
        const progressInterval = setInterval(() => {
          progress += 10
          
          socket.emit('agent:progress', {
            agentId,
            progress,
            message: `Processing... ${progress}%`
          })
          
          if (progress >= 100) {
            clearInterval(progressInterval)
            socket.emit('agent:completed', {
              agentId,
              results: {
                itemsProcessed: 42,
                violationsFound: 3,
                duration: 5000
              }
            })
          }
        }, 500)
        
        // Store interval for cleanup
        socket.data[`interval_${agentId}`] = progressInterval
      })
      
      socket.on('agent:stop', (data: any) => {
        const { agentId } = data
        
        // Clear any running intervals
        if (socket.data[`interval_${agentId}`]) {
          clearInterval(socket.data[`interval_${agentId}`])
          delete socket.data[`interval_${agentId}`]
        }
        
        socket.emit('agent:stopped', {
          agentId,
          stoppedAt: new Date().toISOString()
        })
      })
      
      socket.on('agent:subscribe', (agentId: string) => {
        socket.join(`agent:${agentId}`)
        socket.emit('agent:subscribed', { agentId })
      })
      
      socket.on('agent:unsubscribe', (agentId: string) => {
        socket.leave(`agent:${agentId}`)
        socket.emit('agent:unsubscribed', { agentId })
      })
      
      socket.on('disconnect', () => {
        // Cleanup all intervals
        Object.keys(socket.data).forEach(key => {
          if (key.startsWith('interval_')) {
            clearInterval(socket.data[key])
          }
        })
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

  describe('Agent Connection', () => {
    it('should connect to agents namespace', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true)
        expect(clientSocket.nsp).toBe('/agents')
        done()
      })
    })
  })

  describe('Agent Lifecycle', () => {
    it('should start an agent successfully', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:start', {
          agentId: 'test-agent-1',
          type: 'KNOWN_SITES',
          config: {
            keywords: ['test'],
            platforms: ['google']
          }
        })
      })

      clientSocket.on('agent:started', (data) => {
        expect(data.agentId).toBe('test-agent-1')
        expect(data.type).toBe('KNOWN_SITES')
        expect(data.status).toBe('running')
        expect(data.startedAt).toBeDefined()
        done()
      })
    })

    it('should handle agent progress updates', (done) => {
      const progressUpdates: number[] = []
      
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:start', {
          agentId: 'test-agent-2',
          type: 'WEB_SCANNER'
        })
      })

      clientSocket.on('agent:progress', (data) => {
        progressUpdates.push(data.progress)
        
        // Check first few progress updates
        if (progressUpdates.length === 3) {
          expect(progressUpdates).toEqual([10, 20, 30])
          done()
        }
      })
    })

    it('should complete agent execution', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:start', {
          agentId: 'test-agent-3',
          type: 'SOCIAL_MEDIA'
        })
      })

      clientSocket.on('agent:completed', (data) => {
        expect(data.agentId).toBe('test-agent-3')
        expect(data.results).toBeDefined()
        expect(data.results.itemsProcessed).toBe(42)
        expect(data.results.violationsFound).toBe(3)
        done()
      })
    })

    it('should stop a running agent', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:start', {
          agentId: 'test-agent-4',
          type: 'IMAGE_SCANNER'
        })
      })

      clientSocket.on('agent:started', () => {
        // Stop the agent immediately
        clientSocket.emit('agent:stop', {
          agentId: 'test-agent-4'
        })
      })

      clientSocket.on('agent:stopped', (data) => {
        expect(data.agentId).toBe('test-agent-4')
        expect(data.stoppedAt).toBeDefined()
        done()
      })
    })
  })

  describe('Agent Errors', () => {
    it('should handle missing required fields', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:start', {
          // Missing agentId and type
          config: {}
        })
      })

      clientSocket.on('agent:error', (data) => {
        expect(data.error).toBe('Missing required fields')
        done()
      })
    })

    it('should handle agent execution errors', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      // Mock server error
      agentsNamespace.on('connection', (socket: any) => {
        socket.on('agent:start', (data: any) => {
          if (data.agentId === 'error-agent') {
            socket.emit('agent:error', {
              agentId: data.agentId,
              error: 'Agent execution failed',
              details: 'Invalid configuration'
            })
          }
        })
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:start', {
          agentId: 'error-agent',
          type: 'KNOWN_SITES'
        })
      })

      clientSocket.on('agent:error', (data) => {
        expect(data.agentId).toBe('error-agent')
        expect(data.error).toBe('Agent execution failed')
        expect(data.details).toBe('Invalid configuration')
        done()
      })
    })
  })

  describe('Agent Subscriptions', () => {
    it('should subscribe to specific agent updates', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:subscribe', 'agent-123')
      })

      clientSocket.on('agent:subscribed', (data) => {
        expect(data.agentId).toBe('agent-123')
        done()
      })
    })

    it('should unsubscribe from agent updates', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:subscribe', 'agent-456')
      })

      clientSocket.on('agent:subscribed', () => {
        clientSocket.emit('agent:unsubscribe', 'agent-456')
      })

      clientSocket.on('agent:unsubscribed', (data) => {
        expect(data.agentId).toBe('agent-456')
        done()
      })
    })

    it('should receive updates only for subscribed agents', (done) => {
      const client1Updates: string[] = []
      const client2Updates: string[] = []
      
      const client1 = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })
      
      const client2 = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      // Client 1 subscribes to agent-A
      client1.on('connect', () => {
        client1.emit('agent:subscribe', 'agent-A')
      })

      // Client 2 subscribes to agent-B
      client2.on('connect', () => {
        client2.emit('agent:subscribe', 'agent-B')
      })

      client1.on('agent:update', (data) => {
        client1Updates.push(data.agentId)
      })

      client2.on('agent:update', (data) => {
        client2Updates.push(data.agentId)
      })

      // Wait for both clients to connect and subscribe
      setTimeout(() => {
        // Emit updates to specific rooms
        agentsNamespace.to('agent:agent-A').emit('agent:update', { agentId: 'agent-A' })
        agentsNamespace.to('agent:agent-B').emit('agent:update', { agentId: 'agent-B' })
        
        setTimeout(() => {
          expect(client1Updates).toContain('agent-A')
          expect(client1Updates).not.toContain('agent-B')
          expect(client2Updates).toContain('agent-B')
          expect(client2Updates).not.toContain('agent-A')
          
          client1.disconnect()
          client2.disconnect()
          done()
        }, 100)
      }, 200)
    })
  })

  describe('Concurrent Agents', () => {
    it('should handle multiple agents running simultaneously', (done) => {
      const agentStatuses: Record<string, string> = {}
      
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      clientSocket.on('connect', () => {
        // Start multiple agents
        ['agent-1', 'agent-2', 'agent-3'].forEach(agentId => {
          clientSocket.emit('agent:start', {
            agentId,
            type: 'MULTI_SCANNER'
          })
        })
      })

      clientSocket.on('agent:started', (data) => {
        agentStatuses[data.agentId] = 'running'
        
        // Check if all agents started
        if (Object.keys(agentStatuses).length === 3) {
          expect(agentStatuses['agent-1']).toBe('running')
          expect(agentStatuses['agent-2']).toBe('running')
          expect(agentStatuses['agent-3']).toBe('running')
          done()
        }
      })
    })
  })

  describe('Agent Metrics', () => {
    it('should track agent performance metrics', (done) => {
      clientSocket = io(`${serverUrl}/agents`, {
        transports: ['websocket']
      })

      // Mock server metrics
      agentsNamespace.on('connection', (socket: any) => {
        socket.on('agent:metrics', (agentId: string) => {
          socket.emit('agent:metrics:response', {
            agentId,
            metrics: {
              totalRuns: 150,
              successRate: 0.95,
              averageDuration: 3500,
              lastRunAt: new Date().toISOString()
            }
          })
        })
      })

      clientSocket.on('connect', () => {
        clientSocket.emit('agent:metrics', 'metrics-agent')
      })

      clientSocket.on('agent:metrics:response', (data) => {
        expect(data.agentId).toBe('metrics-agent')
        expect(data.metrics.totalRuns).toBe(150)
        expect(data.metrics.successRate).toBe(0.95)
        expect(data.metrics.averageDuration).toBe(3500)
        done()
      })
    })
  })
})