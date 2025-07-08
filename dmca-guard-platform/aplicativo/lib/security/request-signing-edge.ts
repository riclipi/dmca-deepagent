// lib/security/request-signing-edge.ts - Edge Runtime compatible version

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
  signature?: string
}

export class EdgeRequestSigner {
  private static readonly DEFAULT_ALGORITHM = 'SHA-256'
  private static readonly DEFAULT_EXPIRATION_MS = 5 * 60 * 1000 // 5 minutes

  /**
   * Generate signature for a request using Web Crypto API
   */
  static async generateSignature(
    request: NextRequest,
    secret: string,
    options: SignatureOptions = {}
  ): Promise<string> {
    const timestamp = Date.now()
    const method = request.method
    const url = request.url
    const body = options.includeBody ? await request.text() : ''
    
    // Create payload
    const payload = `${timestamp}.${method}.${url}.${body}`
    
    // Use Web Crypto API for Edge Runtime
    const encoder = new TextEncoder()
    const data = encoder.encode(payload)
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', key, data)
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    return `t=${timestamp},v1=${signatureHex}`
  }

  /**
   * Validate request signature using Web Crypto API
   */
  static async validateSignature(
    request: NextRequest,
    secret: string,
    options: SignatureOptions = {}
  ): Promise<SignatureValidation> {
    try {
      const signatureHeader = request.headers.get('x-signature')
      if (!signatureHeader) {
        return { isValid: false, error: 'Missing signature header' }
      }

      // Parse signature header
      const parts = signatureHeader.split(',')
      const timestampPart = parts.find(p => p.startsWith('t='))
      const signaturePart = parts.find(p => p.startsWith('v1='))

      if (!timestampPart || !signaturePart) {
        return { isValid: false, error: 'Invalid signature format' }
      }

      const timestamp = parseInt(timestampPart.split('=')[1])
      const providedSignature = signaturePart.split('=')[1]

      // Check expiration
      const expirationMs = options.expirationMs || EdgeRequestSigner.DEFAULT_EXPIRATION_MS
      if (Date.now() - timestamp > expirationMs) {
        return { isValid: false, error: 'Signature expired', timestamp }
      }

      // Recreate payload
      const method = request.method
      const url = request.url
      const body = options.includeBody ? await request.text() : ''
      const payload = `${timestamp}.${method}.${url}.${body}`

      // Generate expected signature
      const encoder = new TextEncoder()
      const data = encoder.encode(payload)
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      )
      
      const expectedSignature = await crypto.subtle.sign('HMAC', key, data)
      const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Compare signatures
      const isValid = providedSignature === expectedSignatureHex

      return {
        isValid,
        timestamp,
        signature: providedSignature,
        error: isValid ? undefined : 'Signature mismatch'
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Add signature to request headers
   */
  static async signRequest(
    request: NextRequest,
    secret: string,
    options: SignatureOptions = {}
  ): Promise<Headers> {
    const signature = await this.generateSignature(request, secret, options)
    const headers = new Headers(request.headers)
    headers.set('x-signature', signature)
    headers.set('x-signature-algorithm', options.algorithm || this.DEFAULT_ALGORITHM)
    return headers
  }
}

// Export for backward compatibility
export const generateSignature = EdgeRequestSigner.generateSignature
export const validateSignature = EdgeRequestSigner.validateSignature
export const signRequest = EdgeRequestSigner.signRequest