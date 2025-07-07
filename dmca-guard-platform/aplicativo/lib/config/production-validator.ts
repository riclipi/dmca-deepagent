/**
 * Production Environment Validator
 * Ensures all required configurations are present and valid for production
 */

export interface RequiredEnvVars {
  // Database
  DATABASE_URL: string;
  
  // Authentication
  NEXTAUTH_URL: string;
  NEXTAUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  
  // Email
  RESEND_API_KEY: string;
  RESEND_SENDER_FROM_EMAIL: string;
  RESEND_DOMAIN: string;
  RESEND_SENDER_NAME: string;
  SUPER_USER_EMAIL: string;
  
  // Search APIs (at least one required)
  SERPER_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  GOOGLE_CSE_ID?: string;
  
  // Redis (required for production)
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  
  // Security
  API_SIGNING_SECRET: string;
  CRON_SECRET: string;
}

export class ProductionValidator {
  private static errors: string[] = [];
  
  /**
   * Validates production environment
   * @throws Error if validation fails
   */
  static validate(): void {
    this.errors = [];
    
    // Only validate in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    
    console.log('🔍 Validating production environment...');
    
    // Check required environment variables
    this.validateRequiredEnvVars();
    
    // Check search API configuration
    this.validateSearchAPIs();
    
    // Check security configurations
    this.validateSecurityConfig();
    
    // Check for test/development artifacts
    this.checkForDevArtifacts();
    
    // If there are errors, throw
    if (this.errors.length > 0) {
      const errorMessage = [
        '❌ Production validation failed:',
        '',
        ...this.errors.map(e => `  • ${e}`),
        '',
        '🛠️  Please fix these issues before deploying to production.'
      ].join('\n');
      
      throw new Error(errorMessage);
    }
    
    console.log('✅ Production environment validated successfully');
  }
  
  private static validateRequiredEnvVars(): void {
    const required: (keyof RequiredEnvVars)[] = [
      'DATABASE_URL',
      'NEXTAUTH_URL',
      'NEXTAUTH_SECRET',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'RESEND_API_KEY',
      'RESEND_SENDER_FROM_EMAIL',
      'RESEND_DOMAIN',
      'RESEND_SENDER_NAME',
      'SUPER_USER_EMAIL',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
      'API_SIGNING_SECRET',
      'CRON_SECRET'
    ];
    
    for (const key of required) {
      if (!process.env[key]) {
        this.errors.push(`Missing required environment variable: ${key}`);
      }
    }
    
    // Validate formats
    if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
      this.errors.push('DATABASE_URL must be a valid PostgreSQL connection string');
    }
    
    if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith('http')) {
      this.errors.push('NEXTAUTH_URL must be a valid URL');
    }
    
    if (process.env.SUPER_USER_EMAIL && !this.isValidEmail(process.env.SUPER_USER_EMAIL)) {
      this.errors.push('SUPER_USER_EMAIL must be a valid email address');
    }
  }
  
  private static validateSearchAPIs(): void {
    const hasSerper = !!process.env.SERPER_API_KEY;
    const hasGoogle = !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID);
    
    if (!hasSerper && !hasGoogle) {
      this.errors.push('At least one search API must be configured (Serper or Google Custom Search)');
    }
    
    // Warn if APIs appear to be default/example values
    if (process.env.SERPER_API_KEY?.includes('your-') || 
        process.env.GOOGLE_API_KEY?.includes('your-')) {
      this.errors.push('Search API keys appear to be placeholder values');
    }
  }
  
  private static validateSecurityConfig(): void {
    // Check for weak secrets
    const secrets = [
      { key: 'NEXTAUTH_SECRET', minLength: 32 },
      { key: 'API_SIGNING_SECRET', minLength: 32 },
      { key: 'CRON_SECRET', minLength: 16 }
    ];
    
    for (const { key, minLength } of secrets) {
      const value = process.env[key];
      if (value) {
        if (value.length < minLength) {
          this.errors.push(`${key} is too short (minimum ${minLength} characters)`);
        }
        
        if (value.includes('test') || 
            value.includes('secret') || 
            value.includes('change-in-production') ||
            value === 'your-super-secret-signing-key-here-change-in-production') {
          this.errors.push(`${key} contains insecure placeholder value`);
        }
      }
    }
    
    // Check NEXTAUTH_URL is HTTPS in production
    if (process.env.NEXTAUTH_URL && 
        !process.env.NEXTAUTH_URL.includes('localhost') &&
        !process.env.NEXTAUTH_URL.startsWith('https://')) {
      this.errors.push('NEXTAUTH_URL must use HTTPS in production');
    }
  }
  
  private static checkForDevArtifacts(): void {
    // These should not exist in production
    const devArtifacts = [
      '/app/test',
      '/app/api/test-websocket',
      '/app/api/example-rate-limited',
      '/app/api/example-with-api-response'
    ];
    
    // Note: In a real implementation, you would check file system
    // For now, we'll just warn about their existence
    console.warn('⚠️  Ensure test endpoints are removed before production deployment');
  }
  
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  /**
   * Get safe environment configuration for logging
   * Masks sensitive values
   */
  static getSafeConfig(): Record<string, string> {
    const config: Record<string, string> = {};
    const sensitiveKeys = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'GOOGLE_CLIENT_SECRET',
      'RESEND_API_KEY',
      'UPSTASH_REDIS_REST_TOKEN',
      'API_SIGNING_SECRET',
      'CRON_SECRET',
      'SERPER_API_KEY',
      'GOOGLE_API_KEY'
    ];
    
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === 'string') {
        if (sensitiveKeys.includes(key)) {
          // Mask sensitive values
          config[key] = value.substring(0, 4) + '****' + value.substring(value.length - 4);
        } else {
          config[key] = value;
        }
      }
    }
    
    return config;
  }
}

// Export validation function
export function validateProductionEnvironment(): void {
  ProductionValidator.validate();
}