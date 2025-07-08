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

// DEPRECATED: Lista de sites movida para banco de dados
// Use KnownSitesService.getInstance().getLeakSites() para obter sites do banco
// Esta lista será removida em versão futura
const ADULT_LEAK_SITES_DEPRECATED = [
  // Sites de vazamentos e adultos principais
  '16honeys.com', '18dreams.net', '1bigclub.com', '24xxx.porn', '3gpkings.info',
  '4fappers99.com', '4ksex.me', '6bangs.com', '6dude.com', '82xnxx.com',
  '8xxx.net', '94i5.com', 'adultepic.com', 'allporn123.com', 'alohatube.icu',
  'analsee.com', 'anyxxx.me', 'arabx.cam', 'asstoo.com', 'badwap.icu',
  'bang14.com', 'bangtubevideos.com', 'beeg.porn', 'beegsex.tv', 'befuck.net',
  'bestpornstars.tv', 'bigtitslust.com', 'bitchesgirls-leaks.com', 'bokepxsex.com',
  'bravotube.tv', 'bucetaflix.com', 'bucetaprime.com', 'bucetas.blog',
  'buceteiro.blog', 'buceteiro.com', 'bucitana.com', 'bunkrr.su',
  'cambro.io', 'cambro.today', 'cambro.tv', 'camhoes.tv', 'camlovers.tv',
  'camporn.to', 'camstreams.tv', 'camvideos.org', 'camwhores.biz',
  'camwhores.camera', 'camwhores.com.co', 'camwhores.company', 'camwhores.cool',
  'camwhores.dance', 'camwhores.digital', 'camwhores.film', 'camwhores.in',
  'camwhores.lol', 'camwhores.love', 'camwhores.media', 'camwhores.porn',
  'camwhores.rip', 'camwhores.run', 'camwhores.tips', 'camwhores.tube',
  'camwhores.tv', 'camwhores.us.com', 'camwhores.video', 'camwhores.works',
  'camwhores3.tv', 'camwhores4you.com', 'camwhores5.tv', 'camwhores6.com',
  'camwhores7.com', 'camwhores8.tv', 'camwhores9.com', 'camwhoresbay.net',
  'camwhoresbay.porn', 'camwhorescloud.com', 'camwhorescloud.tv', 'camwhoreshd.com',
  'camwhorez.net', 'camwhorez.tv', 'capetinhas.blog', 'celebexposed.com',
  'chewana.com', 'chupatube.info', 'cinepornogratis.com', 'clipf.com',
  'cloudzsexy.com', 'clubeadulto.net', 'cnnamador.com', 'coedcherry.xyz',
  'coolsexnew.com', 'coomer.su', 'coomer.party', 'daftsex-hd.com',
  'dailyfans.net', 'daleporno.com', 'deltaporno.com', 'dfusporn.net',
  'ditnhau.org', 'ditnhauvietnam.com', 'donpornovideos.com', 'dporn.com',
  'eachporn.com', 'eathotgirls.com', 'eporner.com', 'ero.one', 'erofound.com',
  'erome-leaks.com', 'erome.com', 'erome.fan', 'erome.pics', 'erome.vip',
  'eromeporn.com', 'eromeporno.com', 'eromexxx.com', 'erorox.com', 'eros.ws',
  'erothots.co', 'erothots1.com', 'excluziveporno.com', 'facebook.com',
  'fairporn.net', 'famapop.com.br', 'famosas.vip', 'famosasnuas.blog',
  'famosasnuas.blog.br', 'fansviewer.net', 'fap18.net', 'fap666.com',
  'fapachi.com', 'fapellino.com', 'fapello-leaks.com', 'fapello.com',
  'fapello.pics', 'fapello.ru', 'fapexy.com', 'fapeza.com', 'fapezy.com',
  'fapjerks.com', 'fapmenu.com', 'fapodrop.com', 'fapoleaks.com',
  'fapomania.com', 'faponic.com', 'fapopedia.net', 'fappeningbook.com',
  'fappy.com', 'faps.club', 'fapster.xxx', 'fastpic.org', 'fazersexo.com',
  'fboom.me', 'filefox.cc', 'filejoker.net', 'filesor.com', 'filmesporno.xxx',
  'findhername.net', 'foxporn.me', 'foxporns.net', 'fpo.xxx', 'freefans.co',
  'fuck6teen.com', 'fuckble.com', 'fucks.pics', 'fulldp.co', 'fusker.xxx',
  'gataslindas.com', 'genaporn.com', 'gesek.info', 'gesek.net', 'gofucker.net',
  'gostosavip.com', 'got.sex', 'groupda.com', 'groupsor.me', 'grrlstar.net',
  'guapamag.com', 'hardcore.zone', 'hdfreeporn.net', 'hdporn.pics',
  'hdpornmax.net', 'hdsex.pro', 'hdxxxx.org', 'hdzog.com', 'hentai2.net',
  'hentaipicshub.com', 'hentaixyz.com', 'hib6.com', 'hidefporn.ws',
  'hifiporn.fun', 'holed5k.com', 'homewhores.net', 'hotmovs.com',
  'hotmovs.net', 'hotwap.net', 'hotxv.com', 'hotzxgirl.com', 'ilovnudes.com',
  'imagetwist.com', 'imagexport.com', 'imgbox.com', 'imginn.com',
  'imguol.com.br', 'imx.to', 'influencersgonewild.io.vn', 'instagram.com',
  'integralporn.com', 'iporntv.net', 'joporn.me', 'josporn.com',
  'joyporn.me', 'jukkyyy.com', 'jusbrasil.com.br', 'k2s.cc', 'k2sporn.com',
  'kabinedasnovinhas.com', 'katfile.com', 'kwai.com', 'kwai.net',
  'leaked-of.com', 'leakedall.com', 'leakedfan.com', 'leakedmodels.com',
  'leakedofan.com', 'leakedonlyf.com', 'leakhub.vip', 'leakofans.com',
  'leaks4fap.com', 'leaksio.com', 'leakxxx.com', 'lechetube.com',
  'letmejerk.com', 'loboclick.com', 'lontv.cc', 'lordfans.com',
  'lumendatabase.org', 'manyvidsporn.com', 'masterfap.net', 'meiahora.com.br',
  'midiasexl.com', 'modeladdicts.com', 'modelsporn.org', 'modernpornhd.com',
  'mofosex.net', 'mouthporn.net', 'mp4porn.space', 'muy-porno.com',
  'myadultvideo.net', 'myfreeblack.com', 'mypornvid.fun', 'myxxgirl.com',
  'myxxgirlz.com', 'nacionalporno.com', 'netporn.net', 'nhentai.life',
  'niceporn.me', 'niceporn.tv', 'ninfomaniacas.blog', 'nitroflare-porn.com',
  'novinhas.blog', 'nsfw.xxx', 'nsfw247.to', 'nudegirls.wiki',
  'nudepussy.live', 'nudes.wiki', 'nudes.ws', 'nudevista.be',
  'nudevista.com', 'nudevista.net', 'nudogram.com', 'nudogramtop.com',
  'nudostar.com', 'nudostar.tv', 'nudostartop.info', 'ogfap.com',
  'ohmybabes.com', 'onlinehdtube.com', 'only2leaked.co', 'only2leaked.com',
  'onlyfanspacks.com', 'onlyofleaks.com', 'onlyporn123.com', 'onlyselects.com',
  'onlytreon.com', 'ouropretoonline.com', 'pastelink.net', 'peekvids.com',
  'phimsexchill.com', 'picazor.com', 'picstate.com', 'pictoa.com',
  'pimpandhost.com', 'pinterest.com', 'pixhost.to', 'pixwox.com',
  'pocket-girls.com', 'poringa.net', 'porn100.tv', 'porn7.net',
  'porn800.me', 'pornbb.org', 'porndude-leaks.com', 'porndude.me',
  'pornfactory.info', 'porngo.xxx', 'pornhat.tv', 'pornholder.net',
  'pornhub-pics.com', 'pornjk.com', 'pornleaks.top', 'pornmaster.fun',
  'pornocarioca.com', 'pornocaseiros.com', 'pornogramxxx.com',
  'pornogratisbrasil.com', 'pornomineiro.com', 'pornone.com',
  'pornoonline.com.br', 'pornoperso.com', 'pornoprivado.com',
  'pornotarado.com', 'pornouploads.com', 'pornox.me', 'pornozinho.xxx',
  'pornozorras.com', 'pornpic.xxx', 'pornpics.click', 'pornploy.com',
  'pornproxy.app', 'pornproxy.cc', 'pornproxysite.com', 'pornrancho.com',
  'pornsam.me', 'pornseek123.com', 'pornseek6.com', 'pornsite123.com',
  'pornstream.org', 'pornteen123.com', 'porntrex.com', 'porntrex.video',
  'pornzog.com', 'porzo.tv', 'princess.onl', 'privatehd.org',
  'proxyadult.org', 'proxyporn.org', 'publicsexshow.com', 'publicshot.com',
  'punheteiro.net', 'punheteiro.org', 'purfectpussy.sex', 'pussyspace.com',
  'pussyspace.net', 'putarianocelular.com', 'putaxvideos.com',
  'rapidgator.net', 'rapidgatorporn.net', 'redd.tube', 'reddit.com',
  'reddit.tube', 'reddxxx.com', 'redeancoraxp.com.br', 'redgifs.com',
  'redporn.tv', 'redwap-xxx.com', 'redwap.today', 'redwap.tv',
  'redxxx.cc', 'rexxx.com', 'rioporno.blog', 'rtxporn.com', 'rusoska.com',
  'scrolller.com', 'serv00.net', 'sex103.com', 'sexalarab.com',
  'sexiezpix.com', 'sexnhanh.co', 'sexo.zone', 'sexoro.com',
  'sexporn.com.br', 'sexpornpictures.com', 'sexstalk.com', 'sexto.mobi',
  'sexy6tube.com', 'sexyforums.com', 'sexynudes.tv', 'sexysluts.tv',
  'shemale6.com', 'shemaleleaks.com', 'shufflesex.com', 'simpcity.su',
  'simpcity.tv', 'singlelogin.re', 'siteripz.cc', 'smutty.com',
  'socialmediagirls.com', 'sonovinhasbr.com', 'sortporn.com', 'soundsip.com',
  'spankbang.com', 'spankbang.party', 'spankbang1.com', 'spanknang.net',
  'squidit.com.br', 't.me', 'teenager365.to', 'telegra.ph', 'tezfiles.com',
  'thefap.net', 'thefap.org', 'thefaponic.com', 'thefappening.one',
  'thefappening.plus', 'thefappening2015.com', 'thefappeningblog.com',
  'thegirlgirl.com', 'theporn.how', 'thepornpic.com', 'thepornpicture.com',
  'thethothub.com', 'thothd.com', 'thothd.org', 'thothd.to', 'thothub.ch',
  'thothub.is', 'thothub.lol', 'thothub.mx', 'thothub.org', 'thothub.su',
  'thothub.to', 'thothub.vip', 'thotsbay-leaked.com', 'thotsfan.com',
  'thotslife-leaks.com', 'thudam.pro', 'titfap.com', 'tnaflix.com',
  'topfapgirls.com', 'topfapgirls.tv', 'topfapgirls1.com', 'topfapgirlspics.com',
  'topfaps.com', 'tporn.xxx', 'trahkino.cc', 'trahkino.me', 'trueanal.org',
  'tub.tv', 'tubegalore.tv', 'tudoputa.online', 'tumblr.com', 'tushy4k.org',
  'twpornstars.com', 'uol.com.br', 'urlgalleries.net', 'vamadoras.com',
  'vazouaqui.com', 'vazounudes.com', 'vazounudes.net', 'vervesex.com',
  'vervideosengracados.com.br', 'videosacana.com.br', 'videosdesexo.xxx',
  'videosxxx.com.br', 'vietsex.me', 'vimeo.com', 'vipr.im', 'viptube.com',
  'viralpornhub.com', 'viralpornhub.tv', 'viralxxxporn.com', 'vlixa.com',
  'wapbold.com', 'wapbold.net', 'watch-porn.net', 'wetholefans.com',
  'wetpassions.com', 'wildskirts.co.uk', 'wildskirts.com', 'wildskirts.net',
  'wildskirts.su', 'woodmancx.com', 'wp.com', 'x-video.tube',
  'x-x-x.tube', 'x-x-x.video', 'xbunker.nu', 'xfantazy.com', 'xfree.com',
  'xgif.cc', 'xhaccess.com', 'xhamster.com', 'xhdporno.porn', 'xhopen.com',
  'xhtotal.com', 'xnjav.com', 'xnxx-cdn.com', 'xnxx.health', 'xnxx2.org',
  'xnxx3.com', 'xnxx36.com', 'xnxx4porn.com', 'xpics.me', 'xredwap.com',
  'xshaker.net', 'xvideos-br.com', 'xvideos-hd.com', 'xvideos-xxxx.com',
  'xvideos.blog.br', 'xvideos.com', 'xvideos2.uk', 'xvideos9.com',
  'xvideosbr.to', 'xvideoshq.com', 'xvideosincesto.com', 'xvideosonlyfans.com',
  'xvideosporno.blog', 'xvideospornobr.net', 'xvideospornoxnxx.com',
  'xvideosputaria.com', 'xvideosrei.com', 'xvidio.blog', 'xvidios.xxx',
  'xxbrits.com', 'xxfind24.com', 'xxvideos.cc', 'xxx69tube.com',
  'xxxbullet.com', 'xxxculonas.com', 'xxxgirls88.com', 'xxxhub123.com',
  'xxxi.porn', 'xxxmom.net', 'xxxporn123.com', 'xxxvideo.blog',
  'xxxvideo.blog.br', 'xxxvideo.name', 'xxxxvideo.uno', 'yandex.com.tr',
  'youjizz.sex', 'zenporn.com', 'zproxy.org', 'zzup.com'
];

// Lista completa de termos de vazamento em PT e EN
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

export class SearchEngineService {
  private serperApiKey?: string;
  private googleApiKey?: string;
  private googleCseId?: string;
  private environment: string;

  constructor() {
    this.serperApiKey = process.env.SERPER_API_KEY;
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleCseId = process.env.GOOGLE_CSE_ID;
    this.environment = process.env.NODE_ENV || 'development';
    
    // Verificar configuração
    const isProduction = this.environment === 'production';
    const hasSearchAPIs = !!(this.serperApiKey || this.googleApiKey);
    
    // Logs de configuração
    console.log(`🌍 Ambiente: ${this.environment}`);
    console.log(`🔍 SearchEngineService configurado:`);
    console.log(`   - Serper API: ${this.serperApiKey ? '✅ Configurada' : '❌ Não configurada'}`);
    console.log(`   - Google API: ${this.googleApiKey ? '✅ Configurada' : '❌ Não configurada'}`);
    
    // Em produção, pelo menos uma API deve estar configurada
    if (isProduction && !hasSearchAPIs) {
      throw new Error(
        '❌ ERRO CRÍTICO: Nenhuma API de busca configurada em produção!\n' +
        'Configure SERPER_API_KEY ou GOOGLE_API_KEY nas variáveis de ambiente.\n' +
        'O sistema NÃO pode funcionar sem APIs de busca real.'
      );
    }
    
    if (!hasSearchAPIs) {
      console.warn('⚠️  AVISO: Nenhuma API de busca configurada em desenvolvimento.');
      console.warn('⚠️  Configure Serper ou Google API para buscar conteúdo real.');
    }
  }

  // Gera keywords inteligentes baseadas no nome da marca OU usa keywords seguras do perfil
  generateSearchKeywords(brandName: string, safeKeywords?: string[]): string[] {
    // Se existem keywords seguras, usa elas + algumas variações básicas
    if (safeKeywords && safeKeywords.length > 0) {
      const keywords = [...safeKeywords];
      
      // Adiciona combinações com termos de vazamento para keywords seguras
      const basicLeakTerms = ['leaked', 'vazado', 'onlyfans'];
      safeKeywords.forEach(keyword => {
        basicLeakTerms.forEach(term => {
          keywords.push(`${keyword} ${term}`);
          keywords.push(`"${keyword}" ${term}`);
        });
      });
      
      console.log(`🔐 Usando ${safeKeywords.length} keywords seguras do perfil`);
      return Array.from(new Set(keywords)).slice(0, 50); // Limita a 50
    }
    
    // Fallback: gera keywords automaticamente (método antigo)
    console.log(`⚠️ Gerando keywords automaticamente para '${brandName}' (recomendado: usar keywords seguras)`);
    
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
    
    return Array.from(new Set(keywords)); // Remove duplicatas
  }

  // Busca no Google usando Custom Search API
  async searchGoogle(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    if (!this.googleApiKey || !this.googleCseId) {
      console.log('📵 Google API não configurada, pulando busca Google');
      return [];
    }

    try {
      const query = this.buildSearchQuery(keyword, config);
      console.log(`🔍 Google Search: "${query}"`);
      
      const url = `https://www.googleapis.com/customsearch/v1?key=${this.googleApiKey}&cx=${this.googleCseId}&q=${encodeURIComponent(query)}&num=10`;
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000) // Timeout de 10s
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Google API erro HTTP ${response.status}: ${errorText}`);
        
        // Tratar erros específicos
        if (response.status === 429) {
          console.error('❌ Google API: Limite de taxa excedido (Rate Limit)');
        } else if (response.status === 403) {
          console.error('❌ Google API: Acesso negado - verifique suas credenciais');
        }
        
        return [];
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.log('⚠️  Google API: Nenhum resultado encontrado');
        return [];
      }
      
      console.log(`✅ Google API: ${data.items.length} resultados encontrados`);
      
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
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('❌ Google API: Timeout - requisição demorou muito');
        } else {
          console.error('❌ Google API erro:', error.message);
        }
      } else {
        console.error('❌ Google API erro desconhecido:', error);
      }
      return [];
    }
  }

  // Busca usando Serper API (alternativa robusta)
  async searchSerper(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    if (!this.serperApiKey) {
      console.log('📵 Serper API não configurada, pulando busca Serper');
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
          gl: 'br', // Brasil
          hl: 'pt' // Português
        }),
        signal: AbortSignal.timeout(15000) // Timeout de 15s
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Serper API erro HTTP ${response.status}: ${errorText}`);
        
        // Tratar erros específicos
        if (response.status === 429) {
          console.error('❌ Serper API: Limite de taxa excedido (Rate Limit)');
        } else if (response.status === 401) {
          console.error('❌ Serper API: API Key inválida - verifique SERPER_API_KEY');
        } else if (response.status === 403) {
          console.error('❌ Serper API: Acesso negado - verifique permissões da API Key');
        }
        
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
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('❌ Serper API: Timeout - requisição demorou muito');
        } else {
          console.error('❌ Serper API erro:', error.message);
        }
      } else {
        console.error('❌ Serper API erro desconhecido:', error);
      }
      return [];
    }
  }

  // Busca específica em sites prioritários
  async searchPrioritySites(keyword: string, config: SearchConfig): Promise<SearchResult[]> {
    // Lista reduzida de sites prioritários para busca direcionada
    const prioritySites = [
      'reddit.com', 'twitter.com', 'telegram.me', 'discord.gg',
      'mega.nz', 'pornhub.com', 'xvideos.com', 'erome.com',
      'fapello.com', 'coomer.party', 'kemono.party', 'bunkr.ru'
    ];
    
    const results: SearchResult[] = [];
    
    for (const site of prioritySites) {
      try {
        // Busca site-específica
        const siteQuery = `site:${site} "${config.brandName}"`;
        
        // Usa Serper para buscar em sites específicos
        const siteResults = await this.searchSerper(siteQuery, config);
        results.push(...siteResults);
        
        // Rate limiting para evitar sobrecarga
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
    const apiErrors: string[] = [];
    
    // Usar a keyword específica que veio do config (já processada no route)
    const keyword = config.keyword;
    console.log(`🔍 Buscando keyword específica: "${keyword}"`);
    
    try {
      // Busca paralela em múltiplas fontes para esta keyword específica
      const [googleResults, serperResults, priorityResults] = await Promise.allSettled([
        this.searchGoogle(keyword, config),
        this.searchSerper(keyword, config),
        this.searchPrioritySites(keyword, config)
      ]);
      
      // Coleta resultados bem-sucedidos e registra falhas
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
      
      if (this.environment === 'production') {
        console.error('❌ Em produção: retornando array vazio. Verifique as APIs.');
        // TODO: Implementar notificação para admin sobre falha das APIs
      } else {
        console.warn('⚠️  Em desenvolvimento: configure as APIs corretamente.');
      }
      
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
    // Usar a keyword EXATAMENTE como configurada (sem adicionar termos extras)
    // As keywords seguras já incluem termos como "nome vazado", "nome leaked", etc.
    let query = keyword;
    
    // Apenas excluir domínios essenciais
    const essentialExcludes = ['onlyfans.com'];
    essentialExcludes.forEach(domain => {
      query += ` -site:${domain}`;
    });
    
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
    // TODO: Substituir por verificação no banco via KnownSitesService
    if (ADULT_LEAK_SITES_DEPRECATED.some(site => domain.includes(site))) return 'Adult/Leak Site';
    
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
    // TODO: Substituir por verificação no banco via KnownSitesService
    if (ADULT_LEAK_SITES_DEPRECATED.some(site => url.includes(site))) confidence += 25;
    
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
