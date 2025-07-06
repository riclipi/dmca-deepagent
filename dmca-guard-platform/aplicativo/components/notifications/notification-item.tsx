'use client'

import React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  FileSearch, 
  AlertTriangle, 
  TrendingUp, 
  Megaphone,
  MoreVertical,
  Trash2,
  Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useNotifications } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'
import { Notification } from '@prisma/client'
import { NotificationType } from '@/lib/services/notification.service'

interface NotificationItemProps {
  notification: Notification
  onClose?: () => void
}

export function NotificationItem({ notification, onClose }: NotificationItemProps) {
  const { markAsRead, deleteNotification } = useNotifications()

  const handleClick = async () => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }
    
    // Navigate based on notification type
    switch (notification.type) {
      case NotificationType.VIOLATION_DETECTED:
        window.location.href = '/dashboard/detected-content'
        break
      case NotificationType.TAKEDOWN_SUCCESS:
      case NotificationType.TAKEDOWN_FAILED:
        if (notification.takedownRequestId) {
          window.location.href = `/dashboard/takedown-requests/${notification.takedownRequestId}`
        } else {
          window.location.href = '/dashboard/takedown-requests'
        }
        break
      case NotificationType.SCAN_COMPLETE:
        window.location.href = '/dashboard/monitoring-sessions'
        break
      case NotificationType.ABUSE_WARNING:
        window.location.href = '/dashboard/security'
        break
      case NotificationType.PLAN_LIMIT_WARNING:
        window.location.href = '/pricing'
        break
      default:
        window.location.href = '/dashboard'
    }
    
    onClose?.()
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteNotification(notification.id)
  }

  const getIcon = () => {
    switch (notification.type) {
      case NotificationType.VIOLATION_DETECTED:
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case NotificationType.TAKEDOWN_SUCCESS:
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case NotificationType.TAKEDOWN_FAILED:
        return <XCircle className="h-5 w-5 text-red-500" />
      case NotificationType.SCAN_COMPLETE:
        return <FileSearch className="h-5 w-5 text-blue-500" />
      case NotificationType.ABUSE_WARNING:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />
      case NotificationType.PLAN_LIMIT_WARNING:
        return <TrendingUp className="h-5 w-5 text-purple-500" />
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return <Megaphone className="h-5 w-5 text-gray-500" />
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />
    }
  }

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors cursor-pointer',
        !notification.isRead && 'bg-muted/30'
      )}
      onClick={handleClick}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className={cn(
              'text-sm',
              !notification.isRead && 'font-semibold'
            )}>
              {notification.title}
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formatDistanceToNow(new Date(notification.createdAt), {
                addSuffix: true,
                locale: ptBR
              })}
            </p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!notification.isRead && (
                <DropdownMenuItem onClick={async (e) => {
                  e.stopPropagation()
                  await markAsRead(notification.id)
                }}>
                  <Eye className="mr-2 h-4 w-4" />
                  Mark as read
                </DropdownMenuItem>
              )}
              <DropdownMenuItem 
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!notification.isRead && (
        <div className="flex-shrink-0">
          <div className="h-2 w-2 bg-blue-500 rounded-full" />
        </div>
      )}
    </div>
  )
}