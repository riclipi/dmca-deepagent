# 🔒 DMCA Guard Platform - Security Setup Guide

## 📋 Table of Contents
- [Initial Setup](#initial-setup)
- [Environment Configuration](#environment-configuration)
- [Secret Generation](#secret-generation)
- [Service Configuration](#service-configuration)
- [Security Checklist](#security-checklist)
- [Production Deployment](#production-deployment)
- [Secret Rotation](#secret-rotation)
- [Incident Response](#incident-response)

## 🚀 Initial Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/dmca-guard-platform.git
cd dmca-guard-platform/aplicativo
```

### 2. Create Environment File
```bash
# Copy the example file
cp .env.example .env

# Set restrictive permissions
chmod 600 .env
```

### 3. Install Dependencies
```bash
npm install
```

## 🔐 Environment Configuration

### Required Variables

#### Database
```bash
# PostgreSQL with SSL enabled
DATABASE_URL="postgresql://user:password@host:5432/dmca_guard?sslmode=require"
```

#### Authentication
```bash
# Generate secure secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL="https://yourdomain.com"  # Update with your domain
```

#### Redis (Required for Production)
```bash
# Sign up at https://upstash.com for free tier
UPSTASH_REDIS_REST_URL="https://your-instance.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token-here"
```

#### Search APIs (At least one required)
```bash
# Option 1: Serper (Recommended)
SERPER_API_KEY="your-serper-api-key"

# Option 2: Google Custom Search
GOOGLE_API_KEY="your-google-api-key"
GOOGLE_CSE_ID="your-cse-id"
```

## 🔑 Secret Generation

### Generate Secure Secrets
```bash
# NextAuth Secret
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"

# API Signing Secret
echo "API_SIGNING_SECRET=$(openssl rand -base64 32)"

# Cron Secret
echo "CRON_SECRET=$(openssl rand -base64 32)"

# Database Password
echo "DB_PASSWORD=$(openssl rand -base64 24)"
```

### Password Requirements
- Minimum 32 characters for secrets
- Use alphanumeric + special characters
- Unique per environment
- Never reuse across services

## 🛠️ Service Configuration

### 1. PostgreSQL Setup
```sql
-- Create database with proper encoding
CREATE DATABASE dmca_guard 
  WITH ENCODING 'UTF8' 
  LC_COLLATE='en_US.UTF-8' 
  LC_CTYPE='en_US.UTF-8';

-- Create user with limited privileges
CREATE USER dmca_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT CONNECT ON DATABASE dmca_guard TO dmca_user;
GRANT USAGE ON SCHEMA public TO dmca_user;
GRANT CREATE ON SCHEMA public TO dmca_user;

-- Enable SSL
ALTER SYSTEM SET ssl = on;
```

### 2. Redis Configuration
```bash
# For Upstash Redis:
# 1. Create account at https://upstash.com
# 2. Create new Redis database
# 3. Copy REST URL and token
# 4. Enable eviction policy: allkeys-lru
# 5. Set max memory: 100MB (free tier)
```

### 3. Email Service (Resend)
```bash
# 1. Sign up at https://resend.com
# 2. Verify your domain
# 3. Create API key with send permissions
# 4. Add SPF/DKIM records to DNS
```

## ✅ Security Checklist

### Pre-Deployment
- [ ] All secrets are unique and secure (32+ chars)
- [ ] Database uses SSL connection
- [ ] Redis configured with authentication
- [ ] Email domain verified with SPF/DKIM
- [ ] API keys have minimal required permissions
- [ ] Environment file has restricted permissions (600)
- [ ] No secrets in code or version control
- [ ] All dependencies updated to latest versions

### Application Security
- [ ] Rate limiting enabled
- [ ] HTTPS enforced in production
- [ ] Security headers configured
- [ ] Input validation on all endpoints
- [ ] SQL injection protection (Prisma)
- [ ] XSS protection enabled
- [ ] CSRF protection active
- [ ] File upload restrictions

### Infrastructure
- [ ] Firewall rules configured
- [ ] Database not publicly accessible
- [ ] Redis not publicly accessible
- [ ] Regular security updates
- [ ] Automated backups enabled
- [ ] Monitoring and alerting active

## 🚀 Production Deployment

### Railway.app Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Set environment variables
railway variables set NEXTAUTH_SECRET="your-secret"
railway variables set DATABASE_URL="your-db-url"
# ... set all required variables

# Deploy
railway up
```

### Environment-Specific Settings
```bash
# Production
NODE_ENV="production"
NEXTAUTH_URL="https://yourdomain.com"
DISABLE_RATE_LIMIT="false"
USE_MOCK_REDIS="false"
USE_MOCK_SEARCH="false"

# Staging
NODE_ENV="staging"
NEXTAUTH_URL="https://staging.yourdomain.com"

# Development
NODE_ENV="development"
NEXTAUTH_URL="http://localhost:3000"
```

## 🔄 Secret Rotation

### Rotation Schedule
- **Critical Secrets**: Every 30 days
  - NEXTAUTH_SECRET
  - API_SIGNING_SECRET
  - Database passwords
  
- **API Keys**: Every 90 days
  - External service API keys
  - OAuth credentials
  
- **Less Critical**: Every 180 days
  - Monitoring tokens
  - Analytics keys

### Rotation Process
1. Generate new secret
2. Update in secret management system
3. Deploy with new secret
4. Monitor for issues
5. Remove old secret after 24 hours

### Automated Rotation Script
```bash
#!/bin/bash
# rotate-secrets.sh

# Generate new secrets
NEW_NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEW_API_SIGNING_SECRET=$(openssl rand -base64 32)

# Update in production (example with Railway)
railway variables set NEXTAUTH_SECRET="$NEW_NEXTAUTH_SECRET"
railway variables set API_SIGNING_SECRET="$NEW_API_SIGNING_SECRET"

# Log rotation
echo "$(date): Secrets rotated" >> secret-rotation.log
```

## 🚨 Incident Response

### Security Incident Checklist
1. **Immediate Actions**
   - [ ] Revoke compromised credentials
   - [ ] Enable emergency rate limiting
   - [ ] Check audit logs
   - [ ] Notify security team

2. **Investigation**
   - [ ] Review access logs
   - [ ] Check for data exfiltration
   - [ ] Identify attack vector
   - [ ] Document timeline

3. **Remediation**
   - [ ] Patch vulnerabilities
   - [ ] Rotate all secrets
   - [ ] Update security rules
   - [ ] Deploy fixes

4. **Post-Incident**
   - [ ] Conduct post-mortem
   - [ ] Update security procedures
   - [ ] Improve monitoring
   - [ ] Train team

### Emergency Contacts
```
Security Team: security@yourdomain.com
On-Call Engineer: +1-XXX-XXX-XXXX
Incident Hotline: +1-XXX-XXX-XXXX
```

## 📊 Monitoring

### Security Metrics to Track
- Failed login attempts
- Rate limit violations
- Unusual API usage patterns
- Database connection failures
- Redis connection issues
- 4XX/5XX error rates

### Alerting Rules
```yaml
# Example alerting configuration
alerts:
  - name: HighFailedLogins
    condition: failed_logins > 100 per 5 minutes
    severity: high
    
  - name: RateLimitExceeded
    condition: rate_limit_violations > 1000 per hour
    severity: medium
    
  - name: DatabaseDown
    condition: db_connection_errors > 0
    severity: critical
```

## 🔗 Additional Resources

- [OWASP Security Checklist](https://owasp.org/www-project-web-security-testing-guide/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Redis Security](https://redis.io/docs/manual/security/)

---

**Remember**: Security is not a one-time setup but an ongoing process. Regular reviews, updates, and training are essential for maintaining a secure platform.