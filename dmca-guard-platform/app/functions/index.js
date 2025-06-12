// dmca-guard-platform/app/functions/index.js - VERSÃO CORRIGIDA

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { defineString } = require("firebase-functions/params");
const { Pool } = require("pg");
const puppeteer = require("puppeteer");

initializeApp();

// 1. Apenas definimos o parâmetro, SEM chamar .value()
const postgresConnectionString = defineString("POSTGRES_CONNECTION_STRING");

// 2. Declaramos o pool, mas não o inicializamos ainda
let pool;

exports.automatedMonitoring = onSchedule("every 12 hours", async (event) => {
  console.log("Iniciando monitoramento automático...");

  // 3. Inicializamos o pool de forma "preguiçosa" DENTRO da função
  if (!pool) {
    console.log("Inicializando o pool de conexão com o PostgreSQL...");
    pool = new Pool({
      connectionString: postgresConnectionString.value(), // .value() é chamado aqui, em tempo de execução
    });
  }

  let users = [];
  let client;

  try {
    client = await pool.connect();
    const result = await client.query('SELECT id, name FROM "User"');
    users = result.rows;
    console.log(`Encontrados ${users.length} usuários para monitorar.`);
  } catch (err) {
    console.error("Erro ao buscar usuários no PostgreSQL:", err);
    return null;
  } finally {
    client?.release();
  }

  const db = getFirestore();
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });

  for (const user of users) {
    console.log(`--- Processando usuário: ${user.name} (ID: ${user.id}) ---`);
    try {
      const keywordsSnapshot = await db.collection("Keywords").where("userId", "==", user.id).get();
      if (keywordsSnapshot.empty) {
        console.log(`Nenhuma palavra-chave para ${user.name}. Pulando.`);
        continue;
      }
      const keywords = keywordsSnapshot.docs.map((doc) => doc.data().keyword);

      const whitelistSnapshot = await db.collection("Whitelists").where("userId", "==", user.id).get();
      const whitelistUrls = whitelistSnapshot.docs.map(doc => new URL(doc.data().url).hostname);
      console.log(`Whitelist para ${user.name}:`, whitelistUrls);

      const page = await browser.newPage();
      
      for (const keyword of keywords) {
        console.log(`Buscando por: "${keyword}" para o usuário ${user.id}`);
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`);

        const urls = await page.$$eval("a", (as) =>
          as.map((a) => a.href).filter((href) => href.startsWith("http"))
        );

        for (const url of urls) {
          const urlHostname = new URL(url).hostname;
          if (!whitelistUrls.some(whitelisted => urlHostname.includes(whitelisted))) {
            const detectionsRef = db.collection("Detections");
            const existingDetection = await detectionsRef
              .where("userId", "==", user.id)
              .where("url", "==", url)
              .get();

            if (existingDetection.empty) {
              await detectionsRef.add({
                userId: user.id,
                keyword,
                url,
                status: "new",
                detectedAt: new Date(),
              });
              console.log(`Nova detecção para ${user.id}: ${url}`);
            }
          }
        }
      }
      await page.close();
    } catch (error) {
      console.error(`Erro ao processar o usuário ${user.id}:`, error);
    }
  }

  await browser.close();
  console.log("Monitoramento automático concluído.");
  return null;
});

exports.processNewDetection = onDocumentCreated("Detections/{detectionId}", async (event) => {
    console.log("Nova detecção criada, processando...", event.data.data());

    const detectionData = event.data.data();
    const userId = detectionData.userId;
    const keyword = detectionData.keyword;
    const url = detectionData.url;

    // Aqui você pode adicionar a lógica para processar a nova detecção
    // Por exemplo, enviar uma notificação ao usuário ou atualizar um painel

    return null;
});