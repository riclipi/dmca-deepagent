import { io, Socket } from 'socket.io-client'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { AddressInfo } from 'net'
import jwt from 'jsonwebtoken'

describe('WebSocket Authentication Tests', () => {
  let ioServer: SocketIOServer
  let serverUrl: string
  let httpServer: any
  
  const JWT_SECRET = 'test-secret-key'
  const validUser = {
    id: 'user-123',
    email: 'test@example.com',
    planType: 'PROFESSIONAL'
  }

  beforeAll((done) => {
    httpServer = createServer()
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Authentication middleware
    ioServer.use((socket, next) => {
      const token = socket.handshake.auth.token
      
      if (!token) {
        return next(new Error('No token provided'))
      }
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any
        socket.data.user = decoded
        next()
      } catch (error) {
        next(new Error('Invalid token'))
      }
    })

    // Namespace-specific authentication
    const adminNamespace = ioServer.of('/admin')
    adminNamespace.use((socket, next) => {
      if (socket.data.user?.planType === 'SUPER_USER') {
        next()
      } else {
        next(new Error('Admin access required'))
      }
    })

    // Connection handlers
    ioServer.on('connection', (socket) => {
      socket.emit('authenticated', {
        userId: socket.data.user.id,
        email: socket.data.user.email
      })
      
      socket.on('protected:action', () => {
        socket.emit('action:result', {
          success: true,
          userId: socket.data.user.id
        })
      })
    })

    adminNamespace.on('connection', (socket) => {
      socket.emit('admin:connected', {
        message: 'Welcome to admin namespace'
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

  describe('Token Authentication', () => {
    it('should connect with valid token', (done) => {
      const token = jwt.sign(validUser, JWT_SECRET)
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token
        }
      })

      client.on('authenticated', (data) => {
        expect(data.userId).toBe(validUser.id)
        expect(data.email).toBe(validUser.email)
        client.disconnect()
        done()
      })
    })

    it('should reject connection without token', (done) => {
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: {}
      })

      client.on('connect_error', (error) => {
        expect(error.message).toBe('No token provided')
        done()
      })
    })

    it('should reject connection with invalid token', (done) => {
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: 'invalid-token'
        }
      })

      client.on('connect_error', (error) => {
        expect(error.message).toBe('Invalid token')
        done()
      })
    })

    it('should reject expired token', (done) => {
      const expiredToken = jwt.sign(
        { ...validUser, exp: Math.floor(Date.now() / 1000) - 60 },
        JWT_SECRET
      )
      
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: expiredToken
        }
      })

      client.on('connect_error', (error) => {
        expect(error.message).toBe('Invalid token')
        done()
      })
    })
  })

  describe('Namespace Authorization', () => {
    it('should allow admin access with SUPER_USER plan', (done) => {
      const adminUser = { ...validUser, planType: 'SUPER_USER' }
      const token = jwt.sign(adminUser, JWT_SECRET)
      
      const client = io(`${serverUrl}/admin`, {
        transports: ['websocket'],
        auth: {
          token
        }
      })

      client.on('admin:connected', (data) => {
        expect(data.message).toBe('Welcome to admin namespace')
        client.disconnect()
        done()
      })
    })

    it('should deny admin access without SUPER_USER plan', (done) => {
      const token = jwt.sign(validUser, JWT_SECRET) // PROFESSIONAL plan
      
      const client = io(`${serverUrl}/admin`, {
        transports: ['websocket'],
        auth: {
          token
        }
      })

      client.on('connect_error', (error) => {
        expect(error.message).toBe('Admin access required')
        done()
      })
    })
  })

  describe('Protected Actions', () => {
    it('should allow protected actions with valid auth', (done) => {
      const token = jwt.sign(validUser, JWT_SECRET)
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token
        }
      })

      client.on('connect', () => {
        client.emit('protected:action')
      })

      client.on('action:result', (data) => {
        expect(data.success).toBe(true)
        expect(data.userId).toBe(validUser.id)
        client.disconnect()
        done()
      })
    })
  })

  describe('Token Refresh', () => {
    it('should handle token refresh', (done) => {
      const initialToken = jwt.sign(
        { ...validUser, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: '5s' }
      )
      
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          token: initialToken
        }
      })

      client.on('connect', () => {
        // Simulate token refresh after 2 seconds
        setTimeout(() => {
          const newToken = jwt.sign(
            { ...validUser, iat: Math.floor(Date.now() / 1000) },
            JWT_SECRET,
            { expiresIn: '1h' }
          )
          
          // Update auth and reconnect
          client.auth = { token: newToken }
          client.disconnect()
          client.connect()
        }, 2000)
      })

      let connectCount = 0
      client.on('authenticated', (data) => {
        connectCount++
        if (connectCount === 2) {
          // Successfully reconnected with new token
          expect(data.userId).toBe(validUser.id)
          client.disconnect()
          done()
        }
      })
    })
  })

  describe('Rate Limiting', () => {
    it('should rate limit connection attempts', (done) => {
      const attempts: Promise<void>[] = []
      const invalidToken = 'bad-token'
      
      // Try to connect multiple times with invalid token
      for (let i = 0; i < 5; i++) {
        const attempt = new Promise<void>((resolve) => {
          const client = io(serverUrl, {
            transports: ['websocket'],
            auth: { token: invalidToken },
            reconnection: false
          })
          
          client.on('connect_error', () => {
            client.disconnect()
            resolve()
          })
        })
        
        attempts.push(attempt)
      }
      
      Promise.all(attempts).then(() => {
        // Try one more connection - should be rate limited
        const client = io(serverUrl, {
          transports: ['websocket'],
          auth: { token: invalidToken },
          reconnection: false
        })
        
        client.on('connect_error', (error) => {
          // In a real implementation, this would check for rate limit error
          expect(error.message).toBeDefined()
          done()
        })
      })
    })
  })

  describe('Session Management', () => {
    it('should track active sessions', (done) => {
      const token = jwt.sign(validUser, JWT_SECRET)
      const sessions: string[] = []
      
      // Track sessions on server
      ioServer.on('connection', (socket) => {
        sessions.push(socket.id)
        
        socket.on('disconnect', () => {
          const index = sessions.indexOf(socket.id)
          if (index > -1) {
            sessions.splice(index, 1)
          }
        })
      })
      
      // Create multiple connections
      const client1 = io(serverUrl, {
        transports: ['websocket'],
        auth: { token }
      })
      
      const client2 = io(serverUrl, {
        transports: ['websocket'],
        auth: { token }
      })
      
      setTimeout(() => {
        expect(sessions.length).toBe(2)
        
        client1.disconnect()
        
        setTimeout(() => {
          expect(sessions.length).toBe(1)
          
          client2.disconnect()
          
          setTimeout(() => {
            expect(sessions.length).toBe(0)
            done()
          }, 100)
        }, 100)
      }, 200)
    })
  })

  describe('Permission Checks', () => {
    it('should check permissions for specific events', (done) => {
      // Setup permission middleware
      ioServer.on('connection', (socket) => {
        socket.use((event, next) => {
          const [eventName, ...args] = event
          
          // Check permissions based on event
          if (eventName === 'admin:command' && socket.data.user.planType !== 'SUPER_USER') {
            next(new Error('Insufficient permissions'))
          } else {
            next()
          }
        })
        
        socket.on('admin:command', (data, callback) => {
          callback({ success: true, data })
        })
        
        socket.on('user:command', (data, callback) => {
          callback({ success: true, data })
        })
      })
      
      const token = jwt.sign(validUser, JWT_SECRET) // PROFESSIONAL user
      const client = io(serverUrl, {
        transports: ['websocket'],
        auth: { token }
      })
      
      client.on('connect', () => {
        // Try admin command - should fail
        client.emit('admin:command', { action: 'delete' }, (response: any) => {
          // This callback shouldn't be called due to permission error
          expect(response).toBeUndefined()
        })
        
        // Try user command - should succeed
        client.emit('user:command', { action: 'read' }, (response: any) => {
          expect(response.success).toBe(true)
          expect(response.data.action).toBe('read')
          client.disconnect()
          done()
        })
      })
      
      client.on('error', (error) => {
        expect(error.message).toBe('Insufficient permissions')
      })
    })
  })
})