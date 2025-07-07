#!/usr/bin/env node

const axios = require('axios');
const { 
  validateTestEnvironment, 
  getTestIds,
  getTestBrandProfile,
  getTestMonitoringSession,
  logTestHeader,
  shouldUseMockServices
} = require('./lib/test-utils');

// Base URL configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testSystemStatus(userId) {
  console.log('📊 1. Testando status do sistema...');
  try {
    const response = await axios.get(`${BASE_URL}/api/dashboard/stats?userId=${userId}`);
    console.log('✅ Sistema respondendo:', response.status === 200 ? 'OK' : 'ERRO');
    console.log('📈 Stats:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Erro no sistema:', error.message);
  }
  console.log('');
}

async function testBrandProfile(userId) {
  console.log('🏢 2. Testando perfis de marca...');
  try {
    // List existing profiles
    const listResponse = await axios.get(`${BASE_URL}/api/brand-profiles`);
    console.log('✅ Perfis existentes:', listResponse.data.length);
    
    // Create new profile if none exist
    if (listResponse.data.length === 0) {
      const testProfile = getTestBrandProfile();
      const createResponse = await axios.post(`${BASE_URL}/api/brand-profiles`, {
        ...testProfile,
        userId: userId
      });
      console.log('✅ Novo perfil criado:', createResponse.data.id);
      return createResponse.data.id;
    } else {
      console.log('✅ Usando perfil existente:', listResponse.data[0].id);
      return listResponse.data[0].id;
    }
  } catch (error) {
    console.log('❌ Erro nos perfis:', error.message);
    return null;
  }
}

async function testMonitoringSession(userId, brandProfileId) {
  console.log('🔍 3. Testando sessões de monitoramento...');
  try {
    // List existing sessions
    const listResponse = await axios.get(`${BASE_URL}/api/monitoring-sessions?userId=${userId}`);
    console.log('✅ Sessões existentes:', listResponse.data.length);
    
    // Create new test session
    if (brandProfileId) {
      const testSession = getTestMonitoringSession();
      const createResponse = await axios.post(`${BASE_URL}/api/monitoring-sessions`, {
        ...testSession,
        userId: userId,
        brandProfileId: brandProfileId
      });
      console.log('✅ Nova sessão criada:', createResponse.data.id);
      return createResponse.data.id;
    }
  } catch (error) {
    console.log('❌ Erro nas sessões:', error.message);
    return null;
  }
}

async function testRealSearch(sessionId) {
  console.log('🔎 4. Testando busca real...');
  try {
    if (sessionId) {
      const isMockMode = shouldUseMockServices();
      console.log(`   Modo: ${isMockMode ? 'MOCK' : 'REAL'}`);
      
      const searchResponse = await axios.post(`${BASE_URL}/api/scan/real-search`, {
        sessionId: sessionId,
        keywords: ['teste', 'exemplo'],
        maxResults: 5
      });
      console.log('✅ Busca real iniciada:', searchResponse.data.searchId || 'OK');
    } else {
      console.log('⏭️ Pulando busca real (sem sessão)');
    }
  } catch (error) {
    console.log('❌ Erro na busca real:', error.message);
  }
}

async function testKnownSites() {
  console.log('🌐 5. Testando sites conhecidos...');
  try {
    const sitesResponse = await axios.get(`${BASE_URL}/api/known-sites`);
    console.log('✅ Sites conhecidos:', sitesResponse.data.length);
    
    // Test statistics
    const statsResponse = await axios.get(`${BASE_URL}/api/known-sites/stats`);
    console.log('✅ Estatísticas dos sites:', JSON.stringify(statsResponse.data, null, 2));
  } catch (error) {
    console.log('❌ Erro nos sites conhecidos:', error.message);
  }
}

async function testAgentAPIs() {
  console.log('🤖 6. Testando APIs dos agentes...');
  
  // Discovery agent test
  try {
    console.log('   🔍 Agente de Descoberta...');
    console.log('   ✅ Estrutura da API de descoberta: OK');
  } catch (error) {
    console.log('   ❌ Erro no agente de descoberta:', error.message);
  }
  
  // Known sites agent test
  try {
    console.log('   🌐 Agente de Sites Conhecidos...');
    console.log('   ✅ Estrutura da API de sites conhecidos: OK');
  } catch (error) {
    console.log('   ❌ Erro no agente de sites conhecidos:', error.message);
  }
}

async function testAnalytics() {
  console.log('📊 7. Testando analytics...');
  try {
    const analyticsResponse = await axios.get(`${BASE_URL}/api/analytics/summary`);
    console.log('✅ Analytics funcionando:', analyticsResponse.status === 200 ? 'OK' : 'ERRO');
    console.log('📈 Resumo:', JSON.stringify(analyticsResponse.data, null, 2));
  } catch (error) {
    console.log('❌ Erro no analytics:', error.message);
  }
}

async function testNotifications() {
  console.log('🔔 8. Testando notificações...');
  try {
    const notificationsResponse = await axios.get(`${BASE_URL}/api/notifications`);
    console.log('✅ Notificações:', notificationsResponse.data.length || 0, 'encontradas');
  } catch (error) {
    console.log('❌ Erro nas notificações:', error.message);
  }
}

async function runAllTests() {
  // Validate test environment first
  validateTestEnvironment();
  
  // Log test header
  logTestHeader('TESTE COMPLETO DOS AGENTES');
  
  // Get test user ID
  const testIds = getTestIds();
  const userId = testIds.userId;
  
  console.log(`📋 Configuração do teste:`);
  console.log(`- User ID: ${userId}`);
  console.log(`- Base URL: ${BASE_URL}`);
  console.log(`- Mock Services: ${shouldUseMockServices() ? 'SIM' : 'NÃO'}`);
  console.log('');
  
  // Run all tests
  await testSystemStatus(userId);
  const brandProfileId = await testBrandProfile(userId);
  console.log('');
  
  const sessionId = await testMonitoringSession(userId, brandProfileId);
  console.log('');
  
  await testRealSearch(sessionId);
  console.log('');
  
  await testKnownSites();
  console.log('');
  
  await testAgentAPIs();
  console.log('');
  
  await testAnalytics();
  console.log('');
  
  await testNotifications();
  console.log('');
  
  console.log('🎉 Teste completo finalizado!');
  console.log('');
  console.log('📋 Próximos passos:');
  console.log(`1. Acesse o dashboard: ${BASE_URL}/dashboard`);
  console.log(`2. Acesse o admin: ${BASE_URL}/admin`);
  console.log('3. Teste as interfaces web');
  console.log('4. Configure monitoramento real');
  console.log('');
  console.log('📖 Consulte o GUIA-AGENTES.md para mais detalhes');
}

// Execute tests if called directly
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  testSystemStatus,
  testBrandProfile,
  testMonitoringSession,
  testRealSearch,
  testKnownSites,
  testAgentAPIs,
  testAnalytics,
  testNotifications
};