import axios from 'axios'
import * as cheerio from 'cheerio'

interface DmcaContactInfo {
  email: string | null
  isCompliant: boolean
  contactPage: string | null
  detectedMethod: string
  confidence: number
  additionalEmails: string[]
}

export class DmcaContactDetector {
  private readonly commonPages = [
    '/dmca',
    '/copyright', 
    '/takedown',
    '/abuse',
    '/contact',
    '/legal',
    '/terms',
    '/privacy',
    '/support',
    '/help'
  ]

  private readonly emailPatterns = [
    /dmca@[\w.-]+\.[\w]+/gi,
    /copyright@[\w.-]+\.[\w]+/gi,
    /abuse@[\w.-]+\.[\w]+/gi,
    /legal@[\w.-]+\.[\w]+/gi,
    /takedown@[\w.-]+\.[\w]+/gi,
    /contact@[\w.-]+\.[\w]+/gi,
    /support@[\w.-]+\.[\w]+/gi
  ]

  private readonly dmcaKeywords = [
    'dmca', 'copyright', 'takedown', 'removal request',
    'infringement', 'abuse', 'legal notice', 'cease and desist',
    'intellectual property', 'content removal'
  ]

  async findDmcaContact(url: string): Promise<DmcaContactInfo> {
    try {
      const domain = new URL(url).origin
      console.log(`🔍 Scanning ${domain} for DMCA contacts...`)

      // Try common DMCA pages first
      for (const page of this.commonPages) {
        const pageUrl = `${domain}${page}`
        try {
          const result = await this.scanPage(pageUrl)
          if (result.email) {
            console.log(`✅ Found DMCA contact: ${result.email} on ${page}`)
            return {
              ...result,
              contactPage: pageUrl,
              detectedMethod: `Common page: ${page}`
            }
          }
        } catch (error) {
          // Continue to next page if this one fails
          continue
        }
      }

      // Fallback: scan main page
      console.log(`📄 Scanning main page: ${domain}`)
      const mainPageResult = await this.scanPage(domain)
      if (mainPageResult.email) {
        return {
          ...mainPageResult,
          contactPage: domain,
          detectedMethod: 'Main page scan'
        }
      }

      // No contact found
      return {
        email: null,
        isCompliant: false,
        contactPage: null,
        detectedMethod: 'No method found',
        confidence: 0,
        additionalEmails: []
      }

    } catch (error) {
      console.error(`❌ Error detecting DMCA contact for ${url}:`, error)
      return {
        email: null,
        isCompliant: false,
        contactPage: null,
        detectedMethod: 'Error occurred',
        confidence: 0,
        additionalEmails: []
      }
    }
  }

  private async scanPage(pageUrl: string): Promise<Omit<DmcaContactInfo, 'contactPage' | 'detectedMethod'>> {
    try {
      const response = await axios.get(pageUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      })

      const $ = cheerio.load(response.data)
      const pageText = $.text().toLowerCase()
      const pageHtml = response.data.toLowerCase()

      // Extract all potential emails
      const allEmails = this.extractEmails(pageHtml)
      
      // Find best DMCA email
      const dmcaEmail = this.findBestDmcaEmail(allEmails)
      
      // Check compliance based on content
      const isCompliant = this.checkCompliance(pageText, dmcaEmail !== null)
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(pageText, dmcaEmail, allEmails)

      return {
        email: dmcaEmail,
        isCompliant,
        confidence,
        additionalEmails: allEmails.filter(email => email !== dmcaEmail).slice(0, 3)
      }

    } catch (error) {
      throw new Error(`Failed to scan page: ${error.message}`)
    }
  }

  private extractEmails(html: string): string[] {
    const emails = new Set<string>()
    
    // Apply all email patterns
    for (const pattern of this.emailPatterns) {
      const matches = html.match(pattern)
      if (matches) {
        matches.forEach(email => emails.add(email.toLowerCase()))
      }
    }

    // Generic email pattern as fallback
    const genericPattern = /[\w.-]+@[\w.-]+\.[\w]+/gi
    const genericMatches = html.match(genericPattern)
    if (genericMatches) {
      genericMatches.forEach(email => {
        // Only add if it seems relevant to DMCA
        if (this.isRelevantEmail(email)) {
          emails.add(email.toLowerCase())
        }
      })
    }

    return Array.from(emails)
  }

  private findBestDmcaEmail(emails: string[]): string | null {
    // Priority order for DMCA emails
    const priorities = [
      'dmca@',
      'copyright@', 
      'takedown@',
      'abuse@',
      'legal@',
      'contact@',
      'support@'
    ]

    for (const priority of priorities) {
      const found = emails.find(email => email.startsWith(priority))
      if (found) return found
    }

    // If no priority match, return first email that seems relevant
    return emails.find(email => this.isRelevantEmail(email)) || null
  }

  private isRelevantEmail(email: string): boolean {
    const relevantTerms = ['dmca', 'copyright', 'abuse', 'legal', 'takedown', 'contact', 'support', 'admin', 'info']
    return relevantTerms.some(term => email.includes(term))
  }

  private checkCompliance(pageText: string, hasEmail: boolean): boolean {
    let complianceScore = 0

    // Check for DMCA-related keywords
    const dmcaKeywordCount = this.dmcaKeywords.filter(keyword => 
      pageText.includes(keyword)
    ).length

    complianceScore += dmcaKeywordCount * 10

    // Bonus for having dedicated contact
    if (hasEmail) complianceScore += 30

    // Check for specific compliance indicators
    const complianceIndicators = [
      'digital millennium copyright act',
      'dmca policy',
      'copyright infringement',
      'takedown notice',
      'counter notification',
      'repeat infringer policy'
    ]

    complianceIndicators.forEach(indicator => {
      if (pageText.includes(indicator)) {
        complianceScore += 20
      }
    })

    return complianceScore >= 50
  }

  private calculateConfidence(pageText: string, email: string | null, allEmails: string[]): number {
    let confidence = 0

    // Base confidence from having an email
    if (email) {
      if (email.includes('dmca')) confidence += 90
      else if (email.includes('copyright')) confidence += 80
      else if (email.includes('abuse')) confidence += 70
      else if (email.includes('legal')) confidence += 60
      else confidence += 40
    }

    // Bonus for DMCA-specific content
    const dmcaKeywordCount = this.dmcaKeywords.filter(keyword => pageText.includes(keyword)).length
    confidence += Math.min(dmcaKeywordCount * 5, 30)

    // Bonus for multiple contact options
    if (allEmails.length > 1) confidence += 10

    return Math.min(confidence, 100)
  }

  // Utility method to get domain from URL
  getDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  }

  // Batch processing for multiple URLs
  async findDmcaContactsBatch(urls: string[]): Promise<Map<string, DmcaContactInfo>> {
    const results = new Map<string, DmcaContactInfo>()
    
    // Process in batches to avoid overwhelming servers
    const batchSize = 5
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize)
      const promises = batch.map(async (url) => {
        const contact = await this.findDmcaContact(url)
        return [url, contact] as [string, DmcaContactInfo]
      })

      const batchResults = await Promise.allSettled(promises)
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [url, contact] = result.value
          results.set(url, contact)
        }
      })

      // Small delay between batches
      if (i + batchSize < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }
}

// Export singleton instance
export const dmcaContactDetector = new DmcaContactDetector()