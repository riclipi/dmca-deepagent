#!/usr/bin/env tsx
// scripts/migrate-known-sites.ts - Migrate hardcoded sites to database

import { PrismaClient, SiteCategory } from '@prisma/client'
import chalk from 'chalk'
import { ADULT_LEAK_SITES } from '../lib/search-engines'

const prisma = new PrismaClient()

interface SiteData {
  domain: string
  category: SiteCategory
  platform?: string
  riskScore: number
}

// Categorize sites based on domain patterns
function categorizeSite(domain: string): SiteData {
  const lowerDomain = domain.toLowerCase()
  
  // Social media platforms
  if (['reddit.com', 'twitter.com', 'facebook.com', 'instagram.com', 'tumblr.com', 't.me'].includes(lowerDomain)) {
    return {
      domain,
      category: 'SOCIAL_MEDIA',
      platform: lowerDomain.replace('.com', '').replace('.me', ''),
      riskScore: 60
    }
  }
  
  // File hosting
  if (lowerDomain.includes('mega.') || lowerDomain.includes('rapidgator') || 
      lowerDomain.includes('filejoker') || lowerDomain.includes('k2s.') ||
      lowerDomain.includes('tezfiles') || lowerDomain.includes('fboom')) {
    return {
      domain,
      category: 'FILE_HOSTING',
      riskScore: 70
    }
  }
  
  // Forums
  if (lowerDomain.includes('forum') || lowerDomain.includes('board') || 
      lowerDomain.includes('community')) {
    return {
      domain,
      category: 'FORUM',
      riskScore: 65
    }
  }
  
  // Leak-specific sites
  if (lowerDomain.includes('leak') || lowerDomain.includes('leaked') || 
      lowerDomain.includes('fappening') || lowerDomain.includes('thothub')) {
    return {
      domain,
      category: 'LEAK_SITE',
      riskScore: 95
    }
  }
  
  // OnlyFans-related
  if (lowerDomain.includes('onlyfans') || lowerDomain.includes('fansly') || 
      lowerDomain.includes('fancentro') || lowerDomain.includes('loyalfans')) {
    return {
      domain,
      category: 'LEAK_SITE',
      platform: 'onlyfans',
      riskScore: 90
    }
  }
  
  // Cam sites
  if (lowerDomain.includes('cam') || lowerDomain.includes('chaturbate') || 
      lowerDomain.includes('livejasmin') || lowerDomain.includes('bongacams')) {
    return {
      domain,
      category: 'LEAK_SITE',
      platform: 'cam',
      riskScore: 85
    }
  }
  
  // Image hosting
  if (lowerDomain.includes('imgur') || lowerDomain.includes('imgbox') || 
      lowerDomain.includes('pixhost') || lowerDomain.includes('imagetwist')) {
    return {
      domain,
      category: 'IMAGE_HOSTING',
      riskScore: 50
    }
  }
  
  // Default to adult content site
  return {
    domain,
    category: 'LEAK_SITE',
    riskScore: 80
  }
}

async function migrateSites() {
  console.log(chalk.blue('🚀 Starting Known Sites Migration\n'))
  
  try {
    // Get super admin user
    const superAdminEmail = process.env.SUPER_USER_EMAIL || 'admin@dmcaguard.com'
    let adminUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: superAdminEmail },
          { planType: 'SUPER_USER' }
        ]
      }
    })
    
    if (!adminUser) {
      console.log(chalk.yellow('⚠️  Super admin not found, creating default admin user...'))
      
      // Create admin user for system-owned sites
      adminUser = await prisma.user.create({
        data: {
          email: superAdminEmail,
          name: 'System Admin',
          password: '$2a$10$DUMMY_HASH_CHANGE_THIS', // Dummy hash, should be changed
          planType: 'SUPER_USER',
          status: 'ACTIVE',
          emailVerified: true,
          emailVerifiedAt: new Date()
        }
      })
      
      console.log(chalk.green('✅ Admin user created'))
    }
    
    console.log(chalk.cyan(`📊 Processing ${ADULT_LEAK_SITES.length} sites...\n`))
    
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0
    
    // Process in batches
    const batchSize = 50
    for (let i = 0; i < ADULT_LEAK_SITES.length; i += batchSize) {
      const batch = ADULT_LEAK_SITES.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (domain) => {
        try {
          const siteData = categorizeSite(domain)
          const baseUrl = `https://${domain}`
          
          // Check if site already exists
          const existing = await prisma.knownSite.findUnique({
            where: { baseUrl }
          })
          
          if (existing) {
            // Update existing site
            await prisma.knownSite.update({
              where: { baseUrl },
              data: {
                category: siteData.category,
                platform: siteData.platform,
                riskScore: siteData.riskScore,
                isActive: true,
                updatedAt: new Date()
              }
            })
            updated++
          } else {
            // Create new site
            await prisma.knownSite.create({
              data: {
                baseUrl,
                domain: siteData.domain,
                category: siteData.category,
                platform: siteData.platform,
                riskScore: siteData.riskScore,
                isActive: true,
                crawlDelay: 1000,
                userId: adminUser.id
              }
            })
            created++
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes('Unique constraint')) {
            skipped++
          } else {
            console.error(chalk.red(`❌ Error processing ${domain}:`), error)
            errors++
          }
        }
      }))
      
      // Progress update
      const processed = Math.min(i + batchSize, ADULT_LEAK_SITES.length)
      const percentage = Math.round((processed / ADULT_LEAK_SITES.length) * 100)
      console.log(chalk.gray(`Progress: ${processed}/${ADULT_LEAK_SITES.length} (${percentage}%)`))
    }
    
    // Final statistics
    console.log(chalk.bold('\n📊 Migration Complete!\n'))
    console.log(chalk.green(`✅ Created: ${created} sites`))
    console.log(chalk.blue(`🔄 Updated: ${updated} sites`))
    console.log(chalk.yellow(`⏭️  Skipped: ${skipped} sites`))
    if (errors > 0) {
      console.log(chalk.red(`❌ Errors: ${errors} sites`))
    }
    
    // Verify total count
    const totalSites = await prisma.knownSite.count()
    console.log(chalk.cyan(`\n📈 Total sites in database: ${totalSites}`))
    
    // Category breakdown
    const categoryStats = await prisma.knownSite.groupBy({
      by: ['category'],
      _count: {
        category: true
      }
    })
    
    console.log(chalk.bold('\n📁 Sites by Category:'))
    categoryStats.forEach(stat => {
      console.log(`   ${stat.category}: ${stat._count.category}`)
    })
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Migration failed:'))
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Add command to remove hardcoded list after migration
async function removeHardcodedList() {
  console.log(chalk.yellow('\n⚠️  To complete the migration:'))
  console.log(chalk.yellow('1. Remove ADULT_LEAK_SITES from lib/search-engines.ts'))
  console.log(chalk.yellow('2. Update SearchEngineService to query from database'))
  console.log(chalk.yellow('3. Implement admin UI for site management'))
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  
  if (isDryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be made\n'))
    
    // Just show what would be migrated
    console.log(`Would migrate ${ADULT_LEAK_SITES.length} sites`)
    console.log('\nSample sites:')
    ADULT_LEAK_SITES.slice(0, 10).forEach(site => {
      const data = categorizeSite(site)
      console.log(`  ${site} -> ${data.category} (risk: ${data.riskScore})`)
    })
    
    process.exit(0)
  }
  
  // Run migration
  await migrateSites()
  await removeHardcodedList()
  
  console.log(chalk.green.bold('\n✅ Migration completed successfully!'))
}

// Run if called directly
if (require.main === module) {
  main()
}

export { migrateSites }