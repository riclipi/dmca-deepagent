# 🛡️ Input Validation Guide with Zod

## Overview

This guide explains how to implement secure input validation across all API routes using Zod.

## 🔒 Security Principles

1. **Never trust user input** - Always validate and sanitize
2. **Fail fast** - Validate early in the request lifecycle
3. **Be explicit** - Define exact expected shapes
4. **Sanitize everything** - Remove dangerous characters
5. **Log failures** - Track validation attempts for security monitoring

## 📋 Quick Start

### Basic Route with Validation

```typescript
import { createValidatedHandler } from '@/lib/middleware/validation'
import { ValidationSchemas } from '@/lib/validations/schemas'

// Using the validated handler wrapper
export const POST = createValidatedHandler(
  {
    body: ValidationSchemas.user.register,
    query: z.object({ ref: z.string().optional() })
  },
  async (request, { body, query }) => {
    // body and query are now typed and validated
    const user = await createUser(body)
    return ApiResponse.success(user)
  }
)
```

### Manual Validation

```typescript
import { validateRequest } from '@/lib/middleware/validation'

export async function POST(request: NextRequest) {
  const validation = await validateRequest(request, {
    body: ValidationSchemas.brandProfile.create
  })
  
  if (!validation.success) {
    return validation.error
  }
  
  const { body } = validation.data
  // Continue with validated data
}
```

## 🏗️ Schema Examples

### User Input

```typescript
const userSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: SecurityValidators.strongPassword,
  name: z.string().min(2).max(100).trim(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/).optional()
})
```

### Search Parameters

```typescript
const searchSchema = z.object({
  q: z.string().min(1).max(100),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'name', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})
```

### File Upload

```typescript
const fileSchema = z.object({
  filename: SecurityValidators.safeFilename,
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().max(10 * 1024 * 1024), // 10MB
  data: z.instanceof(Buffer)
})
```

## 🚨 Common Security Validations

### Prevent SQL Injection

```typescript
// Safe string for database queries
const safeString = z.string().regex(
  /^[a-zA-Z0-9\s\-_.@]+$/,
  'Invalid characters detected'
)
```

### Prevent Path Traversal

```typescript
// Safe file path
const safePath = z.string()
  .regex(/^[a-zA-Z0-9\-_./]+$/)
  .refine(path => !path.includes('..'), 'Path traversal detected')
```

### Prevent XSS

```typescript
// Sanitized HTML content
const safeHtml = z.string().transform(str => 
  str.replace(/<script[^>]*>.*?<\/script>/gi, '')
     .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
     .replace(/on\w+\s*=/gi, '')
)
```

### Strong Password

```typescript
const strongPassword = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character')
```

## 📊 Validation Patterns

### Pagination

```typescript
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional()
})
```

### Date Range

```typescript
const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime()
}).refine(
  data => new Date(data.startDate) <= new Date(data.endDate),
  'Start date must be before end date'
)
```

### Enum with Fallback

```typescript
const statusSchema = z.enum(['active', 'inactive', 'pending'])
  .catch('pending') // Default value on error
```

## 🔧 Advanced Techniques

### Conditional Validation

```typescript
const updateSchema = z.object({
  status: z.enum(['draft', 'published']),
  publishedAt: z.string().datetime().optional()
}).refine(
  data => data.status !== 'published' || data.publishedAt,
  'Published date required when status is published'
)
```

### Nested Object Validation

```typescript
const profileSchema = z.object({
  user: z.object({
    name: z.string(),
    email: z.string().email()
  }),
  settings: z.object({
    notifications: z.boolean(),
    theme: z.enum(['light', 'dark'])
  }).optional()
})
```

### Array Validation

```typescript
const tagsSchema = z.array(
  z.string().min(1).max(20)
).min(1).max(10)
```

### Union Types

```typescript
const contentSchema = z.union([
  z.object({ type: z.literal('text'), content: z.string() }),
  z.object({ type: z.literal('image'), url: z.string().url() }),
  z.object({ type: z.literal('video'), embedCode: z.string() })
])
```

## 🚀 Performance Tips

### 1. Reuse Schemas

```typescript
// Define once
export const userIdSchema = z.string().cuid()

// Reuse everywhere
const profileSchema = z.object({
  userId: userIdSchema,
  // ...
})
```

### 2. Lazy Validation

```typescript
// Only validate what you need
const partialValidation = schema.pick({
  email: true,
  name: true
})
```

### 3. Transform Data

```typescript
const schema = z.object({
  email: z.string().email().toLowerCase().trim(),
  tags: z.string().transform(str => str.split(',').map(s => s.trim()))
})
```

## 🛠️ Error Handling

### Custom Error Messages

```typescript
const schema = z.object({
  age: z.number().min(18, {
    message: 'You must be at least 18 years old'
  }),
  email: z.string().email({
    message: 'Please enter a valid email address'
  })
})
```

### Error Response Format

```typescript
if (!validation.success) {
  return ApiResponse.badRequest('Validation failed', {
    errors: validation.error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  })
}
```

## 📝 Checklist for New Routes

- [ ] Define input schema using Zod
- [ ] Use appropriate security validators
- [ ] Implement proper error handling
- [ ] Add validation logging for security monitoring
- [ ] Test with invalid inputs
- [ ] Document expected input format
- [ ] Consider rate limiting for sensitive endpoints

## 🔍 Common Mistakes to Avoid

1. **Not validating array lengths**
   ```typescript
   // Bad
   z.array(z.string())
   
   // Good
   z.array(z.string()).max(100)
   ```

2. **Forgetting to sanitize strings**
   ```typescript
   // Bad
   z.string()
   
   // Good
   z.string().trim().transform(sanitizeString)
   ```

3. **Too permissive schemas**
   ```typescript
   // Bad
   z.object({}).passthrough()
   
   // Good
   z.object({}).strict()
   ```

4. **Not handling empty values**
   ```typescript
   // Bad
   z.string()
   
   // Good
   z.string().min(1, 'Required field')
   ```

## 🔗 Related Files

- Validation middleware: `lib/middleware/validation.ts`
- Schema definitions: `lib/validations/schemas.ts`
- Security validators: `lib/middleware/validation.ts#SecurityValidators`
- API response helper: `lib/api-response.ts`