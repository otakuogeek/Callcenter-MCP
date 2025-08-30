#!/usr/bin/env node

/**
 * Sistema de monitoreo para webhooks ElevenLabs
 * Verifica el estado de los endpoints y la conectividad
 */

import dotenv from 'dotenv';
import axios from 'axios';
import crypto from 'crypto';

// Cargar variables de entorno
dotenv.config();

const WEBHOOK_BASE_URL = 'https://biosanarcall.site/api/webhooks/elevenlabs';
const SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || 'sip_trunk_password_outbound_+573168339017';

interface TestResult {
  endpoint: string;
  status: 'success' | 'error';
  statusCode?: number;
  message: string;
  responseTime?: number;
}

/**
 * Generar firma HMAC para testing
 */
function generateHMAC(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

/**
 * Probar endpoint de webhook
 */
async function testWebhookEndpoint(
  endpoint: string, 
  payload: any, 
  eventType: string
): Promise<TestResult> {
  const url = `${WEBHOOK_BASE_URL}/${endpoint}`;
  const payloadString = JSON.stringify(payload);
  const signature = generateHMAC(payloadString, SECRET);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const startTime = Date.now();
  
  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-ElevenLabs-Signature': `t=${timestamp},v1=${signature}`,
        'X-ElevenLabs-Timestamp': timestamp,
        'X-ElevenLabs-Event': eventType,
        'User-Agent': 'ElevenLabs-Webhook-Monitor/1.0'
      },
      timeout: 10000,
      validateStatus: () => true // No lanzar error por status codes
    });

    const responseTime = Date.now() - startTime;
    
    if (response.status === 200) {
      return {
        endpoint,
        status: 'success',
        statusCode: response.status,
        message: 'Webhook procesado exitosamente',
        responseTime
      };
    } else {
      return {
        endpoint,
        status: 'error',
        statusCode: response.status,
        message: `Error ${response.status}: ${response.data?.error || response.statusText}`,
        responseTime
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      endpoint,
      status: 'error',
      message: `Error de conexión: ${error.message}`,
      responseTime
    };
  }
}

/**
 * Verificar estado del backend
 */
async function checkBackendHealth(): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const response = await axios.get('https://biosanarcall.site/health', {
      timeout: 5000
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      endpoint: 'health',
      status: 'success',
      statusCode: response.status,
      message: 'Backend funcionando correctamente',
      responseTime
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      endpoint: 'health',
      status: 'error',
      message: `Backend no disponible: ${error.message}`,
      responseTime
    };
  }
}

/**
 * Ejecutar todas las pruebas
 */
async function runMonitoring(): Promise<void> {
  console.log('🔍 Iniciando monitoreo de webhooks ElevenLabs...');
  console.log('=====================================================');
  console.log('');

  // 1. Verificar salud del backend
  console.log('📊 Verificando estado del backend...');
  const healthCheck = await checkBackendHealth();
  printResult(healthCheck);
  console.log('');

  // 2. Probar webhook call-started
  console.log('📞 Probando webhook call-started...');
  const callStartedPayload = {
    type: 'conversation.started',
    conversation_id: `test-${Date.now()}`,
    timestamp: new Date().toISOString(),
    agent_id: 'test-agent',
    user_data: {
      source: 'webhook-monitor',
      test: true
    }
  };
  
  const callStartedResult = await testWebhookEndpoint(
    'call-started', 
    callStartedPayload, 
    'conversation.started'
  );
  printResult(callStartedResult);
  console.log('');

  // 3. Probar webhook call-ended
  console.log('📵 Probando webhook call-ended...');
  const callEndedPayload = {
    type: 'conversation.ended',
    conversation_id: `test-${Date.now()}`,
    timestamp: new Date().toISOString(),
    duration: 120,
    transcript: 'Transcripción de prueba generada por el monitor de webhooks',
    audio_url: 'https://example.com/test-audio.mp3',
    agent_id: 'test-agent'
  };
  
  const callEndedResult = await testWebhookEndpoint(
    'call-ended', 
    callEndedPayload, 
    'conversation.ended'
  );
  printResult(callEndedResult);
  console.log('');

  // 4. Resumen final
  const allResults = [healthCheck, callStartedResult, callEndedResult];
  const successCount = allResults.filter(r => r.status === 'success').length;
  const totalCount = allResults.length;
  
  console.log('📋 RESUMEN DE MONITOREO');
  console.log('=====================');
  console.log(`✅ Pruebas exitosas: ${successCount}/${totalCount}`);
  console.log(`❌ Pruebas fallidas: ${totalCount - successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log('🎉 ¡Todos los sistemas funcionando correctamente!');
  } else {
    console.log('⚠️  Algunos sistemas requieren atención');
  }
  
  console.log('');
  console.log('🔗 URLs de Webhook para ElevenLabs Dashboard:');
  console.log(`📞 Call Started: ${WEBHOOK_BASE_URL}/call-started`);
  console.log(`📵 Call Ended: ${WEBHOOK_BASE_URL}/call-ended`);
}

/**
 * Imprimir resultado de prueba
 */
function printResult(result: TestResult): void {
  const icon = result.status === 'success' ? '✅' : '❌';
  const time = result.responseTime ? ` (${result.responseTime}ms)` : '';
  
  console.log(`${icon} ${result.endpoint.toUpperCase()}: ${result.message}${time}`);
  
  if (result.statusCode) {
    console.log(`   Status: ${result.statusCode}`);
  }
}

// Ejecutar monitoreo si se llama directamente
if (require.main === module) {
  runMonitoring().catch(error => {
    console.error('❌ Error en monitoreo:', error);
    process.exit(1);
  });
}

export { runMonitoring, testWebhookEndpoint, checkBackendHealth };
