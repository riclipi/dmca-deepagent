const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('--- ETAPA 1: INICIANDO SCRIPT ---');
  const prisma = new PrismaClient();
  console.log('--- ETAPA 2: PRISMA CLIENT INICIALIZADO ---');

  try {
    // --- DADOS DE TESTE (PREENCHA OS DOIS IDs ABAIXO) ---
    const testBrandProfileId = 'cmc2cmsr200018k29ypnymg7c';
    const testMonitoringSessionId = 'cmc3z0ww200058k3kmyttpp7j'; // <-- O NOVO ID

    const infringingUrlConstant = 'https://www.site-infrator-exemplo.com/conteudo-vazado';

    if (testBrandProfileId === 'SEU_BRAND_PROFILE_ID_AQUI' || testMonitoringSessionId === 'SEU_MONITORING_SESSION_ID_AQUI') {
      console.error('\n❌ ERRO: Substitua os placeholders de ID no script.');
      return;
    }

    console.log(`--- ETAPA 3: PROCURANDO PERFIL DE MARCA ID: ${testBrandProfileId} ---`);
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: testBrandProfileId },
    });

    if (!brandProfile) {
      console.error(`\n❌ ERRO FATAL: Nenhum Perfil de Marca foi encontrado com o ID: ${testBrandProfileId}`);
      return;
    }

    console.log(`--- ETAPA 4: TUDO ENCONTRADO! User ID: ${brandProfile.userId}. CRIANDO CONTEÚDO... ---`);

    const newDetectedContent = await prisma.detectedContent.create({
      data: {
        title: 'Conteúdo de Teste (Gerado por Script)',
        infringingUrl: infringingUrlConstant, // Garante que o campo não fica em branco
        platform: 'WEBSITE',
        contentType: 'IMAGE',
        isConfirmed: false,

        // --- CONECTANDO TODAS AS RELAÇÕES OBRIGATÓRIAS ---
        user: { connect: { id: brandProfile.userId } },
        brandProfile: { connect: { id: testBrandProfileId } },
        monitoringSession: { connect: { id: testMonitoringSessionId } },
      }
    });

    console.log('\n✅✅✅ SUCESSO! CONTEÚDO DE TESTE FINALMENTE CRIADO! ✅✅✅');
    console.log(newDetectedContent);

  } catch (error) {
    console.error('\n❌ ERRO INESPERADO DURANTE A EXECUÇÃO:', error);
  } finally {
    console.log('--- ETAPA FINAL: DESCONECTANDO O PRISMA CLIENT ---');
    if (prisma) {
        await prisma.$disconnect();
        console.log('--- SCRIPT FINALIZADO ---');
    }
  }
}


main();