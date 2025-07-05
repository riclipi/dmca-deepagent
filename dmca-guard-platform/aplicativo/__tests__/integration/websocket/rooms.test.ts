import { io, Socket } from 'socket.io-client'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { AddressInfo } from 'net'

describe('WebSocket Rooms Tests', () => {
  let ioServer: SocketIOServer
  let serverUrl: string
  let httpServer: any

  beforeAll((done) => {
    httpServer = createServer()
    ioServer = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // Setup room management
    ioServer.on('connection', (socket) => {
      // Room join/leave handlers
      socket.on('join:room', (roomName: string) => {
        socket.join(roomName)
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id)
        socket.emit('room:joined', { room: roomName, rooms })
        
        // Notify others in room
        socket.to(roomName).emit('user:joined', {
          userId: socket.id,
          room: roomName
        })
      })
      
      socket.on('leave:room', (roomName: string) => {
        socket.leave(roomName)
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id)
        socket.emit('room:left', { room: roomName, rooms })
        
        // Notify others in room
        socket.to(roomName).emit('user:left', {
          userId: socket.id,
          room: roomName
        })
      })
      
      socket.on('message:room', (data: { room: string; message: string }) => {
        // Send message to everyone in room including sender
        ioServer.to(data.room).emit('room:message', {
          userId: socket.id,
          room: data.room,
          message: data.message,
          timestamp: new Date().toISOString()
        })
      })
      
      socket.on('room:info', (roomName: string) => {
        const room = ioServer.sockets.adapter.rooms.get(roomName)
        socket.emit('room:info:response', {
          room: roomName,
          size: room ? room.size : 0,
          exists: !!room
        })
      })
      
      socket.on('list:rooms', () => {
        const rooms = Array.from(socket.rooms).filter(r => r !== socket.id)
        socket.emit('rooms:list', { rooms })
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

  describe('Basic Room Operations', () => {
    it('should join a room successfully', (done) => {
      const client = io(serverUrl, {
        transports: ['websocket']
      })

      client.on('connect', () => {
        client.emit('join:room', 'test-room')
      })

      client.on('room:joined', (data) => {
        expect(data.room).toBe('test-room')
        expect(data.rooms).toContain('test-room')
        client.disconnect()
        done()
      })
    })

    it('should leave a room successfully', (done) => {
      const client = io(serverUrl, {
        transports: ['websocket']
      })

      client.on('connect', () => {
        client.emit('join:room', 'temp-room')
      })

      client.on('room:joined', () => {
        client.emit('leave:room', 'temp-room')
      })

      client.on('room:left', (data) => {
        expect(data.room).toBe('temp-room')
        expect(data.rooms).not.toContain('temp-room')
        client.disconnect()
        done()
      })
    })

    it('should join multiple rooms', (done) => {
      const client = io(serverUrl, {
        transports: ['websocket']
      })
      const roomsToJoin = ['room-1', 'room-2', 'room-3']
      let joinedCount = 0

      client.on('connect', () => {
        roomsToJoin.forEach(room => {
          client.emit('join:room', room)
        })
      })

      client.on('room:joined', (data) => {
        joinedCount++
        
        if (joinedCount === roomsToJoin.length) {
          expect(data.rooms.sort()).toEqual(roomsToJoin.sort())
          client.disconnect()
          done()
        }
      })
    })
  })

  describe('Room Messaging', () => {
    it('should broadcast messages to room members', (done) => {
      const client1 = io(serverUrl, { transports: ['websocket'] })
      const client2 = io(serverUrl, { transports: ['websocket'] })
      let client1Connected = false
      let client2Connected = false

      client1.on('connect', () => {
        client1Connected = true
        client1.emit('join:room', 'chat-room')
      })

      client2.on('connect', () => {
        client2Connected = true
        client2.emit('join:room', 'chat-room')
      })

      client1.on('room:joined', () => {
        if (client1Connected && client2Connected) {
          client1.emit('message:room', {
            room: 'chat-room',
            message: 'Hello from client1'
          })
        }
      })

      client2.on('room:message', (data) => {
        expect(data.room).toBe('chat-room')
        expect(data.message).toBe('Hello from client1')
        expect(data.userId).toBe(client1.id)
        
        client1.disconnect()
        client2.disconnect()
        done()
      })
    })

    it('should not receive messages from rooms not joined', (done) => {
      const client1 = io(serverUrl, { transports: ['websocket'] })
      const client2 = io(serverUrl, { transports: ['websocket'] })
      
      client1.on('connect', () => {
        client1.emit('join:room', 'room-A')
      })

      client2.on('connect', () => {
        client2.emit('join:room', 'room-B')
      })

      const messageHandler = jest.fn()
      client2.on('room:message', messageHandler)

      client1.on('room:joined', () => {
        client1.emit('message:room', {
          room: 'room-A',
          message: 'Message for room A only'
        })
        
        // Wait to ensure message doesn't arrive
        setTimeout(() => {
          expect(messageHandler).not.toHaveBeenCalled()
          client1.disconnect()
          client2.disconnect()
          done()
        }, 200)
      })
    })
  })

  describe('Room Notifications', () => {
    it('should notify when users join room', (done) => {
      const client1 = io(serverUrl, { transports: ['websocket'] })
      const client2 = io(serverUrl, { transports: ['websocket'] })

      client1.on('connect', () => {
        client1.emit('join:room', 'notification-room')
      })

      client1.on('user:joined', (data) => {
        expect(data.userId).toBe(client2.id)
        expect(data.room).toBe('notification-room')
        
        client1.disconnect()
        client2.disconnect()
        done()
      })

      client1.on('room:joined', () => {
        // Client 2 joins after client 1
        client2.emit('join:room', 'notification-room')
      })

      client2.on('connect', () => {
        // Wait for client1 to join first
      })
    })

    it('should notify when users leave room', (done) => {
      const client1 = io(serverUrl, { transports: ['websocket'] })
      const client2 = io(serverUrl, { transports: ['websocket'] })

      client1.on('connect', () => {
        client1.emit('join:room', 'leave-test-room')
      })

      client2.on('connect', () => {
        client2.emit('join:room', 'leave-test-room')
      })

      client1.on('user:left', (data) => {
        expect(data.userId).toBe(client2.id)
        expect(data.room).toBe('leave-test-room')
        
        client1.disconnect()
        done()
      })

      let bothJoined = 0
      const checkBothJoined = () => {
        bothJoined++
        if (bothJoined === 2) {
          client2.emit('leave:room', 'leave-test-room')
        }
      }

      client1.on('room:joined', checkBothJoined)
      client2.on('room:joined', checkBothJoined)
    })
  })

  describe('Room Information', () => {
    it('should get room information', (done) => {
      const client1 = io(serverUrl, { transports: ['websocket'] })
      const client2 = io(serverUrl, { transports: ['websocket'] })
      const client3 = io(serverUrl, { transports: ['websocket'] })

      let joinedCount = 0
      const checkAllJoined = () => {
        joinedCount++
        if (joinedCount === 3) {
          client1.emit('room:info', 'info-room')
        }
      }

      client1.on('connect', () => {
        client1.emit('join:room', 'info-room')
      })

      client2.on('connect', () => {
        client2.emit('join:room', 'info-room')
      })

      client3.on('connect', () => {
        client3.emit('join:room', 'info-room')
      })

      client1.on('room:joined', checkAllJoined)
      client2.on('room:joined', checkAllJoined)
      client3.on('room:joined', checkAllJoined)

      client1.on('room:info:response', (data) => {
        expect(data.room).toBe('info-room')
        expect(data.exists).toBe(true)
        expect(data.size).toBe(3)
        
        client1.disconnect()
        client2.disconnect()
        client3.disconnect()
        done()
      })
    })

    it('should list all joined rooms', (done) => {
      const client = io(serverUrl, { transports: ['websocket'] })
      const rooms = ['alpha', 'beta', 'gamma']
      let joinedCount = 0

      client.on('connect', () => {
        rooms.forEach(room => {
          client.emit('join:room', room)
        })
      })

      client.on('room:joined', () => {
        joinedCount++
        if (joinedCount === rooms.length) {
          client.emit('list:rooms')
        }
      })

      client.on('rooms:list', (data) => {
        expect(data.rooms.sort()).toEqual(rooms.sort())
        client.disconnect()
        done()
      })
    })
  })

  describe('Room Isolation', () => {
    it('should isolate messages between rooms', (done) => {
      const client1 = io(serverUrl, { transports: ['websocket'] })
      const client2 = io(serverUrl, { transports: ['websocket'] })
      const messages: any[] = []

      client1.on('connect', () => {
        client1.emit('join:room', 'isolated-room-1')
      })

      client2.on('connect', () => {
        client2.emit('join:room', 'isolated-room-2')
      })

      client1.on('room:message', (data) => {
        messages.push({ client: 1, ...data })
      })

      client2.on('room:message', (data) => {
        messages.push({ client: 2, ...data })
      })

      let bothJoined = 0
      const sendMessages = () => {
        bothJoined++
        if (bothJoined === 2) {
          client1.emit('message:room', {
            room: 'isolated-room-1',
            message: 'Message 1'
          })
          
          client2.emit('message:room', {
            room: 'isolated-room-2',
            message: 'Message 2'
          })
          
          setTimeout(() => {
            // Each client should only receive their own room's message
            const client1Messages = messages.filter(m => m.client === 1)
            const client2Messages = messages.filter(m => m.client === 2)
            
            expect(client1Messages.length).toBe(1)
            expect(client1Messages[0].message).toBe('Message 1')
            expect(client1Messages[0].room).toBe('isolated-room-1')
            
            expect(client2Messages.length).toBe(1)
            expect(client2Messages[0].message).toBe('Message 2')
            expect(client2Messages[0].room).toBe('isolated-room-2')
            
            client1.disconnect()
            client2.disconnect()
            done()
          }, 200)
        }
      }

      client1.on('room:joined', sendMessages)
      client2.on('room:joined', sendMessages)
    })
  })

  describe('Room Cleanup', () => {
    it('should clean up empty rooms', (done) => {
      const client = io(serverUrl, { transports: ['websocket'] })

      client.on('connect', () => {
        client.emit('join:room', 'cleanup-room')
      })

      client.on('room:joined', () => {
        // Check room exists
        client.emit('room:info', 'cleanup-room')
      })

      client.on('room:info:response', (data) => {
        if (data.exists) {
          // Leave room
          client.emit('leave:room', 'cleanup-room')
        } else {
          // Room was cleaned up
          expect(data.exists).toBe(false)
          expect(data.size).toBe(0)
          client.disconnect()
          done()
        }
      })

      client.on('room:left', () => {
        // Check if room still exists after leaving
        setTimeout(() => {
          client.emit('room:info', 'cleanup-room')
        }, 100)
      })
    })
  })
})