# Production Security Checklist

## 🔐 Critical Security Items

### 1. Environment Variables
- [ ] Remove `.env.local` from repository
- [ ] Use secure secret management (AWS Secrets Manager, Vercel Environment Variables, etc.)
- [ ] Generate new random values for all secrets:
  - [ ] `NEXTAUTH_SECRET` (minimum 32 characters)
  - [ ] `API_SIGNING_SECRET` (minimum 32 characters)  
  - [ ] `CRON_SECRET` (minimum 16 characters)
- [ ] Never commit real credentials to the repository
- [ ] Use `.env.example` as template only

### 2. API Keys
- [ ] Obtain production API keys for:
  - [ ] Google OAuth (new client ID/secret)
  - [ ] Resend (email service)
  - [ ] Serper or Google Custom Search
  - [ ] Upstash Redis
- [ ] Set up API key rotation schedule
- [ ] Monitor API usage and set alerts

### 3. Database Security
- [ ] Use strong database password
- [ ] Enable SSL/TLS for database connections
- [ ] Set up database backups
- [ ] Restrict database access by IP
- [ ] Use read replicas for analytics

### 4. Redis Configuration
- [ ] Configure Upstash Redis for production
- [ ] Enable Redis persistence
- [ ] Set up Redis password
- [ ] Monitor Redis memory usage
- [ ] Configure appropriate eviction policies

## 🚫 Remove Development Artifacts

### Test Routes to Remove
- [ ] `/app/test` directory
- [ ] `/app/api/test-websocket`
- [ ] `/app/api/example-rate-limited`
- [ ] `/app/api/example-with-api-response`

### Mock Implementations to Replace
- [ ] Real-time scanner mock search results
- [ ] Mock Redis implementation (production must use real Redis)
- [ ] Fake DMCA detection logic
- [ ] Simulated delays and random data

### Hardcoded Data to Remove
- [ ] Test user IDs in scripts
- [ ] Example domain lists
- [ ] Demo content
- [ ] Development URLs

## ✅ Production Configuration

### 1. Application Settings
```env
NODE_ENV=production
NEXTAUTH_URL=https://yourdomain.com
```

### 2. Security Headers
- [ ] Configure CSP (Content Security Policy)
- [ ] Enable HSTS
- [ ] Set X-Frame-Options
- [ ] Configure CORS properly

### 3. Rate Limiting
- [ ] Redis must be configured (no fallback to MockRedis)
- [ ] Adjust rate limits for production traffic
- [ ] Configure DDoS protection

### 4. Monitoring
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure application monitoring
- [ ] Set up uptime monitoring
- [ ] Enable security alerts

## 🔍 Validation Scripts

### Run Production Validation
```bash
# Set NODE_ENV to production and run validation
NODE_ENV=production npm run validate:production
```

### Check for Sensitive Data
```bash
# Search for potential secrets in code
grep -r "password\|secret\|key\|token" --include="*.ts" --include="*.tsx" --include="*.js" --exclude-dir="node_modules"
```

### Verify No Test Routes
```bash
# Check for test routes
find . -name "*test*" -path "*/app/*" -not -path "*/node_modules/*"
```

## 📋 Pre-Deployment Checklist

1. **Environment Validation**
   - [ ] Run `StartupValidator` in production mode
   - [ ] All required environment variables present
   - [ ] No placeholder values in secrets

2. **Code Review**
   - [ ] No console.log with sensitive data
   - [ ] No hardcoded credentials
   - [ ] No debug code in production

3. **Dependencies**
   - [ ] Update all dependencies
   - [ ] Run security audit: `npm audit`
   - [ ] Remove dev dependencies from production build

4. **Build Verification**
   - [ ] Build succeeds without warnings
   - [ ] All TypeScript errors resolved
   - [ ] Bundle size optimized

5. **Testing**
   - [ ] All tests pass
   - [ ] Security tests implemented
   - [ ] Load testing completed

## 🚀 Deployment Process

1. **Pre-deployment**
   ```bash
   # Clean install
   rm -rf node_modules package-lock.json
   npm install
   
   # Run validation
   npm run validate:production
   
   # Build
   npm run build
   ```

2. **Deploy**
   - Use CI/CD pipeline
   - Deploy to staging first
   - Run smoke tests
   - Deploy to production

3. **Post-deployment**
   - [ ] Verify all services running
   - [ ] Check error logs
   - [ ] Monitor performance
   - [ ] Verify security headers

## ⚠️ Emergency Procedures

### If Credentials Leaked
1. Immediately rotate all affected credentials
2. Check logs for unauthorized access
3. Update all services with new credentials
4. Notify security team

### If Production Issues
1. Check error monitoring
2. Review recent deployments
3. Rollback if necessary
4. Document incident

## 📞 Contacts

- Security Team: security@yourdomain.com
- DevOps: devops@yourdomain.com
- On-Call: +1-XXX-XXX-XXXX