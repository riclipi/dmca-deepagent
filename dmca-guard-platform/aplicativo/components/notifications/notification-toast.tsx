'use client'

import React from 'react'
import { toast as sonnerToast } from 'sonner'
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  FileSearch, 
  AlertTriangle, 
  TrendingUp, 
  Megaphone 
} from 'lucide-react'
import { NotificationType } from '@/lib/services/notification.service'

interface NotificationToastProps {
  type: NotificationType
  title: string
  message: string
  onAction?: () => void
}

export function showNotificationToast({ type, title, message, onAction }: NotificationToastProps) {
  const getIcon = () => {
    switch (type) {
      case NotificationType.VIOLATION_DETECTED:
        return <AlertCircle className="h-5 w-5" />
      case NotificationType.TAKEDOWN_SUCCESS:
        return <CheckCircle className="h-5 w-5" />
      case NotificationType.TAKEDOWN_FAILED:
        return <XCircle className="h-5 w-5" />
      case NotificationType.SCAN_COMPLETE:
        return <FileSearch className="h-5 w-5" />
      case NotificationType.ABUSE_WARNING:
        return <AlertTriangle className="h-5 w-5" />
      case NotificationType.PLAN_LIMIT_WARNING:
        return <TrendingUp className="h-5 w-5" />
      case NotificationType.SYSTEM_ANNOUNCEMENT:
        return <Megaphone className="h-5 w-5" />
      default:
        return <AlertCircle className="h-5 w-5" />
    }
  }

  const getToastType = () => {
    switch (type) {
      case NotificationType.TAKEDOWN_SUCCESS:
        return 'success'
      case NotificationType.VIOLATION_DETECTED:
      case NotificationType.TAKEDOWN_FAILED:
      case NotificationType.ABUSE_WARNING:
        return 'error'
      case NotificationType.PLAN_LIMIT_WARNING:
        return 'warning'
      default:
        return 'message'
    }
  }

  const toastType = getToastType()
  const icon = getIcon()

  // Create the toast based on type
  if (toastType === 'success') {
    sonnerToast.success(title, {
      description: message,
      icon,
      action: onAction ? {
        label: 'View',
        onClick: onAction
      } : undefined
    })
  } else if (toastType === 'error') {
    sonnerToast.error(title, {
      description: message,
      icon,
      action: onAction ? {
        label: 'View',
        onClick: onAction
      } : undefined
    })
  } else if (toastType === 'warning') {
    sonnerToast.warning(title, {
      description: message,
      icon,
      action: onAction ? {
        label: 'View',
        onClick: onAction
      } : undefined
    })
  } else {
    sonnerToast(title, {
      description: message,
      icon,
      action: onAction ? {
        label: 'View',
        onClick: onAction
      } : undefined
    })
  }
}

// Re-export for convenience
export { NotificationType }