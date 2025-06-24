#!/usr/bin/env node

// Script que permite build mesmo sem DATABASE_URL
// Define uma URL temporária para o Prisma não falhar

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://temp:temp@localhost:5432/temp";
  console.log('⚠️  DATABASE_URL temporária definida para build');
}

// Executar prisma generate
const { execSync } = require('child_process');

try {
  console.log('🔧 Gerando Prisma Client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('🏗️  Executando Next.js build...');
  execSync('npx next build', { stdio: 'inherit' });
  
  console.log('✅ Build concluído com sucesso!');
} catch (error) {
  console.error('❌ Erro durante build:', error.message);
  process.exit(1);
}