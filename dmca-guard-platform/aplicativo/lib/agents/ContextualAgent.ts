import { PrismaClient } from '@prisma/client'
import { BrandProfile } from './types'
import { GeminiClient, TextAnalysisResult, ImageAnalysisResult } from '../integrations/gemini-client'
import { ContentExtractor, ExtractedContent } from '../extraction/content-extractor'
import { PatternMatcher } from '../analysis/pattern-matcher'
import { SessionManager } from './session-manager'

const prisma = new PrismaClient()

export type ViolationType = 
  | 'COPYRIGHT_INFRINGEMENT'
  | 'TRADEMARK_VIOLATION'
  | 'UNAUTHORIZED_DISTRIBUTION'
  | 'LEAKED_CONTENT'
  | 'COUNTERFEIT_PRODUCTS'
  | 'PRIVACY_VIOLATION'
  | 'UNKNOWN'

export type RecommendedAction = 
  | 'IMMEDIATE_TAKEDOWN'
  | 'SEND_CEASE_DESIST'
  | 'MONITOR_CLOSELY'
  | 'LEGAL_ACTION'
  | 'NO_ACTION_REQUIRED'
  | 'NEEDS_HUMAN_REVIEW'

export interface Evidence {
  type: 'KEYWORD' | 'IMAGE' | 'CONTEXT' | 'PATTERN'
  description: string
  strength: number // 0-1
  location: string // onde foi encontrado
  confidence: number // 0-1
  extractedData?: any
}

export interface ContextualClue {
  type: string
  description: string
  weight: number
  source: string
}

export interface ContextualAnalysis {
  url: string
  riskScore: number // 0-100
  confidence: number // 0-1
  violationType: ViolationType
  evidenceFound: Evidence[]
  contextualClues: ContextualClue[]
  recommendedAction: RecommendedAction
  executiveSummary: string
  detailedAnalysis: string
  geminiAnalysis: GeminiAnalysisResult
  metadata: AnalysisMetadata
  analyzedAt: Date
}

export interface GeminiAnalysisResult {
  textAnalysis: TextAnalysisResult
  imageAnalysis: ImageAnalysisResult
  consolidatedScore: number
  keyFindings: string[]
  riskFactors: string[]
}

export interface AnalysisMetadata {
  processingTime: number
  modelUsed: string
  cacheHit: boolean
  errorCount: number
  warningCount: number
}

export interface ContextualSession {
  sessionId: string
  userId: string
  brandProfileId: string
  urlsToAnalyze: string[]
  totalUrls: number
  urlsProcessed: number
  analysesCompleted: number
  highRiskFound: number
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR' | 'PAUSED'
  startedAt: Date
  completedAt?: Date
  estimatedCompletion?: Date
  currentUrl?: string
  lastError?: string
  config: ContextualConfig
}

export interface ContextualConfig {
  model: 'gemini-1.5-flash-8b' | 'gemini-1.5-flash' | 'gemini-1.5-pro'
  temperature: number
  enableImageAnalysis: boolean
  enableDeepContextAnalysis: boolean
  minConfidenceThreshold: number
  maxUrlsPerSession: number
  timeout: number
}

export class ContextualAgent {
  private userId: string
  private brandProfileId: string
  private brandProfile: BrandProfile | null = null
  private geminiClient: GeminiClient
  private contentExtractor: ContentExtractor
  private patternMatcher: PatternMatcher
  private sessionManager: SessionManager
  private config: ContextualConfig
  private session: ContextualSession | null = null

  constructor(userId: string, brandProfileId: string, config?: Partial<ContextualConfig>) {
    this.userId = userId
    this.brandProfileId = brandProfileId
    this.geminiClient = new GeminiClient()
    this.contentExtractor = new ContentExtractor()
    this.patternMatcher = new PatternMatcher()
    this.sessionManager = new SessionManager()
    
    this.config = {
      model: 'gemini-1.5-flash-8b',
      temperature: 0.1,
      enableImageAnalysis: true,
      enableDeepContextAnalysis: true,
      minConfidenceThreshold: 0.6,
      maxUrlsPerSession: 50,
      timeout: 30000,
      ...config
    }
  }

  /**
   * Iniciar sessão de análise contextual
   */
  async startContextualSession(urls: string[]): Promise<string> {
    try {
      // Carregar perfil da marca
      this.brandProfile = await this.loadBrandProfile()
      if (!this.brandProfile) {
        throw new Error('Perfil da marca não encontrado')
      }

      // Validar e limitar URLs
      const validUrls = urls.filter(url => this.isValidUrl(url))
      const limitedUrls = validUrls.slice(0, this.config.maxUrlsPerSession)

      // Criar sessão
      const sessionId = await this.sessionManager.startScanSession(
        this.userId, 
        this.brandProfileId
      )

      this.session = {
        sessionId,
        userId: this.userId,
        brandProfileId: this.brandProfileId,
        urlsToAnalyze: limitedUrls,
        totalUrls: limitedUrls.length,
        urlsProcessed: 0,
        analysesCompleted: 0,
        highRiskFound: 0,
        status: 'RUNNING',
        startedAt: new Date(),
        config: this.config
      }

      // Executar análise em background
      this.executeContextualAnalysisInBackground(limitedUrls)

      await this.emitEvent('contextual_analysis_started', {
        totalUrls: limitedUrls.length,
        brandProfile: this.brandProfile.name,
        model: this.config.model
      })

      return sessionId

    } catch (error) {
      console.error('Erro ao iniciar sessão de análise contextual:', error)
      throw error
    }
  }

  /**
   * Análise contextual completa de conteúdo suspeito
   */
  async analyzeContent(urls: string[]): Promise<ContextualAnalysis[]> {
    if (!this.brandProfile) {
      throw new Error('Perfil da marca não carregado')
    }

    const analyses: ContextualAnalysis[] = []
    
    for (const url of urls) {
      try {
        await this.emitEvent('url_analysis_started', { url })
        
        const startTime = Date.now()
        const content = await this.contentExtractor.extractContent(url)
        const analysis = await this.performContextualAnalysis(content)
        const processingTime = Date.now() - startTime
        
        analysis.metadata.processingTime = processingTime
        analyses.push(analysis)
        
        await this.updateAnalysisProgress(url, analysis)
        
        // Delay entre análises para respeitar rate limits do Gemini
        await this.sleep(1000)
        
      } catch (error) {
        console.error(`Erro ao analisar ${url}:`, error)
        await this.handleAnalysisError(url, error as Error)
      }
    }
    
    return analyses
  }

  /**
   * Análise multi-dimensional com Gemini
   */
  private async performContextualAnalysis(content: ExtractedContent): Promise<ContextualAnalysis> {
    const startTime = Date.now()
    
    try {
      // Análises paralelas
      const [
        textAnalysis,
        imageAnalysis,
        structuralAnalysis,
        contextualClues
      ] = await Promise.all([
        this.analyzeTextContent(content),
        this.config.enableImageAnalysis ? this.analyzeImages(content) : null,
        this.analyzePageStructure(content),
        this.extractContextualClues(content)
      ])

      // Consolidar análises
      const consolidatedAnalysis = await this.consolidateAnalyses(
        content.url, 
        textAnalysis, 
        imageAnalysis, 
        structuralAnalysis, 
        contextualClues
      )

      return {
        ...consolidatedAnalysis,
        metadata: {
          processingTime: Date.now() - startTime,
          modelUsed: this.config.model,
          cacheHit: false, // Será atualizado pelo cache
          errorCount: 0,
          warningCount: 0
        },
        analyzedAt: new Date()
      }

    } catch (error) {
      console.error('Erro na análise contextual:', error)
      throw error
    }
  }

  /**
   * Análise de texto via Gemini com verificação forense inteligente
   */
  private async analyzeTextContent(content: ExtractedContent): Promise<TextAnalysisResult> {
    const prompt = `
    Você é um especialista forense em análise de violações DMCA. Sua tarefa é determinar se o CONTEÚDO PRINCIPAL e EM DESTAQUE da página está diretamente associado à marca protegida.
    
    ============ DADOS DA PÁGINA ============
    URL: ${content.url}
    Título: ${content.title}
    Descrição: ${content.description}
    Conteúdo Principal: ${content.bodyText.substring(0, 2000)}
    
    ============ MARCA PROTEGIDA ============
    Nome: ${this.brandProfile!.name}
    Variações: ${this.brandProfile!.variations?.join(', ') || 'Nenhuma'}
    Keywords: ${this.brandProfile!.keywords?.join(', ') || 'Nenhuma'}
    
    ============ INSTRUÇÕES FORENSES ============
    
    ANÁLISE CONTEXTUAL INTELIGENTE:
    1. DIFERENCIE o conteúdo principal de elementos secundários:
       - Player de vídeo primário vs. thumbnails de recomendações
       - Download principal vs. links relacionados na sidebar
       - Título/descrição principal vs. comentários de usuários
       - Tags principais vs. categorias genéricas
    
    2. AVALIE APENAS se a palavra-chave está relacionada ao CONTEÚDO PRIMÁRIO:
       - Ignore menções em barras laterais de "vídeos relacionados"
       - Ignore comentários de usuários ou seções de discussão
       - Ignore tags genéricas no rodapé
       - Foque no que um usuário veio especificamente buscar
    
    3. DETECTE FALSOS POSITIVOS:
       - Se a palavra-chave aparece apenas em "Você também pode gostar"
       - Se aparece apenas em listas de "Modelos similares"
       - Se o conteúdo principal é sobre outra pessoa/tema
       - Se é apenas uma menção passageira sem relevância central
    
    4. CONFIRME VIOLAÇÕES REAIS:
       - Conteúdo principal claramente foca na marca protegida
       - Título principal menciona a marca
       - Player/download principal contém material da marca
       - Descrição principal é sobre a marca protegida
    
    RESPONDA apenas se houver ALTA CONFIANÇA (80%+) de que a palavra-chave se refere ao conteúdo principal da página.
    
    Seja CONSERVADOR para evitar falsos positivos. É melhor classificar uma possível violação como "incerta" do que criar um falso positivo.
    
    ============ FORMATO DE RESPOSTA ============
    Responda APENAS em formato JSON válido:
    {
      "riskScore": number (0-100),
      "confidence": number (0-1),
      "violationType": "COPYRIGHT_INFRINGEMENT|TRADEMARK_VIOLATION|UNAUTHORIZED_DISTRIBUTION|LEAKED_CONTENT|FALSE_POSITIVE|UNCERTAIN",
      "evidences": ["evidência específica 1", "evidência específica 2"],
      "recommendedAction": "IMMEDIATE_TAKEDOWN|SEND_CEASE_DESIST|MONITOR_CLOSELY|NEEDS_HUMAN_REVIEW|NO_ACTION_REQUIRED",
      "executiveSummary": "resumo em 2-3 frases",
      "detailedAnalysis": "análise detalhada em 1 parágrafo",
      "keyFindings": ["descoberta chave 1", "descoberta chave 2"],
      "riskFactors": ["fator de risco 1", "fator de risco 2"],
      "contextualEvidence": {
        "isPrimaryContent": boolean,
        "contentLocation": "main|sidebar|footer|comments|recommendations",
        "brandMentionContext": "title|description|main_content|secondary_elements",
        "falsePositiveIndicators": ["indicador 1", "indicador 2"]
      }
    }
    `;
    
    return await this.geminiClient.analyzeText(prompt, {
      temperature: this.config.temperature,
      model: this.config.model
    })
  }

  /**
   * Análise de imagens via Gemini
   */
  private async analyzeImages(content: ExtractedContent): Promise<ImageAnalysisResult | null> {
    if (!content.images || content.images.length === 0) {
      return { hasRelevantImages: false, analyses: [], totalImagesAnalyzed: 0 }
    }

    const imageAnalyses = []
    const imagesToAnalyze = content.images.slice(0, 5) // Limitar a 5 imagens

    for (const imageUrl of imagesToAnalyze) {
      try {
        const prompt = `
        Analise esta imagem para detectar possível violação de copyright/marca:
        
        Contexto: Imagem encontrada em ${content.url}
        Marca protegida: ${this.brandProfile!.name}
        
        Avalie se a imagem:
        1. Contém conteúdo relacionado à marca protegida
        2. Aparenta ser uso não autorizado ou vazamento
        3. Qual o nível de certeza da violação (0-100)
        4. Descreva o que você vê na imagem
        5. Identifique elementos que indicam violação
        
        Responda em formato JSON com as chaves: containsBrandContent, isUnauthorizedUse, certaintyLevel, description, violationElements.
        `

        const analysis = await this.geminiClient.analyzeImage(imageUrl, prompt, {
          temperature: this.config.temperature
        })
        
        imageAnalyses.push({
          ...analysis,
          imageUrl
        })

        // Delay entre análises de imagem
        await this.sleep(500)

      } catch (error) {
        console.warn(`Erro ao analisar imagem ${imageUrl}:`, error)
      }
    }

    return {
      hasRelevantImages: imageAnalyses.length > 0,
      analyses: imageAnalyses,
      totalImagesAnalyzed: imageAnalyses.length
    }
  }

  /**
   * Análise da estrutura da página
   */
  private async analyzePageStructure(content: ExtractedContent): Promise<any> {
    // Analisar elementos estruturais que indicam violação
    const suspiciousElements = []

    // Verificar formulários de download
    if (content.structuralElements?.some(el => el.type === 'download_form')) {
      suspiciousElements.push({
        type: 'download_form',
        description: 'Formulário de download suspeito encontrado',
        risk: 'high'
      })
    }

    // Verificar botões de acesso premium
    if (content.bodyText.toLowerCase().includes('premium') || 
        content.bodyText.toLowerCase().includes('exclusive')) {
      suspiciousElements.push({
        type: 'premium_access',
        description: 'Indícios de conteúdo premium não autorizado',
        risk: 'medium'
      })
    }

    // Verificar links de compartilhamento
    const shareKeywords = ['mega', 'drive', 'dropbox', 'telegram', 'discord']
    const foundShareLinks = shareKeywords.filter(keyword => 
      content.bodyText.toLowerCase().includes(keyword)
    )

    if (foundShareLinks.length > 0) {
      suspiciousElements.push({
        type: 'sharing_links',
        description: `Links de compartilhamento encontrados: ${foundShareLinks.join(', ')}`,
        risk: 'high'
      })
    }

    return {
      suspiciousElements,
      structuralRisk: suspiciousElements.length > 0 ? 'high' : 'low',
      elementCount: suspiciousElements.length
    }
  }

  /**
   * Extrair pistas contextuais
   */
  private async extractContextualClues(content: ExtractedContent): Promise<ContextualClue[]> {
    const clues: ContextualClue[] = []

    // Pistas baseadas no domínio
    const domain = this.extractDomain(content.url)
    if (domain.includes('leaked') || domain.includes('free') || domain.includes('nude')) {
      clues.push({
        type: 'domain_suspicious',
        description: `Domínio suspeito: ${domain}`,
        weight: 0.8,
        source: 'domain_analysis'
      })
    }

    // Pistas baseadas no título
    const suspiciousTitleKeywords = ['leaked', 'free', 'download', 'premium', 'exclusive', 'nude']
    const foundInTitle = suspiciousTitleKeywords.filter(keyword => 
      content.title.toLowerCase().includes(keyword)
    )

    if (foundInTitle.length > 0) {
      clues.push({
        type: 'title_suspicious',
        description: `Palavras suspeitas no título: ${foundInTitle.join(', ')}`,
        weight: 0.7,
        source: 'title_analysis'
      })
    }

    // Pistas baseadas no conteúdo
    const brandMentions = this.countBrandMentions(content.bodyText)
    if (brandMentions > 3) {
      clues.push({
        type: 'excessive_brand_mentions',
        description: `${brandMentions} menções da marca encontradas`,
        weight: 0.6,
        source: 'content_analysis'
      })
    }

    return clues
  }

  /**
   * Consolidar análises em resultado final
   */
  private async consolidateAnalyses(
    url: string,
    textAnalysis: TextAnalysisResult,
    imageAnalysis: ImageAnalysisResult | null,
    structuralAnalysis: any,
    contextualClues: ContextualClue[]
  ): Promise<ContextualAnalysis> {

    // Calcular score de risco consolidado
    let consolidatedScore = textAnalysis.riskScore || 0
    
    if (imageAnalysis?.hasRelevantImages) {
      const imageRisk = imageAnalysis.analyses.reduce((sum, analysis) => 
        sum + (analysis.certaintyLevel || 0), 0) / imageAnalysis.analyses.length
      consolidatedScore = Math.max(consolidatedScore, imageRisk)
    }

    // Ajustar score baseado em pistas contextuais
    const contextualBonus = contextualClues.reduce((sum, clue) => sum + (clue.weight * 10), 0)
    consolidatedScore = Math.min(100, consolidatedScore + contextualBonus)

    // Determinar tipo de violação
    const violationType = this.determineViolationType(textAnalysis, imageAnalysis, contextualClues)

    // Gerar evidências
    const evidenceFound = this.generateEvidence(textAnalysis, imageAnalysis, structuralAnalysis)

    // Determinar ação recomendada
    const recommendedAction = this.determineRecommendedAction(consolidatedScore, violationType)

    return {
      url,
      riskScore: Math.round(consolidatedScore),
      confidence: Math.min(1, consolidatedScore / 100),
      violationType,
      evidenceFound,
      contextualClues,
      recommendedAction,
      executiveSummary: textAnalysis.executiveSummary || this.generateDefaultSummary(consolidatedScore, violationType),
      detailedAnalysis: textAnalysis.detailedAnalysis || this.generateDefaultAnalysis(consolidatedScore, evidenceFound),
      geminiAnalysis: {
        textAnalysis,
        imageAnalysis: imageAnalysis || { hasRelevantImages: false, analyses: [], totalImagesAnalyzed: 0 },
        consolidatedScore,
        keyFindings: textAnalysis.keyFindings || [],
        riskFactors: textAnalysis.riskFactors || []
      },
      metadata: {
        processingTime: 0, // Será preenchido posteriormente
        modelUsed: this.config.model,
        cacheHit: false,
        errorCount: 0,
        warningCount: 0
      },
      analyzedAt: new Date()
    }
  }

  /**
   * Determinar tipo de violação baseado nas análises
   */
  private determineViolationType(
    textAnalysis: TextAnalysisResult,
    imageAnalysis: ImageAnalysisResult | null,
    contextualClues: ContextualClue[]
  ): ViolationType {
    
    // Verificar se há análise específica do Gemini
    if (textAnalysis.violationType) {
      return textAnalysis.violationType as ViolationType
    }

    // Lógica de fallback baseada em pistas
    const hasLeakedContent = contextualClues.some(clue => clue.description.includes('leaked'))
    const hasUnauthorizedDistribution = contextualClues.some(clue => clue.description.includes('sharing'))
    const hasImageViolation = imageAnalysis?.hasRelevantImages && 
      imageAnalysis.analyses.some(analysis => analysis.isUnauthorizedUse)

    if (hasLeakedContent) return 'LEAKED_CONTENT'
    if (hasUnauthorizedDistribution) return 'UNAUTHORIZED_DISTRIBUTION'
    if (hasImageViolation) return 'COPYRIGHT_INFRINGEMENT'

    return 'UNKNOWN'
  }

  /**
   * Gerar evidências consolidadas
   */
  private generateEvidence(
    textAnalysis: TextAnalysisResult,
    imageAnalysis: ImageAnalysisResult | null,
    structuralAnalysis: any
  ): Evidence[] {
    const evidence: Evidence[] = []

    // Evidências do texto
    if (textAnalysis.evidences) {
      evidence.push(...textAnalysis.evidences.map(e => ({
        type: 'KEYWORD' as const,
        description: e.description || e,
        strength: 0.8,
        location: 'page_content',
        confidence: 0.8
      })))
    }

    // Evidências das imagens
    if (imageAnalysis?.hasRelevantImages) {
      imageAnalysis.analyses.forEach((analysis, index) => {
        if (analysis.containsBrandContent) {
          evidence.push({
            type: 'IMAGE',
            description: analysis.description || 'Conteúdo da marca encontrado em imagem',
            strength: (analysis.certaintyLevel || 50) / 100,
            location: `image_${index + 1}`,
            confidence: (analysis.certaintyLevel || 50) / 100,
            extractedData: analysis
          })
        }
      })
    }

    // Evidências estruturais
    if (structuralAnalysis.suspiciousElements?.length > 0) {
      structuralAnalysis.suspiciousElements.forEach((element: any) => {
        evidence.push({
          type: 'PATTERN',
          description: element.description,
          strength: element.risk === 'high' ? 0.9 : 0.6,
          location: 'page_structure',
          confidence: 0.7
        })
      })
    }

    return evidence
  }

  /**
   * Determinar ação recomendada
   */
  private determineRecommendedAction(riskScore: number, violationType: ViolationType): RecommendedAction {
    if (riskScore >= 80) {
      return violationType === 'LEAKED_CONTENT' ? 'IMMEDIATE_TAKEDOWN' : 'LEGAL_ACTION'
    }
    
    if (riskScore >= 60) {
      return 'SEND_CEASE_DESIST'
    }
    
    if (riskScore >= 40) {
      return 'MONITOR_CLOSELY'
    }
    
    if (riskScore >= 20) {
      return 'NEEDS_HUMAN_REVIEW'
    }
    
    return 'NO_ACTION_REQUIRED'
  }

  /**
   * Executar análise contextual em background
   */
  private async executeContextualAnalysisInBackground(urls: string[]): Promise<void> {
    try {
      const results = await this.analyzeContent(urls)
      
      // Salvar resultados no banco
      for (const result of results) {
        await this.saveAnalysisResult(result)
      }
      
      if (this.session) {
        this.session.status = 'COMPLETED'
        this.session.completedAt = new Date()
        this.session.analysesCompleted = results.length
        this.session.highRiskFound = results.filter(r => r.riskScore >= 70).length
      }
      
      await this.emitEvent('contextual_analysis_completed', {
        totalAnalyses: results.length,
        highRiskFound: results.filter(r => r.riskScore >= 70).length,
        averageRisk: results.reduce((sum, r) => sum + r.riskScore, 0) / results.length
      })
      
    } catch (error) {
      console.error('Erro durante análise contextual:', error)
      
      if (this.session) {
        this.session.status = 'ERROR'
        this.session.lastError = error instanceof Error ? error.message : 'Erro desconhecido'
      }
      
      await this.emitEvent('contextual_analysis_error', { 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
    }
  }

  /**
   * Atualizar progresso da análise
   */
  private async updateAnalysisProgress(url: string, analysis: ContextualAnalysis): Promise<void> {
    if (!this.session) return
    
    this.session.urlsProcessed++
    this.session.currentUrl = url
    
    if (analysis.riskScore >= 70) {
      this.session.highRiskFound++
    }
    
    // Calcular estimativa de conclusão
    if (this.session.urlsProcessed > 0) {
      const elapsed = Date.now() - this.session.startedAt.getTime()
      const avgTimePerUrl = elapsed / this.session.urlsProcessed
      const remaining = this.session.totalUrls - this.session.urlsProcessed
      
      this.session.estimatedCompletion = new Date(
        Date.now() + (remaining * avgTimePerUrl)
      )
    }
    
    // Atualizar no banco
    await this.sessionManager.updateSession(this.session.sessionId, {
      sitesScanned: this.session.urlsProcessed,
      totalSites: this.session.totalUrls,
      violationsFound: this.session.highRiskFound,
      currentSite: this.session.currentUrl,
      estimatedCompletion: this.session.estimatedCompletion
    })
    
    await this.emitEvent('analysis_progress', {
      urlsProcessed: this.session.urlsProcessed,
      totalUrls: this.session.totalUrls,
      highRiskFound: this.session.highRiskFound,
      currentUrl: url,
      riskScore: analysis.riskScore
    })
  }

  /**
   * Salvar resultado da análise no banco
   */
  private async saveAnalysisResult(analysis: ContextualAnalysis): Promise<void> {
    try {
      // Salvar na tabela de violações históricas se for de alto risco
      if (analysis.riskScore >= 60) {
        // Primeiro, criar/encontrar o site conhecido
        const knownSite = await prisma.knownSite.upsert({
          where: { baseUrl: analysis.url },
          update: {
            totalViolations: { increment: 1 },
            lastViolation: new Date()
          },
          create: {
            baseUrl: analysis.url,
            domain: this.extractDomain(analysis.url),
            category: 'UNKNOWN',
            platform: null,
            riskScore: analysis.riskScore,
            totalViolations: 1,
            lastViolation: new Date(),
            userId: this.userId,
            isActive: true
          }
        })
        
        // Salvar histórico de violação
        await prisma.violationHistory.create({
          data: {
            knownSiteId: knownSite.id,
            url: analysis.url,
            title: analysis.executiveSummary,
            description: analysis.detailedAnalysis,
            detectionMethod: 'AI_CLASSIFICATION',
            riskLevel: this.mapRiskScoreToLevel(analysis.riskScore),
            aiConfidence: analysis.confidence,
            takedownSent: false,
            resolved: false,
            detectedAt: analysis.analyzedAt
          }
        })
      }
      
      console.log(`Análise salva para ${analysis.url} - Risk: ${analysis.riskScore}`)
      
    } catch (error) {
      console.error('Erro ao salvar análise:', error)
    }
  }

  // Métodos utilitários
  private async loadBrandProfile(): Promise<BrandProfile | null> {
    const profile = await prisma.brandProfile.findFirst({
      where: {
        id: this.brandProfileId,
        userId: this.userId
      }
    })
    
    return profile as BrandProfile | null
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0]
    }
  }

  private countBrandMentions(text: string): number {
    if (!this.brandProfile?.name) return 0
    
    const brandName = this.brandProfile.name.toLowerCase()
    const textLower = text.toLowerCase()
    
    return (textLower.match(new RegExp(brandName, 'g')) || []).length
  }

  private mapRiskScoreToLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (score >= 80) return 'CRITICAL'
    if (score >= 60) return 'HIGH'
    if (score >= 40) return 'MEDIUM'
    return 'LOW'
  }

  private generateDefaultSummary(riskScore: number, violationType: ViolationType): string {
    return `Análise contextual detectou ${violationType.toLowerCase()} com score de risco ${riskScore}/100. ${
      riskScore >= 70 ? 'Ação imediata recomendada.' : 
      riskScore >= 40 ? 'Monitoramento necessário.' : 
      'Baixo risco identificado.'
    }`
  }

  private generateDefaultAnalysis(riskScore: number, evidence: Evidence[]): string {
    return `Análise detalhada identificou ${evidence.length} evidências de possível violação. ` +
           `Score de risco consolidado: ${riskScore}/100. ` +
           `Principais evidências: ${evidence.slice(0, 3).map(e => e.description).join(', ')}.`
  }

  private async handleAnalysisError(url: string, error: Error): Promise<void> {
    console.error(`Erro ao analisar ${url}:`, error)
    
    if (this.session) {
      this.session.lastError = `${url}: ${error.message}`
    }
    
    await this.emitEvent('analysis_error', {
      url,
      error: error.message
    })
  }

  private async emitEvent(type: string, data: Record<string, any>): Promise<void> {
    if (!this.session) return
    
    try {
      await this.sessionManager.emitEvent({
        type: type as any,
        sessionId: this.session.sessionId,
        timestamp: new Date(),
        data
      })
    } catch (error) {
      console.error('Erro ao emitir evento:', error)
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Obter status da sessão atual
   */
  getSessionStatus(): ContextualSession | null {
    return this.session
  }

  /**
   * Pausar análise
   */
  async pauseAnalysis(): Promise<void> {
    if (this.session) {
      this.session.status = 'PAUSED'
      await this.emitEvent('contextual_analysis_paused', {})
    }
  }

  /**
   * Retomar análise
   */
  async resumeAnalysis(): Promise<void> {
    if (this.session) {
      this.session.status = 'RUNNING'
      await this.emitEvent('contextual_analysis_resumed', {})
    }
  }
}
