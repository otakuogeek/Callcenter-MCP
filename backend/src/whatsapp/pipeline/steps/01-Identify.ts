/**
 * @module whatsapp/pipeline/steps/01-Identify
 * @description Pipeline step 1: Auto-identify patient by phone + detect document.
 *              - Calls autoIdentify (ConversationPersistence)
 *              - Syncs identified patient into UnifiedStateManager
 *              - Detects raw document numbers in the message, executes searchPatient
 */

import { ConversationState } from '../../types/state';
import type { PipelineContext } from '../../types';
import { getStateContext, updateState } from '../../state/UnifiedStateManager';
import { logger } from '../../config';
import DirectDBTools from '../../../services/DirectDBTools';
import {
  autoIdentify,
  updatePatient,
  updateContext,
  markQuestion,
  saveAnswer,
} from '../../../services/ConversationPersistence';

/**
 * Step 1: Identify patient by phone or by a document number in the message.
 * Returns early with a response if the identification flow resolves directly.
 */
export async function identifyStep(ctx: PipelineContext): Promise<PipelineContext> {
  const { phone, message } = ctx;

  // 1A. Auto-identify by phone number (returning users)
  try {
    const persisted = await autoIdentify(phone);
    if (persisted.isIdentified && persisted.patient.patientId) {
      const patient = persisted.patient;
      logger.info({ phone, name: patient.fullName }, '🔑 Auto-identified patient by phone');

      const current = getStateContext(phone);
      if (!current.patientId) {
        updateState(phone, ConversationState.AWAITING_SPECIALTY, {
          patientId: patient.patientId,
          patientName: patient.fullName,
          patientDocument: patient.documentNumber,
          patientPhone: patient.phone,
        });
      }
    }
  } catch (err) {
    logger.warn({ err }, 'Error in autoIdentify');
  }

  // 1B. Detect raw cédula in message (6-12 digits, whole message)
  const stateContext = getStateContext(phone);
  const cleanMessage = message.replace(/[.\-\s,]/g, '');
  const cedMatch = cleanMessage.match(/^(\d{6,12})$/);

  // Allow cedula detection in AWAITING_BENEFICIARY state even if patientId already set
  const isBeneficiaryFlow = stateContext.currentState === ConversationState.AWAITING_BENEFICIARY;

  if (cedMatch && (!stateContext.patientId || isBeneficiaryFlow)) {
    const document = cedMatch[1];
    logger.info({ phone, document, isBeneficiaryFlow }, '📄 Document detected, running searchPatient');

    const searchResult = await DirectDBTools.searchPatient({ document });

    if (searchResult.success && searchResult.data?.found) {
      const patient = searchResult.data.patient || searchResult.data.patients?.[0];
      const patientName = patient?.full_name || patient?.name;
      const patientPhone = patient?.phone || patient?.mobile || '';
      const patientId = patient?.id;
      const patientEps = patient?.eps_name || patient?.eps || '';

      if (isBeneficiaryFlow) {
        // Beneficiary found — set as the appointment patient, keep requestor saved
        updateState(phone, ConversationState.AWAITING_SPECIALTY, {
          patientId, patientName, patientDocument: document, patientPhone,
          isThirdParty: true,
        });
        ctx.executedTools.push({ name: 'searchPatient', result: `Beneficiary found: ${patientName}` });
        const firstName = patientName?.split(' ')[0] || 'paciente';
        ctx.earlyResponse = `¡Listo! 😊 Encontré a ${firstName}. ¿Para qué especialidad necesita la cita?`;
        ctx.intent = 'identification';
        return ctx;
      }

      updateState(phone, ConversationState.AWAITING_PHONE_CONFIRMATION, {
        patientId, patientName, patientDocument: document, patientPhone,
      });

      // Persist in JSON conversation
      await updatePatient(phone, {
        patientId, fullName: patientName, firstName: patientName?.split(' ')[0],
        documentNumber: document, phone: patientPhone, eps: patientEps,
      }).catch(() => {});
      await markQuestion(phone, 'cedula').catch(() => {});
      await markQuestion(phone, 'nombre').catch(() => {});
      await updateContext(phone, { state: 'identification' }).catch(() => {});

      ctx.executedTools.push({ name: 'searchPatient', result: `Found: ${patientName}` });

      // If we already have a specialty, fetch availability
      const updatedState = getStateContext(phone);
      if (updatedState.specialtyName) {
        const availResult = await DirectDBTools.getAvailableAppointments({ specialty_name: updatedState.specialtyName });
        if (availResult.success && availResult.data?.appointments?.length > 0) {
          const appts = availResult.data.appointments;
          updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, {
            availableAppointments: appts, specialtyId: appts[0]?.specialty_id,
          });
          let response = `¡Hola ${patientName}! 😊\n\nPara ${updatedState.specialtyName} tenemos:\n\n`;
          appts.slice(0, 5).forEach((apt: any, idx: number) => {
            response += `${idx + 1}. ${apt.doctor_name} - ${apt.appointment_date_formatted || apt.appointment_date} a las ${apt.start_time_formatted || apt.start_time}\n`;
          });
          response += `\n¿Cuál te agendo?`;
          ctx.earlyResponse = response;
          ctx.intent = 'schedule';
          return ctx;
        }
      }

      const firstName = patientName.split(' ')[0];
      ctx.earlyResponse = `¡Hola ${firstName}! 😊 Ya te encontré en el sistema.\n\n¿Para qué especialidad necesitas la cita?`;
      ctx.intent = 'identification';
      return ctx;

    } else {
      // Patient not found
      if (isBeneficiaryFlow) {
        // Beneficiary not registered — start registration for the third party
        updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
          patientDocument: document, registrationPending: true, isThirdParty: true,
        });
        ctx.executedTools.push({ name: 'searchPatient', result: `Beneficiary not found: ${document}` });
        ctx.earlyResponse = `No encontré a nadie con cédula ${document}. 😊\n\nVoy a registrarla. ¿Cuál es el nombre completo de esa persona?`;
        ctx.intent = 'registration';
        return ctx;
      }

      // Patient not found → registration flow
      updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
        patientDocument: document, registrationPending: true,
      });
      ctx.executedTools.push({ name: 'searchPatient', result: `Not found: ${document}` });
      ctx.earlyResponse = `No te encuentro con cédula ${document}. 😊\n\nPara crearte un perfil, ¿cuál es tu nombre completo?`;
      ctx.intent = 'registration';
      return ctx;
    }
  }

  return ctx;
}
