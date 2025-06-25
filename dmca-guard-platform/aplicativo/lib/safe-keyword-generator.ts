export interface SafeKeywordConfig {
  baseName: string
  minLength: number // mínimo 4 caracteres
  maxVariations: number // máximo 50 keywords
  dangerousPatterns: string[] // padrões a evitar
  includeLeetspeakLight: boolean // usar l33tsp34k moderado
  includeSeparators: boolean // separadores como . _ -
  includeSpacing: boolean // variações de espaçamento
}

export interface KeywordRisk {
  keyword: string
  riskScore: number // 0-100 (0 = seguro, 100 = perigoso)
  riskReasons: string[]
  isApproved: boolean
}

export interface GeneratedKeywords {
  safe: string[] // keywords automáticamente aprovadas (score < 30)
  moderate: string[] // keywords que precisam review (score 30-70)
  dangerous: string[] // keywords bloqueadas (score > 70)
  total: number
  config: SafeKeywordConfig
}

class SafeKeywordGenerator {
  private readonly defaultDangerousPatterns = [
    // Padrões muito genéricos
    /^[a-z]{1,3}$/i, // 1-3 caracteres
    /^(a|an|the|is|are|and|or|but|if|on|in|at|to|for|of|by|with)$/i, // artigos/preposições
    
    // Palavras problemáticas para adulto
    /^(sex|porn|nude|naked|xxx|adult|leak|free|download|pack|telegram|discord)$/i,
    
    // Caracteres especiais excessivos
    /[!@#$%^&*()+={}[\]|\\:";'<>?,.\/]{3,}/,
    
    // Números apenas
    /^\d+$/,
    
    // Palavras muito comuns
    /^(content|video|photo|image|pic|girl|boy|model|star|celebrity|famous)$/i
  ]

  private readonly leetSpeakMap: Record<string, string[]> = {
    'a': ['4', '@'],
    'e': ['3'],
    'i': ['1', '!'],
    'o': ['0'],
    's': ['5', '$'],
    't': ['7'],
    'l': ['1'],
    'g': ['9']
  }

  generateSafeKeywords(config: SafeKeywordConfig): GeneratedKeywords {
    const allKeywords = new Set<string>()
    const riskAssessments: KeywordRisk[] = []

    // Normalizar nome base
    const baseName = this.normalizeName(config.baseName)
    
    if (baseName.length < config.minLength) {
      throw new Error(`Nome base '${baseName}' é muito curto (mínimo ${config.minLength} caracteres)`)
    }

    // Gerar variações base
    const baseVariations = this.generateBaseVariations(baseName, config)
    
    // Gerar com separadores
    if (config.includeSeparators) {
      const separatorVariations = this.generateSeparatorVariations(baseName)
      baseVariations.push(...separatorVariations)
    }

    // Gerar com espaçamento
    if (config.includeSpacing) {
      const spacingVariations = this.generateSpacingVariations(baseName)
      baseVariations.push(...spacingVariations)
    }

    // Gerar leetspeak moderado
    if (config.includeLeetspeakLight) {
      const leetVariations = this.generateLeetSpeakVariations(baseName, false) // light mode
      baseVariations.push(...leetVariations)
    }

    // Remover duplicatas e aplicar limite
    const uniqueVariations = Array.from(new Set(baseVariations))
      .slice(0, config.maxVariations)

    // Avaliar risco de cada keyword
    for (const keyword of uniqueVariations) {
      const risk = this.assessKeywordRisk(keyword, config)
      riskAssessments.push(risk)
      allKeywords.add(keyword)
    }

    // Categorizar por nível de risco
    const safe = riskAssessments
      .filter(r => r.riskScore < 30)
      .map(r => r.keyword)

    const moderate = riskAssessments
      .filter(r => r.riskScore >= 30 && r.riskScore <= 70)
      .map(r => r.keyword)

    const dangerous = riskAssessments
      .filter(r => r.riskScore > 70)
      .map(r => r.keyword)

    console.log(`🔍 Keywords geradas para '${baseName}':`)
    console.log(`✅ Seguras (${safe.length}): ${safe.slice(0, 5).join(', ')}${safe.length > 5 ? '...' : ''}`)
    console.log(`⚠️  Moderadas (${moderate.length}): ${moderate.slice(0, 3).join(', ')}${moderate.length > 3 ? '...' : ''}`)
    console.log(`❌ Perigosas (${dangerous.length}): ${dangerous.slice(0, 3).join(', ')}${dangerous.length > 3 ? '...' : ''}`)

    return {
      safe,
      moderate,
      dangerous,
      total: allKeywords.size,
      config
    }
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '') // remover caracteres especiais
      .replace(/\s+/g, ' ') // normalizar espaços
  }

  private generateBaseVariations(baseName: string, config: SafeKeywordConfig): string[] {
    const variations: string[] = []
    const words = baseName.split(' ')

    // Variação original
    variations.push(baseName)

    if (words.length > 1) {
      // Sem espaços
      variations.push(words.join(''))
      
      // Primeira palavra apenas (se >= minLength)
      if (words[0].length >= config.minLength) {
        variations.push(words[0])
      }

      // Última palavra apenas (se >= minLength)
      const lastWord = words[words.length - 1]
      if (lastWord.length >= config.minLength) {
        variations.push(lastWord)
      }

      // Combinações de 2 palavras
      for (let i = 0; i < words.length - 1; i++) {
        const combo = words[i] + words[i + 1]
        if (combo.length >= config.minLength) {
          variations.push(combo)
        }
      }
    }

    // Variações com remoção de vogais (para nomes longos)
    if (baseName.length >= 8) {
      const noVowels = baseName.replace(/[aeiou\s]/g, '')
      if (noVowels.length >= config.minLength) {
        variations.push(noVowels)
      }
    }

    return variations
  }

  private generateSeparatorVariations(baseName: string): string[] {
    const variations: string[] = []
    const separators = ['.', '_', '-']
    const words = baseName.split(' ')

    if (words.length > 1) {
      for (const sep of separators) {
        variations.push(words.join(sep))
      }
    }

    return variations
  }

  private generateSpacingVariations(baseName: string): string[] {
    const variations: string[] = []
    const words = baseName.split(' ')

    if (words.length > 1) {
      // Sem espaços
      variations.push(words.join(''))
      
      // Com espaços extras
      variations.push(words.join('  '))
    }

    return variations
  }

  private generateLeetSpeakVariations(baseName: string, aggressive = false): string[] {
    const variations: string[] = []
    
    // Substituições moderadas (apenas algumas letras)
    const moderateReplacements = ['a', 'e', 'i', 'o']
    
    for (const letter of moderateReplacements) {
      if (baseName.includes(letter)) {
        const replacements = this.leetSpeakMap[letter] || []
        for (const replacement of replacements) {
          const variation = baseName.replace(new RegExp(letter, 'g'), replacement)
          variations.push(variation)
          
          // Também variação sem espaços
          if (variation.includes(' ')) {
            variations.push(variation.replace(/\s/g, ''))
          }
        }
      }
    }

    return variations
  }

  private assessKeywordRisk(keyword: string, config: SafeKeywordConfig): KeywordRisk {
    let riskScore = 0
    const riskReasons: string[] = []

    // Verificar comprimento
    if (keyword.length < config.minLength) {
      riskScore += 50
      riskReasons.push(`Muito curto (${keyword.length} < ${config.minLength})`)
    }

    // Verificar padrões perigosos padrão
    for (const pattern of this.defaultDangerousPatterns) {
      if (pattern.test(keyword)) {
        riskScore += 40
        riskReasons.push('Padrão perigoso detectado')
        break
      }
    }

    // Verificar padrões personalizados
    for (const pattern of config.dangerousPatterns) {
      if (keyword.toLowerCase().includes(pattern.toLowerCase())) {
        riskScore += 30
        riskReasons.push(`Contém padrão personalizado: ${pattern}`)
      }
    }

    // Verificar se é muito genérico
    if (keyword.length <= 3) {
      riskScore += 60
      riskReasons.push('Extremamente genérico')
    } else if (keyword.length <= 5) {
      riskScore += 20
      riskReasons.push('Muito genérico')
    }

    // Verificar caracteres especiais excessivos
    const specialChars = keyword.match(/[^a-zA-Z0-9\s]/g)
    if (specialChars && specialChars.length > 2) {
      riskScore += 25
      riskReasons.push('Muitos caracteres especiais')
    }

    // Verificar apenas números
    if (/^\d+$/.test(keyword)) {
      riskScore += 70
      riskReasons.push('Apenas números')
    }

    // Verificar palavras comuns problemáticas
    const problematicWords = [
      'sex', 'porn', 'nude', 'naked', 'xxx', 'adult', 'leak', 
      'free', 'download', 'pack', 'telegram', 'discord'
    ]
    
    for (const word of problematicWords) {
      if (keyword.toLowerCase().includes(word)) {
        riskScore += 80
        riskReasons.push(`Contém palavra problemática: ${word}`)
        break
      }
    }

    // Limitar score máximo
    riskScore = Math.min(riskScore, 100)

    return {
      keyword,
      riskScore,
      riskReasons,
      isApproved: riskScore < 30 // Auto-aprovar apenas keywords muito seguras
    }
  }

  // Método para validar keywords existentes
  validateExistingKeywords(keywords: string[], baseName: string): KeywordRisk[] {
    const config: SafeKeywordConfig = {
      baseName,
      minLength: 4,
      maxVariations: 50,
      dangerousPatterns: [],
      includeLeetspeakLight: false,
      includeSeparators: false,
      includeSpacing: false
    }

    return keywords.map(keyword => this.assessKeywordRisk(keyword, config))
  }

  // Método para gerar configuração padrão
  getDefaultConfig(baseName: string): SafeKeywordConfig {
    return {
      baseName,
      minLength: 4,
      maxVariations: 30,
      dangerousPatterns: [],
      includeLeetspeakLight: true,
      includeSeparators: true,
      includeSpacing: true
    }
  }

  // Método para obter estatísticas de risco
  getRiskStatistics(risks: KeywordRisk[]): {
    safe: number
    moderate: number 
    dangerous: number
    averageRisk: number
  } {
    const safe = risks.filter(r => r.riskScore < 30).length
    const moderate = risks.filter(r => r.riskScore >= 30 && r.riskScore <= 70).length
    const dangerous = risks.filter(r => r.riskScore > 70).length
    const averageRisk = risks.reduce((sum, r) => sum + r.riskScore, 0) / risks.length

    return { safe, moderate, dangerous, averageRisk }
  }
}

// Export singleton instance
export const safeKeywordGenerator = new SafeKeywordGenerator()

// Export para uso em testes
export { SafeKeywordGenerator }