// dmca-guard-platform/app/functions/index.js - VERSÃO CORRIGIDA

const { onSchedule } = require("firebase-functions/v2/scheduler");
// const { onDocumentCreated } = require("firebase-functions/v2/firestore"); // Removed Firestore trigger
const { onMessagePublished } = require("firebase-functions/v2/pubsub"); // Added Pub/Sub trigger
const { initializeApp } = require("firebase-admin/app");
// const { getFirestore } = require("firebase-admin/firestore"); // No longer needed if Whitelists and Detections fully on PG
const { defineString } = require("firebase-functions/params");
const { Pool } = require("pg");
const puppeteer = require("puppeteer");
const { PubSub } = require('@google-cloud/pubsub');
const { configureGenkit, defineFlow, run, generate } = require('@genkit-ai/core');
const { firebase } = require('@genkit-ai/firebase'); // For Firebase integration with Genkit
const { geminiPro } = require('@genkit-ai/google-ai'); // Or your chosen model provider
const { format } = require('date-fns'); // For formatting dates
const z = require('zod'); // For schema validation with Genkit flows


initializeApp();

// Configure Genkit (basic placeholder)
try {
    configureGenkit({
        plugins: [
            firebase(), // For Firebase environment integration (logging, auth)
            // googleAI(), // Initialize Google AI provider (e.g., for Gemini) - API key needs to be available
        ],
        logLevel: 'debug',
        enableTracingAndMetrics: true, // Recommended for production
    });
    console.log("Genkit configured (basic). Ensure Google AI plugin is properly set up if using Gemini.");
} catch (e) {
    console.warn("Genkit basic configuration skipped or failed. Ensure Genkit is properly initialized for the environment if this function is deployed.", e.message);
}


const pubSubClient = new PubSub();
const NEW_DETECTION_TOPIC = 'new-detection-topic';

// 1. Apenas definimos o parâmetro, SEM chamar .value()
const postgresConnectionString = defineString("POSTGRES_CONNECTION_STRING");

// 2. Declaramos o pool, mas não o inicializamos ainda
let pool;


// Define Genkit Flow Schema and Logic (outside the Pub/Sub handler for clarity and reusability)
const dmcaContextSchema = z.object({
    userName: z.string(),
    userEmail: z.string(),
    userPhone: z.string().optional().nullable(),
    infringingUrl: z.string().url(),
    platform: z.string().optional().nullable(),
    keyword: z.string(), // title from DetectedContent is the keyword
    brandName: z.string().optional().nullable(),
    brandDescription: z.string().optional().nullable(),
    brandOfficialUrls: z.array(z.string().url()).min(1, { message: "At least one official URL is required for the brand." }),
    currentDate: z.string(),
});

// Define the output schema for the DMCA notice flow
const dmcaNoticeOutputSchema = z.object({
    subject: z.string().min(1, { message: "Subject cannot be empty." }),
    body: z.string().min(1, { message: "Body cannot be empty." })
});

const dmcaNoticeFlow = defineFlow(
    {
        name: "dmcaNoticeFlow",
        inputSchema: dmcaContextSchema,
        outputSchema: dmcaNoticeOutputSchema, // Use the new structured output schema
    },
    async (context) => {
        const hostingPlatformHostname = new URL(context.infringingUrl).hostname;
        const prompt = `
You are a specialized legal assistant AI. Your task is to draft a formal and professional DMCA Takedown Notice.
The output MUST be a JSON object with two keys: "subject" and "body".
The "subject" should be a concise and professional subject line for this DMCA Takedown Notice, clearly stating its purpose and mentioning the infringing URL or content if possible (e.g., "DMCA Takedown Notice Regarding Copyright Infringement at ${context.infringingUrl}").
The "body" should be the full text of the notice. Address the notice appropriately (e.g., "To Whom It May Concern," or "Dear Copyright Agent for ${hostingPlatformHostname}").
Maintain a strictly formal and professional legal tone throughout the notice.

Use the following information provided to construct both the subject and the body:
- Copyright Holder Name: ${context.userName}
- Copyright Holder Email: ${context.userEmail}
- Copyright Holder Phone: ${context.userPhone || 'Not provided'}
- Infringing Content URL: ${context.infringingUrl}
- This URL was discovered via the platform: ${context.platform || 'N/A'} (Discovery source, e.g., Google Search)
- Platform hosting the infringing content: ${hostingPlatformHostname}
- A description of the original copyrighted work is: "${context.brandDescription || 'Not explicitly described, but is part of the brand/collection below'}".
- This work is part of the brand/collection titled: "${context.brandName || context.userName}".
- Original Content URL(s) (where the user's original content can be found): ${context.brandOfficialUrls.join(', ')}
- Keyword that led to detection: "${context.keyword}"
- Date of Notice: ${context.currentDate}

The DMCA notice body must include:
1. Clear identification of the infringing material (using Infringing Content URL).
2. Clear identification of the original copyrighted work(s) (referencing Original Content URL(s) and description/brand).
3. A statement of good faith belief that the use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.
4. A statement that the information in the notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
5. The copyright holder's full contact information (Name, Email, Phone).
6. An electronic signature: Conclude with "/s/ ${context.userName}".

Compose the full DMCA notice (subject and body) now.
The entire output must be a single JSON object. Example: {"subject": "Urgent: DMCA Copyright Infringement Notice - Action Required for URL: ${context.infringingUrl}", "body": "Dear Copyright Agent for ${hostingPlatformHostname},\\n\\nI am writing to report a violation of my exclusive copyrights..."}
`;

        console.log("Invoking Genkit AI model to generate structured DMCA notice (subject and body)...");
        try {
            const llmResponse = await generate({
                model: geminiPro,
                prompt: prompt,
                config: { temperature: 0.2 }, // Low temperature for factual, less creative output
                output: { format: "json" }
            });
            const responseText = llmResponse.text();

            if (!responseText || responseText.trim() === "") {
                console.error("Genkit generate() returned empty text.");
                throw new Error("Generated DMCA notice text from AI is empty.");
            }
            // console.log("Raw AI response text for DMCA:", responseText); // Log raw for debugging if needed

            let parsedOutput;
            try {
                 parsedOutput = JSON.parse(responseText);
            } catch (parseError) {
                 console.warn(`AI output was not valid JSON. Raw text: "${responseText.substring(0,500)}..." Error: ${parseError.message}`);
                 return { subject: `DMCA Takedown Notice Regarding: ${context.infringingUrl}`, body: responseText };
            }

            const validationResult = dmcaNoticeOutputSchema.safeParse(parsedOutput);
            if (validationResult.success) {
                console.log("Structured DMCA notice (subject and body) generated and validated successfully by Genkit.");
                return validationResult.data;
            } else {
                console.warn(`Generated JSON does not match dmcaNoticeOutputSchema. Errors: ${JSON.stringify(validationResult.error.flatten())}. Raw text: "${responseText.substring(0,500)}..."`);
                return { subject: `DMCA Takedown Notice Regarding: ${context.infringingUrl}`, body: responseText };
            }

        } catch (e) {
            // Log the original error object for more details
            console.error("Genkit generate() call failed for DMCA notice:", e);
            throw new Error(`AI model failed to generate DMCA notice. Details: ${e.message || e.toString()}`);
        }
    }
);


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
                            const insertResult = await pool.query( // Capture insertResult
                                `INSERT INTO "DetectedContent"
                                 ("userId", "brandProfileId", "monitoringSessionId", "title", "infringingUrl", "platform", "contentType", "detectedAt", "createdAt", "updatedAt", "isConfirmed", "isProcessed", "priority")
                                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                                 RETURNING id`, // Added RETURNING id
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

                            const newDetectedContentId = insertResult.rows[0]?.id;

                            if (!newDetectedContentId) {
                                console.error(`Falha ao obter ID da nova detecção para ${user.id}, URL: ${url} (Keyword: "${keyword}"). Pulando notificação e Pub/Sub.`);
                            } else {
                                console.log(`Nova detecção ID: ${newDetectedContentId} para ${user.id} (PostgreSQL): ${url} (Keyword: "${keyword}")`);

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
                                    console.log(`Notificação criada para ${user.id} para a detecção ID: ${newDetectedContentId}`);
                                } catch (notificationErr) {
                                    console.error(`Erro ao criar notificação no PostgreSQL para ${user.id} (Detecção ID: ${newDetectedContentId}, URL: ${url}, Keyword: "${keyword}"):`, notificationErr);
                                }

                                // Publish to Pub/Sub
                                const messageData = { detectedContentId: newDetectedContentId };
                                const dataBuffer = Buffer.from(JSON.stringify(messageData));
                                try {
                                    const messageId = await pubSubClient.topic(NEW_DETECTION_TOPIC).publishMessage({ data: dataBuffer });
                                    console.log(`Mensagem ${messageId} publicada para ${NEW_DETECTION_TOPIC} com detectedContentId: ${newDetectedContentId}`);
                                } catch (pubSubError) {
                                    console.error(`Erro ao publicar mensagem no Pub/Sub para detectedContentId ${newDetectedContentId}:`, pubSubError);
                                }
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

// Refactored processNewDetection function triggered by Pub/Sub
exports.processNewDetection = onMessagePublished({
    topic: NEW_DETECTION_TOPIC, // Use the constant
    region: "southamerica-east1", // Example region, align with your project
    // Optinal: configure retry behavior, concurrency, etc.
    // https://firebase.google.com/docs/functions/pubsub-events#customize_the_event_handler
}, async (event) => {
    console.log("Função processNewDetection acionada por Pub/Sub.");

    try {
        const message = event.data.message;
        if (!message || !message.data) {
            console.error("Mensagem Pub/Sub inválida ou sem dados. Evento:", JSON.stringify(event, null, 2));
            return null;
        }

        const messageBody = Buffer.from(message.data, 'base64').toString('utf8');
        console.log("Corpo da mensagem decodificado:", messageBody);

        const messagePayload = JSON.parse(messageBody);
        const detectedContentId = messagePayload.detectedContentId;

        if (!detectedContentId) {
            console.error("detectedContentId não encontrado no payload da mensagem:", messageBody);
            return null;
        }

        console.log(`Processando detectedContentId: ${detectedContentId}`);

        // Initialize pool if not already done (important for cold starts or if this function runs separately)
        if (!pool) {
            console.log("Inicializando o pool de conexão com o PostgreSQL para processNewDetection...");
            pool = new Pool({ connectionString: postgresConnectionString.value() });
        }

        // 1. Fetch detailed context from PostgreSQL
        const query = `
            SELECT
                dc.id AS "detectedContentId",
                dc."infringingUrl",
                dc.platform,
                dc.title AS keyword,
                u.name AS "userName",
                u.email AS "userEmail",
                u.phone AS "userPhone",
                bp."officialUrls" AS "brandOfficialUrls",
                bp."brandName",
                bp.description AS "brandDescription"
            FROM "DetectedContent" dc
            JOIN "User" u ON dc."userId" = u.id
            JOIN "BrandProfile" bp ON dc."brandProfileId" = bp.id
            WHERE dc.id = $1;
        `;
        const contextResult = await pool.query(query, [detectedContentId]);

        if (contextResult.rows.length === 0) {
            console.error(`Nenhum DetectedContent encontrado para ID: ${detectedContentId}. Mensagem será acknowledge.`);
            return null;
        }

        const rawContext = contextResult.rows[0];
        console.log("Contexto bruto do DB:", rawContext);

        // Prepare context for Genkit flow
        const flowInput = {
            userName: rawContext.userName,
            userEmail: rawContext.userEmail,
            userPhone: rawContext.userPhone, // Will be null if not present, handled by Zod schema
            infringingUrl: rawContext.infringingUrl,
            platform: rawContext.platform,
            keyword: rawContext.keyword,
            brandName: rawContext.brandName,
            brandDescription: rawContext.brandDescription,
            brandOfficialUrls: rawContext.brandOfficialUrls || [], // Ensure it's an array
            currentDate: format(new Date(), 'yyyy-MM-dd'),
        };

        // Validate input before calling the flow
        const validatedFlowInput = dmcaContextSchema.parse(flowInput); // Throws if validation fails
        console.log("Input validado para o fluxo Genkit:", validatedFlowInput);


        // 2. Invoke the Genkit flow
        console.log("Invocando dmcaNoticeFlow...");
        const generatedDmca = await run(dmcaNoticeFlow, validatedFlowInput); // Now returns { subject, body }

        if (generatedDmca && generatedDmca.body && generatedDmca.subject) {
            console.log("Notificação DMCA Gerada - Assunto:", generatedDmca.subject);
            console.log("Notificação DMCA Gerada - Corpo:\n", generatedDmca.body);

            // 3. Store the generated notice in TakedownRequest table
            try {
                const takedownInsertResult = await pool.query(
                    `INSERT INTO "TakedownRequest"
                     ("userId", "detectedContentId", "platform", "recipientEmail", "subject", "message", "status", "createdAt", "updatedAt")
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
                    [
                        rawContext.userId, // rawContext should have userId from the JOIN
                        detectedContentId,
                        rawContext.platform || "Unknown Platform",
                        "contact@placeholder-platform.com", // Placeholder recipient
                        generatedDmca.subject,
                        generatedDmca.body,
                        "PENDING", // Initial status (TakedownStatus enum)
                        new Date(),   // createdAt
                        new Date()    // updatedAt
                    ]
                );
                const newTakedownRequestId = takedownInsertResult.rows[0]?.id;
                if (newTakedownRequestId) {
                    console.log(`TakedownRequest ${newTakedownRequestId} criado com sucesso para DetectedContentId: ${detectedContentId}`);
                } else {
                    console.error(`Falha ao obter ID do TakedownRequest para DetectedContentId: ${detectedContentId} após inserção.`);
                }
            } catch (takedownDbErr) {
                console.error(`Erro ao salvar TakedownRequest no PostgreSQL para DetectedContentId ${detectedContentId}:`, takedownDbErr);
                // Decide if this error should prevent acknowledging the Pub/Sub message.
                // For now, if creating TakedownRequest fails, we still acknowledge the Pub/Sub message
                // as the core DMCA generation might have succeeded.
            }
        } else {
            console.warn(`Notificação DMCA não foi gerada ou está incompleta para DetectedContentId: ${detectedContentId}. TakedownRequest não será criado.`);
        }

        console.log(`Processamento (incluindo tentativa de TakedownRequest) concluído para detectedContentId: ${detectedContentId}.`);
        return null; // Acknowledge the message

    } catch (error) {
        console.error(`Erro crítico ao processar detectedContentId ${detectedContentId} via Pub/Sub: ${error.message}`, error);
        // Decide on retry strategy. If error is due to bad data (e.g. Zod parse error), acknowledge.
        // If transient (e.g. Genkit model unavailable temporarily), might not acknowledge to allow retry.
        // For now, acknowledge to prevent loops on persistent errors.
        if (error instanceof z.ZodError) {
            console.error("Erro de validação Zod para o input do fluxo:", error.flatten());
        }
        return null;
    }
});