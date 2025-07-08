# 🚀 Redis Production Setup Guide

## 📋 Overview

DMCA Guard Platform requires Redis for:
- **Rate Limiting**: Protect against abuse and DDoS
- **Session Management**: Store user sessions securely
- **Caching**: Improve performance
- **Queue Management**: Handle background jobs

## 🔧 Production Requirements

### Minimum Specifications
- **Memory**: 100MB minimum (256MB recommended)
- **Connections**: 100 concurrent
- **Commands/sec**: 10,000
- **Availability**: 99.9% SLA
- **SSL/TLS**: Required
- **Persistence**: Optional but recommended

### Recommended Providers

#### 1. **Upstash Redis** (Recommended)
- ✅ Serverless (pay-per-request)
- ✅ Global replication
- ✅ Built-in REST API
- ✅ Free tier: 10,000 commands/day
- ✅ No connection limits
- 🔗 [Sign up here](https://upstash.com)

#### 2. **Redis Cloud**
- ✅ Fully managed
- ✅ Multi-cloud support
- ✅ Auto-failover
- 💰 Free tier: 30MB
- 🔗 [Redis Cloud](https://redis.com/redis-enterprise-cloud/)

#### 3. **Railway Redis**
- ✅ Easy integration with Railway deployments
- ✅ Automatic backups
- ✅ Private networking
- 💰 Usage-based pricing
- 🔗 [Railway Redis](https://railway.app)

## 🛠️ Setup Instructions

### Step 1: Create Upstash Account

1. Visit [https://upstash.com](https://upstash.com)
2. Sign up with GitHub/Google or email
3. Verify your email

### Step 2: Create Redis Database

1. Click "Create Database"
2. Configure:
   ```
   Name: dmca-guard-production
   Type: Global (for low latency)
   Region: Primary region closest to your users
   ```
3. Enable:
   - ✅ TLS/SSL
   - ✅ Eviction (recommended: allkeys-lru)
   - ✅ Max memory: 256MB

### Step 3: Get Credentials

1. Go to database details
2. Copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### Step 4: Configure Environment

```bash
# Production .env
UPSTASH_REDIS_REST_URL="https://YOUR-INSTANCE.upstash.io"
UPSTASH_REDIS_REST_TOKEN="YOUR-TOKEN-HERE"

# Optional: Fine-tuning
REDIS_MAX_RETRIES="3"
REDIS_RETRY_DELAY="1000"
REDIS_CONNECTION_TIMEOUT="5000"
```

### Step 5: Validate Configuration

```bash
# Run validation script
npm run validate:redis

# Expected output:
# ✅ Redis credentials found
# ✅ Redis connection successful
# ✅ All Redis operations working correctly
# ✅ Rate limiting functionality verified
```

## 🔒 Security Best Practices

### 1. **Access Control**
```bash
# Use read-only tokens for monitoring
REDIS_MONITORING_TOKEN="read-only-token"

# Use full access only for application
UPSTASH_REDIS_REST_TOKEN="full-access-token"
```

### 2. **Network Security**
- ✅ Always use TLS/SSL connections
- ✅ Whitelist IP addresses (if supported)
- ✅ Use private networking when possible
- ✅ Enable firewall rules

### 3. **Data Security**
- ✅ Don't store sensitive data unencrypted
- ✅ Set appropriate TTLs for all keys
- ✅ Regular key cleanup
- ✅ Monitor for unusual patterns

### 4. **Token Rotation**
```bash
# Rotate tokens every 90 days
# 1. Generate new token in Upstash console
# 2. Update production environment
# 3. Deploy new version
# 4. Revoke old token
```

## 📊 Monitoring Setup

### Key Metrics to Monitor

1. **Performance Metrics**
   - Commands/second
   - Average latency
   - Slow commands
   - Hit rate

2. **Resource Metrics**
   - Memory usage
   - Connection count
   - Bandwidth usage
   - Key count

3. **Error Metrics**
   - Connection failures
   - Command errors
   - Timeout errors
   - Circuit breaker trips

### Health Check Endpoint
```bash
# Monitor Redis health
curl https://your-app.com/api/health

# Response includes:
{
  "services": {
    "redis": {
      "status": "healthy",
      "latency": 45,
      "circuitBreaker": {
        "state": "CLOSED",
        "failures": 0
      }
    }
  }
}
```

## 🚨 Troubleshooting

### Common Issues

#### 1. **Connection Timeouts**
```bash
# Increase timeout
REDIS_CONNECTION_TIMEOUT="10000"  # 10 seconds

# Check network connectivity
curl -I https://your-instance.upstash.io
```

#### 2. **Rate Limit Exceeded**
```bash
# Check current usage
# Upstash Console > Database > Usage

# Solutions:
# - Upgrade plan
# - Optimize queries
# - Implement local caching
```

#### 3. **Circuit Breaker Open**
```javascript
// Check circuit breaker status
const status = getRedisCircuitBreakerStatus()
console.log(status)

// Reset if needed (use cautiously)
// Automatic reset after 60 seconds
```

#### 4. **Memory Issues**
```bash
# Set eviction policy
# Upstash Console > Database > Settings > Eviction

# Recommended: allkeys-lru
# Removes least recently used keys when memory is full
```

## 📈 Scaling Strategies

### 1. **Vertical Scaling**
- Increase memory limit
- Upgrade to higher plan
- Enable persistence

### 2. **Horizontal Scaling**
- Use Redis Cluster
- Implement read replicas
- Geo-distribution

### 3. **Application-Level**
- Local caching layer
- Batch operations
- Connection pooling
- Optimize key patterns

## 🔄 Backup and Recovery

### Automated Backups
```bash
# Upstash provides automatic backups
# Configure in Console > Database > Backups

# Manual backup via CLI
npm run backup:redis
```

### Recovery Process
1. Stop application traffic
2. Restore from backup
3. Validate data integrity
4. Resume traffic gradually

## 📝 Maintenance Checklist

### Daily
- [ ] Check health endpoint
- [ ] Monitor error rates
- [ ] Review slow queries

### Weekly
- [ ] Analyze usage patterns
- [ ] Clean up expired keys
- [ ] Review security logs

### Monthly
- [ ] Performance optimization
- [ ] Capacity planning
- [ ] Cost analysis
- [ ] Update documentation

### Quarterly
- [ ] Security audit
- [ ] Token rotation
- [ ] Disaster recovery test
- [ ] Plan review and updates

## 🆘 Emergency Procedures

### Redis Down
1. **Immediate**: Application switches to degraded mode
2. **Check**: Upstash status page
3. **Fallback**: Circuit breaker prevents cascading failures
4. **Recovery**: Automatic when service restored

### High Memory Usage
1. **Alert**: Monitor triggers at 80%
2. **Analyze**: Identify large keys
3. **Clean**: Remove unnecessary data
4. **Scale**: Increase memory if needed

### Security Breach
1. **Isolate**: Revoke compromised tokens
2. **Rotate**: Generate new credentials
3. **Audit**: Review access logs
4. **Patch**: Update and redeploy

## 📚 Additional Resources

- [Upstash Documentation](https://docs.upstash.com/redis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [DMCA Guard Redis Implementation](./redis-enhanced.ts)
- [Health Check Implementation](../app/api/health/route.ts)

---

**Remember**: A properly configured Redis instance is crucial for application performance and security. Regular monitoring and maintenance ensure optimal operation.