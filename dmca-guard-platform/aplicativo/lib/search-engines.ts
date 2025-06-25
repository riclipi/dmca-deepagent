// lib/search-engines.ts - Sistema de Busca Real para DMCA Detection

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

// Lista base de sites adultos e de vazamentos (expandir com os 10000+ sites)
const ADULT_LEAK_SITES = [
  // Sites de vazamentos populares
  'thothub.tv',
  'coomer.party', 
  'kemono.party',
  'simpcity.su',
  'leakedmodels.com',
  'modelcentro.com',
  'nudostar.tv',
  'fapello.com',
  'bunkr.is',
  'cyberdrop.me',
  'gofile.io',
  'mega.nz',
  'mediafire.com',
  
  // Fóruns e comunidades
  'reddit.com',
  'discord.gg',
  'telegram.org',
  'twitter.com',
  'x.com',
  
  // Sites de compartilhamento
  'imgur.com',
  'imagebam.com',
  'imagetwist.com',
  'pixhost.to',
  'postimg.cc',
  
  // Plataformas adultas
  'xvideos.com',
  'pornhub.com',
  'xhamster.com',
  'redtube.com',
  'youporn.com',
  'spankbang.com',
  'erome.com',
  'scrolller.com'
];

// Variações de termos de vazamento em PT e EN
const LEAK_TERMS = [
  // Português
  'vazado', 'vazou', 'leaked', 'vaza', 'privacy', 'leak',
  'onlyfans vazado', 'onlyfans leaked', 'pacote', 'pack',
  'conteudo vazado', 'fotos vazadas', 'videos vazados',
  'privatecontent', 'premium', 'exclusivo', 'gratis', 'free',
  
  // Inglês
  'leaked', 'leak', 'private', 'premium content', 'exclusive',
  'onlyfans leak', 'mega leak', 'telegram leak', 'discord leak',
  'nude leak', 'sex tape', 'private pics', 'exclusive content'
];

export class SearchEngineService {
  private serperApiKey?: string;
  private googleApiKey?: string;
  private googleCseId?: string;

  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleCseId = process.env.GOOGLE_CSE_ID;
  }

  // Gera keywords inteligentes baseadas no nome da marca
  generateSearchKeywords(brandName: string): string[] {
    const keywords = [];
    const cleanBrandName = brandName.toLowerCase().trim();
    
    // Keywords básicas
    keywords.push(cleanBrandName);
    
    // Combinações com termos de vazamento
    LEAK_TERMS.forEach(term => {
      keywords.push(`${cleanBrandName} ${term}`);
      keywords.push(`"${cleanBrandName}" ${term}`);
    });
    
    // Variações do nome
    const variations = [
      cleanBrandName.replace(/\s+/g, ''),
      cleanBrandName.replace(/\s+/g, '_'),
      cleanBrandName.replace(/\s+/g, '.'),
      cleanBrandName.replace(/\s+/g, '-')
    ];
    
    variations.forEach(variation => {
      keywords.push(variation);
      keywords.push(`${variation} onlyfans`);
      keywords.push(`${variation} leaked`);
      keywords.push(`${variation} vazado`);
    });
    
    return [...new Set(keywords)]; // Remove duplicatas
  }

  // Busca no Google usando Custom Search API
  async searchGoogle(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    if (!this.googleApiKey || !this.googleCseId) {
      console.log('Google API não configurada, pulando...');
      return [];
    }

    try {
      const query = this.buildSearchQuery(keyword, config);
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleCseId}&q=${encodeURIComponent(query)}&num=10`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!data.items) return [];
      
      return data.items.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'google',
        platform: this.detectPlatform(item.link),
        confidence: this.calculateConfidence(item, keyword, config.brandName),
        thumbnailUrl: item.pagemap?.cse_thumbnail?.[0]?.src,
        detectedAt: new Date()
      }));
    } catch (error) {
      console.error('Erro na busca Google:', error);
      return [];
    }
  }

  // Busca usando Serper API (alternativa robusta)
  async searchSerper(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    if (!this.serperApiKey) {
      console.log('Serper API não configurada, pulando...');
      return [];
    }

    try {
      const query = this.buildSearchQuery(keyword, config);
      
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.serperApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 20,
          gl: 'br', // Brasil
          hl: 'pt' // Português
        })
      });

      const data = await response.json();
      
      if (!data.organic) return [];
      
      return data.organic.map((item: any) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'serper',
        platform: this.detectPlatform(item.link),
        confidence: this.calculateConfidence(item, keyword, config.brandName),
        thumbnailUrl: item.thumbnail,
        detectedAt: new Date()
      }));
    } catch (error) {
      console.error('Erro na busca Serper:', error);
      return [];
    }
  }

  // Busca específica em sites adultos
  async searchAdultSites(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    for (const site of ADULT_LEAK_SITES) {
      try {
        // Busca site-específica
        const siteQuery = `site:${site} "${config.brandName}" OR "${keyword}"`;
        
        // Usa Serper para buscar em sites específicos
        const siteResults = await this.searchSerper(siteQuery, config);
        results.push(...siteResults);
        
        // Rate limiting para não sobrecarregar APIs
        await this.delay(100);
        
      } catch (error) {
        console.error(`Erro buscando em ${site}:`, error);
        continue;
      }
    }
    
    return results;
  }

  // Busca completa usando múltiplas fontes
  async performCompleteSearch(config: SearchConfig): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    const keywords = this.generateSearchKeywords(config.brandName);
    
    console.log(`Iniciando busca para ${config.brandName} com ${keywords.length} keywords...`);
    
    for (const keyword of keywords.slice(0, 20)) { // Limita a 20 keywords iniciais
      try {
        console.log(`Buscando: ${keyword}`);
        
        // Busca paralela em múltiplas fontes
        const [googleResults, serperResults, adultResults] = await Promise.allSettled([
          this.searchGoogle(keyword, config),
          this.searchSerper(keyword, config),
          this.searchAdultSites(keyword, config)
        ]);
        
        // Coleta resultados bem-sucedidos
        if (googleResults.status === 'fulfilled') {
          allResults.push(...googleResults.value);
        }
        if (serperResults.status === 'fulfilled') {
          allResults.push(...serperResults.value);
        }
        if (adultResults.status === 'fulfilled') {
          allResults.push(...adultResults.value);
        }
        
        // Rate limiting
        await this.delay(500);
        
      } catch (error) {
        console.error(`Erro buscando keyword ${keyword}:`, error);
        continue;
      }
    }
    
    // Remove duplicatas e ordena por confiança
    const uniqueResults = this.removeDuplicates(allResults);
    const filteredResults = this.filterResults(uniqueResults, config);
    
    return filteredResults
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, config.maxResults);
  }

  // Helpers
  private buildSearchQuery(keyword: string, config: SearchConfig): string {
    let query = `"${keyword}"`;
    
    // Adiciona termos de contexto
    query += ' (vazado OR leaked OR onlyfans OR premium OR private)';
    
    // Exclui domínios da whitelist
    if (config.excludeDomains.length > 0) {
      const excludeQuery = config.excludeDomains.map(domain => `-site:${domain}`).join(' ');
      query += ` ${excludeQuery}`;
    }
    
    return query;
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
    if (ADULT_LEAK_SITES.some(site => domain.includes(site))) return 'Adult/Leak Site';
    
    return 'Other';
  }

  private calculateConfidence(item: any, keyword: string, brandName: string): number {
    let confidence = 50; // Base confidence
    
    const title = (item.title || '').toLowerCase();
    const snippet = (item.snippet || '').toLowerCase();
    const url = (item.link || '').toLowerCase();
    
    // Aumenta confiança se o nome da marca aparece no título
    if (title.includes(brandName.toLowerCase())) confidence += 30;
    
    // Aumenta se aparecer termos de vazamento
    const leakTermsFound = LEAK_TERMS.filter(term => 
      title.includes(term) || snippet.includes(term) || url.includes(term)
    );
    confidence += leakTermsFound.length * 10;
    
    // Reduz se for site oficial/whitelist
    if (url.includes('onlyfans.com') && !url.includes('leaked')) confidence -= 20;
    
    // Aumenta para sites conhecidos de vazamento
    if (ADULT_LEAK_SITES.some(site => url.includes(site))) confidence += 25;
    
    return Math.min(Math.max(confidence, 0), 100);
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

export default SearchEngineService;
