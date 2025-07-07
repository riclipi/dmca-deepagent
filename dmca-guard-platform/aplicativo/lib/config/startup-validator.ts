/**
 * Startup Validator
 * Validates environment and configuration at application startup
 */

import { validateProductionEnvironment } from './production-validator';

export class StartupValidator {
  static async validate(): Promise<void> {
    console.log('🚀 Starting DMCA Guard Platform...');
    
    try {
      // Validate production environment if in production
      if (process.env.NODE_ENV === 'production') {
        validateProductionEnvironment();
        
        // Additional production checks
        this.checkForMockImplementations();
        this.validateSearchEngineConfig();
      }
      
      // Common validations for all environments
      this.validateDatabaseConnection();
      this.checkRequiredServices();
      
      console.log('✅ All validations passed. Application ready to start.');
    } catch (error) {
      console.error('❌ Startup validation failed:', error);
      
      // In production, exit the process
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
      
      // In development, just warn
      console.warn('⚠️  Running in development mode with validation errors');
    }
  }
  
  private static checkForMockImplementations(): void {
    // Check if real-time scanner is using mock data
    if (process.env.USE_MOCK_SCANNER === 'true') {
      throw new Error('Mock scanner is enabled in production. Set USE_MOCK_SCANNER=false');
    }
    
    // Check if search engines are properly configured
    if (!process.env.SERPER_API_KEY && !process.env.GOOGLE_API_KEY) {
      throw new Error('No search engine API configured. Production requires real search capabilities.');
    }
  }
  
  private static validateSearchEngineConfig(): void {
    // Ensure at least one search engine is properly configured
    const searchEngines = {
      serper: !!process.env.SERPER_API_KEY,
      google: !!(process.env.GOOGLE_API_KEY && process.env.GOOGLE_CSE_ID)
    };
    
    if (!Object.values(searchEngines).some(Boolean)) {
      throw new Error('No search engine properly configured for production');
    }
    
    console.log('✅ Search engines configured:', 
      Object.entries(searchEngines)
        .filter(([_, enabled]) => enabled)
        .map(([name]) => name)
        .join(', ')
    );
  }
  
  private static async validateDatabaseConnection(): Promise<void> {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not configured');
    }
    
    // In a real implementation, you would test the database connection
    console.log('✅ Database configuration validated');
  }
  
  private static checkRequiredServices(): void {
    const services = {
      'Authentication': process.env.NEXTAUTH_SECRET,
      'Email Service': process.env.RESEND_API_KEY,
      'Redis Cache': process.env.UPSTASH_REDIS_REST_URL || process.env.NODE_ENV !== 'production'
    };
    
    const missingServices = Object.entries(services)
      .filter(([_, configured]) => !configured)
      .map(([name]) => name);
    
    if (missingServices.length > 0) {
      throw new Error(`Missing required services: ${missingServices.join(', ')}`);
    }
    
    console.log('✅ All required services configured');
  }
}

// Export for use in server startup
export async function runStartupValidation(): Promise<void> {
  await StartupValidator.validate();
}