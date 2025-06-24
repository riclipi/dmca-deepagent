#!/usr/bin/env node

// Script que permite build mesmo sem variáveis de ambiente completas
// Define valores temporários para não falhar no build

console.log('🚀 DMCA Guard - Build Seguro para Produção');
console.log('==========================================');

// Definir variáveis temporárias se não existirem
const envDefaults = {
  DATABASE_URL: "postgresql://temp:temp@localhost:5432/temp",
  NEXTAUTH_SECRET: "temp-secret-for-build-only",
  NEXTAUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_temp_key_for_build",
  RESEND_SENDER_FROM_EMAIL: "temp@example.com",
  RESEND_DOMAIN: "example.com",
  RESEND_SENDER_NAME: "Temp",
  SUPER_USER_EMAIL: "temp@example.com",
  NODE_ENV: "production"
};

// Aplicar defaults apenas se não existirem
Object.entries(envDefaults).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
    console.log(`⚠️  ${key} temporário definido para build`);
  }
});

// Executar build
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