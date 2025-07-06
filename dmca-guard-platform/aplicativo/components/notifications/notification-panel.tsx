'use client'

import React, { useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationItem } from './notification-item'
import { Loader2, CheckCheck, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationPanelProps {
  onClose?: () => void
  className?: string
}

export function NotificationPanel({ onClose, className }: NotificationPanelProps) {
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    markAllAsRead,
    fetchNotifications 
  } = useNotifications()
  
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const filteredNotifications = activeTab === 'unread' 
    ? notifications.filter(n => !n.isRead)
    : notifications

  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true)
    try {
      await markAllAsRead()
    } finally {
      setIsMarkingAll(false)
    }
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'all' | 'unread')
    if (value === 'unread') {
      fetchNotifications({ unreadOnly: true })
    } else {
      fetchNotifications()
    }
  }

  return (
    <div className={cn('flex flex-col h-[500px]', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold text-lg">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="text-xs"
            >
              {isMarkingAll ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3 mr-1" />
              )}
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1">
        <TabsList className="grid w-full grid-cols-2 h-9">
          <TabsTrigger value="all" className="text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="unread" className="text-xs">
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0 h-full">
          {isLoading ? (
            <div className="flex items-center justify-center h-[380px]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[380px] text-center px-4">
              <div className="rounded-full bg-muted p-3 mb-4">
                <Bell className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeTab === 'unread' ? "You're all caught up!" : "No notifications yet"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[380px]">
              <div className="divide-y">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onClose={onClose}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              onClose?.()
              // Navigate to notifications page
              window.location.href = '/dashboard/notifications'
            }}
          >
            View all notifications
          </Button>
        </div>
      )}
    </div>
  )
}

// Missing import
import { Bell } from 'lucide-react'