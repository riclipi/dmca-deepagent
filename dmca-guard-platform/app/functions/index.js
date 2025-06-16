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

  // const db = getFirestore(); // Commented out as Whitelists and Detections are moved to PG
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });

  for (const user of users) {
    console.log(`--- Processando usuário: ${user.name} (ID: ${user.id}) ---`);
    let page; // Define page here to ensure it's closable in finally
    let keywordObjects = [];

    try {
      const brandProfilesResult = await pool.query(
        'SELECT id, keywords FROM "BrandProfile" WHERE "userId" = $1 AND "isActive" = TRUE',
        [user.id]
      );

      if (brandProfilesResult.rows.length > 0) {
        brandProfilesResult.rows.forEach(bp => {
          bp.keywords.forEach(kw => {
            keywordObjects.push({ keyword: kw, brandProfileId: bp.id });
          });
        });
      }

      if (keywordObjects.length === 0) {
        console.log(`Nenhuma palavra-chave (com brandProfileId) encontrada no PostgreSQL para ${user.name} (ID: ${user.id}). Pulando usuário.`);
        continue;
      }
      console.log(`Palavras-chave para ${user.name} (PostgreSQL):`, keywordObjects.map(ko => ko.keyword));

      let whitelistHostnames = [];
      try {
          const whitelistResult = await pool.query(
              'SELECT domain FROM "domain_whitelists" WHERE "userId" = $1',
              [user.id]
          );
          if (whitelistResult.rows.length > 0) {
              // Normalize whitelisted domains by removing www. for consistent matching
              whitelistHostnames = whitelistResult.rows.map(row => row.domain.replace(/^www\./, ''));
          }
          console.log(`Whitelist de domínios para ${user.name} (ID: ${user.id}) (PostgreSQL):`, whitelistHostnames);
      } catch (err) {
          console.error(`Erro ao buscar whitelist no PostgreSQL para ${user.id}:`, err);
      }

      page = await browser.newPage(); // Create page once per user
      
      for (const keywordObject of keywordObjects) {
        const keyword = keywordObject.keyword; // For easier access in logs
        console.log(`Buscando por: "${keyword}" (BrandProfile: ${keywordObject.brandProfileId}) para o usuário ${user.id}`);

        try { // Specific try-catch for each keyword search + processing
            await page.goto(`https://www.google.com/search?q=${encodeURIComponent(keyword)}`, { waitUntil: 'domcontentloaded' });

            const scrapedHrefs = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('div.g a[href]')) // Target links within 'div.g'
                            .map(a => a.getAttribute('href'));
            });

            let processedUrls = [];
            for (const href of scrapedHrefs) {
                if (!href) continue;
                if (href.startsWith('/url?q=')) {
                    try {
                        const HttpsUrl = new URL(`https://www.google.com${href}`);
                        const actualUrl = HttpsUrl.searchParams.get('q');
                        if (actualUrl && actualUrl.startsWith('http')) {
                             processedUrls.push(actualUrl);
                        }
                    } catch(e){
                        // console.warn(`Error parsing Google redirect URL ${href}: ${e.message}`);
                    }
                } else if (href.startsWith('http')) {
                    // Avoid Google's own domains if they are not the intended target
                    const tempUrl = new URL(href);
                    if (!tempUrl.hostname.includes("google.com")){
                         processedUrls.push(href);
                    }
                }
            }
            processedUrls = [...new Set(processedUrls)]; // Unique URLs

            for (const url of processedUrls) {
              if (!url) continue; // Should not happen if previous filter worked
              let urlHostname;
              try {
                urlHostname = new URL(url).hostname.replace(/^www\./, ''); // Normalize hostname
              } catch(e) {
                console.warn(`URL inválida "${url}" detectada para keyword "${keyword}". Pulando.`);
                continue;
              }

              // Precise whitelist matching (after normalizing both sides)
              if (!whitelistHostnames.includes(urlHostname)) {
                // Check for existing detection in PostgreSQL
                try {
                  const existingDetectionRes = await pool.query(
                    'SELECT id FROM "DetectedContent" WHERE "userId" = $1 AND "infringingUrl" = $2',
                    [user.id, url]
                  );

                  if (existingDetectionRes.rows.length === 0) {
                    // New detection, attempt to insert into PostgreSQL
                    let associatedMonitoringSessionId = null;
                    try {
                        const sessionRes = await pool.query(
                            'SELECT id FROM "MonitoringSession" WHERE "userId" = $1 AND "brandProfileId" = $2 AND "isActive" = TRUE LIMIT 1',
                            [user.id, keywordObject.brandProfileId]
                        );
                        if (sessionRes.rows.length > 0) {
                            associatedMonitoringSessionId = sessionRes.rows[0].id;
                        } else {
                            console.warn(`Nenhuma MonitoringSession ativa encontrada para userId: ${user.id}, brandProfileId: ${keywordObject.brandProfileId} para a URL: ${url} (Keyword: "${keyword}"). Pulando inserção.`);
                            continue;
                        }
                    } catch (sessionErr) {
                        console.error(`Erro ao buscar MonitoringSession para ${url} (User: ${user.id}, BP: ${keywordObject.brandProfileId}, Keyword: "${keyword}"):`, sessionErr);
                        continue;
                    }

                    if (associatedMonitoringSessionId) {
                        try {
                            await pool.query(
                                `INSERT INTO "DetectedContent"
                                 ("userId", "brandProfileId", "monitoringSessionId", "title", "infringingUrl", "platform", "contentType", "detectedAt", "createdAt", "updatedAt", "isConfirmed", "isProcessed", "priority")
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
                                [
                                    user.id,
                                    keywordObject.brandProfileId,
                                    associatedMonitoringSessionId,
                                    keyword,
                                    url,
                                    "Google Search",
                                    "OTHER",
                                    new Date(),
                                    new Date(),
                                    new Date(),
                                    false,
                                    false,
                                    "MEDIUM"
                                ]
                            );
                            console.log(`Nova detecção para ${user.id} (PostgreSQL): ${url} (Keyword: "${keyword}")`);

                            // Create Notification for the new detection
                            try {
                                const notificationTitle = "Novo conteúdo detectado automaticamente";
                                const notificationMessage = `O termo "${keyword}" resultou na detecção de conteúdo em: ${url}`;
                                await pool.query(
                                    `INSERT INTO "Notification" ("userId", "title", "message", "type", "isRead", "createdAt", "updatedAt")
                                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                    [
                                        user.id,
                                        notificationTitle,
                                        notificationMessage,
                                        'content_detected', // type
                                        false,              // isRead
                                        new Date(),         // createdAt
                                        new Date()          // updatedAt
                                    ]
                                );
                                console.log(`Notificação criada para ${user.id} para a detecção: ${url}`);
                            } catch (notificationErr) {
                                console.error(`Erro ao criar notificação no PostgreSQL para ${user.id} (URL: ${url}, Keyword: "${keyword}"):`, notificationErr);
                                // Do not re-throw; failing to create a notification should not roll back the detection or stop other processing.
                            }
                        } catch (insertErr) {
                            console.error(`Erro ao inserir detecção no PostgreSQL para ${url} (User: ${user.id}, Keyword: "${keyword}"):`, insertErr);
                        }
                    }
                  }
                } catch (checkErr) {
                  console.error(`Erro ao verificar detecção existente no PostgreSQL para ${url} (User: ${user.id}, Keyword: "${keyword}"):`, checkErr);
                }
              }
            }
        } catch (kwErr) {
            console.error(`Erro ao processar keyword "${keyword}" para usuário ${user.id}:`, kwErr);
        }
      } // End of keyword loop
    } catch (userProcessingError) { // Catch errors from keyword/whitelist fetching for the user
      console.error(`Erro geral ao processar o usuário ${user.id}:`, userProcessingError);
    } finally {
        if (page) {
            try {
                await page.close();
                console.log(`Página fechada para usuário ${user.id}`);
            } catch (closeErr) {
                console.error(`Erro ao fechar página para usuário ${user.id}:`, closeErr);
            }
        }
    }
  } // End of user loop

  await browser.close();
  console.log("Monitoramento automático concluído.");
  return null;
});

/* // Commented out as detections are now written to PostgreSQL
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
*/