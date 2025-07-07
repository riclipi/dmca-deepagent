import { EventEmitter } from 'events'
import { dmcaContactDetector } from './dmca-contact-detector'
import { prisma } from './prisma'
import { emitToRoom } from './socket-server'
import SearchEngineService from './search-engines'

export interface ScanProgress {
  scanId: string
  userId: string
  isRunning: boolean
  startedAt: Date
  completedAt?: Date
  elapsedMinutes: number
  currentActivity: string
  progress: number // 0-100%
  phase: 'initializing' | 'searching' | 'analyzing' | 'verifying' | 'completed' | 'failed'
}

export interface ScanMethods {
  targetedSiteScans: { completed: boolean; count: number; sites: string[] }
  searchEngines: { completed: boolean; queries: number; engines: string[] }
  imageSearches: { completed: boolean; images: number; processed: number }
  reverseImageSearches: { completed: boolean; matches: number; verified: number }
  nicheBasedSearches: { completed: boolean; platforms: number; found: number }
  dmcaDetection: { completed: boolean; contacts: number; compliance: number }
}

export interface ScanInsights {
  linksAnalysed: number
  leakingSites: number
  leaksFound: number
  imagesScanned: number
  dmcaContactsFound: number
  complianceSites: number
  estimatedRemovalTime: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export interface ScanActivity {
  id: string
  timestamp: Date
  type: 'search' | 'detection' | 'verification' | 'dmca' | 'completion'
  message: string
  icon: string
  status: 'running' | 'success' | 'warning' | 'error'
  metadata?: any
}

class RealTimeScanner extends EventEmitter {
  private activeScans: Map<string, ScanProgress> = new Map()
  private scanMethods: Map<string, ScanMethods> = new Map()
  private scanInsights: Map<string, ScanInsights> = new Map()
  private scanActivities: Map<string, ScanActivity[]> = new Map()

  async startScan(userId: string, profileId: string, scanType: 'full' | 'quick' | 'targeted' = 'full'): Promise<string> {
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const scanProgress: ScanProgress = {
      scanId,
      userId,
      isRunning: true,
      startedAt: new Date(),
      elapsedMinutes: 0,
      currentActivity: '🚀 Initializing comprehensive scan...',
      progress: 0,
      phase: 'initializing'
    }

    const scanMethods: ScanMethods = {
      targetedSiteScans: { completed: false, count: 0, sites: [] },
      searchEngines: { completed: false, queries: 0, engines: [] },
      imageSearches: { completed: false, images: 0, processed: 0 },
      reverseImageSearches: { completed: false, matches: 0, verified: 0 },
      nicheBasedSearches: { completed: false, platforms: 0, found: 0 },
      dmcaDetection: { completed: false, contacts: 0, compliance: 0 }
    }

    const scanInsights: ScanInsights = {
      linksAnalysed: 0,
      leakingSites: 0,
      leaksFound: 0,
      imagesScanned: 0,
      dmcaContactsFound: 0,
      complianceSites: 0,
      estimatedRemovalTime: 'Calculating...',
      riskLevel: 'LOW'
    }

    this.activeScans.set(scanId, scanProgress)
    this.scanMethods.set(scanId, scanMethods)
    this.scanInsights.set(scanId, scanInsights)
    this.scanActivities.set(scanId, [])

    // Add initial activity
    this.addActivity(scanId, {
      id: `activity_${Date.now()}`,
      timestamp: new Date(),
      type: 'search',
      message: '🚀 Starting comprehensive leak detection scan...',
      icon: '🚀',
      status: 'running'
    })

    // Start the scan process
    this.runScanProcess(scanId, profileId, scanType)
    
    // Emit initial state
    this.emitUpdate(scanId)
    
    return scanId
  }

  private async runScanProcess(scanId: string, profileId: string, scanType: string) {
    try {
      // Get brand profile data
      const profile = await prisma.brandProfile.findUnique({
        where: { id: profileId }
      })

      if (!profile) {
        throw new Error('Brand profile not found')
      }

      // Phase 1: Search Engine Queries
      await this.runSearchEnginePhase(scanId, profile)
      
      // Phase 2: Targeted Site Scans
      await this.runTargetedSitePhase(scanId, profile)
      
      // Phase 3: Image Analysis
      await this.runImageAnalysisPhase(scanId, profile)
      
      // Phase 4: DMCA Contact Detection
      await this.runDmcaDetectionPhase(scanId)
      
      // Phase 5: Completion
      await this.completeScan(scanId)

    } catch (error) {
      await this.failScan(scanId, error instanceof Error ? error.message : 'Unknown error occurred')
    }
  }

  private async runSearchEnginePhase(scanId: string, profile: any) {
    this.updateProgress(scanId, 10, 'searching', '🔍 Searching across multiple search engines...')
    
    // Initialize search service
    const searchService = new SearchEngineService()
    
    // Get keywords from profile
    let keywords: string[] = []
    if (profile.safeKeywords && profile.safeKeywords.length > 0) {
      // Use safe keywords from profile
      keywords = profile.safeKeywords
      console.log(`🔐 Using ${keywords.length} safe keywords from profile`)
    } else {
      // Generate keywords from brand name
      keywords = searchService.generateSearchKeywords(profile.brandName)
      console.log(`⚠️ Generated ${keywords.length} keywords from brand name`)
    }
    
    // Get whitelist domains
    const domainWhitelists = await prisma.domainWhitelist.findMany({
      where: { userId: profile.userId },
      select: { domain: true }
    })
    
    const excludeDomains = [
      ...domainWhitelists.map(w => w.domain),
      ...profile.officialUrls.map((url: string) => new URL(url).hostname),
      'onlyfans.com'
    ]
    
    let totalQueries = 0
    let totalResults = 0
    let leaksFound = 0
    const searchEngines: string[] = []
    const detectedUrls = new Set<string>()
    
    // Process keywords in batches
    const batchSize = 3
    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize)
      
      // Process batch in parallel
      const batchPromises = batch.map(async (keyword) => {
        this.addActivity(scanId, {
          id: `activity_${Date.now()}_${Math.random()}`,
          timestamp: new Date(),
          type: 'search',
          message: `🔍 Searching for "${keyword}"...`,
          icon: '🔍',
          status: 'running'
        })
        
        try {
          // Perform real search
          const searchConfig = {
            keyword,
            brandName: profile.brandName,
            excludeDomains,
            maxResults: 20,
            platforms: []
          }
          
          const results = await searchService.performCompleteSearch(searchConfig)
          totalQueries++
          
          if (results.length > 0) {
            totalResults += results.length
            
            // Count high confidence results as leaks
            const highConfidenceResults = results.filter(r => r.confidence >= 60)
            leaksFound += highConfidenceResults.length
            
            // Track unique URLs
            results.forEach(r => detectedUrls.add(r.url))
            
            // Track which search engines returned results
            const resultSources = [...new Set(results.map(r => r.source))]
            resultSources.forEach(source => {
              if (!searchEngines.includes(source)) searchEngines.push(source)
            })
            
            this.addActivity(scanId, {
              id: `activity_${Date.now()}_${Math.random()}`,
              timestamp: new Date(),
              type: 'detection',
              message: `✅ Found ${results.length} results for "${keyword}" (${highConfidenceResults.length} high confidence)`,
              icon: '✅',
              status: highConfidenceResults.length > 0 ? 'warning' : 'success',
              metadata: { 
                keyword, 
                results: results.length,
                highConfidence: highConfidenceResults.length,
                sources: resultSources
              }
            })
            
            // Save high confidence results to database
            for (const result of highConfidenceResults) {
              try {
                // Check if already exists
                const existing = await prisma.detectedContent.findFirst({
                  where: {
                    infringingUrl: result.url,
                    brandProfileId: profile.id
                  }
                })
                
                if (!existing && result.confidence >= 50) {
                  await prisma.detectedContent.create({
                    data: {
                      userId: profile.userId,
                      brandProfileId: profile.id,
                      title: result.title,
                      description: result.snippet,
                      contentType: 'OTHER',
                      infringingUrl: result.url,
                      platform: result.platform,
                      thumbnailUrl: result.thumbnailUrl,
                      confidence: Math.round(result.confidence),
                      keywordSource: keyword,
                      platformType: result.source,
                      priority: result.confidence >= 70 ? 'HIGH' : 'MEDIUM',
                      detectedAt: result.detectedAt || new Date()
                    }
                  })
                }
              } catch (error) {
                console.error(`Error saving result: ${error}`)
              }
            }
          } else {
            this.addActivity(scanId, {
              id: `activity_${Date.now()}_${Math.random()}`,
              timestamp: new Date(),
              type: 'verification',
              message: `✅ No results found for "${keyword}"`,
              icon: '✅',
              status: 'success'
            })
          }
        } catch (error) {
          console.error(`Error searching for "${keyword}":`, error)
          this.addActivity(scanId, {
            id: `activity_${Date.now()}_${Math.random()}`,
            timestamp: new Date(),
            type: 'search',
            message: `⚠️ Error searching for "${keyword}"`,
            icon: '⚠️',
            status: 'error'
          })
        }
        
        this.updateScanInsights(scanId, (insights) => ({
          ...insights,
          linksAnalysed: detectedUrls.size,
          leaksFound: leaksFound,
          leakingSites: leaksFound > 0 ? Math.min(leaksFound, detectedUrls.size) : 0,
          riskLevel: leaksFound > 5 ? 'HIGH' : leaksFound > 2 ? 'MEDIUM' : 'LOW' as any
        }))
        
        this.emitUpdate(scanId)
      })
      
      // Wait for batch to complete
      await Promise.allSettled(batchPromises)
      
      // Small delay between batches
      if (i + batchSize < keywords.length) {
        await this.delay(1000)
      }
    }
    
    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      searchEngines: { 
        completed: true, 
        queries: totalQueries, 
        engines: searchEngines.length > 0 ? searchEngines : ['No APIs configured']
      }
    }))
    
    const message = totalResults > 0 
      ? `✅ Search completed: ${totalResults} results found across ${totalQueries} queries`
      : '⚠️ Search completed: No results found (check API configuration)'
    
    this.updateProgress(scanId, 30, 'searching', message)
  }

  private async runTargetedSitePhase(scanId: string, profile: any) {
    this.updateProgress(scanId, 40, 'analyzing', '🎯 Scanning targeted adult sites...')
    
    // Initialize search service
    const searchService = new SearchEngineService()
    
    // Priority sites to check with site-specific searches
    const targetSites = [
      'reddit.com',
      'twitter.com', 
      'x.com',
      'telegram.me',
      'discord.gg',
      'mega.nz',
      'pornhub.com',
      'xvideos.com',
      'spankbang.com',
      'erome.com',
      'fapello.com',
      'thothub.tv',
      'coomer.party',
      'kemono.party',
      'bunkr.ru',
      'cyberfile.su'
    ]
    
    // Get whitelist domains
    const domainWhitelists = await prisma.domainWhitelist.findMany({
      where: { userId: profile.userId },
      select: { domain: true }
    })
    
    const excludeDomains = [
      ...domainWhitelists.map(w => w.domain),
      ...profile.officialUrls.map((url: string) => new URL(url).hostname),
      'onlyfans.com'
    ]
    
    let sitesWithLeaks = 0
    let totalLeaksFound = 0
    const scannedSites: string[] = []
    
    // Process sites in batches
    const batchSize = 3
    for (let i = 0; i < targetSites.length; i += batchSize) {
      const batch = targetSites.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (site) => {
        this.addActivity(scanId, {
          id: `activity_${Date.now()}_${Math.random()}`,
          timestamp: new Date(),
          type: 'search',
          message: `🎯 Scanning ${site} for leaked content...`,
          icon: '🎯',
          status: 'running'
        })
        
        try {
          // Create site-specific search query
          const siteQuery = `site:${site} "${profile.brandName}"`
          
          const searchConfig = {
            keyword: siteQuery,
            brandName: profile.brandName,
            excludeDomains,
            maxResults: 10,
            platforms: [site]
          }
          
          const results = await searchService.performCompleteSearch(searchConfig)
          scannedSites.push(site)
          
          if (results.length > 0) {
            const highConfidenceResults = results.filter(r => r.confidence >= 50)
            
            if (highConfidenceResults.length > 0) {
              sitesWithLeaks++
              totalLeaksFound += highConfidenceResults.length
              
              this.addActivity(scanId, {
                id: `activity_${Date.now()}_${Math.random()}`,
                timestamp: new Date(),
                type: 'detection',
                message: `⚠️ Found ${highConfidenceResults.length} potential leaks on ${site}`,
                icon: '⚠️',
                status: 'warning',
                metadata: { 
                  site, 
                  type: 'leak',
                  count: highConfidenceResults.length,
                  urls: highConfidenceResults.slice(0, 3).map(r => r.url)
                }
              })
              
              // Save results to database
              for (const result of highConfidenceResults) {
                try {
                  const existing = await prisma.detectedContent.findFirst({
                    where: {
                      infringingUrl: result.url,
                      brandProfileId: profile.id
                    }
                  })
                  
                  if (!existing) {
                    await prisma.detectedContent.create({
                      data: {
                        userId: profile.userId,
                        brandProfileId: profile.id,
                        title: result.title,
                        description: result.snippet,
                        contentType: 'OTHER',
                        infringingUrl: result.url,
                        platform: site,
                        thumbnailUrl: result.thumbnailUrl,
                        confidence: Math.round(result.confidence),
                        keywordSource: `site:${site}`,
                        platformType: 'targeted_scan',
                        priority: result.confidence >= 70 ? 'HIGH' : 'MEDIUM',
                        detectedAt: new Date()
                      }
                    })
                  }
                } catch (error) {
                  console.error(`Error saving result from ${site}:`, error)
                }
              }
            } else {
              this.addActivity(scanId, {
                id: `activity_${Date.now()}_${Math.random()}`,
                timestamp: new Date(),
                type: 'verification',
                message: `✅ No high-confidence leaks found on ${site}`,
                icon: '✅',
                status: 'success'
              })
            }
          } else {
            this.addActivity(scanId, {
              id: `activity_${Date.now()}_${Math.random()}`,
              timestamp: new Date(),
              type: 'verification',
              message: `✅ No content found on ${site}`,
              icon: '✅',
              status: 'success'
            })
          }
        } catch (error) {
          console.error(`Error scanning ${site}:`, error)
          this.addActivity(scanId, {
            id: `activity_${Date.now()}_${Math.random()}`,
            timestamp: new Date(),
            type: 'search',
            message: `⚠️ Error scanning ${site}`,
            icon: '⚠️',
            status: 'error'
          })
        }
        
        this.emitUpdate(scanId)
      })
      
      await Promise.allSettled(batchPromises)
      
      // Update insights after each batch
      const currentInsights = this.scanInsights.get(scanId)!
      this.updateScanInsights(scanId, (insights) => ({
        ...insights,
        leakingSites: sitesWithLeaks,
        leaksFound: currentInsights.leaksFound + totalLeaksFound,
        riskLevel: totalLeaksFound > 5 ? 'HIGH' : totalLeaksFound > 2 ? 'MEDIUM' : 'LOW' as any
      }))
      
      // Small delay between batches
      if (i + batchSize < targetSites.length) {
        await this.delay(1000)
      }
    }
    
    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      targetedSiteScans: { 
        completed: true, 
        count: scannedSites.length, 
        sites: scannedSites 
      }
    }))

    const message = sitesWithLeaks > 0
      ? `⚠️ Targeted scan completed: Found leaks on ${sitesWithLeaks} sites`
      : '✅ Targeted scan completed: No leaks found on priority sites'
      
    this.updateProgress(scanId, 60, 'analyzing', message)
  }

  private async runImageAnalysisPhase(scanId: string, profile: any) {
    this.updateProgress(scanId, 70, 'verifying', '🖼️ Preparing image analysis...')
    
    // For now, we'll skip actual image analysis as it requires additional APIs
    // This phase can be implemented later with:
    // - Google Vision API for face detection
    // - PimEyes API for reverse image search
    // - Custom image hashing for duplicate detection
    
    this.addActivity(scanId, {
      id: `activity_${Date.now()}_${Math.random()}`,
      timestamp: new Date(),
      type: 'verification',
      message: '🖼️ Image analysis phase skipped (requires additional APIs)',
      icon: '🖼️',
      status: 'success'
    })
    
    // Mark the phase as completed but with no results
    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      imageSearches: { completed: true, images: 0, processed: 0 },
      reverseImageSearches: { completed: true, matches: 0, verified: 0 }
    }))
    
    this.updateProgress(scanId, 85, 'verifying', '⏭️ Image analysis skipped')
    
    // Small delay to show the status
    await this.delay(1000)
  }

  private async runDmcaDetectionPhase(scanId: string) {
    this.updateProgress(scanId, 90, 'verifying', '📧 Detecting DMCA contacts...')
    
    const scanProgress = this.activeScans.get(scanId)!
    
    // Get detected content from this scan
    const detectedContent = await prisma.detectedContent.findMany({
      where: {
        userId: scanProgress.userId,
        createdAt: {
          gte: scanProgress.startedAt
        }
      },
      select: {
        infringingUrl: true,
        platform: true
      }
    })
    
    // Extract unique domains
    const uniqueDomains = new Set<string>()
    detectedContent.forEach(content => {
      try {
        const domain = new URL(content.infringingUrl).hostname
        uniqueDomains.add(domain)
      } catch (error) {
        console.error(`Invalid URL: ${content.infringingUrl}`)
      }
    })
    
    console.log(`📧 Checking DMCA contacts for ${uniqueDomains.size} unique domains`)
    
    let dmcaContactsFound = 0
    let compliantSites = 0
    const dmcaResults: Array<{domain: string, contact: any}> = []
    
    // Process domains in batches
    const domains = Array.from(uniqueDomains)
    const batchSize = 3
    
    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (domain) => {
        this.addActivity(scanId, {
          id: `activity_${Date.now()}_${Math.random()}`,
          timestamp: new Date(),
          type: 'dmca',
          message: `📧 Detecting DMCA contact for ${domain}...`,
          icon: '📧',
          status: 'running'
        })
        
        try {
          const contactInfo = await dmcaContactDetector.findDmcaContact(`https://${domain}`)
          
          if (contactInfo.email) {
            dmcaContactsFound++
            if (contactInfo.isCompliant) compliantSites++
            
            dmcaResults.push({ domain, contact: contactInfo })
            
            this.addActivity(scanId, {
              id: `activity_${Date.now()}_${Math.random()}`,
              timestamp: new Date(),
              type: 'dmca',
              message: `✅ DMCA contact found: ${contactInfo.email} ${contactInfo.isCompliant ? '(Compliant)' : '(Non-compliant)'}`,
              icon: '✅',
              status: 'success',
              metadata: { 
                domain,
                email: contactInfo.email, 
                isCompliant: contactInfo.isCompliant,
                confidence: contactInfo.confidence,
                method: contactInfo.detectedMethod
              }
            })
            
            // Save DMCA contact info for detected content
            try {
              // Find detected content for this domain
              const contentForDomain = detectedContent.find(content => {
                try {
                  return new URL(content.infringingUrl).hostname === domain
                } catch {
                  return false
                }
              })
              
              if (contentForDomain) {
                // Check if DMCA info already exists for this content
                const existing = await prisma.dmcaContactInfo.findUnique({
                  where: {
                    detectedContentId: contentForDomain.infringingUrl // Using URL as ID proxy
                  }
                })
                
                if (!existing) {
                  // Get the actual detected content record with ID
                  const detectedContentRecord = await prisma.detectedContent.findFirst({
                    where: {
                      infringingUrl: contentForDomain.infringingUrl
                    }
                  })
                  
                  if (detectedContentRecord) {
                    await prisma.dmcaContactInfo.create({
                      data: {
                        detectedContentId: detectedContentRecord.id,
                        email: contactInfo.email,
                        isCompliant: contactInfo.isCompliant,
                        contactPage: contactInfo.contactPage,
                        detectedMethod: contactInfo.detectedMethod,
                        confidence: contactInfo.confidence,
                        additionalEmails: contactInfo.additionalEmails,
                        lastCheckedAt: new Date()
                      }
                    })
                  }
                }
              }
            } catch (error) {
              console.error(`Error saving DMCA contact for ${domain}:`, error)
            }
          } else {
            this.addActivity(scanId, {
              id: `activity_${Date.now()}_${Math.random()}`,
              timestamp: new Date(),
              type: 'dmca',
              message: `⚠️ No DMCA contact found for ${domain}`,
              icon: '⚠️',
              status: 'warning',
              metadata: { domain }
            })
          }
        } catch (error) {
          console.error(`Error detecting DMCA for ${domain}:`, error)
          this.addActivity(scanId, {
            id: `activity_${Date.now()}_${Math.random()}`,
            timestamp: new Date(),
            type: 'dmca',
            message: `❌ Error checking ${domain}`,
            icon: '❌',
            status: 'error'
          })
        }
        
        this.emitUpdate(scanId)
      })
      
      await Promise.allSettled(batchPromises)
      
      // Small delay between batches
      if (i + batchSize < domains.length) {
        await this.delay(500)
      }
    }
    
    // Update insights with real data
    this.updateScanInsights(scanId, (insights) => ({
      ...insights,
      dmcaContactsFound: dmcaContactsFound,
      complianceSites: compliantSites,
      estimatedRemovalTime: this.calculateRemovalTime(dmcaContactsFound, compliantSites)
    }))

    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      dmcaDetection: { 
        completed: true, 
        contacts: dmcaContactsFound, 
        compliance: compliantSites 
      }
    }))

    const message = dmcaContactsFound > 0
      ? `✅ DMCA detection completed: Found ${dmcaContactsFound} contacts (${compliantSites} compliant)`
      : '⚠️ DMCA detection completed: No contacts found'
      
    this.updateProgress(scanId, 95, 'verifying', message)
  }

  private async completeScan(scanId: string) {
    const insights = this.scanInsights.get(scanId)!
    
    this.addActivity(scanId, {
      id: `activity_${Date.now()}`,
      timestamp: new Date(),
      type: 'completion',
      message: `🎉 Scan completed! Found ${insights.leaksFound} leaks across ${insights.leakingSites} sites`,
      icon: '🎉',
      status: 'success'
    })

    this.updateProgress(scanId, 100, 'completed', '🎉 Comprehensive scan completed successfully')
    
    const scanProgress = this.activeScans.get(scanId)!
    scanProgress.isRunning = false
    scanProgress.completedAt = new Date()
    
    this.emitUpdate(scanId)
    
    // Save results to database
    await this.saveScanResults(scanId)
  }

  private async failScan(scanId: string, error: string) {
    this.addActivity(scanId, {
      id: `activity_${Date.now()}`,
      timestamp: new Date(),
      type: 'completion',
      message: `❌ Scan failed: ${error}`,
      icon: '❌',
      status: 'error'
    })

    this.updateProgress(scanId, 0, 'failed', `❌ Scan failed: ${error}`)
    
    const scanProgress = this.activeScans.get(scanId)!
    scanProgress.isRunning = false
    scanProgress.completedAt = new Date()
    
    this.emitUpdate(scanId)
  }


  private calculateRemovalTime(contacts: number, compliant: number): string {
    if (contacts === 0) return 'Manual action required'
    if (compliant > contacts * 0.7) return '1-3 days'
    if (compliant > contacts * 0.4) return '3-7 days'
    return '1-2 weeks'
  }

  private updateProgress(scanId: string, progress: number, phase: ScanProgress['phase'], activity: string) {
    const scan = this.activeScans.get(scanId)
    if (scan) {
      scan.progress = progress
      scan.phase = phase
      scan.currentActivity = activity
      scan.elapsedMinutes = Math.floor((Date.now() - scan.startedAt.getTime()) / 60000)
      
      // Emit WebSocket event for scan progress
      emitToRoom('/monitoring', `scan:${scanId}`, 'scan-progress', {
        scanId,
        progress,
        phase,
        currentActivity: activity,
        elapsedMinutes: scan.elapsedMinutes
      })
    }
  }

  private updateScanMethods(scanId: string, updater: (methods: ScanMethods) => ScanMethods) {
    const methods = this.scanMethods.get(scanId)
    if (methods) {
      this.scanMethods.set(scanId, updater(methods))
    }
  }

  private updateScanInsights(scanId: string, updater: (insights: ScanInsights) => ScanInsights) {
    const insights = this.scanInsights.get(scanId)
    if (insights) {
      this.scanInsights.set(scanId, updater(insights))
    }
  }

  private addActivity(scanId: string, activity: ScanActivity) {
    const activities = this.scanActivities.get(scanId) || []
    activities.unshift(activity) // Add to beginning for newest first
    
    // Keep only last 50 activities
    if (activities.length > 50) {
      activities.splice(50)
    }
    
    this.scanActivities.set(scanId, activities)
    
    // Emit WebSocket event for new activity
    emitToRoom('/monitoring', `scan:${scanId}`, 'scan-activity', {
      scanId,
      activity
    })
  }

  private emitUpdate(scanId: string) {
    const update = {
      scanId,
      progress: this.activeScans.get(scanId),
      methods: this.scanMethods.get(scanId),
      insights: this.scanInsights.get(scanId),
      activities: this.scanActivities.get(scanId)?.slice(0, 10) // Latest 10 for real-time feed
    }
    
    this.emit('scanUpdate', update)
    
    // Emit WebSocket events for different update types
    const scan = this.activeScans.get(scanId)
    if (scan) {
      emitToRoom('/monitoring', `scan:${scanId}`, 'scan-methods', {
        scanId,
        methods: this.scanMethods.get(scanId)
      })
      
      emitToRoom('/monitoring', `scan:${scanId}`, 'scan-insights', {
        scanId,
        insights: this.scanInsights.get(scanId)
      })
    }
  }

  private async saveScanResults(scanId: string) {
    const progress = this.activeScans.get(scanId)
    const insights = this.scanInsights.get(scanId)
    
    if (!progress || !insights) return

    // Save scan results to database
    // This would integrate with your existing detected content system
    console.log(`💾 Saving scan results for ${scanId}`, {
      userId: progress.userId,
      leaksFound: insights.leaksFound,
      leakingSites: insights.leakingSites,
      dmcaContacts: insights.dmcaContactsFound
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Public getters
  getScanProgress(scanId: string): ScanProgress | undefined {
    return this.activeScans.get(scanId)
  }

  getScanMethods(scanId: string): ScanMethods | undefined {
    return this.scanMethods.get(scanId)
  }

  getScanInsights(scanId: string): ScanInsights | undefined {
    return this.scanInsights.get(scanId)
  }

  getScanActivities(scanId: string): ScanActivity[] {
    return this.scanActivities.get(scanId) || []
  }

  getActiveScanIds(): string[] {
    return Array.from(this.activeScans.keys()).filter(scanId => 
      this.activeScans.get(scanId)?.isRunning
    )
  }

  stopScan(scanId: string): boolean {
    const scan = this.activeScans.get(scanId)
    if (scan && scan.isRunning) {
      scan.isRunning = false
      scan.completedAt = new Date()
      scan.currentActivity = '⏹️ Scan stopped by user'
      scan.phase = 'completed'
      this.emitUpdate(scanId)
      return true
    }
    return false
  }
}

// Export singleton instance
export const realTimeScanner = new RealTimeScanner()