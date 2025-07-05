import crypto from 'crypto'
import { NextRequest } from 'next/server'

export interface SignatureOptions {
  algorithm?: string
  expirationMs?: number
  includeBody?: boolean
}

export interface SignatureValidation {
  isValid: boolean
  error?: string
  timestamp?: number
}

const DEFAULT_OPTIONS: SignatureOptions = {
  algorithm: 'sha256',
  expirationMs: 5 * 60 * 1000, // 5 minutes
  includeBody: true
}

export class RequestSigner {
  private secret: string

  constructor(secret?: string) {
    this.secret = secret || process.env.API_SIGNING_SECRET || ''
    if (!this.secret) {
      console.warn('[RequestSigner] No signing secret configured')
    }
  }

  /**
   * Generate a signature for a request
   */
  async generateSignature(
    method: string,
    path: string,
    timestamp: number,
    body?: any,
    options: SignatureOptions = {}
  ): Promise<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    
    // Create the string to sign
    const parts = [
      method.toUpperCase(),
      path,
      timestamp.toString()
    ]

    // Include body hash if requested and body exists
    if (opts.includeBody && body) {
      const bodyString = typeof body === 'string' ? body : JSON.stringify(body)
      const bodyHash = crypto
        .createHash(opts.algorithm!)
        .update(bodyString)
        .digest('hex')
      parts.push(bodyHash)
    }

    const stringToSign = parts.join('\n')

    // Generate HMAC
    const signature = crypto
      .createHmac(opts.algorithm!, this.secret)
      .update(stringToSign)
      .digest('hex')

    return signature
  }

  /**
   * Validate a request signature
   */
  async validateSignature(
    request: NextRequest,
    body?: any,
    options: SignatureOptions = {}
  ): Promise<SignatureValidation> {
    const opts = { ...DEFAULT_OPTIONS, ...options }

    // Extract signature and timestamp from headers
    const signature = request.headers.get('x-signature')
    const timestampStr = request.headers.get('x-timestamp')

    if (!signature || !timestampStr) {
      return {
        isValid: false,
        error: 'Missing signature or timestamp headers'
      }
    }

    const timestamp = parseInt(timestampStr, 10)
    if (isNaN(timestamp)) {
      return {
        isValid: false,
        error: 'Invalid timestamp format'
      }
    }

    // Check timestamp expiration
    const now = Date.now()
    if (now - timestamp > opts.expirationMs!) {
      return {
        isValid: false,
        error: 'Signature expired',
        timestamp
      }
    }

    // Prevent replay attacks - timestamp can't be in the future
    if (timestamp > now + 60000) { // Allow 1 minute clock drift
      return {
        isValid: false,
        error: 'Invalid timestamp (future)',
        timestamp
      }
    }

    // Generate expected signature
    const method = request.method
    const path = new URL(request.url).pathname
    const expectedSignature = await this.generateSignature(
      method,
      path,
      timestamp,
      body,
      opts
    )

    // Compare signatures
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )

    return {
      isValid,
      timestamp,
      error: isValid ? undefined : 'Invalid signature'
    }
  }

  /**
   * Sign a fetch request
   */
  async signRequest(
    url: string,
    options: RequestInit & { body?: any } = {},
    signOptions: SignatureOptions = {}
  ): Promise<RequestInit> {
    const method = options.method || 'GET'
    const parsedUrl = new URL(url)
    const path = parsedUrl.pathname
    const timestamp = Date.now()

    const signature = await this.generateSignature(
      method,
      path,
      timestamp,
      options.body,
      signOptions
    )

    return {
      ...options,
      headers: {
        ...options.headers,
        'x-signature': signature,
        'x-timestamp': timestamp.toString()
      }
    }
  }
}

// Default instance
export const requestSigner = new RequestSigner()

/**
 * Middleware to validate signed requests
 */
export function requireSignature(options: SignatureOptions = {}) {
  return async (request: NextRequest) => {
    // Parse body if needed
    let body
    if (options.includeBody && request.method !== 'GET') {
      try {
        const text = await request.text()
        body = text ? JSON.parse(text) : undefined
      } catch {
        body = undefined
      }
    }

    const validation = await requestSigner.validateSignature(request, body, options)
    
    if (!validation.isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request signature',
          error: validation.error
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Continue with the request
    return null
  }
}

/**
 * Helper to check if an endpoint should be protected
 */
export function shouldProtectEndpoint(pathname: string): boolean {
  const protectedPatterns = [
    /^\/api\/takedown/,
    /^\/api\/abuse/,
    /^\/api\/payment/,
    /^\/api\/admin/,
    /^\/api\/cron/,
    /^\/api\/brand-profiles.*\/(delete|ownership)/,
    /^\/api\/monitoring-sessions.*\/delete/
  ]

  return protectedPatterns.some(pattern => pattern.test(pathname))
}

/**
 * Generate API key for a user
 */
export function generateApiKey(userId: string): string {
  const timestamp = Date.now()
  const random = crypto.randomBytes(16).toString('hex')
  const data = `${userId}:${timestamp}:${random}`
  
  return Buffer.from(data).toString('base64url')
}

/**
 * Parse API key
 */
export function parseApiKey(apiKey: string): { userId: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(apiKey, 'base64url').toString()
    const [userId, timestamp] = decoded.split(':')
    
    return {
      userId,
      timestamp: parseInt(timestamp, 10)
    }
  } catch {
    return null
  }
}