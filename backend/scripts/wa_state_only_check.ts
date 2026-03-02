import WhatsAppAI from '../src/services/WhatsAppAIService';
import { updateState, resetState, ConversationState } from '../src/services/WhatsAppStateManager';

async function run() {
  const ts = Date.now();
  const phone1 = `test-guided-state-expired-${ts}`;
  const phone2 = `test-guided-state-nosummary-${ts}`;

  console.log('=== ESCENARIO 1 (servicio): confirmación tardía ===');
  resetState(phone1);
  WhatsAppAI.resetConversation(phone1);
  const expiredAt = Date.now() - (11 * 60 * 1000);
  updateState(phone1, ConversationState.AWAITING_CONFIRMATION, {
    patientId: 999001,
    patientName: 'Paciente Prueba',
    patientDocument: '99900111',
    availabilityId: 123456,
    scheduledDatetime: '2026-02-26 09:00:00',
    reason: 'Control',
    confirmationRequestedAt: expiredAt,
    timestamp: expiredAt,
    retryCount: 0
  });

  const r1 = await WhatsAppAI.processMessage('sí', phone1, []);
  console.log(r1.response || r1.error || 'sin respuesta');

  console.log('\n=== ESCENARIO 2 (servicio): sí sin resumen vigente ===');
  resetState(phone2);
  WhatsAppAI.resetConversation(phone2);
  const r2 = await WhatsAppAI.processMessage('sí', phone2, []);
  console.log(r2.response || r2.error || 'sin respuesta');

  const text1 = (r1.response || '').toLowerCase();
  const ok1 = /retomemos|motivo de tu consulta|evitar confirmar una cita antigua/.test(text1);

  console.log('\n=== RESULTADOS CHECK ===');
  console.log(`scenario1_expired_confirmation_guard=${ok1 ? 'PASS' : 'FAIL'}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
