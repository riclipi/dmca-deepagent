import { z } from 'zod'

// Schemas de validação
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
   * Analisar imagens para detectar violações
   */
  async analyzeImage(imageUrl: string, context: AnalysisContext): Promise<AnalysisResult> {
    try {
      const prompt = this.buildImageAnalysisPrompt(imageUrl, context)
      
      const response = await this.callGeminiVision(prompt, imageUrl, {
        temperature: 0.3,
        maxOutputTokens: 800
      })

      return this.parseAnalysisResponse(response)
      
    } catch (error) {
      console.error('Erro na análise de imagem:', error)
      throw new Error(`Falha na análise de imagem: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
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
        'Análise contextual'
      ]
    }
  }
}