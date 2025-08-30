#!/usr/bin/env node

/**
 * Script para probar webhooks de ElevenLabs con firmas HMAC válidas
 */

const crypto = require('crypto');
const axios = require('axios');

// Configuración
const WEBHOOK_BASE_URL = 'https://biosanarcall.site/api/webhooks/elevenlabs';
const CALL_STARTED_SECRET = 'wsec_10242422f757a3433ce3983064bd5d44f74ec516cc921e972ed1561cb896bdfa';
const CALL_ENDED_SECRET = 'wsec_2704eb64eb523848d3ed499d627f6683fad77967a11a5072c77132fd4ad1fb31';

/**
 * Genera una firma HMAC válida para un payload
 */
function generateValidSignature(payload, secret) {
  // Usar solo la parte después de 'wsec_'
  const secretKey = secret.startsWith('wsec_') ? secret.substring(5) : secret;
  
  // Generar timestamp actual
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Crear payload completo con timestamp
  const fullPayload = `${timestamp}.${payload}`;
  
  // Generar hash HMAC
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(fullPayload)
    .digest('hex');
  
  // Formato v1=hash,t=timestamp (formato ElevenLabs)
  return `t=${timestamp},v1=${hash}`;
}

/**
 * Prueba el webhook call-started
 */
async function testCallStartedWebhook() {
  console.log('🧪 Testing Call Started Webhook...');
  
  const payload = {
    type: 'conversation.started',
    conversation_id: 'test-conv-123',
    timestamp: new Date().toISOString(),
    data: {
      agent_id: 'test-agent',
      user_name: 'Test User'
    }
  };
  
  const payloadString = JSON.stringify(payload);
  const signature = generateValidSignature(payloadString, CALL_STARTED_SECRET);
  
  console.log('📝 Payload:', payloadString);
  console.log('🔑 Signature:', signature);
  
  try {
    const response = await axios.post(`${WEBHOOK_BASE_URL}/call-started`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'ElevenLabs-Signature': signature
      }
    });
    
    console.log('✅ Call Started Webhook Response:', response.status, response.data);
  } catch (error) {
    console.log('❌ Call Started Webhook Error:', error.response?.status, error.response?.data);
  }
}

/**
 * Prueba el webhook call-ended
 */
async function testCallEndedWebhook() {
  console.log('\\n🧪 Testing Call Ended Webhook...');
  
  const payload = {
    type: 'conversation.ended',
    conversation_id: 'test-conv-456',
    timestamp: new Date().toISOString(),
    data: {
      agent_id: 'test-agent',
      duration: 120,
      transcript: 'Test conversation transcript'
    }
  };
  
  const payloadString = JSON.stringify(payload);
  const signature = generateValidSignature(payloadString, CALL_ENDED_SECRET);
  
  console.log('📝 Payload:', payloadString);
  console.log('🔑 Signature:', signature);
  
  try {
    const response = await axios.post(`${WEBHOOK_BASE_URL}/call-ended`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'ElevenLabs-Signature': signature
      }
    });
    
    console.log('✅ Call Ended Webhook Response:', response.status, response.data);
  } catch (error) {
    console.log('❌ Call Ended Webhook Error:', error.response?.status, error.response?.data);
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 ElevenLabs Webhook Test Suite');
  console.log('================================\\n');
  
  await testCallStartedWebhook();
  await testCallEndedWebhook();
  
  console.log('\\n🎉 Test suite completed!');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  generateValidSignature,
  testCallStartedWebhook,
  testCallEndedWebhook
};
