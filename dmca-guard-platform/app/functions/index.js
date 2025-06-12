const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const puppeteer = require("puppeteer");
const { genkit } = require('genkit');
const { googleAI } = require('@genkit-ai/googleai');
const { z } = require('genkit');

admin.initializeApp();

const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.0-flash',
});

exports.automatedMonitoring = onSchedule({
    schedule: "0 9,21 * * *",
    timeZone: "America/Sao_Paulo",
    timeoutSeconds: 540,
    memory: "1GiB",
    region: "us-central1",
  }, async (event) => {
  logger.info("Iniciando varredura de monitoramento automático!");
  const db = admin.firestore();
  // No futuro, isso será um loop por todos os usuários. Por enquanto, usa o ID de teste.
  const userId = "test-user-123";
  const keywordsSnapshot = await db.collection("users").doc(userId).collection("keywords").get();
  if (keywordsSnapshot.empty) {
    logger.info(`Nenhuma palavra-chave para o usuário ${userId}.`);
    return null;
  }
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  for (const doc of keywordsSnapshot.docs) {
    const termo = doc.data().name;
    if (!termo) continue;
    logger.info(`Buscando por: "${termo}" para o usuário ${userId}`);
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(termo)}&num=20`, { waitUntil: 'networkidle2' });
    const links = await page.evaluate(() => Array.from(document.querySelectorAll('div.g a')).map(a => a.href).filter(h => h.startsWith('http')));
    for (const link of links) {
      const detectionQuery = await db.collection('detections').where('url', '==', link).where('userId', '==', userId).limit(1).get();
      if (detectionQuery.empty) {
        logger.info(`  -> Nova detecção: ${link}`);
        await db.collection('detections').add({ url: link, userId: userId, keyword: termo, detectedAt: admin.firestore.FieldValue.serverTimestamp(), status: 'new' });
      }
    }
  }
  await browser.close();
  logger.info("Varredura concluída.");
  return null;
});

const generateDMCAPrompt = ai.definePrompt({
  name: 'generateDMCATakedownPrompt_backend',
  input: { schema: z.object({ leakedContentUrl: z.string(), officialProfileUrls: z.array(z.string()) }) },
  output: { schema: z.object({ dmcaNotice: z.string() }) },
  prompt: `Generate a professional DMCA takedown notice for the content at {{{leakedContentUrl}}}. The copyright owner's official profiles are: {{#each officialProfileUrls}}{{{this}}} {{/each}}. The notice must be formal and request immediate removal.`,
});

exports.processNewDetection = onDocumentCreated("detections/{detectionId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const detection = snapshot.data();
  const detectionId = event.params.detectionId;
  const userId = detection.userId;
  if (!userId || detection.status !== 'new') return;
  logger.info(`Processando nova detecção ${detectionId} para ${userId}.`);
  try {
    const db = admin.firestore();
    const profilesSnapshot = await db.collection("users").doc(userId).collection("officialprofiles").get();
    const officialProfileUrls = profilesSnapshot.docs.map(doc => doc.data().url).filter(Boolean);
    if (officialProfileUrls.length === 0) {
      throw new Error('Nenhum perfil oficial encontrado para gerar DMCA.');
    }
    logger.info(`Gerando DMCA para: ${detection.url}`);
    const { output } = await generateDMCAPrompt({ leakedContentUrl: detection.url, officialProfileUrls: officialProfileUrls });
    if (!output) throw new Error("A IA não gerou a notificação.");
    await snapshot.ref.update({ status: 'dmca_generated', dmcaNoticeContent: output.dmcaNotice, statusNotes: 'DMCA gerado automaticamente.' });
    logger.info(`DMCA para ${detectionId} gerado com sucesso.`);
  } catch (error) {
    logger.error(`Erro ao processar ${detectionId}:`, error);
    await snapshot.ref.update({ status: 'error', statusNotes: `Falha na geração de DMCA: ${error.message}` });
  }
});