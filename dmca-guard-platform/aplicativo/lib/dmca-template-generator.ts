import { DetectedContent } from '@prisma/client'

interface UserInfo {
  name: string
  email: string
  phone?: string
  address?: string
}

interface DmcaTemplateData {
  subject: string
  body: string
  isUrgent: boolean
  legalReferences: string[]
}

export class DmcaTemplateGenerator {
  
  generateDmcaTemplate(
    leak: DetectedContent, 
    dmcaContact: string, 
    userInfo: UserInfo,
    customMessage?: string
  ): DmcaTemplateData {
    
    const domain = this.extractDomain(leak.infringingUrl)
    const contactName = this.extractContactName(dmcaContact)
    const isUrgent = leak.priority === 'URGENT' || leak.priority === 'HIGH'
    
    const subject = this.generateSubject(domain, isUrgent)
    const body = this.generateBody(leak, dmcaContact, userInfo, customMessage)
    
    return {
      subject,
      body,
      isUrgent,
      legalReferences: this.getLegalReferences()
    }
  }

  private generateSubject(domain: string, isUrgent: boolean): string {
    const urgencyPrefix = isUrgent ? '[URGENT] ' : ''
    return `${urgencyPrefix}DMCA Takedown Notice - Copyright Infringement on ${domain}`
  }

  private generateBody(
    leak: DetectedContent,
    dmcaContact: string,
    userInfo: UserInfo,
    customMessage?: string
  ): string {
    const contactName = this.extractContactName(dmcaContact)
    const domain = this.extractDomain(leak.infringingUrl)
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    })

    return `Dear ${contactName},

I hope this message finds you well. I am writing to notify you of copyright infringement occurring on your platform ${domain}, and to request immediate removal of the infringing content under the Digital Millennium Copyright Act (DMCA).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 TAKEDOWN REQUEST DETAILS

🔗 Infringing Content URL: ${leak.infringingUrl}
📅 Date of Detection: ${new Date(leak.createdAt).toLocaleDateString()}
⚠️  Priority Level: ${leak.priority}
📊 Similarity Score: ${leak.similarity || 'N/A'}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 COPYRIGHT HOLDER INFORMATION

Name: ${userInfo.name}
Email: ${userInfo.email}${userInfo.phone ? `\nPhone: ${userInfo.phone}` : ''}${userInfo.address ? `\nAddress: ${userInfo.address}` : ''}

I am the copyright owner (or authorized representative) of the original content being infringed upon. The infringing material identified above is being used without my permission and constitutes copyright infringement under applicable law.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 DMCA COMPLIANCE STATEMENT

I have a good faith belief that the use of the copyrighted material described above is not authorized by the copyright owner, its agent, or the law.

I swear, under penalty of perjury, that the information in this notification is accurate and that I am the copyright owner or am authorized to act on behalf of the copyright owner of an exclusive right that is allegedly infringed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚨 REQUESTED ACTION

Please remove or disable access to the infringing content immediately. According to the DMCA (17 U.S.C. § 512), you have safe harbor protections contingent upon the "expeditious" removal of infringing content upon notification.

${customMessage ? `\n📄 ADDITIONAL MESSAGE\n\n${customMessage}\n` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

I appreciate your prompt attention to this matter and look forward to your confirmation of the content removal.

Best regards,

${userInfo.name}
${userInfo.email}

Date: ${currentDate}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 Legal References:
• Digital Millennium Copyright Act (DMCA) - 17 U.S.C. § 512
• Copyright Act - 17 U.S.C. § 101 et seq.
• Online Copyright Infringement Liability Limitation Act

This notice is sent in good faith and is not intended to harass or intimidate. It is a formal legal request for copyright protection under applicable law.`
  }

  private extractContactName(email: string): string {
    if (!email) return 'Copyright Team'
    
    const localPart = email.split('@')[0]
    
    // Handle common prefixes
    if (localPart.includes('dmca')) return 'DMCA Team'
    if (localPart.includes('copyright')) return 'Copyright Team'
    if (localPart.includes('abuse')) return 'Abuse Team'
    if (localPart.includes('legal')) return 'Legal Team'
    if (localPart.includes('contact')) return 'Contact Team'
    if (localPart.includes('support')) return 'Support Team'
    
    // Capitalize first letter
    return localPart.charAt(0).toUpperCase() + localPart.slice(1) + ' Team'
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  private getLegalReferences(): string[] {
    return [
      'Digital Millennium Copyright Act (DMCA) - 17 U.S.C. § 512',
      'Copyright Act - 17 U.S.C. § 101 et seq.',
      'Online Copyright Infringement Liability Limitation Act',
      'Berne Convention for the Protection of Literary and Artistic Works',
      'WIPO Copyright Treaty'
    ]
  }

  // Generate bulk templates for multiple content
  generateBulkTemplates(
    leaks: DetectedContent[],
    dmcaContacts: Map<string, string>,
    userInfo: UserInfo,
    customMessage?: string
  ): Map<string, DmcaTemplateData> {
    const templates = new Map<string, DmcaTemplateData>()

    leaks.forEach(leak => {
      const domain = this.extractDomain(leak.infringingUrl)
      const dmcaContact = dmcaContacts.get(domain) || dmcaContacts.get(leak.infringingUrl) || ''
      
      if (dmcaContact) {
        const template = this.generateDmcaTemplate(leak, dmcaContact, userInfo, customMessage)
        templates.set(leak.id, template)
      }
    })

    return templates
  }

  // Generate template for specific platform with custom content
  generatePlatformSpecificTemplate(
    platform: string,
    urls: string[],
    userInfo: UserInfo,
    customMessage?: string
  ): DmcaTemplateData {
    const subject = `[URGENT] DMCA Takedown Notice - Multiple Copyright Infringements on ${platform}`
    
    const urlList = urls.map((url, index) => `${index + 1}. ${url}`).join('\n')
    
    const body = `Dear ${platform} Copyright Team,

I am writing to report multiple instances of copyright infringement on your platform ${platform}. As the copyright owner, I request immediate removal of the following infringing content under the DMCA:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔗 INFRINGING CONTENT URLS (${urls.length} total):

${urlList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 COPYRIGHT HOLDER: ${userInfo.name} (${userInfo.email})

I have a good faith belief that the use of this copyrighted material is not authorized by the copyright owner, its agent, or the law. I swear, under penalty of perjury, that the information in this notification is accurate and that I am the copyright owner.

${customMessage ? `\nADDITIONAL MESSAGE:\n${customMessage}\n` : ''}

Please confirm removal of all listed content.

Best regards,
${userInfo.name}
${userInfo.email}`

    return {
      subject,
      body,
      isUrgent: true,
      legalReferences: this.getLegalReferences()
    }
  }

  // Generate follow-up template for non-responsive contacts
  generateFollowUpTemplate(
    originalLeak: DetectedContent,
    dmcaContact: string,
    userInfo: UserInfo,
    daysSinceOriginal: number
  ): DmcaTemplateData {
    const domain = this.extractDomain(originalLeak.infringingUrl)
    
    return {
      subject: `[URGENT FOLLOW-UP] DMCA Takedown Notice - ${domain} (${daysSinceOriginal} days pending)`,
      body: `Dear Copyright Team,

This is a follow-up to my DMCA takedown notice sent ${daysSinceOriginal} days ago regarding copyright infringement on ${domain}.

ORIGINAL REQUEST: ${originalLeak.infringingUrl}
STATUS: Still active and accessible

Under the DMCA, platforms are required to respond expeditiously to takedown notices. The continued hosting of this infringing content may affect your safe harbor protections under 17 U.S.C. § 512.

I respectfully request immediate action on this matter.

Best regards,
${userInfo.name}
${userInfo.email}`,
      isUrgent: true,
      legalReferences: this.getLegalReferences()
    }
  }
}

// Export singleton instance
export const dmcaTemplateGenerator = new DmcaTemplateGenerator()