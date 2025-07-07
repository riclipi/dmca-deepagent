/**
 * Environment configuration validation
 * Ensures all required environment variables are properly set
 */

type EnvironmentConfig = {
  // Database
  DATABASE_URL: string
  
  // Authentication
  NEXTAUTH_SECRET: string
  NEXTAUTH_URL: string
  
  // Redis (required in production)
  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string
  
  // Email
  RESEND_API_KEY: string
  RESEND_SENDER_FROM_EMAIL: string
  RESEND_DOMAIN: string
  RESEND_SENDER_NAME: string
  
  // Admin
  SUPER_USER_EMAIL: string
  
  // Environment
  NODE_ENV: 'development' | 'test' | 'production'
  
  // Search API Keys (at least one required in production)
  SERPER_API_KEY?: string
  GOOGLE_API_KEY?: string
  GOOGLE_CSE_ID?: string
  
  // Security
  API_SIGNING_SECRET?: string
  CRON_SECRET?: string
}

class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EnvironmentValidationError'
  }
}

export function validateEnvironment(): EnvironmentConfig {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Helper function to check required variables
  const requireEnv = (key: string, description: string): string => {
    const value = process.env[key]
    if (!value) {
      errors.push(`Missing required environment variable: ${key} (${description})`)
      return ''
    }
    return value
  }
  
  // Helper function to check optional variables
  const optionalEnv = (key: string, description: string): string | undefined => {
    const value = process.env[key]
    if (!value) {
      warnings.push(`Missing optional environment variable: ${key} (${description})`)
    }
    return value
  }
  
  const isProduction = process.env.NODE_ENV === 'production'
  
  const config: EnvironmentConfig = {
    // Database
    DATABASE_URL: requireEnv('DATABASE_URL', 'PostgreSQL connection string'),
    
    // Authentication
    NEXTAUTH_SECRET: requireEnv('NEXTAUTH_SECRET', 'Secret for NextAuth.js'),
    NEXTAUTH_URL: requireEnv('NEXTAUTH_URL', 'NextAuth callback URL'),
    
    // Redis - required in production
    UPSTASH_REDIS_REST_URL: isProduction 
      ? requireEnv('UPSTASH_REDIS_REST_URL', 'Upstash Redis URL (required in production)')
      : optionalEnv('UPSTASH_REDIS_REST_URL', 'Upstash Redis URL'),
    UPSTASH_REDIS_REST_TOKEN: isProduction
      ? requireEnv('UPSTASH_REDIS_REST_TOKEN', 'Upstash Redis token (required in production)')
      : optionalEnv('UPSTASH_REDIS_REST_TOKEN', 'Upstash Redis token'),
    
    // Email
    RESEND_API_KEY: requireEnv('RESEND_API_KEY', 'Resend API key for email'),
    RESEND_SENDER_FROM_EMAIL: requireEnv('RESEND_SENDER_FROM_EMAIL', 'Sender email address'),
    RESEND_DOMAIN: requireEnv('RESEND_DOMAIN', 'Email domain'),
    RESEND_SENDER_NAME: requireEnv('RESEND_SENDER_NAME', 'Sender name'),
    
    // Admin
    SUPER_USER_EMAIL: requireEnv('SUPER_USER_EMAIL', 'Super admin email'),
    
    // Environment
    NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'test' | 'production',
    
    // Search API Keys
    SERPER_API_KEY: optionalEnv('SERPER_API_KEY', 'Serper API key for search'),
    GOOGLE_API_KEY: optionalEnv('GOOGLE_API_KEY', 'Google API key'),
    GOOGLE_CSE_ID: optionalEnv('GOOGLE_CSE_ID', 'Google Custom Search Engine ID'),
    
    // Security
    API_SIGNING_SECRET: isProduction
      ? requireEnv('API_SIGNING_SECRET', 'API signature secret (required in production)')
      : optionalEnv('API_SIGNING_SECRET', 'API signature secret'),
    CRON_SECRET: isProduction
      ? requireEnv('CRON_SECRET', 'Cron job secret (required in production)')
      : optionalEnv('CRON_SECRET', 'Cron job secret'),
  }
  
  // Production-specific validations
  if (isProduction) {
    // Ensure NEXTAUTH_URL is HTTPS in production
    if (!config.NEXTAUTH_URL.startsWith('https://')) {
      errors.push('NEXTAUTH_URL must use HTTPS in production')
    }
    
    // Ensure critical secrets are strong enough
    if (config.NEXTAUTH_SECRET.length < 32) {
      errors.push('NEXTAUTH_SECRET must be at least 32 characters in production')
    }
    
    if (config.API_SIGNING_SECRET && config.API_SIGNING_SECRET.length < 32) {
      errors.push('API_SIGNING_SECRET must be at least 32 characters in production')
    }
    
    if (config.CRON_SECRET && config.CRON_SECRET.length < 32) {
      errors.push('CRON_SECRET must be at least 32 characters in production')
    }
    
    // Ensure at least one search API is configured
    const hasSerperAPI = config.SERPER_API_KEY
    const hasGoogleAPI = config.GOOGLE_API_KEY && config.GOOGLE_CSE_ID
    
    if (!hasSerperAPI && !hasGoogleAPI) {
      errors.push('At least one search API must be configured in production (SERPER_API_KEY or GOOGLE_API_KEY + GOOGLE_CSE_ID)')
    }
  }
  
  // Log warnings
  if (warnings.length > 0) {
    console.warn('⚠️  Environment configuration warnings:')
    warnings.forEach(warning => console.warn(`   - ${warning}`))
  }
  
  // Throw if there are errors
  if (errors.length > 0) {
    console.error('❌ Environment configuration errors:')
    errors.forEach(error => console.error(`   - ${error}`))
    throw new EnvironmentValidationError(
      `Environment validation failed with ${errors.length} error(s). ` +
      'Please check your environment variables.'
    )
  }
  
  // Log success
  console.log('✅ Environment configuration validated successfully')
  
  return config
}

// Export validated config
export const env = validateEnvironment()