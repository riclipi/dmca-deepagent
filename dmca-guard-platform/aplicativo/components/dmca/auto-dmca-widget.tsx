'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, CheckCircle, Clock, Globe, Mail, Send, Loader2, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DmcaContactInfo {
  email: string | null
  isCompliant: boolean
  contactPage: string | null
  detectedMethod: string
  confidence: number
  additionalEmails: string[]
}

interface AutoDmcaWidgetProps {
  detectedContentId: string
  contentUrl: string
  platform: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  onSubmitSuccess?: () => void
}

export function AutoDmcaWidget({
  detectedContentId,
  contentUrl,
  platform,
  priority,
  onSubmitSuccess
}: AutoDmcaWidgetProps) {
  const [contactInfo, setContactInfo] = useState<DmcaContactInfo | null>(null)
  const [template, setTemplate] = useState<any>(null)
  const [customMessage, setCustomMessage] = useState('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<'detect' | 'generate' | 'submit'>('detect')
  
  const { toast } = useToast()

  const detectDmcaContact = async () => {
    setIsDetecting(true)
    try {
      const response = await fetch('/api/dmca-contacts/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ detectedContentId })
      })

      const data = await response.json()

      if (data.success) {
        setContactInfo(data.contactInfo)
        setStep('generate')
        
        if (data.contactInfo.email) {
          toast({
            title: '✅ DMCA Contact Found!',
            description: `Found: ${data.contactInfo.email} (${data.contactInfo.confidence}% confidence)`
          })
        } else {
          toast({
            title: '⚠️ No DMCA Contact Found',
            description: 'You can still submit manually by providing an email address.',
            variant: 'destructive'
          })
        }
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error detecting DMCA contact:', error)
      toast({
        title: 'Detection Failed',
        description: 'Failed to detect DMCA contact. Try manual submission.',
        variant: 'destructive'
      })
    } finally {
      setIsDetecting(false)
    }
  }

  const generateTemplate = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/dmca-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          detectedContentId,
          customMessage: customMessage || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        setTemplate(data.template)
        setStep('submit')
        toast({
          title: '📝 Template Generated',
          description: 'DMCA takedown template ready for submission'
        })
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error generating template:', error)
      toast({
        title: 'Template Generation Failed',
        description: error.message || 'Failed to generate DMCA template',
        variant: 'destructive'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const submitTakedown = async () => {
    if (!template || !contactInfo?.email) {
      toast({
        title: 'Cannot Submit',
        description: 'Template and contact email are required',
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/takedown-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detectedContentId,
          recipientEmail: contactInfo.email,
          subject: template.subject,
          message: template.body,
          platform
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: '🚀 DMCA Request Submitted!',
          description: `Takedown request sent to ${contactInfo.email}`
        })
        onSubmitSuccess?.()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Error submitting takedown:', error)
      toast({
        title: 'Submission Failed',
        description: error.message || 'Failed to submit DMCA request',
        variant: 'destructive'
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const getDomainFromUrl = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800 border-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600'
    if (confidence >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Auto-DMCA Submission
            </CardTitle>
            <CardDescription>
              Automated DMCA takedown request for {getDomainFromUrl(contentUrl)}
            </CardDescription>
          </div>
          <Badge className={getPriorityColor(priority)}>
            {priority}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Content Info */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <Globe className="h-5 w-5 text-gray-500" />
          <div className="flex-1">
            <p className="font-medium">{platform}</p>
            <p className="text-sm text-gray-600 truncate">{contentUrl}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(contentUrl, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {/* Step 1: Detect Contact */}
        {step === 'detect' && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Step 1: Detect DMCA Contact
            </h3>
            <p className="text-sm text-gray-600">
              Scan the website to automatically find DMCA contact information.
            </p>
            <Button 
              onClick={detectDmcaContact} 
              disabled={isDetecting}
              className="w-full"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scanning for DMCA contacts...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Detect DMCA Contact
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Generate Template */}
        {step === 'generate' && contactInfo && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Step 2: Generate Template
            </h3>
            
            {/* Contact Info Display */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">DMCA Contact:</span>
                <span className={contactInfo.email ? 'text-green-600' : 'text-red-600'}>
                  {contactInfo.email || 'No email found'}
                </span>
              </div>
              
              {contactInfo.email && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confidence:</span>
                    <span className={`text-sm font-medium ${getConfidenceColor(contactInfo.confidence)}`}>
                      {contactInfo.confidence}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Compliant:</span>
                    <Badge variant={contactInfo.isCompliant ? 'default' : 'destructive'}>
                      {contactInfo.isCompliant ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  
                  {contactInfo.detectedMethod && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Method:</span>
                      <span className="text-sm">{contactInfo.detectedMethod}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Custom Message (Optional)</label>
              <Textarea
                placeholder="Add any specific details or urgent requests..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button 
              onClick={generateTemplate} 
              disabled={isGenerating || !contactInfo.email}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating template...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Generate DMCA Template
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Submit */}
        {step === 'submit' && template && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Step 3: Submit Request
            </h3>

            {/* Template Preview */}
            <div className="space-y-3">
              <div className="p-3 border rounded-lg bg-gray-50">
                <p className="text-sm font-medium">To: {template.recipientEmail}</p>
                <p className="text-sm font-medium">Subject: {template.subject}</p>
              </div>
              
              <div className="p-3 border rounded-lg max-h-40 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap font-mono">
                  {template.body.substring(0, 500)}
                  {template.body.length > 500 && '...'}
                </pre>
              </div>
            </div>

            {template.isUrgent && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-800">This is marked as urgent due to high priority content</span>
              </div>
            )}

            <Button 
              onClick={submitTakedown} 
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting takedown request...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Submit DMCA Takedown Request
                </>
              )}
            </Button>
          </div>
        )}

        {/* Footer Info */}
        <div className="text-xs text-gray-500 border-t pt-4">
          <p>🤖 Powered by Auto-DMCA • This tool automates DMCA takedown requests to help protect your content rights.</p>
        </div>
      </CardContent>
    </Card>
  )
}