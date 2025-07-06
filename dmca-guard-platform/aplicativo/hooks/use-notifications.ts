'use client'

import { useContext } from 'react'
import { NotificationContext, NotificationContextType } from '@/components/notifications/notification-provider'

/**
 * Hook to access the notification context
 * @returns NotificationContextType
 * @throws Error if used outside of NotificationProvider
 */
export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext)
  
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  
  return context
}

// Re-export the context type for convenience
export type { NotificationContextType } from '@/components/notifications/notification-provider'