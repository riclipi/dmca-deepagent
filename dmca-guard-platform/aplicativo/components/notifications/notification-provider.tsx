'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import socketIOClient from 'socket.io-client'
const io = socketIOClient
type Socket = typeof socketIOClient.Socket
import { Notification } from '@prisma/client'
import { toast } from 'sonner'

export interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  isConnected: boolean
  fetchNotifications: (options?: { unreadOnly?: boolean }) => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (notificationId: string) => Promise<void>
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isConnected, setIsConnected] = useState(false)

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (options?: { unreadOnly?: boolean }) => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (options?.unreadOnly) params.set('unreadOnly', 'true')
      params.set('limit', '100')

      const response = await fetch(`/api/notifications?${params}`)
      if (!response.ok) throw new Error('Failed to fetch notifications')

      const data = await response.json()
      if (data.success) {
        setNotifications(data.data.notifications)
        setUnreadCount(data.data.unread)
      }
    } catch (error) {
      console.error('Error fetching notifications:', error)
      toast.error('Failed to load notifications')
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
        method: 'POST'
      })
      
      if (!response.ok) throw new Error('Failed to mark as read')

      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, isRead: true, readAt: new Date() } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast.error('Failed to mark notification as read')
    }
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST'
      })
      
      if (!response.ok) throw new Error('Failed to mark all as read')

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: new Date() })))
      setUnreadCount(0)
      
      toast.success('All notifications marked as read')
    } catch (error) {
      console.error('Error marking all as read:', error)
      toast.error('Failed to mark all as read')
    }
  }, [])

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) throw new Error('Failed to delete notification')

      // Update local state
      const notification = notifications.find(n => n.id === notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
      
      toast.success('Notification deleted')
    } catch (error) {
      console.error('Error deleting notification:', error)
      toast.error('Failed to delete notification')
    }
  }, [notifications])

  // Initialize WebSocket connection
  useEffect(() => {
    if (!session?.user?.id) return

    const socketInstance = io('/notifications', {
      path: '/api/socket/io',
      auth: {
        userId: session.user.id
      }
    })

    socketInstance.on('connect', () => {
      console.log('[NotificationProvider] Connected to WebSocket')
      setIsConnected(true)
      socketInstance.emit('join', `user:${session.user.id}`)
    })

    socketInstance.on('disconnect', () => {
      console.log('[NotificationProvider] Disconnected from WebSocket')
      setIsConnected(false)
    })

    // Handle new notifications
    socketInstance.on('notification:new', (notification: Notification) => {
      console.log('[NotificationProvider] New notification:', notification)
      
      // Add to local state
      setNotifications(prev => [notification, ...prev])
      if (!notification.isRead) {
        setUnreadCount(prev => prev + 1)
      }

      // Show toast notification
      toast(notification.title, {
        description: notification.message,
        action: {
          label: 'View',
          onClick: () => markAsRead(notification.id)
        }
      })
    })

    // Handle notification updates
    socketInstance.on('notification:updated', (update: { id: string; isRead: boolean; readAt?: Date }) => {
      setNotifications(prev => prev.map(n => 
        n.id === update.id ? { ...n, ...update } : n
      ))
      
      // Update unread count if needed
      const notification = notifications.find(n => n.id === update.id)
      if (notification && !notification.isRead && update.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    })

    // Handle bulk updates
    socketInstance.on('notification:bulk_update', (data: { action: string; timestamp: Date }) => {
      if (data.action === 'all_read') {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true, readAt: data.timestamp })))
        setUnreadCount(0)
      }
    })

    // Handle notification deletion
    socketInstance.on('notification:deleted', (data: { id: string }) => {
      const notification = notifications.find(n => n.id === data.id)
      setNotifications(prev => prev.filter(n => n.id !== data.id))
      if (notification && !notification.isRead) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [session?.user?.id, markAsRead])

  // Fetch initial notifications
  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications()
    }
  }, [session?.user?.id, fetchNotifications])

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    isConnected,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}