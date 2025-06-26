import { BrandProfile, PageContent, ViolationResult, MatchResult, ImageAnalysisResult, ContextResult } from '../agents/types'
import { GeminiClient } from '../integrations/gemini-client'

export class ViolationDetector {
  private brandProfile: BrandProfile
  private keywords: string[]
  private geminiClient: GeminiClient
  private suspiciousPatterns: RegExp[]
  private contextPatterns: RegExp[]

  constructor(brandProfile: BrandProfile) {
    this.brandProfile = brandProfile
    this.keywords = [...brandProfile.keywords, ...brandProfile.variations]
    this.geminiClient = new GeminiClient()
    
    // Inicializar padrões suspeitos
    this.suspiciousPatterns = this.buildSuspiciousPatterns()
    this.contextPatterns = this.buildContextPatterns()
  }

  /**
   * Análise multi-camada de conteúdo
   */
  async analyzeContent(content: PageContent): Promise<ViolationResult | null> {
    try {
      // Executar análises em paralelo
      const [keywordResults, imageResults, contextResults] = await Promise.all([
        this.checkKeywordMatches(content),
        this.analyzeImages(content),
        this.analyzeContext(content)
      ])

      // Agregar resultados
      const aggregatedResult = this.aggregateResults(content, [
        keywordResults,
        imageResults,
        contextResults
      ])

      // Verificar se atinge o threshold de risco
      if (aggregatedResult && aggregatedResult.confidence >= this.brandProfile.riskThreshold) {
        return aggregatedResult
      }

      return null

    } catch (error) {
      console.error('Erro na análise de conteúdo:', error)
      return null
    }
  }

  /**
   * Detecção baseada em keywords
   */
  private async checkKeywordMatches(content: PageContent): Promise<MatchResult> {
    const text = `${content.title} ${content.description} ${content.bodyText}`.toLowerCase()
    const matches: string[] = []
    let totalMatches = 0

    // Verificar nome da marca e variações
    const brandTerms = [
      this.brandProfile.name,
      ...this.brandProfile.variations
    ]

    for (const term of brandTerms) {
      const regex = new RegExp(this.escapeRegex(term.toLowerCase()), 'gi')
      const termMatches = (text.match(regex) || []).length
      if (termMatches > 0) {
        matches.push(term)
        totalMatches += termMatches
      }
    }

    // Verificar keywords específicas
    for (const keyword of this.brandProfile.keywords) {
      const regex = new RegExp(this.escapeRegex(keyword.toLowerCase()), 'gi')
      const keywordMatches = (text.match(regex) || []).length
      if (keywordMatches > 0) {
        matches.push(keyword)
        totalMatches += keywordMatches
      }
    }

    // Verificar padrões suspeitos
    const suspiciousMatches = this.checkSuspiciousPatterns(text)
    matches.push(...suspiciousMatches.keywords)
    totalMatches += suspiciousMatches.count

    // Calcular densidade de keywords
    const textWords = text.split(/\s+/).length
    const density = textWords > 0 ? (totalMatches / textWords) * 100 : 0

    // Calcular score de risco baseado em matches
    const baseScore = Math.min(totalMatches * 10, 70)
    const densityBonus = Math.min(density * 5, 20)
    const varietyBonus = Math.min(matches.length * 5, 10)
    
    const riskScore = Math.min(baseScore + densityBonus + varietyBonus, 100)

    return {
      matches: totalMatches,
      keywords: matches,
      density,
      context: this.extractContext(text, matches),
      riskScore
    }
  }

  /**
   * Verificar padrões suspeitos
   */
  private checkSuspiciousPatterns(text: string): { count: number; keywords: string[] } {
    let count = 0
    const keywords: string[] = []

    for (const pattern of this.suspiciousPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        count += matches.length
        keywords.push(...matches)
      }
    }

    return { count, keywords }
  }

  /**
   * Análise básica de imagens
   */
  private async analyzeImages(content: PageContent): Promise<ImageAnalysisResult> {
    const suspiciousImages: string[] = []
    const imageMetadata: Record<string, any> = {}

    // Analisar URLs de imagens
    for (const imageUrl of content.images) {
      const isSuspicious = this.isImageSuspicious(imageUrl)
      if (isSuspicious) {
        suspiciousImages.push(imageUrl)
      }

      // Extrair metadados básicos da URL
      imageMetadata[imageUrl] = {
        filename: this.extractFilename(imageUrl),
        extension: this.extractExtension(imageUrl),
        suspicious: isSuspicious
      }
    }

    // Calcular score de risco
    const totalImages = content.images.length
    const suspiciousCount = suspiciousImages.length
    const riskScore = totalImages > 0 ? (suspiciousCount / totalImages) * 100 : 0

    return {
      suspiciousImages: suspiciousCount,
      imageUrls: suspiciousImages,
      metadata: imageMetadata,
      riskScore
    }
  }

  /**
   * Verificar se imagem é suspeita baseado na URL
   */
  private isImageSuspicious(imageUrl: string): boolean {
    const url = imageUrl.toLowerCase()
    const filename = this.extractFilename(url)
    
    // Padrões suspeitos em nomes de arquivo
    const suspiciousFilePatterns = [
      /leaked/i,
      /nude/i,
      /naked/i,
      /xxx/i,
      /sex/i,
      /porn/i,
      /nsfw/i,
      /onlyfans/i,
      /premium/i,
      /exclusive/i,
      /private/i
    ]

    // Verificar se filename contém termos suspeitos
    for (const pattern of suspiciousFilePatterns) {
      if (pattern.test(filename)) return true
    }

    // Verificar se filename contém nome da marca + termos suspeitos
    const brandName = this.brandProfile.name.toLowerCase()
    if (filename.includes(brandName)) {
      const suspiciousCombos = [
        'leaked', 'nude', 'naked', 'sex', 'porn', 'nsfw', 
        'exclusive', 'premium', 'private', 'only'
      ]
      
      for (const combo of suspiciousCombos) {
        if (filename.includes(combo)) return true
      }
    }

    return false
  }

  /**
   * Análise contextual da página
   */
  private async analyzeContext(content: PageContent): Promise<ContextResult> {
    let riskScore = 0
    const factors: string[] = []

    // Analisar título
    const titleMatch = this.checkTitleSuspicion(content.title)
    if (titleMatch) {
      riskScore += 30
      factors.push('título suspeito')
    }

    // Analisar descrição
    const descriptionMatch = this.checkDescriptionSuspicion(content.description)
    if (descriptionMatch) {
      riskScore += 20
      factors.push('descrição suspeita')
    }

    // Analisar estrutura da página
    const structureRisk = this.assessPageStructure(content)
    riskScore += structureRisk
    if (structureRisk > 20) {
      factors.push('estrutura suspeita')
    }

    // Detectar tipo de página
    const pageType = this.detectPageType(content)
    const pageTypeRisk = this.getPageTypeRisk(pageType)
    riskScore += pageTypeRisk
    if (pageTypeRisk > 0) {
      factors.push(`página tipo: ${pageType}`)
    }

    return {
      titleMatch,
      descriptionMatch,
      structureRisk,
      pageType,
      riskScore: Math.min(riskScore, 100)
    }
  }

  /**
   * Verificar suspeição no título
   */
  private checkTitleSuspicion(title: string): boolean {
    const titleLower = title.toLowerCase()
    const brandName = this.brandProfile.name.toLowerCase()

    // Verificar se título contém marca + termos suspeitos
    if (titleLower.includes(brandName)) {
      const suspiciousTerms = [
        'leaked', 'nude', 'naked', 'sex', 'porn', 'nsfw',
        'onlyfans', 'premium', 'exclusive', 'private',
        'free', 'download', 'watch', 'full'
      ]

      return suspiciousTerms.some(term => titleLower.includes(term))
    }

    return false
  }

  /**
   * Verificar suspeição na descrição
   */
  private checkDescriptionSuspicion(description: string): boolean {
    const descLower = description.toLowerCase()
    const brandName = this.brandProfile.name.toLowerCase()

    if (descLower.includes(brandName)) {
      const suspiciousContexts = [
        'leaked content', 'exclusive content', 'private photos',
        'nude pics', 'sex tape', 'premium content', 'onlyfans leak',
        'free download', 'full video', 'uncensored'
      ]

      return suspiciousContexts.some(context => descLower.includes(context))
    }

    return false
  }

  /**
   * Avaliar estrutura da página
   */
  private assessPageStructure(content: PageContent): number {
    let risk = 0
    const text = content.bodyText.toLowerCase()

    // Verificar densidade de links (páginas de vazamento costumam ter muitos links)
    const linkDensity = content.links.length / Math.max(content.bodyText.length / 1000, 1)
    if (linkDensity > 10) risk += 20

    // Verificar presença de elementos típicos de sites de vazamento
    const leakIndicators = [
      'download link', 'mega link', 'telegram link', 'discord link',
      'premium account', 'vip access', 'exclusive access',
      'leaked folder', 'mega folder', 'zip download'
    ]

    const indicatorMatches = leakIndicators.filter(indicator => text.includes(indicator))
    risk += indicatorMatches.length * 10

    // Verificar excesso de imagens (galerias de vazamento)
    if (content.images.length > 20) risk += 15

    return Math.min(risk, 50)
  }

  /**
   * Detectar tipo de página
   */
  private detectPageType(content: PageContent): string {
    const url = content.url.toLowerCase()
    const text = content.bodyText.toLowerCase()
    const title = content.title.toLowerCase()

    // Padrões para diferentes tipos de página
    if (url.includes('/forum/') || title.includes('forum')) return 'forum'
    if (url.includes('/gallery/') || text.includes('gallery')) return 'gallery'
    if (url.includes('/download/') || text.includes('download')) return 'download'
    if (url.includes('/video/') || text.includes('video player')) return 'video'
    if (url.includes('/profile/') || text.includes('profile')) return 'profile'
    if (text.includes('leaked') || text.includes('leak')) return 'leak'
    if (text.includes('onlyfans') || text.includes('premium')) return 'premium'

    return 'general'
  }

  /**
   * Obter risco baseado no tipo de página
   */
  private getPageTypeRisk(pageType: string): number {
    const risks: Record<string, number> = {
      'leak': 40,
      'premium': 30,
      'download': 25,
      'gallery': 20,
      'video': 15,
      'profile': 10,
      'forum': 5,
      'general': 0
    }

    return risks[pageType] || 0
  }

  /**
   * Agregar resultados das análises
   */
  private aggregateResults(
    content: PageContent, 
    results: [MatchResult, ImageAnalysisResult, ContextResult]
  ): ViolationResult | null {
    const [keywordResult, imageResult, contextResult] = results

    // Calcular score final
    const keywordWeight = 0.5
    const imageWeight = 0.3
    const contextWeight = 0.2

    const finalScore = 
      (keywordResult.riskScore * keywordWeight) +
      (imageResult.riskScore * imageWeight) +
      (contextResult.riskScore * contextWeight)

    // Determinar nível de risco
    const riskLevel = this.calculateRiskLevel(finalScore)

    // Gerar descrição detalhada
    const description = this.generateViolationDescription(keywordResult, imageResult, contextResult)

    // Determinar método de detecção
    const detectionMethods = []
    if (keywordResult.matches > 0) detectionMethods.push('keyword-match')
    if (imageResult.suspiciousImages > 0) detectionMethods.push('image-analysis')
    if (contextResult.riskScore > 20) detectionMethods.push('context-analysis')

    return {
      id: this.generateViolationId(),
      url: content.url,
      title: content.title,
      description,
      riskLevel,
      confidence: Math.round(finalScore),
      detectionMethod: detectionMethods.join(', '),
      metadata: {
        keywordMatches: keywordResult.matches,
        keywords: keywordResult.keywords,
        suspiciousImages: imageResult.suspiciousImages,
        pageType: contextResult.pageType,
        analysis: {
          keyword: keywordResult,
          image: imageResult,
          context: contextResult
        }
      },
      detectedAt: new Date(),
      brandProfileId: this.brandProfile.id,
      knownSiteId: '' // Será preenchido pelo agente
    }
  }

  /**
   * Calcular nível de risco
   */
  private calculateRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'CRITICAL'
    if (score >= 60) return 'HIGH'
    if (score >= 40) return 'MEDIUM'
    return 'LOW'
  }

  /**
   * Gerar descrição da violação
   */
  private generateViolationDescription(
    keyword: MatchResult, 
    image: ImageAnalysisResult, 
    context: ContextResult
  ): string {
    const parts: string[] = []

    if (keyword.matches > 0) {
      parts.push(`Encontradas ${keyword.matches} menções da marca`)
      if (keyword.keywords.length > 0) {
        parts.push(`Palavras-chave: ${keyword.keywords.slice(0, 5).join(', ')}`)
      }
    }

    if (image.suspiciousImages > 0) {
      parts.push(`${image.suspiciousImages} imagens suspeitas detectadas`)
    }

    if (context.riskScore > 20) {
      parts.push(`Contexto suspeito: ${context.pageType}`)
    }

    return parts.join('. ')
  }

  /**
   * Gerar keywords para busca
   */
  private generateKeywords(): string[] {
    const keywords = new Set<string>()

    // Nome da marca e variações
    keywords.add(this.brandProfile.name)
    this.brandProfile.variations.forEach(v => keywords.add(v))

    // Keywords específicas do perfil
    this.brandProfile.keywords.forEach(k => keywords.add(k))

    // Combinações suspeitas
    const suspiciousTerms = ['leaked', 'nude', 'naked', 'sex', 'porn', 'nsfw', 'onlyfans']
    const brandTerms = [this.brandProfile.name, ...this.brandProfile.variations]

    for (const brand of brandTerms) {
      for (const suspicious of suspiciousTerms) {
        keywords.add(`${brand} ${suspicious}`)
        keywords.add(`${suspicious} ${brand}`)
      }
    }

    return Array.from(keywords)
  }

  /**
   * Construir padrões suspeitos
   */
  private buildSuspiciousPatterns(): RegExp[] {
    return [
      /\b(leaked?|leak)\b/gi,
      /\b(nude|naked|nudes)\b/gi,
      /\b(sex|sexy|sexual)\b/gi,
      /\b(porn|porno|pornography)\b/gi,
      /\b(nsfw|adult)\b/gi,
      /\b(onlyfans|only\s*fans)\b/gi,
      /\b(premium|exclusive|vip)\b/gi,
      /\b(private|personal)\b/gi,
      /\b(free\s*download|download\s*free)\b/gi,
      /\b(mega\s*link|telegram\s*link)\b/gi,
      /\b(full\s*video|complete\s*set)\b/gi,
      /\b(uncensored|uncut)\b/gi
    ]
  }

  /**
   * Construir padrões contextuais
   */
  private buildContextPatterns(): RegExp[] {
    return [
      /\b(hack|hacked|stolen)\b/gi,
      /\b(icloud\s*hack|phone\s*hack)\b/gi,
      /\b(celebrity\s*leak|celeb\s*nude)\b/gi,
      /\b(revenge\s*porn|ex\s*girlfriend)\b/gi
    ]
  }

  /**
   * Inicializar padrões de detecção
   */
  private initializePatterns(): void {
    // Padrões suspeitos gerais
    this.suspiciousPatterns = [
      /\b(leaked?|leak)\b/gi,
      /\b(nude|naked|nudes)\b/gi,
      /\b(sex|sexy|sexual)\b/gi,
      /\b(porn|porno|pornography)\b/gi,
      /\b(nsfw|adult)\b/gi,
      /\b(onlyfans|only\s*fans)\b/gi,
      /\b(premium|exclusive|vip)\b/gi,
      /\b(private|personal)\b/gi,
      /\b(free\s*download|download\s*free)\b/gi,
      /\b(mega\s*link|telegram\s*link)\b/gi,
      /\b(full\s*video|complete\s*set)\b/gi,
      /\b(uncensored|uncut)\b/gi
    ]

    // Padrões contextuais
    this.contextPatterns = [
      /\b(hack|hacked|stolen)\b/gi,
      /\b(icloud\s*hack|phone\s*hack)\b/gi,
      /\b(celebrity\s*leak|celeb\s*nude)\b/gi,
      /\b(revenge\s*porn|ex\s*girlfriend)\b/gi
    ]
  }

  /**
   * Extrair contexto das matches
   */
  private extractContext(text: string, keywords: string[]): string[] {
    const contexts: string[] = []
    const contextRadius = 50 // caracteres antes e depois

    for (const keyword of keywords) {
      const regex = new RegExp(this.escapeRegex(keyword), 'gi')
      let match

      while ((match = regex.exec(text)) !== null) {
        const start = Math.max(0, match.index - contextRadius)
        const end = Math.min(text.length, match.index + match[0].length + contextRadius)
        const context = text.substring(start, end).trim()
        
        if (context && !contexts.includes(context)) {
          contexts.push(context)
        }
      }
    }

    return contexts.slice(0, 5) // Limitar a 5 contextos
  }

  /**
   * Escapar regex
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Extrair nome do arquivo da URL
   */
  private extractFilename(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      return pathname.substring(pathname.lastIndexOf('/') + 1)
    } catch {
      return url.substring(url.lastIndexOf('/') + 1) || url
    }
  }

  /**
   * Extrair extensão do arquivo
   */
  private extractExtension(url: string): string {
    const filename = this.extractFilename(url)
    const lastDot = filename.lastIndexOf('.')
    return lastDot > 0 ? filename.substring(lastDot + 1).toLowerCase() : ''
  }

  /**
   * Gerar ID único para violação
   */
  private generateViolationId(): string {
    return `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Verificar variações do nome
   */
  async checkNameVariations(content: PageContent): Promise<MatchResult> {
    const text = `${content.title} ${content.description} ${content.bodyText}`.toLowerCase()
    const variations = this.generateNameVariations(this.brandProfile.name)
    
    let matches = 0
    const foundVariations: string[] = []

    for (const variation of variations) {
      const regex = new RegExp(this.escapeRegex(variation.toLowerCase()), 'gi')
      const variationMatches = (text.match(regex) || []).length
      if (variationMatches > 0) {
        matches += variationMatches
        foundVariations.push(variation)
      }
    }

    return {
      matches,
      keywords: foundVariations,
      density: 0, // Não aplicável para variações
      context: [],
      riskScore: Math.min(matches * 15, 60)
    }
  }

  /**
   * Gerar variações do nome da marca
   */
  private generateNameVariations(name: string): string[] {
    const variations = new Set<string>()
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    variations.add(name)
    variations.add(cleanName)
    
    // Variações com espaços
    variations.add(name.replace(/\s+/g, ''))
    variations.add(name.replace(/\s+/g, '.'))
    variations.add(name.replace(/\s+/g, '_'))
    variations.add(name.replace(/\s+/g, '-'))
    
    // Variações com números/símbolos
    variations.add(name.replace(/o/gi, '0'))
    variations.add(name.replace(/a/gi, '@'))
    variations.add(name.replace(/i/gi, '1'))
    variations.add(name.replace(/s/gi, '$'))
    
    return Array.from(variations)
  }
}