import { RequestSigner, shouldProtectEndpoint, generateApiKey, parseApiKey } from '@/lib/security/request-signing'
import { NextRequest } from 'next/server'

describe('RequestSigner', () => {
  let signer: RequestSigner
  const testSecret = 'test-secret-key'

  beforeEach(() => {
    process.env.API_SIGNING_SECRET = testSecret
    signer = new RequestSigner()
  })

  describe('generateSignature', () => {
    it('should generate consistent signatures for same input', async () => {
      const method = 'POST'
      const path = '/api/test'
      const timestamp = Date.now()
      const body = { test: 'data' }

      const sig1 = await signer.generateSignature(method, path, timestamp, body)
      const sig2 = await signer.generateSignature(method, path, timestamp, body)

      expect(sig1).toBe(sig2)
      expect(sig1).toMatch(/^[a-f0-9]{64}$/) // SHA256 hex
    })

    it('should generate different signatures for different inputs', async () => {
      const timestamp = Date.now()

      const sig1 = await signer.generateSignature('GET', '/api/test1', timestamp)
      const sig2 = await signer.generateSignature('GET', '/api/test2', timestamp)
      const sig3 = await signer.generateSignature('POST', '/api/test1', timestamp)

      expect(sig1).not.toBe(sig2)
      expect(sig1).not.toBe(sig3)
      expect(sig2).not.toBe(sig3)
    })

    it('should include body hash when specified', async () => {
      const method = 'POST'
      const path = '/api/test'
      const timestamp = Date.now()
      const body = { test: 'data' }

      const sigWithBody = await signer.generateSignature(method, path, timestamp, body, { includeBody: true })
      const sigWithoutBody = await signer.generateSignature(method, path, timestamp, body, { includeBody: false })

      expect(sigWithBody).not.toBe(sigWithoutBody)
    })
  })

  describe('validateSignature', () => {
    it('should validate correct signature', async () => {
      const method = 'POST'
      const path = '/api/test'
      const timestamp = Date.now()
      const body = { test: 'data' }

      const signature = await signer.generateSignature(method, path, timestamp, body)

      const request = new NextRequest('http://localhost:3000' + path, {
        method,
        headers: {
          'x-signature': signature,
          'x-timestamp': timestamp.toString()
        }
      })

      const validation = await signer.validateSignature(request, body)

      expect(validation.isValid).toBe(true)
      expect(validation.error).toBeUndefined()
      expect(validation.timestamp).toBe(timestamp)
    })

    it('should reject missing signature headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        method: 'POST'
      })

      const validation = await signer.validateSignature(request)

      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain('Missing signature')
    })

    it('should reject expired signatures', async () => {
      const method = 'GET'
      const path = '/api/test'
      const oldTimestamp = Date.now() - (10 * 60 * 1000) // 10 minutes ago

      const signature = await signer.generateSignature(method, path, oldTimestamp)

      const request = new NextRequest('http://localhost:3000' + path, {
        method,
        headers: {
          'x-signature': signature,
          'x-timestamp': oldTimestamp.toString()
        }
      })

      const validation = await signer.validateSignature(request)

      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain('expired')
    })

    it('should reject future timestamps', async () => {
      const method = 'GET'
      const path = '/api/test'
      const futureTimestamp = Date.now() + (2 * 60 * 1000) // 2 minutes in future

      const signature = await signer.generateSignature(method, path, futureTimestamp)

      const request = new NextRequest('http://localhost:3000' + path, {
        method,
        headers: {
          'x-signature': signature,
          'x-timestamp': futureTimestamp.toString()
        }
      })

      const validation = await signer.validateSignature(request)

      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain('future')
    })

    it('should reject tampered signatures', async () => {
      const method = 'POST'
      const path = '/api/test'
      const timestamp = Date.now()
      const body = { test: 'data' }

      const signature = await signer.generateSignature(method, path, timestamp, body)
      const tamperedSignature = signature.slice(0, -2) + 'ff' // Change last 2 chars

      const request = new NextRequest('http://localhost:3000' + path, {
        method,
        headers: {
          'x-signature': tamperedSignature,
          'x-timestamp': timestamp.toString()
        }
      })

      const validation = await signer.validateSignature(request, body)

      expect(validation.isValid).toBe(false)
      expect(validation.error).toContain('Invalid signature')
    })
  })

  describe('signRequest', () => {
    it('should add signature headers to request', async () => {
      const url = 'http://localhost:3000/api/test'
      const options = {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const signedOptions = await signer.signRequest(url, options)

      expect(signedOptions.headers).toBeDefined()
      expect(signedOptions.headers!['x-signature']).toMatch(/^[a-f0-9]{64}$/)
      expect(signedOptions.headers!['x-timestamp']).toMatch(/^\d+$/)
      expect(signedOptions.headers!['Content-Type']).toBe('application/json')
    })
  })
})

describe('shouldProtectEndpoint', () => {
  it('should protect critical endpoints', () => {
    expect(shouldProtectEndpoint('/api/takedown/request')).toBe(true)
    expect(shouldProtectEndpoint('/api/abuse/report')).toBe(true)
    expect(shouldProtectEndpoint('/api/payment/process')).toBe(true)
    expect(shouldProtectEndpoint('/api/admin/users')).toBe(true)
    expect(shouldProtectEndpoint('/api/cron/abuse-monitoring')).toBe(true)
    expect(shouldProtectEndpoint('/api/brand-profiles/123/delete')).toBe(true)
    expect(shouldProtectEndpoint('/api/brand-profiles/123/ownership')).toBe(true)
    expect(shouldProtectEndpoint('/api/monitoring-sessions/456/delete')).toBe(true)
  })

  it('should not protect regular endpoints', () => {
    expect(shouldProtectEndpoint('/api/health')).toBe(false)
    expect(shouldProtectEndpoint('/api/queue/status')).toBe(false)
    expect(shouldProtectEndpoint('/api/brand-profiles')).toBe(false)
    expect(shouldProtectEndpoint('/api/brand-profiles/123')).toBe(false)
    expect(shouldProtectEndpoint('/api/monitoring-sessions')).toBe(false)
  })
})

describe('API Key functions', () => {
  describe('generateApiKey', () => {
    it('should generate unique API keys', () => {
      const userId = 'user-123'
      
      const key1 = generateApiKey(userId)
      const key2 = generateApiKey(userId)

      expect(key1).not.toBe(key2)
      expect(key1).toMatch(/^[A-Za-z0-9_-]+$/) // Base64URL format
    })

    it('should include user ID in key', () => {
      const userId = 'test-user-456'
      const key = generateApiKey(userId)
      const decoded = Buffer.from(key, 'base64url').toString()

      expect(decoded).toContain(userId)
    })
  })

  describe('parseApiKey', () => {
    it('should parse valid API key', () => {
      const userId = 'user-789'
      const key = generateApiKey(userId)
      const parsed = parseApiKey(key)

      expect(parsed).not.toBeNull()
      expect(parsed!.userId).toBe(userId)
      expect(parsed!.timestamp).toBeGreaterThan(0)
    })

    it('should return null for invalid key', () => {
      const parsed = parseApiKey('invalid-key')
      expect(parsed).toBeNull()
    })
  })
})