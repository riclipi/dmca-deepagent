import { z } from 'zod'
import NodeCache from 'node-cache'
import pLimit from 'p-limit'

// Schemas de validação existentes
export const AnalysisResultSchema = z.object({
  isViolation: z.boolean(),
  confidence: z.number().min(0).max(1),
  violationType: z.enum(['COPYRIGHT', 'TRADEMARK', 'CONTENT_THEFT', 'IMPERSONATION', 'OTHER']).optional(),
  description: z.string(),
  suggestedAction: z.enum(['IGNORE', 'MONITOR', 'TAKEDOWN', 'URGENT_TAKEDOWN']),
  keywordsFound: z.array(z.string()),
  contextAnalysis: z.string(),
  metadata: z.record(z.any()).optional()
})

export const RiskAssessmentSchema = z.object({
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  riskScore: z.number().min(0).max(100),
  factors: z.array(z.string()),
  recommendations: z.array(z.string()),
  priority: z.number().min(1).max(10)
})

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>

// Novos tipos para análise contextual
export interface TextAnalysisResult {
  riskScore?: number
  violationType?: string
  evidences?: any[]
  recommendedAction?: string
  executiveSummary?: string
  detailedAnalysis?: string
  keyFindings?: string[]
  riskFactors?: string[]
  confidence?: number
}

export interface ImageAnalysisResult {
  hasRelevantImages: boolean
  analyses: ImageAnalysis[]
  totalImagesAnalyzed: number
}

export interface ImageAnalysis {
  imageUrl: string
  containsBrandContent?: boolean
  isUnauthorizedUse?: boolean
  certaintyLevel?: number
  description?: string
  violationElements?: string[]
}

export interface AnalysisOptions {
  temperature?: number
  model?: string
  useCache?: boolean
  priority?: 'low' | 'normal' | 'high'
}

export interface AnalysisContext {
  brandName?: string
  keywords?: string[]
  referenceImages?: string[]
  previousViolations?: number
  userProfile?: any
}

export interface ContentAnalysisOptions {
  includeImages?: boolean
  deepAnalysis?: boolean
  compareWithDatabase?: boolean
  timeout?: number
}

export class GeminiClient {
  private apiKey: string
  private model: string = "gemini-1.5-flash-8b"
  private baseUrl: string = "https://generativelanguage.googleapis.com/v1beta"

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || ''
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is required')
    }
  }

  /**
   * Analisar conteúdo para detectar violações DMCA
   */
  async analyzeContent(
    url: string, 
    content: string, 
    context: AnalysisContext,
    options: ContentAnalysisOptions = {}
  ): Promise<AnalysisResult> {
    try {
      const prompt = this.buildAnalysisPrompt(url, content, context, options)
      
      const response = await this.callGemini(prompt, {
        temperature: 0.3,
        maxOutputTokens: 1000
      })

      return this.parseAnalysisResponse(response)
      
    } catch (error) {
      console.error('Erro na análise de conteúdo:', error)
      throw new Error(`Falha na análise: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  /**
   * Classificar risco de conteúdo
   */
  async classifyRisk(content: string, context?: AnalysisContext): Promise<RiskAssessment> {
    try {
      const prompt = this.buildRiskPrompt(content, context)
      
      const response = await this.callGemini(prompt, {
        temperature: 0.2,
        maxOutputTokens: 500
      })

      return this.parseRiskResponse(response)
      
    } catch (error) {
      console.error('Erro na classificação de risco:', error)
      throw new Error(`Falha na classificação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  /**
   * Gerar relatório contextual de violações
   */
  async generateContextualReport(violations: any[], context?: AnalysisContext): Promise<string> {
    try {
      const prompt = this.buildReportPrompt(violations, context)
      
      const response = await this.callGemini(prompt, {
        temperature: 0.4,
        maxOutputTokens: 2000
      })

      return response.trim()
      
    } catch (error) {
      console.error('Erro na geração de relatório:', error)
      throw new Error(`Falha no relatório: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }


  /**
   * Construir prompt para análise de conteúdo
   */
  private buildAnalysisPrompt(
    url: string, 
    content: string, 
    context: AnalysisContext,
    options: ContentAnalysisOptions
  ): string {
    const { brandName, keywords, previousViolations } = context
    
    return `
Você é um especialista em análise de violações DMCA. Analise o seguinte conteúdo:

URL: ${url}
CONTEÚDO: ${content.substring(0, 2000)}
MARCA PROTEGIDA: ${brandName || 'Não especificada'}
PALAVRAS-CHAVE: ${keywords?.join(', ') || 'Nenhuma'}
VIOLAÇÕES ANTERIORES: ${previousViolations || 0}

Analise se este conteúdo constitui uma violação de direitos autorais, marca registrada ou roubo de conteúdo.

Responda no seguinte formato JSON:
{
  "isViolation": boolean,
  "confidence": number (0-1),
  "violationType": "COPYRIGHT|TRADEMARK|CONTENT_THEFT|IMPERSONATION|OTHER",
  "description": "descrição detalhada da análise",
  "suggestedAction": "IGNORE|MONITOR|TAKEDOWN|URGENT_TAKEDOWN",
  "keywordsFound": ["palavra1", "palavra2"],
  "contextAnalysis": "análise contextual detalhada"
}

Seja preciso e baseie-se em evidências concretas.
    `.trim()
  }

  /**
   * Construir prompt para classificação de risco
   */
  private buildRiskPrompt(content: string, context?: AnalysisContext): string {
    return `
Classifique o nível de risco deste conteúdo para violação DMCA:

CONTEÚDO: ${content.substring(0, 1500)}
CONTEXTO: ${context?.brandName ? `Marca: ${context.brandName}` : 'Sem contexto específico'}

Considere fatores como:
- Severidade da violação
- Impacto potencial na marca
- Urgência de ação necessária
- Probabilidade de dano

Responda no formato JSON:
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": number (0-100),
  "factors": ["fator1", "fator2"],
  "recommendations": ["recomendação1", "recomendação2"],
  "priority": number (1-10)
}
    `.trim()
  }

  /**
   * Construir prompt para relatório
   */
  private buildReportPrompt(violations: any[], context?: AnalysisContext): string {
    const violationsSummary = violations.map((v, i) => 
      `${i + 1}. URL: ${v.url} - Tipo: ${v.violationType} - Confiança: ${v.confidence}`
    ).join('\n')

    return `
Gere um relatório executivo sobre as seguintes violações DMCA detectadas:

VIOLAÇÕES ENCONTRADAS:
${violationsSummary}

CONTEXTO:
- Marca: ${context?.brandName || 'Não especificada'}
- Total de violações: ${violations.length}

O relatório deve incluir:
1. Resumo executivo
2. Análise de padrões
3. Recomendações de ação
4. Priorização por urgência
5. Próximos passos sugeridos

Mantenha um tom profissional e focado em ações práticas.
    `.trim()
  }

  /**
   * Construir prompt para análise de imagem
   */
  private buildImageAnalysisPrompt(imageUrl: string, context: AnalysisContext): string {
    return `
Analise esta imagem para detectar possíveis violações de direitos autorais ou uso não autorizado:

IMAGEM: ${imageUrl}
MARCA PROTEGIDA: ${context.brandName || 'Não especificada'}
REFERÊNCIAS: ${context.referenceImages?.join(', ') || 'Nenhuma'}

Procure por:
- Logos ou marcas não autorizadas
- Conteúdo protegido por direitos autorais
- Uso indevido de imagens de marca
- Falsificação ou imitação

Responda no mesmo formato JSON da análise de conteúdo.
    `.trim()
  }

  /**
   * Chamada para API do Gemini (texto)
   */
  private async callGemini(prompt: string, options: any = {}): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`
    
    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: options.temperature || 0.3,
        maxOutputTokens: options.maxOutputTokens || 1000,
        topP: 0.8,
        topK: 40
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('Resposta inválida da API Gemini')
    }

    return data.candidates[0].content.parts[0].text
  }

  /**
   * Chamada para API do Gemini (visão)
   */
  private async callGeminiVision(prompt: string, imageUrl: string, options: any = {}): Promise<string> {
    // Para implementação futura - requer configuração adicional
    // Por ora, retorna análise baseada em texto
    return this.callGemini(`${prompt}\n\nNOTA: Análise de imagem não implementada. URL: ${imageUrl}`, options)
  }

  /**
   * Parse da resposta de análise
   */
  private parseAnalysisResponse(response: string): AnalysisResult {
    try {
      // Tentar extrair JSON da resposta
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Resposta não contém JSON válido')
      }

      const parsed = JSON.parse(jsonMatch[0])
      return AnalysisResultSchema.parse(parsed)
      
    } catch (error) {
      console.error('Erro ao fazer parse da resposta:', error)
      
      // Fallback: análise básica baseada no texto
      return {
        isViolation: false,
        confidence: 0.1,
        description: 'Erro na análise - resposta inválida do Gemini',
        suggestedAction: 'IGNORE',
        keywordsFound: [],
        contextAnalysis: response.substring(0, 500)
      }
    }
  }

  /**
   * Parse da resposta de risco
   */
  private parseRiskResponse(response: string): RiskAssessment {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Resposta não contém JSON válido')
      }

      const parsed = JSON.parse(jsonMatch[0])
      return RiskAssessmentSchema.parse(parsed)
      
    } catch (error) {
      console.error('Erro ao fazer parse da resposta de risco:', error)
      
      // Fallback
      return {
        riskLevel: 'LOW',
        riskScore: 10,
        factors: ['Erro na análise'],
        recommendations: ['Revisar manualmente'],
        priority: 1
      }
    }
  }

  /**
   * Verificar se a API está configurada corretamente
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callGemini('Teste de conexão. Responda apenas "OK".', {
        maxOutputTokens: 10
      })
      return response.toLowerCase().includes('ok')
    } catch (error) {
      console.error('Erro no teste de conexão:', error)
      return false
    }
  }

  /**
   * Análise de texto para ContextualAgent
   */
  async analyzeText(prompt: string, options?: AnalysisOptions): Promise<TextAnalysisResult> {
    try {
      const response = await this.callGemini(prompt, {
        temperature: options?.temperature || 0.1,
        maxOutputTokens: 2000
      })
      
      return this.parseTextAnalysisResult(response)
      
    } catch (error) {
      console.error('Erro na análise de texto:', error)
      return this.generateFallbackTextAnalysis(prompt)
    }
  }

  /**
   * Análise de imagem para ContextualAgent
   */
  async analyzeImage(imageUrl: string, prompt: string, options?: AnalysisOptions): Promise<ImageAnalysis> {
    try {
      // Por enquanto, análise baseada em texto da URL
      const fullPrompt = `${prompt}\n\nImagem: ${imageUrl}\n\nNOTA: Análise visual não implementada ainda, avalie baseado na URL e contexto.`
      
      const response = await this.callGemini(fullPrompt, {
        temperature: options?.temperature || 0.1,
        maxOutputTokens: 800
      })
      
      return this.parseImageAnalysisResult(response, imageUrl)
      
    } catch (error) {
      console.error(`Erro na análise de imagem ${imageUrl}:`, error)
      return {
        imageUrl,
        containsBrandContent: false,
        isUnauthorizedUse: false,
        certaintyLevel: 0,
        description: 'Erro na análise da imagem',
        violationElements: []
      }
    }
  }

  /**
   * Parse do resultado de análise de texto para ContextualAgent
   */
  private parseTextAnalysisResult(response: string): TextAnalysisResult {
    try {
      const cleaned = this.cleanJsonResponse(response)
      const parsed = JSON.parse(cleaned)
      
      return {
        riskScore: parsed.riskScore || 0,
        violationType: parsed.violationType || 'UNKNOWN',
        evidences: parsed.evidences || [],
        recommendedAction: parsed.recommendedAction || 'NEEDS_HUMAN_REVIEW',
        executiveSummary: parsed.executiveSummary || '',
        detailedAnalysis: parsed.detailedAnalysis || '',
        keyFindings: parsed.keyFindings || [],
        riskFactors: parsed.riskFactors || [],
        confidence: parsed.confidence || 0.5
      }
    } catch (error) {
      console.warn('Erro ao parsear resposta JSON do Gemini, usando fallback:', error)
      return this.extractAnalysisFromText(response)
    }
  }

  /**
   * Parse do resultado de análise de imagem para ContextualAgent
   */
  private parseImageAnalysisResult(response: string, imageUrl: string): ImageAnalysis {
    try {
      const cleaned = this.cleanJsonResponse(response)
      const parsed = JSON.parse(cleaned)
      
      return {
        imageUrl,
        containsBrandContent: parsed.containsBrandContent || false,
        isUnauthorizedUse: parsed.isUnauthorizedUse || false,
        certaintyLevel: parsed.certaintyLevel || 0,
        description: parsed.description || '',
        violationElements: parsed.violationElements || []
      }
    } catch (error) {
      console.warn('Erro ao parsear resposta de análise de imagem:', error)
      
      const containsViolation = response.toLowerCase().includes('violação') || 
                               response.toLowerCase().includes('violation') ||
                               response.toLowerCase().includes('unauthorized')
      
      return {
        imageUrl,
        containsBrandContent: containsViolation,
        isUnauthorizedUse: containsViolation,
        certaintyLevel: containsViolation ? 60 : 10,
        description: response.substring(0, 200),
        violationElements: []
      }
    }
  }

  /**
   * Extrair análise de texto livre quando JSON falha
   */
  private extractAnalysisFromText(text: string): TextAnalysisResult {
    const lowercaseText = text.toLowerCase()
    
    let riskScore = 0
    const scoreMatch = text.match(/(\d+)\/100|\b(\d+)%|\brisk.*?(\d+)/i)
    if (scoreMatch) {
      riskScore = parseInt(scoreMatch[1] || scoreMatch[2] || scoreMatch[3] || '0')
    }
    
    let violationType = 'UNKNOWN'
    if (lowercaseText.includes('copyright')) violationType = 'COPYRIGHT_INFRINGEMENT'
    else if (lowercaseText.includes('trademark')) violationType = 'TRADEMARK_VIOLATION'
    else if (lowercaseText.includes('leaked')) violationType = 'LEAKED_CONTENT'
    else if (lowercaseText.includes('unauthorized')) violationType = 'UNAUTHORIZED_DISTRIBUTION'
    
    let recommendedAction = 'NEEDS_HUMAN_REVIEW'
    if (lowercaseText.includes('takedown')) recommendedAction = 'IMMEDIATE_TAKEDOWN'
    else if (lowercaseText.includes('legal')) recommendedAction = 'LEGAL_ACTION'
    else if (lowercaseText.includes('monitor')) recommendedAction = 'MONITOR_CLOSELY'
    
    return {
      riskScore,
      violationType,
      evidences: [],
      recommendedAction,
      executiveSummary: text.substring(0, 200),
      detailedAnalysis: text,
      keyFindings: [],
      riskFactors: [],
      confidence: 0.3
    }
  }

  /**
   * Limpar resposta JSON do Gemini
   */
  private cleanJsonResponse(response: string): string {
    let cleaned = response.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '')
    
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
    }
    
    return cleaned.trim()
  }

  /**
   * Gerar análise de fallback
   */
  private generateFallbackTextAnalysis(prompt: string): TextAnalysisResult {
    return {
      riskScore: 0,
      violationType: 'UNKNOWN',
      evidences: [],
      recommendedAction: 'NEEDS_HUMAN_REVIEW',
      executiveSummary: 'Análise não disponível devido a erro na API',
      detailedAnalysis: 'Não foi possível completar a análise via Gemini API',
      keyFindings: [],
      riskFactors: [],
      confidence: 0
    }
  }

  /**
   * Geração de texto genérica
   */
  async generateText(prompt: string, options?: any): Promise<string> {
    try {
      const response = await this.callGemini(prompt, options);
      return response;
    } catch (error) {
      console.error('Erro na geração de texto:', error);
      throw error;
    }
  }

  /**
   * Obter informações do modelo
   */
  getModelInfo(): { model: string; capabilities: string[] } {
    return {
      model: this.model,
      capabilities: [
        'Análise de texto',
        'Detecção de violações DMCA',
        'Classificação de risco',
        'Geração de relatórios',
        'Análise contextual',
        'Análise de imagens (limitada)',
        'Cache e rate limiting'
      ]
    }
  }
}
