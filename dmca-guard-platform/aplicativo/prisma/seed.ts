import { PrismaClient, PlanType, UserStatus, SiteCategory, ContentType, Priority, ContentStatus, AbuseState, ViolationType, ValidationMethod, ValidationStatus, SessionStatus, AgentType, AgentStatus, RiskLevel, DetectionMethod } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // Clean database
  console.log('🧹 Cleaning database...')
  await cleanDatabase()

  // Create users with different plans
  console.log('👥 Creating users...')
  const users = await createUsers()

  // Create brand profiles
  console.log('🏢 Creating brand profiles...')
  const brandProfiles = await createBrandProfiles(users)

  // Create monitoring sessions
  console.log('📊 Creating monitoring sessions...')
  const sessions = await createMonitoringSessions(users, brandProfiles)

  // Create detected content
  console.log('🔍 Creating detected content...')
  await createDetectedContent(users, brandProfiles, sessions)

  // Create known sites
  console.log('🌐 Creating known sites...')
  const knownSites = await createKnownSites(users)

  // Create violation history
  console.log('⚠️ Creating violation history...')
  await createViolationHistory(knownSites)

  // Create abuse scores and violations
  console.log('🚨 Creating abuse scores...')
  await createAbuseScores(users)

  // Create ownership validations
  console.log('✅ Creating ownership validations...')
  await createOwnershipValidations(users, brandProfiles)

  // Create scan sessions
  console.log('🔄 Creating scan sessions...')
  await createScanSessions(users, brandProfiles)

  // Create agent activities
  console.log('🤖 Creating agent activities...')
  await createAgentActivities(users)

  // Create cache entries
  console.log('💾 Creating cache entries...')
  await createCacheEntries()

  // Create user activities for rate limiting
  console.log('📈 Creating user activities...')
  await createUserActivities(users)

  console.log('✅ Seed completed successfully!')
}

async function cleanDatabase() {
  const tablenames = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname='public'
  `

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} CASCADE;`)
  } catch (error) {
    console.log({ error })
  }
}

async function createUsers() {
  const hashedPassword = await bcrypt.hash('password123', 10)

  const users = await Promise.all([
    // Free user
    prisma.user.create({
      data: {
        email: 'free@example.com',
        name: 'Free User',
        password: hashedPassword,
        planType: PlanType.FREE,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    }),
    // Basic user
    prisma.user.create({
      data: {
        email: 'basic@example.com',
        name: 'Basic User',
        password: hashedPassword,
        planType: PlanType.BASIC,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    }),
    // Premium user
    prisma.user.create({
      data: {
        email: 'premium@example.com',
        name: 'Premium User',
        password: hashedPassword,
        planType: PlanType.PREMIUM,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    }),
    // Enterprise user
    prisma.user.create({
      data: {
        email: 'enterprise@example.com',
        name: 'Enterprise User',
        password: hashedPassword,
        planType: PlanType.ENTERPRISE,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    }),
    // Super user
    prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: hashedPassword,
        planType: PlanType.SUPER_USER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    }),
    // Suspended user (for testing)
    prisma.user.create({
      data: {
        email: 'suspended@example.com',
        name: 'Suspended User',
        password: hashedPassword,
        planType: PlanType.FREE,
        status: UserStatus.SUSPENDED,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      }
    }),
  ])

  return users
}

async function createBrandProfiles(users: any[]) {
  const profiles = []

  for (const user of users.slice(0, 5)) { // Skip suspended user
    const profile = await prisma.brandProfile.create({
      data: {
        userId: user.id,
        brandName: `${user.name}'s Brand`,
        description: `Official brand profile for ${user.name}`,
        officialUrls: ['https://example.com', 'https://shop.example.com'],
        socialMedia: {
          twitter: '@example',
          instagram: '@example',
          facebook: 'example'
        },
        keywords: ['brand', 'product', 'official'],
        safeKeywords: ['official store', 'authentic product', 'genuine brand'],
        moderateKeywords: ['discount', 'sale', 'cheap'],
        dangerousKeywords: ['fake', 'replica', 'counterfeit'],
        keywordConfig: {
          autoApprove: true,
          riskThreshold: 50
        },
        isActive: true,
      }
    })
    profiles.push(profile)
  }

  return profiles
}

async function createMonitoringSessions(users: any[], brandProfiles: any[]) {
  const sessions = []

  for (let i = 0; i < brandProfiles.length; i++) {
    const session = await prisma.monitoringSession.create({
      data: {
        userId: users[i].id,
        brandProfileId: brandProfiles[i].id,
        name: `Monitoring ${brandProfiles[i].brandName}`,
        description: 'Automated monitoring for brand protection',
        targetPlatforms: ['google', 'bing', 'social'],
        useProfileKeywords: true,
        customKeywords: ['special edition', 'limited'],
        excludeKeywords: ['review', 'unboxing'],
        status: i === 0 ? SessionStatus.RUNNING : SessionStatus.IDLE,
        currentKeyword: i === 0 ? 'brand product' : null,
        progress: i === 0 ? 45 : 0,
        totalKeywords: 10,
        processedKeywords: i === 0 ? 4 : 0,
        resultsFound: i === 0 ? 12 : 0,
        isActive: true,
        lastScanAt: i < 2 ? new Date(Date.now() - 3600000) : null,
        nextScanAt: new Date(Date.now() + 86400000),
        scanFrequency: 24,
      }
    })
    sessions.push(session)
  }

  return sessions
}

async function createDetectedContent(users: any[], brandProfiles: any[], sessions: any[]) {
  const detectedContent = []
  const statuses = [ContentStatus.DETECTED, ContentStatus.REVIEWED, ContentStatus.DMCA_SENT, ContentStatus.DELISTED]
  const types = [ContentType.IMAGE, ContentType.VIDEO, ContentType.DOCUMENT]
  const priorities = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT]

  for (let i = 0; i < 20; i++) {
    const userIndex = i % users.length
    const sessionIndex = i % sessions.length
    const statusIndex = i % statuses.length
    
    const content = await prisma.detectedContent.create({
      data: {
        userId: users[userIndex].id,
        brandProfileId: brandProfiles[userIndex].id,
        monitoringSessionId: sessions[sessionIndex].id,
        title: `Suspicious listing #${i + 1}`,
        description: `Potential counterfeit ${brandProfiles[userIndex].brandName} product`,
        contentType: types[i % types.length],
        infringingUrl: `https://suspicious-site.com/product/${i + 1}`,
        platform: ['ebay', 'amazon', 'aliexpress'][i % 3],
        thumbnailUrl: `https://suspicious-site.com/images/thumb_${i + 1}.jpg`,
        similarity: 75 + Math.random() * 25,
        priority: priorities[i % priorities.length],
        status: statuses[statusIndex],
        isConfirmed: statusIndex > 0,
        isProcessed: statusIndex > 1,
        confidence: 80 + Math.random() * 20,
        keywordSource: brandProfiles[userIndex].keywords[i % 3],
        detectedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        confirmedAt: statusIndex > 0 ? new Date() : null,
        processedAt: statusIndex > 1 ? new Date() : null,
      }
    })
    detectedContent.push(content)
  }

  return detectedContent
}

async function createKnownSites(users: any[]) {
  const sites = [
    {
      baseUrl: 'https://forum.example.com',
      domain: 'forum.example.com',
      category: SiteCategory.FORUM,
      platform: 'phpbb',
      totalViolations: 45,
      riskScore: 75,
    },
    {
      baseUrl: 'https://downloads.example.com',
      domain: 'downloads.example.com',
      category: SiteCategory.FILE_SHARING,
      platform: 'custom',
      totalViolations: 120,
      riskScore: 90,
    },
    {
      baseUrl: 'https://social.example.com',
      domain: 'social.example.com',
      category: SiteCategory.SOCIAL_MEDIA,
      platform: 'mastodon',
      totalViolations: 23,
      riskScore: 60,
    },
    {
      baseUrl: 'https://chat.example.com',
      domain: 'chat.example.com',
      category: SiteCategory.MESSAGING,
      platform: 'telegram',
      totalViolations: 67,
      riskScore: 85,
    },
  ]

  const knownSites = []
  for (const site of sites) {
    const created = await prisma.knownSite.create({
      data: {
        ...site,
        userId: users[0].id, // Assign to first user
        lastViolation: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        lastChecked: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        avgResponseTime: Math.floor(500 + Math.random() * 2000),
        crawlDelay: 1000,
        isActive: true,
        lastCrawlSuccess: true,
        blockedByRobots: false,
      }
    })
    knownSites.push(created)
  }

  return knownSites
}

async function createViolationHistory(knownSites: any[]) {
  const violations = []
  const methods = [DetectionMethod.KEYWORD_MATCH, DetectionMethod.IMAGE_ANALYSIS, DetectionMethod.AI_CLASSIFICATION]
  const levels = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.CRITICAL]

  for (const site of knownSites) {
    for (let i = 0; i < 5; i++) {
      const violation = await prisma.violationHistory.create({
        data: {
          knownSiteId: site.id,
          url: `${site.baseUrl}/post/${Math.random().toString(36).substring(7)}`,
          title: `Suspicious post about fake products`,
          description: `User discussing counterfeit items and sharing links`,
          detectionMethod: methods[i % methods.length],
          riskLevel: levels[i % levels.length],
          aiConfidence: 0.7 + Math.random() * 0.3,
          takedownSent: i % 2 === 0,
          takedownDate: i % 2 === 0 ? new Date() : null,
          resolved: i % 3 === 0,
          resolvedDate: i % 3 === 0 ? new Date() : null,
          detectedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        }
      })
      violations.push(violation)
    }
  }

  return violations
}

async function createAbuseScores(users: any[]) {
  const states = [AbuseState.CLEAN, AbuseState.WARNING, AbuseState.HIGH_RISK]
  const violationTypes = [
    ViolationType.SPAM_KEYWORDS,
    ViolationType.EXCESSIVE_REQUESTS,
    ViolationType.SUSPICIOUS_PATTERNS,
    ViolationType.COMPETITOR_MONITORING,
  ]

  for (let i = 0; i < 3; i++) {
    const user = users[i]
    const state = states[i]
    const score = i * 50 // 0, 50, 100

    const abuseScore = await prisma.abuseScore.create({
      data: {
        userId: user.id,
        currentScore: score,
        state: state,
        lastViolation: i > 0 ? new Date(Date.now() - i * 24 * 60 * 60 * 1000) : null,
      }
    })

    // Add some violations for users with scores
    if (i > 0) {
      for (let j = 0; j < i * 2; j++) {
        await prisma.abuseViolation.create({
          data: {
            userId: user.id,
            scoreId: abuseScore.id,
            type: violationTypes[j % violationTypes.length],
            severity: 0.3 + (i * 0.2),
            description: `Violation ${j + 1} for ${user.name}`,
            metadata: {
              ip: '192.168.1.' + (100 + j),
              userAgent: 'Mozilla/5.0',
              action: 'keyword_search'
            },
            occurredAt: new Date(Date.now() - j * 12 * 60 * 60 * 1000),
          }
        })
      }
    }
  }
}

async function createOwnershipValidations(users: any[], brandProfiles: any[]) {
  const methods = [ValidationMethod.DNS_TXT, ValidationMethod.META_TAG, ValidationMethod.EMAIL_CONFIRMATION]
  const statuses = [ValidationStatus.VERIFIED, ValidationStatus.PENDING, ValidationStatus.FAILED]

  for (let i = 0; i < 3; i++) {
    await prisma.ownershipValidation.create({
      data: {
        userId: users[i].id,
        brandProfileId: brandProfiles[i].id,
        domain: 'example.com',
        method: methods[i],
        status: statuses[i],
        verificationToken: i < 2 ? `verify_${Math.random().toString(36).substring(7)}` : null,
        validatedAt: i === 0 ? new Date() : null,
        expiresAt: i === 1 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
        score: i === 0 ? 1.0 : i === 1 ? 0.5 : 0,
        attempts: i + 1,
        metadata: {
          dnsRecord: i === 0 ? 'dmca-verify=token123' : null,
          lastCheckAt: new Date(),
        }
      }
    })
  }
}

async function createScanSessions(users: any[], brandProfiles: any[]) {
  const statuses = [SessionStatus.COMPLETED, SessionStatus.RUNNING, SessionStatus.ERROR, SessionStatus.IDLE]

  for (let i = 0; i < 8; i++) {
    const userIndex = i % users.length
    const status = statuses[i % statuses.length]
    const isCompleted = status === SessionStatus.COMPLETED
    const isRunning = status === SessionStatus.RUNNING

    await prisma.scanSession.create({
      data: {
        userId: users[userIndex].id,
        brandProfileId: brandProfiles[userIndex % brandProfiles.length].id,
        status: status,
        totalSites: 100,
        sitesScanned: isCompleted ? 100 : isRunning ? 45 : i * 10,
        violationsFound: Math.floor(Math.random() * 20),
        errorCount: status === SessionStatus.ERROR ? 3 : 0,
        startedAt: new Date(Date.now() - (i + 1) * 60 * 60 * 1000),
        completedAt: isCompleted ? new Date() : null,
        estimatedCompletion: isRunning ? new Date(Date.now() + 30 * 60 * 1000) : null,
        currentSite: isRunning ? 'https://scanning-now.com' : null,
        lastError: status === SessionStatus.ERROR ? 'Connection timeout' : null,
        metadata: {
          keywords: ['test', 'scan'],
          platforms: ['google', 'bing'],
        }
      }
    })
  }
}

async function createAgentActivities(users: any[]) {
  const agentTypes = [AgentType.KNOWN_SITES_SCANNER, AgentType.DISCOVERY_SCANNER, AgentType.CONTEXT_ANALYZER]
  const statuses = [AgentStatus.COMPLETED, AgentStatus.RUNNING, AgentStatus.ERROR]

  for (let i = 0; i < 12; i++) {
    const userIndex = i % users.length
    const agentType = agentTypes[i % agentTypes.length]
    const status = statuses[i % statuses.length]
    const sessionId = `session_${Math.random().toString(36).substring(7)}`

    await prisma.agentActivity.create({
      data: {
        agentType: agentType,
        userId: users[userIndex].id,
        sessionId: sessionId,
        status: status,
        startedAt: new Date(Date.now() - (i + 1) * 30 * 60 * 1000),
        completedAt: status === AgentStatus.COMPLETED ? new Date() : null,
        sitesScanned: Math.floor(Math.random() * 50),
        violationsFound: Math.floor(Math.random() * 10),
        newSitesFound: agentType === AgentType.DISCOVERY_SCANNER ? Math.floor(Math.random() * 5) : 0,
        processingTime: status === AgentStatus.COMPLETED ? Math.floor(60 + Math.random() * 300) : null,
        metadata: {
          version: '1.0',
          config: {
            maxConcurrency: 3,
            timeout: 30000,
          }
        },
        errorMessage: status === AgentStatus.ERROR ? 'Rate limit exceeded' : null,
      }
    })
  }
}

async function createCacheEntries() {
  const types = ['content', 'robots', 'metadata', 'screenshot']
  const now = Date.now()

  for (let i = 0; i < 10; i++) {
    const ttl = (i + 1) * 3600000 // 1-10 hours
    await prisma.cacheEntry.create({
      data: {
        key: `cache_key_${i}`,
        type: types[i % types.length],
        value: {
          data: `Cached data ${i}`,
          url: `https://example.com/page${i}`,
          timestamp: now,
        },
        createdAt: new Date(now - Math.random() * ttl),
        expiresAt: new Date(now + ttl),
        ttl: ttl,
        tags: ['test', `type:${types[i % types.length]}`],
        hits: Math.floor(Math.random() * 100),
      }
    })
  }
}

async function createUserActivities(users: any[]) {
  const actions = ['keyword_search', 'start_scan', 'api_call', 'login']
  const now = Date.now()

  for (const user of users) {
    for (let i = 0; i < 20; i++) {
      await prisma.userActivity.create({
        data: {
          userId: user.id,
          action: actions[i % actions.length],
          metadata: {
            endpoint: '/api/test',
            method: 'GET',
            statusCode: 200,
            duration: Math.floor(50 + Math.random() * 500),
          },
          ip: `192.168.1.${100 + i}`,
          userAgent: 'Mozilla/5.0 (Test)',
          createdAt: new Date(now - i * 5 * 60 * 1000), // Every 5 minutes
        }
      })
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })