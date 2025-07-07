# Safe Testing Guide for DMCA Guard Platform

## Overview

This guide explains how to safely test the DMCA Guard Platform without affecting production data. All test scripts now include environment safeguards to prevent accidental modification of production data.

## Critical Security Notice

**⚠️ NEVER run test scripts in production environments!**

All test scripts now include:
- Environment validation
- Production safeguards
- Confirmation prompts
- Environment variable requirements

## Quick Start

### 1. Setup Test Environment

```bash
# Copy the test environment template
cp .env.test.example .env.test

# Copy main environment template if needed
cp .env.example .env

# Generate secure secrets for testing
npm run test:setup
```

### 2. Configure Test IDs

Edit `.env.test` and add your test IDs:

```env
# Generate new IDs using Prisma or use existing test data
TEST_USER_ID="your-test-user-id"
TEST_ADMIN_USER_ID="your-test-admin-id"
TEST_BRAND_PROFILE_ID="your-test-brand-id"
TEST_MONITORING_SESSION_ID="your-test-session-id"
TEST_DETECTED_CONTENT_ID="your-test-content-id"

# IMPORTANT: Always set these to true for test environments
NODE_ENV="test"
IS_TEST_ENVIRONMENT="true"
ALLOW_TEST_DATA_CREATION="true"
```

### 3. Use Safe Test Commands

The package.json now includes safe test commands that automatically set NODE_ENV=test:

```bash
# Test all agents
npm run test:agents

# Create test content
npm run test:seed-content

# Create test takedown request
npm run test:create-takedown

# Create or update admin user
npm run test:create-admin

# Promote user to admin
npm run test:promote-user

# Delete test sessions
npm run test:delete-sessions
```

## Environment Variables Reference

### Production Protection Variables

| Variable | Description | Safe Values |
|----------|-------------|-------------|
| `NODE_ENV` | Current environment | `test`, `development` |
| `IS_TEST_ENVIRONMENT` | Explicitly marks test env | `true` for testing |
| `ALLOW_TEST_DATA_CREATION` | Allows test data creation | `true` for testing |

### Test Data Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `TEST_USER_ID` | Test user ID | `test_user_123` |
| `TEST_ADMIN_USER_ID` | Test admin ID | `test_admin_456` |
| `TEST_BRAND_PROFILE_ID` | Test brand profile ID | `test_brand_789` |
| `TEST_MONITORING_SESSION_ID` | Test session ID | `test_session_012` |
| `TEST_DETECTED_CONTENT_ID` | Test content ID | `test_content_345` |

## Safety Features

### 1. Environment Validation

All test scripts now call `validateTestEnvironment()` which:
- Checks if NODE_ENV is production (blocks execution)
- Verifies ALLOW_TEST_DATA_CREATION is true
- Warns if IS_TEST_ENVIRONMENT is not set

### 2. Confirmation Prompts

Destructive operations require user confirmation:
- Creating new data
- Deleting sessions
- Promoting users to admin

### 3. Test Utilities

The `lib/test-utils.js` module provides:
- `validateTestEnvironment()` - Environment safety checks
- `getTestIds()` - Retrieves and validates test IDs
- `confirmAction()` - User confirmation prompts
- `logTestHeader()` - Consistent logging format

## Best Practices

### DO:
- Always use test-specific IDs
- Run tests in isolated test databases
- Use the provided npm scripts
- Configure `.env.test` separately from `.env`
- Generate new IDs for each test environment

### DON'T:
- Never copy production IDs to test files
- Never set ALLOW_TEST_DATA_CREATION=true in production
- Never hardcode IDs in scripts
- Never skip environment validation

## Creating Test Data

### 1. Generate Test IDs

Use Prisma Studio or a script to generate test IDs:

```javascript
// Example: Generate test IDs
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateTestIds() {
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: 'testuser@example.com',
      name: 'Test User',
      // ... other fields
    }
  });
  
  console.log('TEST_USER_ID=' + user.id);
  // ... create other test entities
}
```

### 2. Use Test Data

Once configured, test scripts will use these IDs automatically:

```bash
# This will use TEST_BRAND_PROFILE_ID and TEST_MONITORING_SESSION_ID
npm run test:seed-content
```

## Troubleshooting

### "Tentativa de executar script de teste em PRODUÇÃO!"

**Cause**: NODE_ENV is set to "production"
**Solution**: Set NODE_ENV to "test" or "development"

### "IDs de teste não configurados!"

**Cause**: Missing test IDs in environment
**Solution**: Configure all TEST_* variables in .env

### "Criação de dados de teste não está habilitada"

**Cause**: ALLOW_TEST_DATA_CREATION is not "true"
**Solution**: Set ALLOW_TEST_DATA_CREATION="true" in .env

## Migration Guide

If you have existing scripts with hardcoded IDs:

1. Extract the IDs to `.env.test`
2. Update scripts to use `getTestIds()`
3. Add `validateTestEnvironment()` at the start
4. Test in a safe environment first

## Example Test Workflow

```bash
# 1. Setup environment
cp .env.test.example .env.test
# Edit .env.test with your test IDs

# 2. Create test admin
npm run test:create-admin

# 3. Test agent functionality
npm run test:agents

# 4. Create test content
npm run test:seed-content

# 5. Create test takedown
npm run test:create-takedown

# 6. Clean up (if needed)
npm run test:delete-sessions session_id_1 session_id_2
```

## Security Checklist

Before running any test script:

- [ ] NODE_ENV is NOT "production"
- [ ] Using `.env.test` not `.env`
- [ ] All TEST_* variables are configured
- [ ] ALLOW_TEST_DATA_CREATION is "true"
- [ ] Using a test database (not production)
- [ ] Reviewed the script's actions

## Support

If you encounter issues:

1. Check environment variables are set correctly
2. Ensure you're not in production environment
3. Verify test IDs exist in your test database
4. Review error messages for specific guidance

Remember: **Safety first! When in doubt, don't run the script.**