#!/usr/bin/env node

const crypto = require('crypto');

console.log('🔑 DMCA Guard - Geração de Secrets para Produção');
console.log('================================================');
console.log('');

// Gerar NEXTAUTH_SECRET
const nextAuthSecret = crypto.randomBytes(32).toString('base64');
console.log('📋 Variáveis de Ambiente para Railway:');
console.log('');
console.log(`NEXTAUTH_SECRET="${nextAuthSecret}"`);
console.log('NODE_ENV="production"');
console.log('');

console.log('🔧 Configurações adicionais necessárias:');
console.log('');
console.log('1. NEXTAUTH_URL - será definido automaticamente pelo Railway');
console.log('2. DATABASE_URL - será definido automaticamente pelo PostgreSQL');
console.log('3. Resend API configs - usar as existentes');
console.log('');

console.log('✅ Copie essas variáveis para o Railway Dashboard:');
console.log('   Project Settings > Variables');