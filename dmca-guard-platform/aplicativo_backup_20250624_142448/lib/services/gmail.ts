// dmca-guard-platform/app/lib/services/gmail.ts

import { google } from 'googleapis';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.resolve(process.cwd(), 'gmail_token.json'); // Token salvo localmente
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'credentials.json');

async function loadCredentials() {
  console.log('DEBUG: Tentando carregar:', CREDENTIALS_PATH);
  try {
    const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
    console.log('DEBUG: Conteúdo lido:', content.slice(0, 50)); // Mostra só o início do JSON
    return JSON.parse(content);
  } catch (err) {
    console.error('ERRO AO LER O credentials.json:', err);
    throw err;
  }
}

async function loadSavedToken() {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.warn('Token ainda não existe:', err?.message || err);
    return null;
  }
}

async function saveToken(token: any) {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
}

export async function getGmailClient() {
  try {
    const credentials = await loadCredentials();
    console.log('DEBUG: Credentials carregadas:', credentials && typeof credentials === 'object' ? Object.keys(credentials) : credentials);

    const { client_secret, client_id, redirect_uris } = credentials.web;
    console.log('DEBUG: client_id:', client_id, '| redirect_uris:', redirect_uris);

    const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]
    );

    const token = await loadSavedToken();
    console.log('DEBUG: Token carregado:', token);

    if (token) {
      oAuth2Client.setCredentials(token);
      return oAuth2Client;
    }

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });
    throw new Error(
      `Autorize o app visitando esta URL e cole o código no endpoint de callback: ${authUrl}`
    );
  } catch (err) {
    console.error('ERRO em getGmailClient:', err);
    throw err;
  }
}

export async function fetchGoogleAlertsFromGmail(userEmail: string) {
  try {
    const auth = await getGmailClient();
    const gmail = google.gmail({ version: 'v1', auth });

    // Busca mensagens do Google Alerts na caixa de entrada
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: `from:googlealerts-noreply@google.com newer_than:7d`, // ajusta o range se quiser
      maxResults: 20,
    });

    const messages = res.data.messages || [];
    const detectedContents = [];

    for (const msg of messages) {
      const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id! });
      const snippet = msgData.data.snippet || '';
      const payload = msgData.data.payload;
      const parts = payload?.parts || [];
      let bodyHtml = '';

      // Pega corpo do email (HTML)
      for (const part of parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString();
        }
      }

      // Regex básico para extrair URLs do corpo do alerta
      const urls = [...bodyHtml.matchAll(/https?:\/\/[^\s"'>]+/g)].map(m => m[0]);
      if (urls.length === 0) continue; // pula alertas sem links

      // Para cada URL encontrada, cria um DetectedContent se ainda não existir
      for (const url of urls) {
        const exists = await prisma.detectedContent.findFirst({
          where: { infringingUrl: url },
        });
        if (!exists) {
          detectedContents.push({
            title: snippet.slice(0, 60),
            infringingUrl: url,
            platform: 'WEBSITE',
            detectedAt: new Date(),
            // ...adicione outros campos se quiser
          });
          // (Aqui pode salvar no banco direto, ou retornar para o endpoint decidir)
        }
      }
    }

    console.log('DEBUG: DetectedContents extraídos:', detectedContents.length);
    return detectedContents;
  } catch (err) {
    console.error('ERRO em fetchGoogleAlertsFromGmail:', err);
    throw err;
  }
}
