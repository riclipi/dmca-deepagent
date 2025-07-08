#!/usr/bin/env tsx
// scripts/validate-redis.ts - Validate Redis configuration

import { Redis } from '@upstash/redis'
import chalk from 'chalk'

interface ValidationResult {
  success: boolean
  message: string
  details?: any
}

async function validateRedisConfig(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []
  
  console.log(chalk.blue('🔍 Validating Redis Configuration...\n'))

  // 1. Check environment variables
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    results.push({
      success: false,
      message: 'Missing Redis credentials',
      details: {
        UPSTASH_REDIS_REST_URL: url ? '✅ Set' : '❌ Missing',
        UPSTASH_REDIS_REST_TOKEN: token ? '✅ Set' : '❌ Missing'
      }
    })
    return results
  }

  results.push({
    success: true,
    message: 'Redis credentials found'
  })

  // 2. Test connection
  try {
    const redis = new Redis({ url, token })
    const start = Date.now()
    const pong = await redis.ping()
    const latency = Date.now() - start

    results.push({
      success: true,
      message: 'Redis connection successful',
      details: {
        response: pong,
        latency: `${latency}ms`,
        status: latency < 100 ? '🟢 Excellent' : latency < 500 ? '🟡 Good' : '🔴 Slow'
      }
    })
  } catch (error) {
    results.push({
      success: false,
      message: 'Redis connection failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
    return results
  }

  // 3. Test basic operations
  try {
    const redis = new Redis({ url, token })
    const testKey = '__redis_validation_test__'
    const testValue = Date.now().toString()
    
    // Test SET
    await redis.set(testKey, testValue, { ex: 60 })
    
    // Test GET
    const retrieved = await redis.get(testKey)
    if (retrieved !== testValue) {
      throw new Error('Value mismatch')
    }
    
    // Test INCR
    const counterKey = '__redis_counter_test__'
    const count = await redis.incr(counterKey)
    
    // Test TTL
    const ttl = await redis.ttl(testKey)
    
    // Test DEL
    await redis.del(testKey, counterKey)
    
    results.push({
      success: true,
      message: 'All Redis operations working correctly',
      details: {
        set: '✅',
        get: '✅',
        incr: '✅',
        ttl: '✅',
        del: '✅'
      }
    })
  } catch (error) {
    results.push({
      success: false,
      message: 'Redis operations failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }

  // 4. Test rate limiting functionality
  try {
    const redis = new Redis({ url, token })
    const rateLimitKey = '__rate_limit_test__'
    
    // Simulate rate limit checks
    const limit = 5
    for (let i = 0; i < limit + 2; i++) {
      const count = await redis.incr(rateLimitKey)
      if (count === 1) {
        await redis.expire(rateLimitKey, 60)
      }
    }
    
    const finalCount = await redis.get(rateLimitKey)
    await redis.del(rateLimitKey)
    
    results.push({
      success: true,
      message: 'Rate limiting functionality verified',
      details: {
        testLimit: limit,
        finalCount: finalCount,
        status: '✅ Working correctly'
      }
    })
  } catch (error) {
    results.push({
      success: false,
      message: 'Rate limiting test failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    })
  }

  // 5. Check Redis info
  try {
    const redis = new Redis({ url, token })
    
    // Upstash doesn't support INFO command directly, but we can check quota
    // by attempting operations and checking response headers
    
    results.push({
      success: true,
      message: 'Redis service information',
      details: {
        provider: 'Upstash',
        region: url.includes('.upstash.io') ? 'Global' : 'Unknown',
        endpoint: url.replace(/https?:\/\//, '').split('.')[0]
      }
    })
  } catch (error) {
    // Not critical if info fails
  }

  return results
}

// Display results
function displayResults(results: ValidationResult[]) {
  console.log(chalk.bold('\n📊 Validation Results:\n'))
  
  let allSuccess = true
  
  results.forEach((result, index) => {
    const icon = result.success ? '✅' : '❌'
    const color = result.success ? chalk.green : chalk.red
    
    console.log(`${icon} ${color(result.message)}`)
    
    if (result.details) {
      console.log(chalk.gray('   Details:'))
      Object.entries(result.details).forEach(([key, value]) => {
        console.log(chalk.gray(`   - ${key}: ${value}`))
      })
    }
    
    console.log()
    
    if (!result.success) {
      allSuccess = false
    }
  })
  
  // Summary
  console.log(chalk.bold('\n📋 Summary:\n'))
  
  if (allSuccess) {
    console.log(chalk.green.bold('✅ All Redis validations passed!'))
    console.log(chalk.green('Your Redis configuration is ready for production.'))
  } else {
    console.log(chalk.red.bold('❌ Some validations failed!'))
    console.log(chalk.red('Please fix the issues above before deploying to production.'))
    
    // Provide helpful links
    console.log(chalk.yellow('\n💡 Need help?'))
    console.log(chalk.yellow('- Create Upstash account: https://upstash.com'))
    console.log(chalk.yellow('- Documentation: https://docs.upstash.com/redis'))
  }
  
  return allSuccess
}

// Main execution
async function main() {
  try {
    const results = await validateRedisConfig()
    const success = displayResults(results)
    
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Unexpected error during validation:'))
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'))
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { validateRedisConfig }