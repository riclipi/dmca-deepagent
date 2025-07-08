// lib/search-engines-v2.ts - Versão refatorada usando banco de dados

import { KnownSitesService } from './services/known-sites.service'

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  platform: string;
  confidence: number;
  thumbnailUrl?: string;
  detectedAt: Date;
}

interface SearchConfig {
  keyword: string;
  brandName: string;
  excludeDomains: string[];
  maxResults: number;
  platforms: string[];
}

// Lista de termos de vazamento (mantida pois são keywords, não sites)
const LEAK_TERMS = [
  // Português básico
  'vazado', 'vazou', 'vaza', 'vazamento', 'vazamentos',
  'leaked', 'leak', 'leaks', 'privacy', 'privacidade',
  'onlyfans vazado', 'onlyfans leaked', 'pacote', 'pack', 'packs',
  'conteudo vazado', 'fotos vazadas', 'videos vazados',
  'privatecontent', 'premium', 'exclusivo', 'gratis', 'free',
  'nudes vazadas', 'pack vazado', 'content leaked',
  
  // Inglês avançado
  'leaked', 'leak', 'leaks', 'private', 'premium content', 'exclusive',
  'onlyfans leak', 'onlyfans leaked', 'of leak', 'of leaked',
  'mega leak', 'telegram leak', 'discord leak', 'reddit leak',
  'nude leak', 'nudes leaked', 'sex tape', 'sextape',
  'private pics', 'private photos', 'exclusive content',
  'premium leak', 'vip content', 'paid content', 'subscription leak',
  
  // Termos específicos de plataformas
  'onlyfans', 'fansly', 'manyvids', 'chaturbate', 'cam4',
  'streamate', 'livejasmin', 'bongacams', 'stripchat',
  'patreon', 'fancentro', 'loyalfans', 'justforfans',
  
  // Variações portuguesas
  'pelada', 'peladas', 'nua', 'nuas', 'sem roupa',
  'intima', 'intimas', 'pessoal', 'particular',
  'secreta', 'secretas', 'escondida', 'escondidas',
  'proibida', 'proibidas', 'censurada', 'censuradas',
  
  // Termos de ação
  'download', 'baixar', 'gratis', 'gratuito', 'free',
  'completo', 'full', 'mega', 'torrent', 'zip', 'rar',
  'album', 'collection', 'colecao', 'galeria', 'gallery'
];

export class SearchEngineServiceV2 {
  private serperApiKey?: string;
  private googleApiKey?: string;
  private googleCseId?: string;
  private environment: string;
  private knownSitesService: KnownSitesService;
  private leakSitesCache: Set<string> | null = null;
  private cacheExpiry: number = 0;

  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleCseId = process.env.GOOGLE_CSE_ID;
    this.environment = process.env.NODE_ENV || 'development';
    this.knownSitesService = KnownSitesService.getInstance();
  }

  /**
   * Carrega sites de vazamento do banco com cache
   */
  private async getLeakSites(): Promise<Set<string>> {
    // Usar cache se ainda válido (5 minutos)
    if (this.leakSitesCache && Date.now() < this.cacheExpiry) {
      return this.leakSitesCache;
    }

    // Buscar do banco
    const sites = await this.knownSitesService.getLeakSites();
    this.leakSitesCache = new Set(sites.map(s => s.domain));
    this.cacheExpiry = Date.now() + 5 * 60 * 1000; // 5 minutos

    return this.leakSitesCache;
  }

  // Google Search API
  async searchGoogle(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    if (!this.googleApiKey || !this.googleCseId) {
      console.warn('⚠️  Google Search API não configurada');
      return [];
    }

    try {
      const query = this.buildSearchQuery(keyword, config);
      console.log(`🔍 Google Search: "${query}"`);
      
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.append('key', this.googleApiKey);
      url.searchParams.append('cx', this.googleCseId);
      url.searchParams.append('q', query);
      url.searchParams.append('num', '10');
      url.searchParams.append('hl', 'pt');
      url.searchParams.append('gl', 'br');

      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        console.error(`❌ Google API erro HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log('⚠️  Google API: Nenhum resultado encontrado');
        return [];
      }
      
      console.log(`✅ Google API: ${data.items.length} resultados encontrados`);
      
      const results = data.items.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'google',
        platform: this.detectPlatform(item.link),
        confidence: this.calculateConfidence(item, keyword, config.brandName),
        thumbnailUrl: item.pagemap?.cse_thumbnail?.[0]?.src,
        detectedAt: new Date()
      }));
      
      return results;
    } catch (error) {
      console.error('❌ Google API erro:', error);
      return [];
    }
  }

  // Serper API
  async searchSerper(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    if (!this.serperApiKey) {
      console.warn('⚠️  Serper API não configurada');
      return [];
    }

    try {
      const query = this.buildSearchQuery(keyword, config);
      console.log(`🔍 Serper Search: "${query}"`);
      
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.serperApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 20,
          gl: 'br',
          hl: 'pt'
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        console.error(`❌ Serper API erro HTTP ${response.status}`);
        return [];
      }

      const data = await response.json();
      
      if (!data.organic || data.organic.length === 0) {
        console.log('⚠️  Serper API: Nenhum resultado orgânico encontrado');
        return [];
      }
      
      console.log(`✅ Serper API: ${data.organic.length} resultados encontrados`);
      
      const results = data.organic.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'serper',
        platform: this.detectPlatform(item.link),
        confidence: this.calculateConfidence(item, keyword, config.brandName),
        thumbnailUrl: item.thumbnail,
        detectedAt: new Date()
      }));
      
      return results;
    } catch (error) {
      console.error('❌ Serper API erro:', error);
      return [];
    }
  }

  // Busca específica em sites prioritários
  async searchPrioritySites(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    // Buscar sites de alta prioridade do banco
    const highRiskSites = await this.knownSitesService.getHighRiskSites(20);
    
    if (highRiskSites.length === 0) {
      console.warn('⚠️  Nenhum site de alto risco encontrado no banco');
      return [];
    }
    
    const results: SearchResult[] = [];
    const batchSize = 5; // Processar em lotes para melhor performance
    
    // Processar sites em lotes
    for (let i = 0; i < highRiskSites.length; i += batchSize) {
      const batch = highRiskSites.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (site) => {
        try {
          const siteQuery = `site:${site.domain} "${config.brandName}"`;
          const siteConfig = { ...config, maxResults: 5 }; // Limitar resultados por site
          return await this.searchSerper(siteQuery, siteConfig);
        } catch (error) {
          console.error(`Erro buscando em ${site.domain}:`, error);
          return [];
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          results.push(...result.value);
        }
      }
      
      // Rate limiting entre lotes
      if (i + batchSize < highRiskSites.length) {
        await this.delay(200);
      }
    }
    
    return results;
  }

  // Busca completa usando múltiplas fontes
  async performCompleteSearch(config: SearchConfig): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const apiErrors: string[] = [];
    
    const keyword = config.keyword;
    console.log(`🔍 Buscando keyword específica: "${keyword}"`);
    
    try {
      // Busca paralela em múltiplas fontes
      const [googleResults, serperResults, priorityResults] = await Promise.allSettled([
        this.searchGoogle(keyword, config),
        this.searchSerper(keyword, config),
        this.searchPrioritySites(keyword, config)
      ]);
      
      // Coleta resultados bem-sucedidos
      if (googleResults.status === 'fulfilled') {
        allResults.push(...googleResults.value.map(r => ({ ...r, keyword })));
      } else {
        apiErrors.push(`Google API: ${googleResults.reason}`);
      }
      
      if (serperResults.status === 'fulfilled') {
        allResults.push(...serperResults.value.map(r => ({ ...r, keyword })));
      } else {
        apiErrors.push(`Serper API: ${serperResults.reason}`);
      }
      
      if (priorityResults.status === 'fulfilled') {
        allResults.push(...priorityResults.value.map(r => ({ ...r, keyword })));
      } else {
        apiErrors.push(`Priority Sites: ${priorityResults.reason}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro crítico buscando keyword "${keyword}":`, error);
      apiErrors.push(`Erro geral: ${error instanceof Error ? error.message : 'Desconhecido'}`);
    }
    
    // Se teve erros, registrar no log
    if (apiErrors.length > 0) {
      console.error('❌ Erros nas APIs de busca:', apiErrors);
    }
    
    // Se nenhum resultado foi encontrado
    if (allResults.length === 0) {
      console.error(`❌ Nenhum resultado encontrado para "${keyword}".`);
      return [];
    }
    
    // Remove duplicatas e ordena por confiança
    const uniqueResults = this.removeDuplicates(allResults);
    const filteredResults = this.filterResults(uniqueResults, config);
    
    console.log(`📊 Encontrados ${filteredResults.length} resultados para "${keyword}"`);
    
    return filteredResults
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.maxResults);
  }

  // Helpers
  private buildSearchQuery(keyword: string, config: SearchConfig): string {
    let query = keyword;
    
    // Excluir domínios da whitelist do usuário
    if (config.excludeDomains && config.excludeDomains.length > 0) {
      config.excludeDomains.forEach(domain => {
        query += ` -site:${domain}`;
      });
    }
    
    // Excluir domínios oficiais conhecidos
    const officialDomains = ['onlyfans.com', 'fansly.com', 'patreon.com'];
    officialDomains.forEach(domain => {
      if (!query.includes(`-site:${domain}`)) {
        query += ` -site:${domain}`;
      }
    });
    
    // Adicionar filtros de plataforma se especificado
    if (config.platforms && config.platforms.length > 0) {
      const platformQueries = config.platforms.map(platform => {
        switch (platform.toLowerCase()) {
          case 'reddit':
            return 'site:reddit.com';
          case 'twitter':
            return '(site:twitter.com OR site:x.com)';
          case 'telegram':
            return 'site:t.me';
          case 'discord':
            return 'site:discord.gg';
          default:
            return '';
        }
      }).filter(q => q);
      
      if (platformQueries.length > 0) {
        query += ` (${platformQueries.join(' OR ')})`;
      }
    }
    
    return query.trim();
  }

  private detectPlatform(url: string): string {
    const domain = new URL(url).hostname.toLowerCase();
    
    if (domain.includes('reddit')) return 'Reddit';
    if (domain.includes('twitter') || domain.includes('x.com')) return 'Twitter/X';
    if (domain.includes('telegram')) return 'Telegram';
    if (domain.includes('discord')) return 'Discord';
    if (domain.includes('onlyfans')) return 'OnlyFans';
    if (domain.includes('mega.nz')) return 'Mega';
    if (domain.includes('pornhub')) return 'PornHub';
    if (domain.includes('xvideos')) return 'XVideos';
    
    return 'Other';
  }

  private async calculateConfidence(item: any, keyword: string, brandName: string): Promise<number> {
    let confidence = 50; // Base confidence
    
    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    const url = (item.link || '').toLowerCase();
    const brandLower = brandName.toLowerCase();
    
    // Análise de título (peso maior)
    if (title.includes(brandLower)) {
      confidence += 30;
      // Bonus se o nome aparece no início do título
      if (title.startsWith(brandLower)) confidence += 10;
    }
    
    // Análise de snippet (peso médio)
    if (snippet.includes(brandLower)) {
      confidence += 20;
    }
    
    // Análise de termos de vazamento com pesos diferenciados
    const criticalTerms = ['vazado', 'leaked', 'vazou', 'leak', 'nudes vazadas', 'pack vazado'];
    const moderateTerms = ['premium', 'exclusivo', 'private', 'content'];
    const contextTerms = ['download', 'gratis', 'free', 'completo'];
    
    let leakScore = 0;
    criticalTerms.forEach(term => {
      if (title.includes(term)) leakScore += 15;
      else if (snippet.includes(term)) leakScore += 10;
      else if (url.includes(term)) leakScore += 5;
    });
    
    moderateTerms.forEach(term => {
      if (title.includes(term)) leakScore += 8;
      else if (snippet.includes(term)) leakScore += 5;
    });
    
    contextTerms.forEach(term => {
      if (title.includes(term) || snippet.includes(term)) leakScore += 3;
    });
    
    confidence += Math.min(leakScore, 40); // Cap leak score contribution
    
    // Análise de URL
    const urlAnalysis = this.analyzeUrl(url);
    confidence += urlAnalysis.score;
    
    // Penalização para sites oficiais
    const officialSites = ['onlyfans.com', 'fansly.com', 'patreon.com'];
    const domain = new URL(item.link || '').hostname.toLowerCase();
    
    if (officialSites.some(site => domain.includes(site))) {
      // Só penaliza se não houver termos de vazamento
      if (leakScore < 10) {
        confidence -= 30;
      }
    }
    
    // Bonus para sites conhecidos de vazamento
    const leakSites = await this.getLeakSites();
    if (leakSites.has(domain)) {
      confidence += 25;
      
      // Extra bonus se o site tem alto risco
      const siteInfo = await this.knownSitesService.getActiveSites({ 
        platform: domain,
        limit: 1 
      });
      if (siteInfo.length > 0 && siteInfo[0].riskScore >= 80) {
        confidence += 10;
      }
    }
    
    // Análise temporal (conteúdo recente é mais relevante)
    if (item.date) {
      const daysSincePublished = (Date.now() - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSincePublished < 7) confidence += 10;
      else if (daysSincePublished < 30) confidence += 5;
      else if (daysSincePublished > 180) confidence -= 10;
    }
    
    return Math.min(Math.max(confidence, 0), 100);
  }
  
  /**
   * Analisa a URL para detectar padrões suspeitos
   */
  private analyzeUrl(url: string): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const urlLower = url.toLowerCase();
    
    // Padrões suspeitos na URL
    const suspiciousPatterns = [
      { pattern: /mega\.nz/i, score: 15, reason: 'File sharing service' },
      { pattern: /t\.me/i, score: 10, reason: 'Telegram link' },
      { pattern: /discord\.gg/i, score: 10, reason: 'Discord invite' },
      { pattern: /\/(leaked|vazado|pack|nudes)/i, score: 20, reason: 'Leak terms in URL' },
      { pattern: /\d{4,}/i, score: 5, reason: 'Long number sequence' },
      { pattern: /\.ru$|\.tk$|\.ml$/i, score: 10, reason: 'Suspicious TLD' }
    ];
    
    suspiciousPatterns.forEach(({ pattern, score: patternScore, reason }) => {
      if (pattern.test(urlLower)) {
        score += patternScore;
        reasons.push(reason);
      }
    });
    
    return { score, reasons };
  }

  private removeDuplicates(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private filterResults(results: SearchResult[], config: SearchConfig): SearchResult[] {
    return results.filter(result => {
      // Remove se estiver na whitelist
      if (config.excludeDomains.some(domain => result.url.includes(domain))) {
        return false;
      }
      
      // Mantém apenas resultados com confiança mínima
      return result.confidence >= 30;
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Exportar nova versão como padrão
export default SearchEngineServiceV2;