
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');

const prisma = new PrismaClient();

async function importLeakedLinks(filePath, brandName) {
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    return;
  }

  const brandProfile = await prisma.brandProfile.findFirst({
    where: { brandName: { equals: brandName, mode: 'insensitive' } },
  });

  if (!brandProfile) {
    console.error(`Error: Brand profile "${brandName}" not found.`);
    console.log('Please ensure the brand profile exists before importing.');
    return;
  }

  let session = await prisma.monitoringSession.findFirst({
    where: {
      name: 'CSV Import Session',
      brandProfileId: brandProfile.id,
    },
  });

  if (!session) {
    session = await prisma.monitoringSession.create({
      data: {
        name: 'CSV Import Session',
        description: 'Session for content imported from CSV.',
        brandProfileId: brandProfile.id,
        userId: brandProfile.userId,
        status: 'COMPLETED',
        targetPlatforms: ['csv_import'],
      },
    });
    console.log(`Created new "CSV Import Session" for ${brandName}.`);
  }

  const results = [];
  fs.createReadStream(filePath)
    .pipe(csv({ headers: false }))
    .on('data', (row) => {
      const url = row[0];
      if (url) {
        results.push({
          userId: brandProfile.userId,
          brandProfileId: brandProfile.id,
          monitoringSessionId: session.id,
          title: `Imported Link: ${url.substring(0, 50)}`,
          infringingUrl: url,
          platform: 'csv_import',
          contentType: 'OTHER',
          source: 'csv_import',
          status: 'CONFIRMED',
          isConfirmed: true,
          detectedAt: new Date(),
        });
      }
    })
    .on('end', async () => {
      if (results.length === 0) {
        console.log('No links found in the CSV file.');
        return;
      }

      console.log(`Found ${results.length} links to import.`);

      try {
        const createdContent = await prisma.detectedContent.createMany({
          data: results,
          skipDuplicates: true,
        });
        console.log(`Successfully imported ${createdContent.count} new leaked links.`);
      } catch (error) {
        console.error('Error importing links:', error);
      } finally {
        await prisma.$disconnect();
      }
    });
}

const filePath = process.argv[2];
const brandName = process.argv[3];

if (!filePath || !brandName) {
  console.log('Usage: node scripts/import-leaked-links.js <path_to_csv> <brand_name>');
  process.exit(1);
}

importLeakedLinks(filePath, brandName);
