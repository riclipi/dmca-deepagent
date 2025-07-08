// lib/validations/schemas.ts - Zod validation schemas for all entities

import { z } from 'zod'
import { 
  PlanType, 
  UserStatus, 
  ContentType, 
  Priority, 
  TakedownType,
  SiteCategory,
  ContentStatus,
  SessionStatus
} from '@prisma/client'
import { CommonSchemas, SecurityValidators } from '@/lib/middleware/validation'

// ===================================================================
// USER SCHEMAS
// ===================================================================

export const UserSchemas = {
  // User registration
  register: z.object({
    email: CommonSchemas.email,
    password: SecurityValidators.strongPassword,
    name: z.string().min(2).max(100),
    phone: z.string().regex(/^\+?[\d\s-()]+$/).optional(),
    acceptTerms: z.boolean().refine(val => val === true, {
      message: 'You must accept the terms and conditions'
    })
  }),
  
  // User login
  login: z.object({
    email: CommonSchemas.email,
    password: z.string().min(1, 'Password is required')
  }),
  
  // Update profile
  updateProfile: z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z.string().regex(/^\+?[\d\s-()]+$/).optional(),
    address: z.string().max(500).optional(),
    dateOfBirth: z.string().datetime().optional()
  }),
  
  // Change password
  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword: SecurityValidators.strongPassword,
    confirmPassword: z.string()
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
}

// ===================================================================
// BRAND PROFILE SCHEMAS
// ===================================================================

export const BrandProfileSchemas = {
  // Create brand profile
  create: z.object({
    brandName: z.string()
      .min(2, 'Brand name must be at least 2 characters')
      .max(100, 'Brand name must be less than 100 characters')
      .regex(/^[a-zA-Z0-9\s\-_.&]+$/, 'Brand name contains invalid characters'),
    description: z.string().max(500).optional(),
    officialUrls: z.array(CommonSchemas.url).min(1, 'At least one official URL is required'),
    socialMedia: z.object({
      twitter: z.string().optional(),
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional()
    }).optional(),
    keywords: z.array(z.string().min(1).max(50))
      .max(100, 'Maximum 100 keywords allowed')
      .optional()
  }),
  
  // Update brand profile
  update: z.object({
    brandName: z.string().min(2).max(100).optional(),
    description: z.string().max(500).optional(),
    officialUrls: z.array(CommonSchemas.url).optional(),
    socialMedia: z.object({
      twitter: z.string().optional(),
      instagram: z.string().optional(),
      facebook: z.string().optional(),
      tiktok: z.string().optional(),
      youtube: z.string().optional()
    }).optional(),
    keywords: z.array(z.string().min(1).max(50)).optional(),
    isActive: z.boolean().optional()
  }),
  
  // Safe keywords management
  updateKeywords: z.object({
    safeKeywords: z.array(z.string().min(1).max(50)).optional(),
    moderateKeywords: z.array(z.string().min(1).max(50)).optional(),
    dangerousKeywords: z.array(z.string().min(1).max(50)).optional()
  })
}

// ===================================================================
// MONITORING SESSION SCHEMAS
// ===================================================================

export const MonitoringSessionSchemas = {
  // Create monitoring session
  create: z.object({
    brandProfileId: CommonSchemas.id,
    name: z.string().min(3).max(100),
    description: z.string().max(500).optional(),
    targetPlatforms: z.array(z.string()).min(1, 'Select at least one platform'),
    customKeywords: z.array(z.string()).optional(),
    excludeKeywords: z.array(z.string()).optional(),
    scanFrequency: z.number().min(1).max(168).default(24), // hours
    isActive: z.boolean().default(true)
  }),
  
  // Update monitoring session
  update: z.object({
    name: z.string().min(3).max(100).optional(),
    description: z.string().max(500).optional(),
    targetPlatforms: z.array(z.string()).optional(),
    customKeywords: z.array(z.string()).optional(),
    excludeKeywords: z.array(z.string()).optional(),
    scanFrequency: z.number().min(1).max(168).optional(),
    isActive: z.boolean().optional(),
    status: z.nativeEnum(SessionStatus).optional()
  }),
  
  // Search/filter sessions
  search: z.object({
    brandProfileId: CommonSchemas.id.optional(),
    status: z.nativeEnum(SessionStatus).optional(),
    isActive: z.boolean().optional(),
    ...CommonSchemas.pagination.shape,
    ...CommonSchemas.dateRange.shape
  })
}

// ===================================================================
// DETECTED CONTENT SCHEMAS
// ===================================================================

export const DetectedContentSchemas = {
  // Review detected content
  review: z.object({
    isConfirmed: z.boolean(),
    priority: z.nativeEnum(Priority).optional(),
    notes: z.string().max(1000).optional()
  }),
  
  // Bulk review
  bulkReview: z.object({
    contentIds: z.array(CommonSchemas.id).min(1).max(100),
    action: z.enum(['confirm', 'reject', 'ignore']),
    priority: z.nativeEnum(Priority).optional()
  }),
  
  // Search detected content
  search: z.object({
    brandProfileId: CommonSchemas.id.optional(),
    monitoringSessionId: CommonSchemas.id.optional(),
    status: z.nativeEnum(ContentStatus).optional(),
    contentType: z.nativeEnum(ContentType).optional(),
    platform: z.string().optional(),
    isConfirmed: z.boolean().optional(),
    priority: z.nativeEnum(Priority).optional(),
    ...CommonSchemas.pagination.shape,
    ...CommonSchemas.dateRange.shape
  })
}

// ===================================================================
// TAKEDOWN REQUEST SCHEMAS
// ===================================================================

export const TakedownRequestSchemas = {
  // Create takedown request
  create: z.object({
    detectedContentId: CommonSchemas.id,
    requestType: z.nativeEnum(TakedownType),
    priority: z.number().min(1).max(10).default(5),
    subject: z.string().min(10).max(200),
    message: z.string().min(50).max(5000),
    attachments: z.array(CommonSchemas.fileUpload).max(10).optional()
  }),
  
  // Update takedown request
  update: z.object({
    status: z.enum(['ACKNOWLEDGED', 'IN_REVIEW', 'REMOVED', 'REJECTED']).optional(),
    notes: z.string().max(1000).optional(),
    responseReceived: z.string().max(5000).optional()
  }),
  
  // Search takedown requests
  search: z.object({
    userId: CommonSchemas.id.optional(),
    status: z.string().optional(), // Multiple statuses as comma-separated
    requestType: z.nativeEnum(TakedownType).optional(),
    priority: z.number().min(1).max(10).optional(),
    ...CommonSchemas.pagination.shape,
    ...CommonSchemas.dateRange.shape
  })
}

// ===================================================================
// SEARCH & SCAN SCHEMAS
// ===================================================================

export const SearchSchemas = {
  // Keyword search
  keywordSearch: z.object({
    keyword: z.string()
      .min(2, 'Keyword must be at least 2 characters')
      .max(100, 'Keyword must be less than 100 characters'),
    brandProfileId: CommonSchemas.id,
    platforms: z.array(z.string()).optional(),
    limit: z.number().min(1).max(100).default(20)
  }),
  
  // Site scan
  siteScan: z.object({
    brandProfileId: CommonSchemas.id,
    siteIds: z.array(CommonSchemas.id).min(1).max(50),
    priority: z.enum(['low', 'medium', 'high']).default('medium')
  }),
  
  // Image search
  imageSearch: z.object({
    brandProfileId: CommonSchemas.id,
    imageIds: z.array(CommonSchemas.id).min(1).max(10)
  })
}

// ===================================================================
// ADMIN SCHEMAS
// ===================================================================

export const AdminSchemas = {
  // User management
  updateUser: z.object({
    status: z.nativeEnum(UserStatus).optional(),
    planType: z.nativeEnum(PlanType).optional(),
    planExpiresAt: z.string().datetime().optional(),
    emailVerified: z.boolean().optional()
  }),
  
  // Known sites management
  addKnownSite: z.object({
    domain: z.string().min(3).max(255),
    category: z.nativeEnum(SiteCategory),
    platform: z.string().optional(),
    riskScore: z.number().min(0).max(100).optional()
  }),
  
  // System configuration
  updateConfig: z.object({
    key: z.string().regex(/^[A-Z_]+$/),
    value: z.union([z.string(), z.number(), z.boolean()]),
    description: z.string().optional()
  })
}

// ===================================================================
// WEBHOOK SCHEMAS
// ===================================================================

export const WebhookSchemas = {
  // Payment webhook
  paymentWebhook: z.object({
    event: z.enum(['payment.success', 'payment.failed', 'subscription.created', 'subscription.cancelled']),
    customerId: z.string(),
    amount: z.number().optional(),
    currency: z.string().optional(),
    subscriptionId: z.string().optional(),
    metadata: z.record(z.unknown()).optional()
  }),
  
  // External service webhook
  serviceWebhook: z.object({
    service: z.string(),
    event: z.string(),
    data: z.record(z.unknown()),
    signature: z.string(),
    timestamp: z.string().datetime()
  })
}

// ===================================================================
// FILE UPLOAD SCHEMAS
// ===================================================================

export const FileUploadSchemas = {
  // Reference image upload
  referenceImage: z.object({
    brandProfileId: CommonSchemas.id,
    title: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    tags: z.array(z.string()).max(20).optional(),
    file: CommonSchemas.fileUpload.extend({
      mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp'])
    })
  }),
  
  // Evidence upload
  evidence: z.object({
    takedownRequestId: CommonSchemas.id,
    description: z.string().max(500),
    file: CommonSchemas.fileUpload.extend({
      mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    })
  })
}

// ===================================================================
// NOTIFICATION SCHEMAS
// ===================================================================

export const NotificationSchemas = {
  // Mark as read
  markAsRead: z.object({
    notificationIds: z.array(CommonSchemas.id).min(1).max(100)
  }),
  
  // Update preferences
  updatePreferences: z.object({
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    notificationTypes: z.object({
      newDetection: z.boolean().optional(),
      takedownUpdate: z.boolean().optional(),
      scanComplete: z.boolean().optional(),
      accountUpdate: z.boolean().optional()
    }).optional()
  })
}

// ===================================================================
// EXPORT ALL SCHEMAS
// ===================================================================

export const ValidationSchemas = {
  user: UserSchemas,
  brandProfile: BrandProfileSchemas,
  monitoringSession: MonitoringSessionSchemas,
  detectedContent: DetectedContentSchemas,
  takedownRequest: TakedownRequestSchemas,
  search: SearchSchemas,
  admin: AdminSchemas,
  webhook: WebhookSchemas,
  fileUpload: FileUploadSchemas,
  notification: NotificationSchemas
}