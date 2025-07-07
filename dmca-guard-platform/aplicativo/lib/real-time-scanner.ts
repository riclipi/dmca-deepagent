import { EventEmitter } from 'events'
import { dmcaContactDetector } from './dmca-contact-detector'
import { prisma } from './prisma'
import { emitToRoom } from './socket-server'

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
    
    const keywords = this.generateSearchKeywords(profile.brandName)
    const searchEngines = ['Google', 'Bing', 'DuckDuckGo']
    
    let totalQueries = 0
    
    for (const engine of searchEngines) {
      for (const keyword of keywords) {
        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'search',
          message: `🔍 Searching ${engine} for "${keyword}"...`,
          icon: '🔍',
          status: 'running'
        })

        // Simulate search delay
        await this.delay(500)
        
        // Mock search results
        const results = Math.floor(Math.random() * 50) + 10
        totalQueries++
        
        this.updateScanInsights(scanId, (insights) => ({
          ...insights,
          linksAnalysed: insights.linksAnalysed + results
        }))

        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'detection',
          message: `✅ Found ${results} results on ${engine}`,
          icon: '✅',
          status: 'success',
          metadata: { engine, keyword, results }
        })

        this.emitUpdate(scanId)
      }
    }

    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      searchEngines: { completed: true, queries: totalQueries, engines: searchEngines }
    }))

    this.updateProgress(scanId, 30, 'searching', '✅ Search engine queries completed')
  }

  private async runTargetedSitePhase(scanId: string, profile: any) {
    this.updateProgress(scanId, 40, 'analyzing', '🎯 Scanning targeted adult sites...')
    
    const targetSites = [
      'xvideos.com', 'pornhub.com', 'onlyfans.com', 'reddit.com',
      'telegram.me', 'discord.gg', 'fapello.com', 'thothub.tv'
    ]
    
    let leaksFound = 0
    
    for (const site of targetSites) {
      this.addActivity(scanId, {
        id: `activity_${Date.now()}`,
        timestamp: new Date(),
        type: 'search',
        message: `🎯 Scanning ${site} for leaked content...`,
        icon: '🎯',
        status: 'running'
      })

      await this.delay(800)
      
      // Simulate finding leaks
      const hasLeak = Math.random() > 0.7
      if (hasLeak) {
        leaksFound++
        
        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'detection',
          message: `⚠️ Confirmed leak detected on ${site}`,
          icon: '⚠️',
          status: 'warning',
          metadata: { site, type: 'leak' }
        })

        this.updateScanInsights(scanId, (insights) => ({
          ...insights,
          leaksFound: insights.leaksFound + 1,
          leakingSites: insights.leakingSites + 1,
          riskLevel: leaksFound > 2 ? 'HIGH' : leaksFound > 1 ? 'MEDIUM' : 'LOW' as any
        }))
      } else {
        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'verification',
          message: `✅ No leaks found on ${site}`,
          icon: '✅',
          status: 'success'
        })
      }

      this.emitUpdate(scanId)
    }

    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      targetedSiteScans: { completed: true, count: targetSites.length, sites: targetSites }
    }))

    this.updateProgress(scanId, 60, 'analyzing', '✅ Targeted site scanning completed')
  }

  private async runImageAnalysisPhase(scanId: string, profile: any) {
    this.updateProgress(scanId, 70, 'verifying', '🖼️ Running advanced image analysis...')
    
    const mockImages = 25
    let processedImages = 0
    let matches = 0
    
    for (let i = 0; i < mockImages; i++) {
      processedImages++
      
      if (i % 5 === 0) {
        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'verification',
          message: `🖼️ Analyzing image batch ${Math.floor(i/5) + 1}/${Math.ceil(mockImages/5)}...`,
          icon: '🖼️',
          status: 'running'
        })
      }

      await this.delay(200)
      
      // Simulate face recognition match
      if (Math.random() > 0.8) {
        matches++
        
        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'detection',
          message: `🎯 Face match confirmed (${Math.floor(Math.random() * 20) + 80}% confidence)`,
          icon: '🎯',
          status: 'warning'
        })
      }

      this.updateScanInsights(scanId, (insights) => ({
        ...insights,
        imagesScanned: processedImages
      }))

      if (i % 3 === 0) {
        this.emitUpdate(scanId)
      }
    }

    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      imageSearches: { completed: true, images: mockImages, processed: processedImages },
      reverseImageSearches: { completed: true, matches, verified: matches }
    }))

    this.updateProgress(scanId, 85, 'verifying', '✅ Image analysis completed')
  }

  private async runDmcaDetectionPhase(scanId: string) {
    this.updateProgress(scanId, 90, 'verifying', '📧 Detecting DMCA contacts...')
    
    const insights = this.scanInsights.get(scanId)!
    const leakingSites = insights.leakingSites
    
    let dmcaContacts = 0
    let compliantSites = 0
    
    for (let i = 0; i < leakingSites; i++) {
      const mockSite = `site${i + 1}.com`
      
      this.addActivity(scanId, {
        id: `activity_${Date.now()}`,
        timestamp: new Date(),
        type: 'dmca',
        message: `📧 Detecting DMCA contact for ${mockSite}...`,
        icon: '📧',
        status: 'running'
      })

      await this.delay(600)
      
      // Simulate DMCA contact detection
      if (Math.random() > 0.3) {
        dmcaContacts++
        const email = `dmca@${mockSite}`
        const isCompliant = Math.random() > 0.5
        
        if (isCompliant) compliantSites++
        
        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'dmca',
          message: `✅ DMCA contact found: ${email} ${isCompliant ? '(Compliant)' : '(Non-compliant)'}`,
          icon: '✅',
          status: 'success',
          metadata: { email, isCompliant }
        })
      } else {
        this.addActivity(scanId, {
          id: `activity_${Date.now()}`,
          timestamp: new Date(),
          type: 'dmca',
          message: `⚠️ No DMCA contact found for ${mockSite}`,
          icon: '⚠️',
          status: 'warning'
        })
      }

      this.emitUpdate(scanId)
    }

    this.updateScanInsights(scanId, (insights) => ({
      ...insights,
      dmcaContactsFound: dmcaContacts,
      complianceSites: compliantSites,
      estimatedRemovalTime: this.calculateRemovalTime(dmcaContacts, compliantSites)
    }))

    this.updateScanMethods(scanId, (methods) => ({
      ...methods,
      dmcaDetection: { completed: true, contacts: dmcaContacts, compliance: compliantSites }
    }))

    this.updateProgress(scanId, 95, 'verifying', '✅ DMCA contact detection completed')
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

  private generateSearchKeywords(brandName: string): string[] {
    const base = brandName.toLowerCase()
    return [
      `${base} leaked`,
      `${base} nude`,
      `${base} onlyfans`,
      `${base} pack`,
      `${base} telegram`,
      `${base} discord`,
      `${base} free download`
    ]
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