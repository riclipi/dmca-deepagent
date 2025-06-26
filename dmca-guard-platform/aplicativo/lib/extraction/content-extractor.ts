import { JSDOM } from 'jsdom'
import fetch from 'node-fetch'

export interface ExtractedContent {
  url: string
  title: string
  description: string
  bodyText: string
  images: string[]
  links: string[]
  metadata: {
    canonical?: string
    robots?: string
    lang?: string
    charset?: string
    lastModified?: string
    contentType?: string
  }
  structuralElements?: StructuralElement[]
  rawHtml?: string
}

export interface StructuralElement {
  type: string
  content: string
  attributes?: Record<string, string>
  position: number
}

export interface ExtractionOptions {
  includeImages?: boolean
  includeLinks?: boolean
  includeRawHtml?: boolean
  maxContentLength?: number
  timeout?: number
  userAgent?: string
  followRedirects?: boolean
}

export class ContentExtractor {
  private defaultOptions: ExtractionOptions = {
    includeImages: true,
    includeLinks: true,
    includeRawHtml: false,
    maxContentLength: 50000,
    timeout: 15000,
    userAgent: 'Mozilla/5.0 (compatible; DMCA-Guard/1.0; +https://dmca-guard.com/bot)',
    followRedirects: true
  }

  constructor(private options?: Partial<ExtractionOptions>) {
    this.options = { ...this.defaultOptions, ...options }
  }

  /**
   * Extrair conteúdo completo de uma URL
   */
  async extractContent(url: string, customOptions?: Partial<ExtractionOptions>): Promise<ExtractedContent> {
    const extractionOptions = { ...this.options, ...customOptions }
    
    try {
      console.log(`Extraindo conteúdo de: ${url}`)
      
      // Fazer requisição HTTP
      const response = await this.fetchPage(url, extractionOptions)
      const html = await response.text()
      
      // Parse HTML com JSDOM
      const dom = new JSDOM(html, {
        url: url,
        referrer: url,
        contentType: "text/html",
        includeNodeLocations: false,
        storageQuota: 10000000
      })
      
      const document = dom.window.document
      
      // Extrair elementos básicos
      const title = this.extractTitle(document)
      const description = this.extractDescription(document)
      const bodyText = this.extractBodyText(document, extractionOptions.maxContentLength!)
      const metadata = this.extractMetadata(document, response)
      
      // Extrair elementos opcionais
      const images = extractionOptions.includeImages ? this.extractImages(document, url) : []
      const links = extractionOptions.includeLinks ? this.extractLinks(document, url) : []
      const structuralElements = this.extractStructuralElements(document)
      
      const extractedContent: ExtractedContent = {
        url,
        title,
        description,
        bodyText,
        images,
        links,
        metadata,
        structuralElements
      }
      
      // Incluir HTML raw se solicitado
      if (extractionOptions.includeRawHtml) {
        extractedContent.rawHtml = html
      }
      
      console.log(`Conteúdo extraído: ${bodyText.length} chars, ${images.length} imagens, ${links.length} links`)
      
      return extractedContent
      
    } catch (error) {
      console.error(`Erro ao extrair conteúdo de ${url}:`, error)
      
      // Retornar conteúdo mínimo em caso de erro
      return {
        url,
        title: '',
        description: '',
        bodyText: '',
        images: [],
        links: [],
        metadata: {},
        structuralElements: []
      }
    }
  }

  /**
   * Fazer requisição HTTP para a página
   */
  private async fetchPage(url: string, options: ExtractionOptions): Promise<any> {
    const fetchOptions = {
      method: 'GET',
      headers: {
        'User-Agent': options.userAgent!,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: options.timeout!,
      redirect: options.followRedirects ? 'follow' : 'manual',
      size: options.maxContentLength! * 2 // Limite dobrado para HTML raw
    }
    
    const response = await fetch(url, fetchOptions as any)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return response
  }

  /**
   * Extrair título da página
   */
  private extractTitle(document: Document): string {
    // Prioridade: title tag > og:title > h1 > fallback
    
    const titleTag = document.querySelector('title')
    if (titleTag?.textContent?.trim()) {
      return titleTag.textContent.trim()
    }
    
    const ogTitle = document.querySelector('meta[property="og:title"]')
    if (ogTitle?.getAttribute('content')?.trim()) {
      return ogTitle.getAttribute('content')!.trim()
    }
    
    const h1 = document.querySelector('h1')
    if (h1?.textContent?.trim()) {
      return h1.textContent.trim()
    }
    
    return 'Sem título'
  }

  /**
   * Extrair descrição da página
   */
  private extractDescription(document: Document): string {
    // Prioridade: meta description > og:description > primeiro parágrafo
    
    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc?.getAttribute('content')?.trim()) {
      return metaDesc.getAttribute('content')!.trim()
    }
    
    const ogDesc = document.querySelector('meta[property="og:description"]')
    if (ogDesc?.getAttribute('content')?.trim()) {
      return ogDesc.getAttribute('content')!.trim()
    }
    
    const firstParagraph = document.querySelector('p')
    if (firstParagraph?.textContent?.trim()) {
      const text = firstParagraph.textContent.trim()
      return text.length > 200 ? text.substring(0, 200) + '...' : text
    }
    
    return 'Sem descrição'
  }

  /**
   * Extrair texto do corpo da página
   */
  private extractBodyText(document: Document, maxLength: number): string {
    // Remover elementos desnecessários
    this.removeUnwantedElements(document)
    
    // Extrair texto do body
    const body = document.body || document.documentElement
    let text = this.extractTextContent(body)
    
    // Limpar e normalizar texto
    text = this.cleanText(text)
    
    // Limitar tamanho
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...'
    }
    
    return text
  }

  /**
   * Remover elementos desnecessários para extração de texto
   */
  private removeUnwantedElements(document: Document): void {
    const unwantedSelectors = [
      'script', 'style', 'noscript', 'iframe', 'object', 'embed',
      'nav', 'header', 'footer', 'aside', '.advertisement', '.ad',
      '.sidebar', '.menu', '.navigation', '.comments', '.comment',
      '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
    ]
    
    unwantedSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector)
      elements.forEach(element => element.remove())
    })
  }

  /**
   * Extrair texto de um elemento de forma recursiva
   */
  private extractTextContent(element: Element): string {
    let text = ''
    
    for (const node of element.childNodes) {
      if (node.nodeType === 3) { // Text node
        text += node.textContent || ''
      } else if (node.nodeType === 1) { // Element node
        const el = node as Element
        
        // Adicionar quebras de linha para elementos de bloco
        if (this.isBlockElement(el.tagName.toLowerCase())) {
          text += '\n'
        }
        
        text += this.extractTextContent(el)
        
        if (this.isBlockElement(el.tagName.toLowerCase())) {
          text += '\n'
        }
      }
    }
    
    return text
  }

  /**
   * Verificar se é elemento de bloco
   */
  private isBlockElement(tagName: string): boolean {
    const blockElements = [
      'div', 'p', 'section', 'article', 'aside', 'main', 'header', 'footer',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'ul', 'ol', 'li',
      'table', 'tr', 'td', 'th', 'form', 'fieldset', 'address', 'hr', 'br'
    ]
    
    return blockElements.includes(tagName)
  }

  /**
   * Limpar e normalizar texto
   */
  private cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Múltiplos espaços em branco
      .replace(/\n\s+/g, '\n') // Espaços após quebras de linha
      .replace(/\n+/g, '\n') // Múltiplas quebras de linha
      .trim()
  }

  /**
   * Extrair imagens da página
   */
  private extractImages(document: Document, baseUrl: string): string[] {
    const images: string[] = []
    const imageElements = document.querySelectorAll('img')
    
    imageElements.forEach(img => {
      const src = img.getAttribute('src')
      if (src) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href
          if (this.isValidImageUrl(absoluteUrl)) {
            images.push(absoluteUrl)
          }
        } catch (error) {
          console.warn(`URL de imagem inválida: ${src}`)
        }
      }
    })
    
    // Também extrair de backgrounds CSS se possível
    const elementsWithBg = document.querySelectorAll('[style*="background"]')
    elementsWithBg.forEach(el => {
      const style = el.getAttribute('style') || ''
      const bgMatch = style.match(/background-image:\s*url\(['"]?([^'"]+)['"]?\)/)
      if (bgMatch) {
        try {
          const absoluteUrl = new URL(bgMatch[1], baseUrl).href
          if (this.isValidImageUrl(absoluteUrl)) {
            images.push(absoluteUrl)
          }
        } catch (error) {
          console.warn(`URL de background inválida: ${bgMatch[1]}`)
        }
      }
    })
    
    // Remover duplicatas
    return [...new Set(images)]
  }

  /**
   * Verificar se URL é de imagem válida
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      const path = urlObj.pathname.toLowerCase()
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp']
      
      return imageExtensions.some(ext => path.endsWith(ext)) ||
             urlObj.hostname.includes('image') ||
             urlObj.hostname.includes('img') ||
             path.includes('/image') ||
             path.includes('/img')
    } catch {
      return false
    }
  }

  /**
   * Extrair links da página
   */
  private extractLinks(document: Document, baseUrl: string): string[] {
    const links: string[] = []
    const linkElements = document.querySelectorAll('a[href]')
    
    linkElements.forEach(link => {
      const href = link.getAttribute('href')
      if (href && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href
          links.push(absoluteUrl)
        } catch (error) {
          console.warn(`URL de link inválida: ${href}`)
        }
      }
    })
    
    // Remover duplicatas
    return [...new Set(links)]
  }

  /**
   * Extrair metadados da página
   */
  private extractMetadata(document: Document, response: any): ExtractedContent['metadata'] {
    const metadata: ExtractedContent['metadata'] = {}
    
    // Meta tags básicas
    const canonical = document.querySelector('link[rel="canonical"]')
    if (canonical) {
      metadata.canonical = canonical.getAttribute('href') || undefined
    }
    
    const robots = document.querySelector('meta[name="robots"]')
    if (robots) {
      metadata.robots = robots.getAttribute('content') || undefined
    }
    
    const lang = document.documentElement.getAttribute('lang')
    if (lang) {
      metadata.lang = lang
    }
    
    const charset = document.querySelector('meta[charset]')
    if (charset) {
      metadata.charset = charset.getAttribute('charset') || undefined
    }
    
    // Headers da resposta HTTP
    if (response.headers) {
      metadata.contentType = response.headers.get('content-type') || undefined
      metadata.lastModified = response.headers.get('last-modified') || undefined
    }
    
    return metadata
  }

  /**
   * Extrair elementos estruturais suspeitos
   */
  private extractStructuralElements(document: Document): StructuralElement[] {
    const elements: StructuralElement[] = []
    let position = 0
    
    // Formulários de download
    const forms = document.querySelectorAll('form')
    forms.forEach(form => {
      const action = form.getAttribute('action') || ''
      const method = form.getAttribute('method') || ''
      
      if (action.toLowerCase().includes('download') || 
          form.textContent?.toLowerCase().includes('download')) {
        elements.push({
          type: 'download_form',
          content: form.textContent?.substring(0, 200) || '',
          attributes: { action, method },
          position: position++
        })
      }
    })
    
    // Botões suspeitos
    const buttons = document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn, .button')
    buttons.forEach(button => {
      const text = button.textContent?.toLowerCase() || ''
      const suspicious = ['download', 'free', 'premium', 'unlock', 'access', 'leaked']
      
      if (suspicious.some(word => text.includes(word))) {
        elements.push({
          type: 'suspicious_button',
          content: button.textContent?.substring(0, 100) || '',
          attributes: {
            class: button.getAttribute('class') || '',
            id: button.getAttribute('id') || ''
          },
          position: position++
        })
      }
    })
    
    // Links de compartilhamento
    const shareLinks = document.querySelectorAll('a[href]')
    shareLinks.forEach(link => {
      const href = link.getAttribute('href') || ''
      const text = link.textContent?.toLowerCase() || ''
      const shareServices = ['mega.nz', 'drive.google', 'dropbox', 'telegram', 'discord', 'mediafire']
      
      if (shareServices.some(service => href.includes(service) || text.includes(service))) {
        elements.push({
          type: 'share_link',
          content: `${text} -> ${href}`.substring(0, 200),
          attributes: { href },
          position: position++
        })
      }
    })
    
    return elements
  }

  /**
   * Extrair apenas texto de uma URL (método simplificado)
   */
  async extractTextOnly(url: string): Promise<string> {
    try {
      const content = await this.extractContent(url, {
        includeImages: false,
        includeLinks: false,
        includeRawHtml: false,
        maxContentLength: 10000
      })
      
      return `${content.title}\n\n${content.description}\n\n${content.bodyText}`
    } catch (error) {
      console.error(`Erro ao extrair texto de ${url}:`, error)
      return ''
    }
  }

  /**
   * Verificar se URL é acessível
   */
  async checkUrlAccessibility(url: string): Promise<{
    accessible: boolean
    statusCode?: number
    contentType?: string
    error?: string
  }> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: { 'User-Agent': this.options?.userAgent || this.defaultOptions.userAgent! },
        timeout: 5000
      } as any)
      
      return {
        accessible: response.ok,
        statusCode: response.status,
        contentType: response.headers.get('content-type') || undefined
      }
    } catch (error) {
      return {
        accessible: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }
    }
  }

  /**
   * Extrair conteúdo de múltiplas URLs em paralelo
   */
  async extractMultiple(urls: string[], maxConcurrent: number = 3): Promise<ExtractedContent[]> {
    const results: ExtractedContent[] = []
    
    // Processar em lotes para evitar sobrecarga
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      const batch = urls.slice(i, i + maxConcurrent)
      
      const batchPromises = batch.map(url => 
        this.extractContent(url).catch(error => {
          console.error(`Erro ao extrair ${url}:`, error)
          return {
            url,
            title: '',
            description: '',
            bodyText: '',
            images: [],
            links: [],
            metadata: {},
            structuralElements: []
          }
        })
      )
      
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
      
      // Delay entre lotes
      if (i + maxConcurrent < urls.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    return results
  }
}
