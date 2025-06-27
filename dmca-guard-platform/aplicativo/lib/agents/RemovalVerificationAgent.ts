import { PrismaClient } from '@prisma/client'
import { ContentExtractor } from '../extraction/content-extractor'
import { SessionManager } from './session-manager'
import puppeteer from 'puppeteer-core'
import path from 'path'
import fs from 'fs/promises'

const prisma = new PrismaClient()

export interface RemovalProof {
  id: string
  url: string
  status: RemovalStatus
  proofType: ProofType
  verificationDate: Date
  screenshotPath?: string
  httpStatusCode?: number
  responseBody?: string
  errorMessage?: string
  retryCount: number
  metadata: RemovalMetadata
}

export interface RemovalMetadata {
  originalDetectedAt: Date
  dmcaSentAt: Date
  firstVerificationAt: Date
  lastVerificationAt: Date
  verificationHistory: VerificationAttempt[]
  automatedChecks: number
  manualReviews: number
  confidenceLevel: number // 0-100
}

export interface VerificationAttempt {
  timestamp: Date
  status: RemovalStatus
  method: 'AUTOMATED' | 'MANUAL'
  evidence: string[]
  confidence: number
  notes?: string
}

export type RemovalStatus = 
  | 'PENDING_VERIFICATION'     // Aguardando primeira verificação
  | 'CONTENT_STILL_ONLINE'     // Conteúdo ainda está online
  | 'CONTENT_REMOVED'          // Conteúdo confirmadamente removido
  | 'SITE_UNREACHABLE'         // Site não acessível (pode estar offline)
  | 'CONTENT_BLOCKED'          // Conteúdo bloqueado/restrito geograficamente
  | 'URL_REDIRECTED'           // URL redirecionada
  | 'VERIFICATION_FAILED'      // Falha na verificação automática
  | 'REQUIRES_MANUAL_REVIEW'   // Precisa de revisão manual

export type ProofType = 
  | 'HTTP_404_NOT_FOUND'
  | 'HTTP_410_GONE'
  | 'HTTP_403_FORBIDDEN'
  | 'CONTENT_REMOVED_MESSAGE'
  | 'DMCA_TAKEDOWN_NOTICE'
  | 'SITE_OFFLINE'
  | 'MANUAL_VERIFICATION'
  | 'SCREENSHOT_EVIDENCE'

export interface VerificationConfig {
  waitTimeAfterDMCA: number      // Tempo de espera após DMCA (horas)
  maxRetryAttempts: number       // Máximo de tentativas de verificação
  retryInterval: number          // Intervalo entre tentativas (horas)
  enableScreenshots: boolean     // Capturar screenshots como prova
  enableFullPageScan: boolean    // Verificar se conteúdo foi apenas movido
  userAgent: string             // User agent para requests
  timeout: number               // Timeout para verificações
}

export class RemovalVerificationAgent {
  private config: VerificationConfig
  private sessionManager: SessionManager
  private contentExtractor: ContentExtractor
  private screenshotsDir: string

  constructor(config?: Partial<VerificationConfig>) {
    this.config = {
      waitTimeAfterDMCA: 48,        // 48 horas de espera padrão
      maxRetryAttempts: 5,          // Máximo 5 tentativas
      retryInterval: 24,            // Verificar a cada 24 horas
      enableScreenshots: true,      // Screenshots habilitados
      enableFullPageScan: true,     // Scan completo habilitado
      userAgent: 'Mozilla/5.0 (compatible; DMCA-Guard-Verifier/1.0; +https://dmca-guard.com/verifier)',
      timeout: 30000,               // 30 segundos de timeout
      ...config
    }

    this.sessionManager = new SessionManager()
    this.contentExtractor = new ContentExtractor()
    this.screenshotsDir = path.join(process.cwd(), 'storage', 'removal-proofs')
    
    // Criar diretório de screenshots se não existir
    this.ensureScreenshotsDir()
  }

  /**
   * Iniciar processo de verificação de remoção para um takedown request
   */
  async initiateRemovalVerification(takedownRequestId: string): Promise<string> {
    try {
      // Buscar dados do takedown request
      const takedownRequest = await prisma.takedownRequest.findUnique({
        where: { id: takedownRequestId },
        include: {
          detectedContent: {
            include: {
              brandProfile: true
            }
          }
        }
      })

      if (!takedownRequest) {
        throw new Error('Takedown request não encontrado')
      }

      // Verificar se já passou o tempo de espera
      const hoursElapsed = this.getHoursElapsed(takedownRequest.sentAt || takedownRequest.createdAt)
      if (hoursElapsed < this.config.waitTimeAfterDMCA) {
        const hoursRemaining = this.config.waitTimeAfterDMCA - hoursElapsed
        throw new Error(`Aguarde mais ${hoursRemaining.toFixed(1)} horas antes de verificar a remoção`)
      }

      // Criar sessão de verificação
      const sessionId = await this.sessionManager.startScanSession(
        takedownRequest.userId,
        takedownRequest.detectedContent.brandProfileId
      )

      // Executar verificação em background
      this.executeRemovalVerificationInBackground(takedownRequestId, sessionId)

      return sessionId

    } catch (error) {
      console.error('Erro ao iniciar verificação de remoção:', error)
      throw error
    }
  }

  /**
   * Verificar remoção de conteúdo específico
   */
  async verifyContentRemoval(url: string, takedownRequestId?: string): Promise<RemovalProof> {
    console.log(`🔍 Iniciando verificação de remoção para: ${url}`)
    
    const verificationAttempt: VerificationAttempt = {
      timestamp: new Date(),
      status: 'PENDING_VERIFICATION',
      method: 'AUTOMATED',
      evidence: [],
      confidence: 0
    }

    try {
      // 1. Verificação HTTP básica
      const httpResult = await this.performHttpCheck(url)
      verificationAttempt.evidence.push(`HTTP Status: ${httpResult.statusCode}`)

      // 2. Capturar screenshot se necessário
      let screenshotPath: string | undefined
      if (this.config.enableScreenshots && httpResult.requiresScreenshot) {
        screenshotPath = await this.captureScreenshot(url, takedownRequestId)
        if (screenshotPath) {
          verificationAttempt.evidence.push(`Screenshot capturado: ${screenshotPath}`)
        }
      }

      // 3. Análise do conteúdo da página (se ainda acessível)
      let contentAnalysis
      if (httpResult.isAccessible) {
        contentAnalysis = await this.analyzePageContent(url)
        verificationAttempt.evidence.push(...contentAnalysis.evidence)
      }

      // 4. Determinar status e prova de remoção
      const removalResult = this.determineRemovalStatus(httpResult, contentAnalysis, screenshotPath)
      
      verificationAttempt.status = removalResult.status
      verificationAttempt.confidence = removalResult.confidence

      // 5. Criar prova de remoção
      const removalProof: RemovalProof = {
        id: this.generateProofId(),
        url,
        status: removalResult.status,
        proofType: removalResult.proofType,
        verificationDate: new Date(),
        screenshotPath,
        httpStatusCode: httpResult.statusCode,
        responseBody: httpResult.responseSnippet,
        errorMessage: httpResult.error,
        retryCount: 0,
        metadata: {
          originalDetectedAt: new Date(), // Será atualizado com dados reais
          dmcaSentAt: new Date(),         // Será atualizado com dados reais
          firstVerificationAt: new Date(),
          lastVerificationAt: new Date(),
          verificationHistory: [verificationAttempt],
          automatedChecks: 1,
          manualReviews: 0,
          confidenceLevel: removalResult.confidence
        }
      }

      // 6. Salvar prova no banco de dados
      await this.saveRemovalProof(removalProof, takedownRequestId)

      console.log(`✅ Verificação concluída para ${url} - Status: ${removalResult.status}`)
      return removalProof

    } catch (error) {
      console.error(`❌ Erro na verificação de remoção para ${url}:`, error)
      
      verificationAttempt.status = 'VERIFICATION_FAILED'
      verificationAttempt.evidence.push(`Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)

      throw error
    }
  }

  /**
   * Verificação HTTP básica
   */
  private async performHttpCheck(url: string): Promise<{
    statusCode?: number
    isAccessible: boolean
    requiresScreenshot: boolean
    responseSnippet?: string
    error?: string
  }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': this.config.userAgent
        },
        signal: AbortSignal.timeout(this.config.timeout)
      })

      const statusCode = response.status

      // Status codes que indicam remoção definitiva
      if (statusCode === 404 || statusCode === 410) {
        return {
          statusCode,
          isAccessible: false,
          requiresScreenshot: true,
          responseSnippet: `HTTP ${statusCode} - Content not found`
        }
      }

      // Status codes que indicam bloqueio/restrição
      if (statusCode === 403 || statusCode === 451) {
        return {
          statusCode,
          isAccessible: false,
          requiresScreenshot: true,
          responseSnippet: `HTTP ${statusCode} - Access forbidden/restricted`
        }
      }

      // Conteúdo ainda acessível - verificação mais profunda necessária
      if (statusCode >= 200 && statusCode < 300) {
        return {
          statusCode,
          isAccessible: true,
          requiresScreenshot: true,
          responseSnippet: `HTTP ${statusCode} - Content accessible`
        }
      }

      // Outros status codes
      return {
        statusCode,
        isAccessible: false,
        requiresScreenshot: true,
        responseSnippet: `HTTP ${statusCode} - Unexpected status`
      }

    } catch (error) {
      // Erro de rede ou timeout - pode indicar site offline
      return {
        isAccessible: false,
        requiresScreenshot: false,
        error: error instanceof Error ? error.message : 'Network error'
      }
    }
  }

  /**
   * Analisar conteúdo da página para verificar se foi removido
   */
  private async analyzePageContent(url: string): Promise<{
    evidence: string[]
    hasOriginalContent: boolean
    hasRemovalNotice: boolean
  }> {
    try {
      const content = await this.contentExtractor.extractContent(url, {
        includeImages: false,
        includeLinks: false,
        maxContentLength: 5000
      })

      const evidence: string[] = []
      let hasOriginalContent = false
      let hasRemovalNotice = false

      const pageText = `${content.title} ${content.description} ${content.bodyText}`.toLowerCase()

      // Verificar se há notícias de remoção/DMCA
      const removalIndicators = [
        'content removed',
        'dmca takedown',
        'copyright notice',
        'removed due to',
        'no longer available',
        'conteúdo removido',
        'violação de direitos',
        'removido por solicitação',
        'página não encontrada'
      ]

      for (const indicator of removalIndicators) {
        if (pageText.includes(indicator)) {
          hasRemovalNotice = true
          evidence.push(`Indicador de remoção encontrado: "${indicator}"`)
        }
      }

      // Verificar se ainda há conteúdo suspeito
      // (Isso seria customizado baseado na marca específica)
      const suspiciousIndicators = [
        'download',
        'premium',
        'exclusive',
        'leaked',
        'free access'
      ]

      for (const indicator of suspiciousIndicators) {
        if (pageText.includes(indicator)) {
          hasOriginalContent = true
          evidence.push(`Conteúdo suspeito ainda presente: "${indicator}"`)
        }
      }

      return {
        evidence,
        hasOriginalContent,
        hasRemovalNotice
      }

    } catch (error) {
      return {
        evidence: [`Erro na análise de conteúdo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`],
        hasOriginalContent: false,
        hasRemovalNotice: false
      }
    }
  }

  /**
   * Capturar screenshot como evidência
   */
  private async captureScreenshot(url: string, takedownRequestId?: string): Promise<string | undefined> {
    if (!this.config.enableScreenshots) return undefined

    try {
      // Usar Puppeteer para capturar screenshot
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        timeout: this.config.timeout
      })

      const page = await browser.newPage()
      await page.setUserAgent(this.config.userAgent)
      await page.setViewport({ width: 1280, height: 720 })

      // Navegar para a página
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: this.config.timeout 
      })

      // Gerar nome do arquivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `${takedownRequestId || 'verification'}_${timestamp}.png`
      const screenshotPath = path.join(this.screenshotsDir, filename)

      // Capturar screenshot
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: 'png'
      })

      await browser.close()

      console.log(`📸 Screenshot capturado: ${screenshotPath}`)
      return screenshotPath

    } catch (error) {
      console.error('Erro ao capturar screenshot:', error)
      return undefined
    }
  }

  /**
   * Determinar status de remoção baseado nas evidências
   */
  private determineRemovalStatus(
    httpResult: any,
    contentAnalysis?: any,
    screenshotPath?: string
  ): {
    status: RemovalStatus
    proofType: ProofType
    confidence: number
  } {
    
    // Remoção confirmada por HTTP 404/410
    if (httpResult.statusCode === 404) {
      return {
        status: 'CONTENT_REMOVED',
        proofType: 'HTTP_404_NOT_FOUND',
        confidence: 95
      }
    }

    if (httpResult.statusCode === 410) {
      return {
        status: 'CONTENT_REMOVED',
        proofType: 'HTTP_410_GONE',
        confidence: 98
      }
    }

    // Conteúdo bloqueado/restrito
    if (httpResult.statusCode === 403 || httpResult.statusCode === 451) {
      return {
        status: 'CONTENT_BLOCKED',
        proofType: 'HTTP_403_FORBIDDEN',
        confidence: 85
      }
    }

    // Site inacessível
    if (httpResult.error && !httpResult.statusCode) {
      return {
        status: 'SITE_UNREACHABLE',
        proofType: 'SITE_OFFLINE',
        confidence: 70
      }
    }

    // Análise de conteúdo (se página ainda acessível)
    if (contentAnalysis) {
      if (contentAnalysis.hasRemovalNotice && !contentAnalysis.hasOriginalContent) {
        return {
          status: 'CONTENT_REMOVED',
          proofType: 'CONTENT_REMOVED_MESSAGE',
          confidence: 90
        }
      }

      if (contentAnalysis.hasOriginalContent) {
        return {
          status: 'CONTENT_STILL_ONLINE',
          proofType: screenshotPath ? 'SCREENSHOT_EVIDENCE' : 'MANUAL_VERIFICATION',
          confidence: 85
        }
      }
    }

    // Situação incerta - requer revisão manual
    return {
      status: 'REQUIRES_MANUAL_REVIEW',
      proofType: screenshotPath ? 'SCREENSHOT_EVIDENCE' : 'MANUAL_VERIFICATION',
      confidence: 50
    }
  }

  /**
   * Salvar prova de remoção no banco de dados
   */
  private async saveRemovalProof(proof: RemovalProof, takedownRequestId?: string): Promise<void> {
    try {
      // Salvar prova na tabela de evidências
      await prisma.removalProof.create({
        data: {
          id: proof.id,
          takedownRequestId,
          url: proof.url,
          status: proof.status,
          proofType: proof.proofType,
          verificationDate: proof.verificationDate,
          screenshotPath: proof.screenshotPath,
          httpStatusCode: proof.httpStatusCode,
          responseBody: proof.responseBody,
          errorMessage: proof.errorMessage,
          retryCount: proof.retryCount,
          metadata: proof.metadata as any,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })

      // Atualizar status do takedown request se fornecido
      if (takedownRequestId) {
        await this.updateTakedownRequestStatus(takedownRequestId, proof.status)
      }

      // Atualizar status do detected content
      if (takedownRequestId) {
        const takedownRequest = await prisma.takedownRequest.findUnique({
          where: { id: takedownRequestId }
        })

        if (takedownRequest) {
          let newContentStatus: string
          
          switch (proof.status) {
            case 'CONTENT_REMOVED':
            case 'CONTENT_BLOCKED':
              newContentStatus = 'DELISTED'
              break
            case 'CONTENT_STILL_ONLINE':
              newContentStatus = 'REJECTED'
              break
            default:
              newContentStatus = 'PENDING_REVIEW'
          }

          await prisma.detectedContent.update({
            where: { id: takedownRequest.detectedContentId },
            data: {
              status: newContentStatus as any,
              reviewedAt: new Date(),
              reviewedBy: 'REMOVAL_VERIFICATION_AGENT'
            }
          })
        }
      }

    } catch (error) {
      console.error('Erro ao salvar prova de remoção:', error)
      throw error
    }
  }

  /**
   * Atualizar status do takedown request
   */
  private async updateTakedownRequestStatus(takedownRequestId: string, removalStatus: RemovalStatus): Promise<void> {
    let takedownStatus: string

    switch (removalStatus) {
      case 'CONTENT_REMOVED':
      case 'CONTENT_BLOCKED':
        takedownStatus = 'REMOVED'
        break
      case 'CONTENT_STILL_ONLINE':
        takedownStatus = 'REJECTED'
        break
      case 'SITE_UNREACHABLE':
        takedownStatus = 'ACKNOWLEDGED'
        break
      default:
        takedownStatus = 'IN_REVIEW'
    }

    await prisma.takedownRequest.update({
      where: { id: takedownRequestId },
      data: {
        status: takedownStatus as any,
        resolvedAt: removalStatus === 'CONTENT_REMOVED' || removalStatus === 'CONTENT_BLOCKED' 
          ? new Date() 
          : undefined,
        updatedAt: new Date()
      }
    })
  }

  /**
   * Executar verificação de remoção em background
   */
  private async executeRemovalVerificationInBackground(takedownRequestId: string, sessionId: string): Promise<void> {
    try {
      await this.sessionManager.emitEvent({
        type: 'REMOVAL_VERIFICATION_STARTED',
        sessionId,
        timestamp: new Date(),
        data: { takedownRequestId }
      })

      // Buscar dados do takedown
      const takedownRequest = await prisma.takedownRequest.findUnique({
        where: { id: takedownRequestId },
        include: {
          detectedContent: true
        }
      })

      if (!takedownRequest) {
        throw new Error('Takedown request não encontrado')
      }

      // Verificar remoção
      const proof = await this.verifyContentRemoval(
        takedownRequest.detectedContent.infringingUrl,
        takedownRequestId
      )

      // Emitir evento de conclusão
      await this.sessionManager.emitEvent({
        type: 'REMOVAL_VERIFICATION_COMPLETED',
        sessionId,
        timestamp: new Date(),
        data: {
          takedownRequestId,
          removalStatus: proof.status,
          proofType: proof.proofType,
          confidence: proof.metadata.confidenceLevel,
          screenshotPath: proof.screenshotPath
        }
      })

    } catch (error) {
      console.error('Erro na verificação de remoção em background:', error)

      await this.sessionManager.emitEvent({
        type: 'REMOVAL_VERIFICATION_ERROR',
        sessionId,
        timestamp: new Date(),
        data: {
          takedownRequestId,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      })
    }
  }

  /**
   * Agendar verificações automáticas recorrentes
   */
  async scheduleRecurringVerifications(): Promise<void> {
    try {
      // Buscar takedown requests que precisam de verificação
      const takedownsToVerify = await prisma.takedownRequest.findMany({
        where: {
          status: { in: ['SENT', 'ACKNOWLEDGED', 'IN_REVIEW'] },
          sentAt: {
            lte: new Date(Date.now() - (this.config.waitTimeAfterDMCA * 60 * 60 * 1000))
          }
        },
        include: {
          detectedContent: true
        }
      })

      console.log(`🔄 Encontrados ${takedownsToVerify.length} takedowns para verificação automática`)

      for (const takedown of takedownsToVerify) {
        try {
          await this.verifyContentRemoval(
            takedown.detectedContent.infringingUrl,
            takedown.id
          )

          // Delay entre verificações para não sobrecarregar
          await this.sleep(2000)

        } catch (error) {
          console.error(`Erro na verificação automática para ${takedown.id}:`, error)
        }
      }

    } catch (error) {
      console.error('Erro ao agendar verificações recorrentes:', error)
    }
  }

  // Métodos utilitários
  private async ensureScreenshotsDir(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotsDir, { recursive: true })
    } catch (error) {
      console.error('Erro ao criar diretório de screenshots:', error)
    }
  }

  private generateProofId(): string {
    return `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getHoursElapsed(date: Date): number {
    return (Date.now() - date.getTime()) / (1000 * 60 * 60)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Obter histórico de verificações para uma URL
   */
  async getVerificationHistory(url: string): Promise<RemovalProof[]> {
    try {
      const proofs = await prisma.removalProof.findMany({
        where: { url },
        orderBy: { verificationDate: 'desc' }
      })

      return proofs as any[]
    } catch (error) {
      console.error('Erro ao buscar histórico de verificações:', error)
      return []
    }
  }

  /**
   * Gerar relatório de remoções
   */
  async generateRemovalReport(userId: string, startDate: Date, endDate: Date): Promise<{
    totalVerifications: number
    successfulRemovals: number
    failedRemovals: number
    pendingVerifications: number
    averageRemovalTime: number
    proofsSaved: number
  }> {
    try {
      const verifications = await prisma.removalProof.findMany({
        where: {
          verificationDate: {
            gte: startDate,
            lte: endDate
          },
          takedownRequest: {
            userId
          }
        },
        include: {
          takedownRequest: true
        }
      })

      const totalVerifications = verifications.length
      const successfulRemovals = verifications.filter(v => 
        v.status === 'CONTENT_REMOVED' || v.status === 'CONTENT_BLOCKED'
      ).length
      const failedRemovals = verifications.filter(v => 
        v.status === 'CONTENT_STILL_ONLINE'
      ).length
      const pendingVerifications = verifications.filter(v => 
        v.status === 'REQUIRES_MANUAL_REVIEW' || v.status === 'PENDING_VERIFICATION'
      ).length
      const proofsSaved = verifications.filter(v => v.screenshotPath).length

      // Calcular tempo médio de remoção
      const removedContent = verifications.filter(v => 
        v.status === 'CONTENT_REMOVED' && v.takedownRequest?.sentAt
      )
      const averageRemovalTime = removedContent.length > 0
        ? removedContent.reduce((sum, v) => {
            const sentAt = v.takedownRequest?.sentAt
            if (sentAt) {
              return sum + (v.verificationDate.getTime() - sentAt.getTime())
            }
            return sum
          }, 0) / removedContent.length / (1000 * 60 * 60) // em horas
        : 0

      return {
        totalVerifications,
        successfulRemovals,
        failedRemovals,
        pendingVerifications,
        averageRemovalTime,
        proofsSaved
      }

    } catch (error) {
      console.error('Erro ao gerar relatório de remoções:', error)
      throw error
    }
  }
}
