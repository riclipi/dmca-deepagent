// Mock Gemini AI Service for build
// Replace with actual implementation when API key is available

export interface GeminiResponse {
  text: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class GeminiAIService {
  private static instance: GeminiAIService
  
  static getInstance(): GeminiAIService {
    if (!GeminiAIService.instance) {
      GeminiAIService.instance = new GeminiAIService()
    }
    return GeminiAIService.instance
  }
  
  async generateContent(prompt: string): Promise<GeminiResponse> {
    // Mock response for build
    console.warn('[GeminiAI] Using mock response - configure GEMINI_API_KEY for real responses')
    
    return {
      text: JSON.stringify({
        analysis: "Mock analysis response",
        keywords: [],
        suggestions: []
      }),
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      }
    }
  }
  
  async analyzeKeywords(keywords: string[], context: any): Promise<any> {
    // Mock keyword analysis
    return keywords.map(keyword => ({
      keyword,
      classification: 'SAFE',
      riskScore: 0,
      reasons: ['Mock analysis'],
      suggestions: []
    }))
  }
}