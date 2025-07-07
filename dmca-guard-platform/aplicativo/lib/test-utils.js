/**
 * Test Utilities for DMCA Guard Platform
 * 
 * This module provides centralized utilities for test scripts to ensure
 * safe testing practices and prevent accidental production data modification.
 */

const readline = require('readline');

/**
 * Validates that the current environment is safe for running test scripts
 * @throws {Error} If running in production environment
 */
function validateTestEnvironment() {
  const nodeEnv = process.env.NODE_ENV;
  const isTestEnv = process.env.IS_TEST_ENVIRONMENT === 'true';
  const allowTestData = process.env.ALLOW_TEST_DATA_CREATION === 'true';

  // Check if we're in production
  if (nodeEnv === 'production') {
    console.error('\n❌ ERRO CRÍTICO: Tentativa de executar script de teste em PRODUÇÃO!');
    console.error('Este script só pode ser executado em ambientes de teste.');
    console.error('Configure NODE_ENV para "test" ou "development".\n');
    process.exit(1);
  }

  // Check if test data creation is allowed
  if (!allowTestData) {
    console.error('\n⚠️  AVISO: Criação de dados de teste não está habilitada.');
    console.error('Configure ALLOW_TEST_DATA_CREATION="true" no seu arquivo .env');
    console.error('NUNCA habilite isso em produção!\n');
    process.exit(1);
  }

  // Warn if not explicitly in test environment
  if (!isTestEnv) {
    console.warn('\n⚠️  AVISO: IS_TEST_ENVIRONMENT não está configurado como "true".');
    console.warn('Certifique-se de que está usando um ambiente de teste isolado.\n');
  }

  console.log('✅ Ambiente de teste validado.\n');
}

/**
 * Gets test IDs from environment variables with validation
 * @returns {Object} Object containing all test IDs
 * @throws {Error} If any required test ID is missing
 */
function getTestIds() {
  const requiredIds = {
    userId: process.env.TEST_USER_ID,
    adminUserId: process.env.TEST_ADMIN_USER_ID,
    brandProfileId: process.env.TEST_BRAND_PROFILE_ID,
    monitoringSessionId: process.env.TEST_MONITORING_SESSION_ID,
    detectedContentId: process.env.TEST_DETECTED_CONTENT_ID
  };

  const missingIds = [];
  for (const [key, value] of Object.entries(requiredIds)) {
    if (!value || value.trim() === '') {
      missingIds.push(`TEST_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`);
    }
  }

  if (missingIds.length > 0) {
    console.error('\n❌ ERRO: IDs de teste não configurados!');
    console.error('Configure as seguintes variáveis no seu arquivo .env:');
    missingIds.forEach(id => console.error(`  - ${id}`));
    console.error('\nUse o arquivo .env.test.example como referência.\n');
    process.exit(1);
  }

  return requiredIds;
}

/**
 * Gets test user credentials from environment variables
 * @returns {Object} Object containing test user credentials
 */
function getTestCredentials() {
  return {
    testUser: {
      email: process.env.TEST_USER_EMAIL || 'testuser@example.com',
      password: process.env.TEST_USER_PASSWORD || 'test123456'
    },
    adminUser: {
      email: process.env.TEST_ADMIN_EMAIL || 'testadmin@example.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123456'
    }
  };
}

/**
 * Gets test brand profile configuration
 * @returns {Object} Brand profile test data
 */
function getTestBrandProfile() {
  return {
    brandName: process.env.TEST_BRAND_NAME || 'Test Brand',
    description: process.env.TEST_BRAND_DESCRIPTION || 'Test brand for automated testing',
    officialUrls: JSON.parse(process.env.TEST_BRAND_URLS || '["https://test-brand.com"]'),
    keywords: JSON.parse(process.env.TEST_BRAND_KEYWORDS || '["test brand", "test product"]')
  };
}

/**
 * Gets test monitoring session configuration
 * @returns {Object} Monitoring session test data
 */
function getTestMonitoringSession() {
  return {
    name: process.env.TEST_SESSION_NAME || 'Test Monitoring Session',
    description: process.env.TEST_SESSION_DESCRIPTION || 'Automated test session',
    targetPlatforms: JSON.parse(process.env.TEST_TARGET_PLATFORMS || '["google", "youtube"]')
  };
}

/**
 * Gets test content configuration
 * @returns {Object} Content test data
 */
function getTestContent() {
  return {
    infringingUrl: process.env.TEST_INFRINGING_URL || 'https://test-infringer.com/test-content',
    platform: process.env.TEST_PLATFORM || 'WEBSITE',
    contentType: process.env.TEST_CONTENT_TYPE || 'IMAGE'
  };
}

/**
 * Prompts user for confirmation before running potentially destructive operations
 * @param {string} message - The confirmation message to display
 * @returns {Promise<boolean>} True if user confirms, false otherwise
 */
async function confirmAction(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`\n⚠️  ${message}\nDeseja continuar? (s/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim');
    });
  });
}

/**
 * Logs test script header with environment information
 * @param {string} scriptName - Name of the test script being run
 */
function logTestHeader(scriptName) {
  console.log('='.repeat(60));
  console.log(`🧪 ${scriptName}`);
  console.log('='.repeat(60));
  console.log(`📅 Data: ${new Date().toISOString()}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1] || 'não configurado'}`);
  console.log('='.repeat(60));
  console.log('');
}

/**
 * Generates a unique test ID with prefix
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique test ID
 */
function generateTestId(prefix = 'test') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Checks if we're using mock services (for API calls)
 * @returns {boolean} True if mock services should be used
 */
function shouldUseMockServices() {
  return process.env.USE_MOCK_SEARCH_API === 'true' || 
         process.env.NODE_ENV === 'test';
}

module.exports = {
  validateTestEnvironment,
  getTestIds,
  getTestCredentials,
  getTestBrandProfile,
  getTestMonitoringSession,
  getTestContent,
  confirmAction,
  logTestHeader,
  generateTestId,
  shouldUseMockServices
};