# Notification System Usage Guide

## Overview
The DMCA Guard Platform V2 includes a comprehensive real-time notification system with WebSocket support, multiple delivery channels, and a modern UI.

## Features
- 🔔 Real-time notifications via WebSocket
- 📧 Email notifications (via Resend)
- 🪝 Webhook notifications
- 🎯 Type-specific preferences
- 💾 Persistent storage
- 🎨 Beautiful UI components

## Notification Types

```typescript
enum NotificationType {
  VIOLATION_DETECTED = 'VIOLATION_DETECTED',      // New violation found
  TAKEDOWN_SUCCESS = 'TAKEDOWN_SUCCESS',          // Successful content removal
  TAKEDOWN_FAILED = 'TAKEDOWN_FAILED',            // Failed removal attempt
  SCAN_COMPLETE = 'SCAN_COMPLETE',                // Monitoring scan finished
  ABUSE_WARNING = 'ABUSE_WARNING',                // Abuse score threshold reached
  PLAN_LIMIT_WARNING = 'PLAN_LIMIT_WARNING',      // Approaching plan limits
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT'     // Platform updates
}
```

## Backend Usage

### Creating Notifications

```typescript
import { notificationService, NotificationType } from '@/lib/services/notification.service'

// Create a single notification
await notificationService.create({
  userId: 'user-id',
  type: NotificationType.VIOLATION_DETECTED,
  title: 'New violation detected',
  message: 'Unauthorized use of your content found on example.com',
  metadata: {
    url: 'https://example.com/infringing-content',
    platform: 'Website',
    violationId: 'violation-123'
  }
})

// Create batch notifications
await notificationService.createBatch([
  {
    userId: 'user-1',
    type: NotificationType.SCAN_COMPLETE,
    title: 'Scan completed',
    message: 'Found 5 violations across 20 sites'
  },
  {
    userId: 'user-2',
    type: NotificationType.PLAN_LIMIT_WARNING,
    title: 'Approaching scan limit',
    message: 'You have used 80% of your monthly scans'
  }
])

// System-wide announcement
await notificationService.createSystemAnnouncement(
  'Scheduled Maintenance',
  'The platform will undergo maintenance on Saturday from 2-4 AM'
)
```

### Integration in Services

```typescript
// Example: In takedown service
class TakedownService {
  async sendTakedownRequest(takedownId: string) {
    try {
      // ... send takedown logic
      
      await notificationService.create({
        userId: takedown.userId,
        type: NotificationType.TAKEDOWN_SUCCESS,
        title: 'Takedown successful',
        message: `Content removed from ${takedown.platform}`,
        takedownRequestId: takedownId
      })
    } catch (error) {
      await notificationService.create({
        userId: takedown.userId,
        type: NotificationType.TAKEDOWN_FAILED,
        title: 'Takedown failed',
        message: `Failed to remove content: ${error.message}`,
        takedownRequestId: takedownId
      })
    }
  }
}
```

## Frontend Usage

### Using the Notification Hook

```typescript
import { useNotifications } from '@/hooks/use-notifications'

function MyComponent() {
  const { 
    notifications, 
    unreadCount, 
    isLoading,
    isConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification 
  } = useNotifications()

  return (
    <div>
      <h2>Notifications ({unreadCount} unread)</h2>
      {notifications.map(notification => (
        <div 
          key={notification.id}
          onClick={() => markAsRead(notification.id)}
        >
          <h3>{notification.title}</h3>
          <p>{notification.message}</p>
        </div>
      ))}
    </div>
  )
}
```

### Programmatic Toast Notifications

```typescript
import { showNotificationToast, NotificationType } from '@/components/notifications/notification-toast'

// Show a success toast
showNotificationToast({
  type: NotificationType.TAKEDOWN_SUCCESS,
  title: 'Content removed!',
  message: 'The infringing content has been successfully removed.',
  onAction: () => {
    router.push('/dashboard/takedown-requests')
  }
})

// Show an error toast
showNotificationToast({
  type: NotificationType.VIOLATION_DETECTED,
  title: 'New violation found!',
  message: '3 new violations detected on YouTube',
  onAction: () => {
    router.push('/dashboard/detected-content')
  }
})
```

## API Endpoints

### List Notifications
```http
GET /api/notifications?unreadOnly=true&limit=50&offset=0&types=VIOLATION_DETECTED,TAKEDOWN_SUCCESS
```

### Mark as Read
```http
POST /api/notifications/{id}/mark-read
```

### Mark All as Read
```http
POST /api/notifications/mark-all-read
```

### Delete Notification
```http
DELETE /api/notifications/{id}
```

### Get/Update Preferences
```http
GET /api/notifications/preferences
PATCH /api/notifications/preferences
{
  "inApp": true,
  "email": true,
  "webhook": false,
  "preferences": {
    "VIOLATION_DETECTED": {
      "email": true,
      "webhook": true
    }
  }
}
```

## WebSocket Events

The notification system uses Socket.io with the `/notifications` namespace:

### Client Events
- `join` - Join user room
- `leave` - Leave user room

### Server Events
- `notification:new` - New notification created
- `notification:updated` - Notification marked as read
- `notification:bulk_update` - Multiple notifications updated
- `notification:deleted` - Notification deleted

## Email Configuration

Set up Resend for email notifications:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

## Webhook Configuration

Users can configure webhook URLs to receive notifications:

```typescript
// Example webhook payload
{
  "id": "notification-123",
  "type": "VIOLATION_DETECTED",
  "title": "New violation detected",
  "message": "Unauthorized content found",
  "userId": "user-123",
  "createdAt": "2024-01-15T10:30:00Z",
  "metadata": {
    "url": "https://example.com",
    "platform": "Website"
  }
}
```

## Best Practices

1. **Batch Operations**: Use `createBatch` for multiple notifications to reduce database queries
2. **Metadata**: Include relevant metadata for actionable notifications
3. **Rate Limiting**: Implement notification rate limiting to prevent spam
4. **Preferences**: Respect user preferences for notification channels
5. **Real-time**: Leverage WebSocket for instant delivery of critical notifications

## Troubleshooting

### Notifications not appearing in real-time
- Check WebSocket connection in browser console
- Verify Socket.io server is running
- Ensure user is authenticated

### Email notifications not sending
- Verify RESEND_API_KEY is set
- Check Resend dashboard for errors
- Ensure user has valid email address

### High notification volume
- Implement batching for similar notifications
- Add cooldown periods for non-critical notifications
- Use notification preferences to filter by type