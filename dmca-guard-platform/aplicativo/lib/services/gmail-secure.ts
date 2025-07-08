// lib/services/gmail-secure.ts - Versão segura do cliente Gmail com armazenamento no banco

import { google } from 'googleapis';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_CACHE_KEY = 'gmail:oauth:token';
const TOKEN_CACHE_TTL = 3500; // 58 minutos (token expira em 1h)

export interface GmailCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export class SecureGmailService {
  private static instance: SecureGmailService;
  
  private constructor() {}
  
  static getInstance(): SecureGmailService {
    if (!SecureGmailService.instance) {
      SecureGmailService.instance = new SecureGmailService();
    }
    return SecureGmailService.instance;
  }

  /**
   * Obter credenciais do Gmail das variáveis de ambiente
   */
  private getCredentials(): GmailCredentials {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/auth/gmail/callback';

    if (!clientId || !clientSecret) {
      throw new Error(
        'Gmail OAuth não configurado. Configure GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET nas variáveis de ambiente.'
      );
    }

    return {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri
    };
  }

  /**
   * Carregar token OAuth do banco de dados
   */
  private async loadTokenFromDatabase(userId: string): Promise<any | null> {
    try {
      // Primeiro tentar cache Redis
      const cachedToken = await redis.get(`${TOKEN_CACHE_KEY}:${userId}`);
      if (cachedToken) {
        return JSON.parse(cachedToken as string);
      }

      // Se não estiver no cache, buscar no banco
      const integration = await prisma.userIntegration.findFirst({
        where: {
          userId,
          provider: 'GMAIL',
          status: 'ACTIVE'
        }
      });

      if (!integration || !integration.accessToken) {
        return null;
      }

      const token = {
        access_token: integration.accessToken,
        refresh_token: integration.refreshToken,
        token_type: 'Bearer',
        expiry_date: integration.expiresAt?.getTime()
      };

      // Cachear o token
      await redis.set(
        `${TOKEN_CACHE_KEY}:${userId}`,
        JSON.stringify(token),
        TOKEN_CACHE_TTL
      );

      return token;
    } catch (error) {
      console.error('Erro ao carregar token do banco:', error);
      return null;
    }
  }

  /**
   * Salvar token OAuth no banco de dados
   */
  private async saveTokenToDatabase(userId: string, token: any): Promise<void> {
    try {
      const expiresAt = token.expiry_date ? new Date(token.expiry_date) : null;

      await prisma.userIntegration.upsert({
        where: {
          userId_provider: {
            userId,
            provider: 'GMAIL'
          }
        },
        update: {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt,
          status: 'ACTIVE',
          lastSyncAt: new Date()
        },
        create: {
          userId,
          provider: 'GMAIL',
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt,
          status: 'ACTIVE'
        }
      });

      // Atualizar cache
      await redis.set(
        `${TOKEN_CACHE_KEY}:${userId}`,
        JSON.stringify(token),
        TOKEN_CACHE_TTL
      );
    } catch (error) {
      console.error('Erro ao salvar token no banco:', error);
      throw error;
    }
  }

  /**
   * Criar cliente OAuth2 autenticado
   */
  async getAuthenticatedClient(userId: string) {
    const credentials = this.getCredentials();
    
    const oAuth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );

    const token = await this.loadTokenFromDatabase(userId);
    
    if (!token) {
      throw new Error('Usuário não autenticado com Gmail. Faça a autenticação primeiro.');
    }

    oAuth2Client.setCredentials(token);

    // Configurar listener para atualizar token quando for renovado
    oAuth2Client.on('tokens', async (tokens) => {
      try {
        // Mesclar com token existente (preservar refresh_token se não vier novo)
        const updatedToken = {
          ...token,
          access_token: tokens.access_token || token.access_token,
          refresh_token: tokens.refresh_token || token.refresh_token,
          expiry_date: tokens.expiry_date || token.expiry_date
        };
        
        await this.saveTokenToDatabase(userId, updatedToken);
      } catch (error) {
        console.error('Erro ao atualizar token:', error);
      }
    });

    // Verificar se token está expirado e tentar renovar
    if (token.expiry_date && token.expiry_date < Date.now()) {
      try {
        const { credentials: newTokens } = await oAuth2Client.refreshAccessToken();
        await this.saveTokenToDatabase(userId, newTokens);
        oAuth2Client.setCredentials(newTokens);
      } catch (error) {
        console.error('Erro ao renovar token:', error);
        throw new Error('Token expirado e não foi possível renovar. Faça login novamente.');
      }
    }

    return oAuth2Client;
  }

  /**
   * Gerar URL de autenticação OAuth
   */
  generateAuthUrl(state?: string): string {
    const credentials = this.getCredentials();
    
    const oAuth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );

    return oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state
    });
  }

  /**
   * Trocar código de autorização por token
   */
  async exchangeCodeForToken(code: string): Promise<any> {
    const credentials = this.getCredentials();
    
    const oAuth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uri
    );

    const { tokens } = await oAuth2Client.getToken(code);
    return tokens;
  }

  /**
   * Buscar alertas do Google Alerts
   */
  async fetchGoogleAlerts(userId: string, options?: {
    maxResults?: number;
    daysBack?: number;
  }) {
    try {
      const auth = await this.getAuthenticatedClient(userId);
      const gmail = google.gmail({ version: 'v1', auth });

      const daysBack = options?.daysBack || 7;
      const maxResults = options?.maxResults || 20;

      // Buscar mensagens do Google Alerts
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: `from:googlealerts-noreply@google.com newer_than:${daysBack}d`,
        maxResults
      });

      const messages = response.data.messages || [];
      const alerts = [];

      for (const message of messages) {
        try {
          const msgData = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!
          });

          const snippet = msgData.data.snippet || '';
          const payload = msgData.data.payload;
          
          // Extrair dados relevantes
          const alert = this.parseGoogleAlert(msgData.data);
          if (alert) {
            alerts.push(alert);
          }
        } catch (error) {
          console.error(`Erro ao processar mensagem ${message.id}:`, error);
        }
      }

      return alerts;
    } catch (error) {
      console.error('Erro ao buscar Google Alerts:', error);
      throw error;
    }
  }

  /**
   * Parse de alerta do Google com extração completa
   */
  private parseGoogleAlert(message: any) {
    try {
      const payload = message.payload;
      const headers = payload?.headers || [];
      
      // Extrair metadados do email
      const subjectHeader = headers.find((h: any) => h.name === 'Subject');
      const subject = subjectHeader?.value || '';
      
      const dateHeader = headers.find((h: any) => h.name === 'Date');
      const date = dateHeader ? new Date(dateHeader.value) : new Date();
      
      // Extrair corpo do email (suporta estruturas aninhadas)
      let bodyHtml = '';
      let bodyText = '';
      
      const extractBody = (part: any) => {
        if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          // Recursivamente processar partes aninhadas
          part.parts.forEach(extractBody);
        }
      };
      
      if (payload.parts) {
        payload.parts.forEach(extractBody);
      } else if (payload.body?.data) {
        // Email simples sem partes
        const content = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        if (payload.mimeType === 'text/html') {
          bodyHtml = content;
        } else {
          bodyText = content;
        }
      }

      // Extrair URLs com regex mais robusto
      const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi;
      const htmlUrls = bodyHtml.match(urlRegex) || [];
      const textUrls = bodyText.match(urlRegex) || [];
      const allUrls = [...new Set([...htmlUrls, ...textUrls])];
      
      // Filtrar e limpar URLs
      const relevantUrls = allUrls
        .map(url => {
          // Remover tracking parameters comuns
          try {
            const urlObj = new URL(url);
            // Remover parâmetros de tracking do Google
            ['utm_source', 'utm_medium', 'utm_campaign', 'ved', 'usg'].forEach(param => {
              urlObj.searchParams.delete(param);
            });
            return urlObj.toString();
          } catch {
            return url;
          }
        })
        .filter(url => {
          // Filtrar URLs do Google e outros irrelevantes
          const excludePatterns = [
            'google.com',
            'googleapis.com',
            'googleusercontent.com',
            'gstatic.com',
            'accounts.google',
            'myaccount.google',
            'alerts.google'
          ];
          return !excludePatterns.some(pattern => url.includes(pattern));
        });

      // Extrair palavras-chave do alerta
      const keywordMatch = subject.match(/Google Alert - (.+)/i);
      const alertKeyword = keywordMatch ? keywordMatch[1].trim() : '';

      return {
        id: message.id,
        subject,
        alertKeyword,
        date,
        snippet: message.snippet || bodyText.substring(0, 200),
        urls: relevantUrls,
        urlCount: relevantUrls.length,
        hasHtmlContent: !!bodyHtml,
        metadata: {
          threadId: message.threadId,
          labelIds: message.labelIds || []
        }
      };
    } catch (error) {
      console.error('Erro ao fazer parse do alerta:', error);
      return null;
    }
  }

  /**
   * Verificar status da integração
   */
  async checkIntegrationStatus(userId: string): Promise<{
    isConnected: boolean;
    lastSync?: Date;
    expiresAt?: Date;
  }> {
    const integration = await prisma.userIntegration.findFirst({
      where: {
        userId,
        provider: 'GMAIL',
        status: 'ACTIVE'
      }
    });

    return {
      isConnected: !!integration,
      lastSync: integration?.lastSyncAt || undefined,
      expiresAt: integration?.expiresAt || undefined
    };
  }

  /**
   * Desconectar integração
   */
  async disconnectIntegration(userId: string): Promise<void> {
    // Remover do banco
    await prisma.userIntegration.deleteMany({
      where: {
        userId,
        provider: 'GMAIL'
      }
    });

    // Limpar cache
    await redis.del(`${TOKEN_CACHE_KEY}:${userId}`);
  }
}

// Exportar instância singleton
export const gmailService = SecureGmailService.getInstance();