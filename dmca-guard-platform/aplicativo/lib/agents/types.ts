export interface ScanSession {
  sessionId: string
  userId: string
  brandProfileId: string
  totalSites: number
  sitesScanned: number
  violationsFound: number
  status: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR'
  startedAt: Date
  estimatedCompletion?: Date
  currentSite?: string
  errorCount: number
  lastError?: string
}

export interface ViolationResult {
  id: string
  url: string
  title: string
  description: string
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  confidence: number
  detectionMethod: string
  screenshot?: string
  metadata: Record<string, any>
  detectedAt: Date
  brandProfileId: string
  knownSiteId: string
}

export interface ProgressUpdate {
  sitesScanned: number
  violationsFound: number
  currentSite?: string
  errorCount: number
  lastError?: string
  estimatedCompletion?: Date
}

export interface ScanOptions {
  respectRobots: boolean
  maxConcurrency: number
  timeout: number
  screenshotViolations: boolean
  skipRecentlyScanned: boolean
  recentThreshold: number // hours
}

export interface ScanReport {
  sessionId: string
  totalSites: number
  sitesScanned: number
  violationsFound: number
  errorCount: number
  duration: number
  averageTimePerSite: number
  violationsByRisk: Record<string, number>
  topViolationSites: Array<{
    domain: string
    violations: number
    highestRisk: string
  }>
  errors: Array<{
    site: string
    error: string
    timestamp: Date
  }>
}

export interface BrandProfile {
  id: string
  name: string
  userId: string
  keywords: string[]
  variations: string[]
  excludeKeywords: string[]
  riskThreshold: number
  industries: string[]
  contentTypes: string[]
  protectedContent: string[]
}

export interface PageContent {
  url: string
  title: string
  description: string
  bodyText: string
  images: string[]
  links: string[]
  metadata: Record<string, any>
  scrapedAt: Date
  size: number
  responseTime: number
}

export interface MatchResult {
  matches: number
  keywords: string[]
  density: number
  context: string[]
  riskScore: number
}

export interface ImageAnalysisResult {
  suspiciousImages: number
  imageUrls: string[]
  metadata: Record<string, any>
  riskScore: number
}

export interface ContextResult {
  titleMatch: boolean
  descriptionMatch: boolean
  structureRisk: number
  pageType: string
  riskScore: number
}

export interface ScrapingOptions {
  timeout: number
  userAgent: string
  respectRobots: boolean
  maxRetries: number
  delay: number
  screenshot: boolean
  followRedirects: boolean
  headers: Record<string, string>
}

export interface RobotsInfo {
  allowed: boolean
  crawlDelay: number
  sitemap?: string
  userAgent: string
  lastChecked: Date
}

export interface CacheEntry {
  key: string
  data: any
  timestamp: Date
  ttl: number
  hits: number
}

export type AgentEventType = 
  | 'session_started'
  | 'site_scanning'
  | 'violation_found'
  | 'site_completed'
  | 'session_paused'
  | 'session_resumed'
  | 'session_completed'
  | 'session_error'

export interface AgentEvent {
  type: AgentEventType
  sessionId: string
  timestamp: Date
  data: Record<string, any>
}