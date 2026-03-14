/**
 * @module whatsapp/pipeline/steps/05-StateHandlers
 * @description Pipeline step 5: Handle state-specific user interactions.
 *              AWAITING_PHONE_CONFIRMATION, AWAITING_LOCATION, AWAITING_DOCTOR_SELECTION,
 *              AWAITING_DATE, AWAITING_TIME, AWAITING_DOUBLE_APPOINTMENT, AWAITING_REASON,
 *              WAITING_LIST, COMPLETED.
 */

import type { PipelineContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState, resetState } from '../../state/UnifiedStateManager';
import { isAffirmative, isNegative } from '../../utils/validation';
import { convertToColombiaTime, formatDate, formatTime } from '../../utils/date';
import { matchByNumberOrName } from '../../utils/fuzzyMatch';
import { logger } from '../../config';
import DirectDBTools from '../../../services/DirectDBTools';
import { fetchAndRouteAvailability, checkSpecialtyEligibility } from './04-AutoAvailability';
import * as PersistenceService from '../../../services/WhatsAppPersistenceService';
import smsService from '../../../services/labsmobile-sms.service';

/**
 * Step 5: State-specific interaction handlers.
 */
export async function stateHandlersStep(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.earlyResponse) return ctx;

  const { phone, message } = ctx;
  const stateContext = getStateContext(phone);
  const normalizedMsg = message.trim().toLowerCase();

  switch (stateContext.currentState) {
    case ConversationState.AWAITING_PATIENT_DATA:
      return handlePatientRegistration(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_BENEFICIARY:
      return handleBeneficiaryQuestion(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_PHONE_CONFIRMATION:
      return handlePhoneConfirmation(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_SPECIALTY:
      return handleSpecialtySelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_LOCATION:
      return handleLocationSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_CUPS:
      return handleCUPSInput(ctx, stateContext, ctx.message.trim());

    case ConversationState.AWAITING_DOCTOR_SELECTION:
      return handleDoctorSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.WAITING_LIST:
      return handleWaitingListConfirmation(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_DATE:
      return handleDateSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_TIME:
      return handleTimeSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_DOUBLE_APPOINTMENT:
      return handleDoubleAppointmentSelection(ctx, stateContext, normalizedMsg);

    case ConversationState.AWAITING_REASON:
      return handleAutoSchedule(ctx, stateContext, message);

    case ConversationState.COMPLETED:
      return handleCompletedCycle(ctx, stateContext, normalizedMsg);

    default:
      return ctx;
  }
}

// ─── Beneficiary Question ─────────────────────────────────────────────────

async function handleBeneficiaryQuestion(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;
  const firstName = (state.requestorPatientName || state.patientName || '').split(' ')[0];

  const isForSelf = isAffirmative(ctx.message) ||
    /para m[ií]|es para m[ií]|yo mismo|soy yo|la m[ií]a|mi cita|para mi|^1$/i.test(msg);

  const isForOther = /otra persona|para otro|para ella|para él|para alguien|familiar|tercero|beneficiario|^2$|mi (esposa|esposo|mam[aá]|pap[aá]|hij[ao]|hermano|hermana|pareja|abuelo|abuela)/i.test(msg) ||
    (!isForSelf && isNegative(ctx.message));

  // Raw cedula — interpret as beneficiary
  const cleanMsg = ctx.message.replace(/[.\-\s,]/g, '');
  if (/^\d{6,12}$/.test(cleanMsg)) {
    updateState(phone, ConversationState.AWAITING_DOCUMENT, { isThirdParty: true });
    return ctx;
  }

  if (isForSelf) {
    const requestorId = state.requestorPatientId || state.patientId;
    const requestorName = state.requestorPatientName || state.patientName;
    const requestorDoc = state.requestorPatientDocument || state.patientDocument;
    updateState(phone, ConversationState.AWAITING_SPECIALTY, {
      patientId: requestorId,
      patientName: requestorName,
      patientDocument: requestorDoc,
      isThirdParty: false,
    });
    // Always refresh specialties from DB
    const freshSpecialties = await refreshAuthorizedSpecialties(phone, state.patientEpsId);
    ctx.earlyResponse = buildSpecialtyListMessage(firstName, freshSpecialties);
    return ctx;
  }

  if (isForOther) {
    updateState(phone, ConversationState.AWAITING_DOCUMENT, { isThirdParty: true });
    ctx.earlyResponse = `¡Con gusto! 😊 ¿Me das el número de cédula de la persona que necesita la cita?`;
    return ctx;
  }

  // Unrecognized answer — ask clearly
  ctx.earlyResponse = `${firstName ? firstName + ", \u00bf" : "\u00bf"}la cita es para ti o para otra persona?\n\n1. \ud83d\ude4b *Para m\u00ed*\n2. \ud83d\udc65 *Para otra persona*\n\nResponde con el n\u00famero o escribe tu respuesta. \ud83d\ude0a`;
  return ctx;
}
// ─── Helper: Build specialty list message ──────────────────────────────────

/**
 * Always refresh authorized specialties from DB before showing the list.
 * This ensures new DB changes (added/removed specialties) are reflected immediately.
 */
async function refreshAuthorizedSpecialties(phone: string, epsId?: number): Promise<Array<{ specialty_id: number; specialty_name: string; allows_double_appointment?: boolean }> | undefined> {
  if (!epsId) return undefined;
  try {
    const epsAuth = await DirectDBTools.getAuthorizedSpecialtiesForEPS({ eps_id: epsId });
    if (epsAuth.success && epsAuth.authorized_specialties?.length > 0) {
      updateState(phone, getStateContext(phone).currentState, {
        authorizedSpecialties: epsAuth.authorized_specialties,
      });
      return epsAuth.authorized_specialties;
    }
  } catch (e) {
    logger.warn({ err: e, epsId }, 'Error refreshing authorized specialties');
  }
  return getStateContext(phone).authorizedSpecialties;
}

function buildSpecialtyListMessage(
  firstName: string,
  authorizedSpecialties?: Array<{ specialty_id: number; specialty_name: string }>,
): string {
  const greeting = firstName ? `¡Perfecto, ${firstName}! 😊` : '¡Perfecto! 😊';
  if (authorizedSpecialties && authorizedSpecialties.length > 0) {
    let msg = `${greeting}\n\nEstas son las especialidades disponibles para tu EPS:\n\n`;
    authorizedSpecialties.forEach((s, i) => {
      msg += `${i + 1}. ${s.specialty_name}\n`;
    });
    msg += '\n¿Cuál especialidad necesitas? Responde con el número o el nombre. 😊';
    return msg;
  }
  return `${greeting} ¿Para qué especialidad necesitas la cita?`;
}

// ─── Specialty Selection ──────────────────────────────────────────────────

async function handleSpecialtySelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;

  // Always refresh authorized specialties from DB
  const authorized = await refreshAuthorizedSpecialties(phone, state.patientEpsId)
    || state.authorizedSpecialties as Array<{ specialty_id: number; specialty_name: string; allows_double_appointment?: boolean }> | undefined;

  let selectedName: string | undefined;
  let selectedId: number | undefined;
  let allowsDouble = false;

  if (authorized && authorized.length > 0) {
    // Try to match by number or fuzzy name
    const match = matchByNumberOrName(
      msg,
      authorized.map(s => ({ label: s.specialty_name, value: s })),
      0.5,
    );

    if (match) {
      selectedName = match.match.specialty_name;
      selectedId = match.match.specialty_id;
      allowsDouble = Boolean(match.match.allows_double_appointment);
    } else {
      // No match — show list again
      const firstName = state.patientName?.split(' ')[0] || '';
      ctx.earlyResponse = buildSpecialtyListMessage(firstName, authorized);
      return ctx;
    }
  } else {
    // No EPS authorization list → use free text
    const trimmed = ctx.message.trim();
    if (trimmed.length >= 3) {
      selectedName = trimmed;
    } else {
      return ctx; // Fall through to AI if very short message
    }
  }

  if (!selectedName) return ctx;

  // Eligibility check (gender/age)
  const eligErr = checkSpecialtyEligibility(selectedName, state.patientGender, state.patientAge);
  if (eligErr) {
    updateState(phone, ConversationState.AWAITING_SPECIALTY, {
      specialtyName: undefined, specialtyId: undefined,
    });
    ctx.earlyResponse = `Lo siento. ${eligErr}`;
    return ctx;
  }

  // Update state with selected specialty
  updateState(phone, ConversationState.AWAITING_SPECIALTY, {
    specialtyName: selectedName, specialtyId: selectedId,
    allowsDoubleAppointment: allowsDouble,
  });

  // If specialty is Ecografía → ask for CUPS code first
  if (selectedName && selectedName.toLowerCase().includes('ecograf')) {
    const firstName = state.patientName?.split(' ')[0] || '';
    updateState(phone, ConversationState.AWAITING_CUPS, {
      specialtyName: selectedName, specialtyId: selectedId,
    });
    ctx.earlyResponse = `${firstName ? firstName + ', para' : 'Para'} agendar tu cita de *${selectedName}* necesito el *código CUPS* que aparece en tu orden médica. 📋\n\nPor favor escríbelo (ejemplo: *881611*).`;
    return ctx;
  }

  // Fetch availability directly (step 04 already ran)
  return fetchAndRouteAvailability(ctx, phone, selectedName, selectedId, getStateContext(phone));
}

// ─── CUPS Code Input (Ecografías) ─────────────────────────────────────────

async function handleCUPSInput(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;
  const firstName = state.patientName?.split(' ')[0] || '';

  // Phase 2: cupsCode already set but not found → user is providing manual name
  if (state.cupsCode && !state.cupsName) {
    const manualName = msg.trim();
    if (manualName.length < 3) {
      ctx.earlyResponse = `Por favor escribe el nombre del examen de ecografía que necesitas (mínimo 3 caracteres). 📝`;
      return ctx;
    }
    updateState(phone, ConversationState.AWAITING_CUPS, {
      cupsName: manualName,
    });
    ctx.earlyResponse = `✅ Registrado: *${manualName}* (código ${state.cupsCode}).\n\nContinuemos con el agendamiento...`;
    // Continue to availability
    const updatedState = getStateContext(phone);
    return fetchAndRouteAvailability(ctx, phone, updatedState.specialtyName!, updatedState.specialtyId, updatedState);
  }

  // Phase 1: user is providing CUPS code
  const cleanCode = msg.replace(/[.\-\s]/g, '');

  // Validate format: should be a numeric code (typically 6 digits)
  if (!/^\d{4,8}$/.test(cleanCode)) {
    ctx.earlyResponse = `${firstName ? firstName + ', el' : 'El'} código CUPS debe ser un número de 4 a 8 dígitos (ejemplo: *881611*). 📋\n\nPor favor revisa tu orden médica e ingresa el código CUPS del examen.`;
    return ctx;
  }

  // Validate against DB
  try {
    const cupsResult = await DirectDBTools.getCUPSInfo({ cups_code: cleanCode });

    if (cupsResult.success && cupsResult.cups_data) {
      // Found → save and continue
      updateState(phone, ConversationState.AWAITING_CUPS, {
        cupsCode: cupsResult.cups_data.cups_code,
        cupsName: cupsResult.cups_data.cups_name,
        cupsId: cupsResult.cups_data.cups_id,
      });
      ctx.earlyResponse = `✅ Código CUPS *${cupsResult.cups_data.cups_code}*: *${cupsResult.cups_data.cups_name}*\n\nContinuemos con el agendamiento...`;
      const updatedState = getStateContext(phone);
      return fetchAndRouteAvailability(ctx, phone, updatedState.specialtyName!, updatedState.specialtyId, updatedState);
    }

    // Not found → save code, ask for manual name
    updateState(phone, ConversationState.AWAITING_CUPS, { cupsCode: cleanCode });
    ctx.earlyResponse = `No encontré el código CUPS *${cleanCode}* en nuestra base de datos. 🔍\n\nPor favor escribe el *nombre del examen* tal como aparece en tu orden médica (ejemplo: _Ecografía abdominal superior_).`;
    return ctx;
  } catch (err: any) {
    logger.error({ err: err.message, cupsCode: cleanCode }, 'Error validating CUPS code');
    // On error, accept the code and continue
    updateState(phone, ConversationState.AWAITING_CUPS, {
      cupsCode: cleanCode,
      cupsName: `Ecografía (código ${cleanCode})`,
    });
    const updatedState = getStateContext(phone);
    return fetchAndRouteAvailability(ctx, phone, updatedState.specialtyName!, updatedState.specialtyId, updatedState);
  }
}

// ─── Patient Registration (1-by-1 questions) ──────────────────────────────

async function handlePatientRegistration(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  if (!state.registrationPending) return ctx;
  const { phone } = ctx;
  const step = state.regStep || 'name';
  const trimmedMsg = ctx.message.trim();
  const isThirdParty = state.isThirdParty;
  const label = isThirdParty ? 'del paciente' : 'tu';
  const pronoun = isThirdParty ? 'su' : 'tu';

  logger.info({ phone, step, msg: trimmedMsg }, '📝 Registration step');

  // ── STEP 1: Name ──
  if (step === 'name') {
    const nameClean = trimmedMsg.replace(/[^a-záéíóúñüA-ZÁÉÍÓÚÑÜ\s]/g, '').trim();
    if (nameClean.length < 3 || nameClean.split(/\s+/).length < 2) {
      ctx.earlyResponse = `Por favor, indícame ${pronoun} nombre completo (nombres y apellidos). 😊`;
      return ctx;
    }
    updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
      regStep: 'birth_date', regName: nameClean,
    });
    ctx.earlyResponse = `Perfecto, *${nameClean}*. 😊\n\n¿Cuál es ${pronoun} fecha de nacimiento?\n_Ejemplo: 15/03/1990 o 15 de marzo de 1990_`;
    return ctx;
  }

  // ── STEP 2: Birth date ──
  if (step === 'birth_date') {
    const parsed = parseBirthDate(trimmedMsg);
    if (!parsed) {
      ctx.earlyResponse = `No logré entender la fecha. 😅\n\nPor favor escríbela así: *dd/mm/aaaa*\n_Ejemplo: 15/03/1990_`;
      return ctx;
    }
    updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
      regStep: 'gender', regBirthDate: parsed,
    });
    ctx.earlyResponse = `¿Cuál es ${pronoun} género?\n\n1. Masculino\n2. Femenino`;
    return ctx;
  }

  // ── STEP 3: Gender ──
  if (step === 'gender') {
    const norm = trimmedMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let gender: string | null = null;
    if (/^(1|m|masculino|hombre|masc|varon|male)$/i.test(norm)) gender = 'Masculino';
    else if (/^(2|f|femenino|mujer|fem|female)$/i.test(norm)) gender = 'Femenino';
    if (!gender) {
      ctx.earlyResponse = 'Por favor responde *1* para Masculino o *2* para Femenino. 😊';
      return ctx;
    }
    updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
      regStep: 'phone', regGender: gender,
    });
    ctx.earlyResponse = `¿Cuál es ${pronoun} número de teléfono? 📱`;
    return ctx;
  }

  // ── STEP 4: Phone ──
  if (step === 'phone') {
    const phoneClean = trimmedMsg.replace(/[\s\-\.\(\)]/g, '');
    if (!/^\d{7,15}$/.test(phoneClean)) {
      ctx.earlyResponse = 'Por favor ingresa un número de teléfono válido (solo dígitos, entre 7 y 15). 📱';
      return ctx;
    }
    updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
      regStep: 'eps', regPhone: phoneClean,
    });

    // Build EPS list
    let epsMsg = `¿Cuál es ${pronoun} EPS? 🏥\n\n`;
    try {
      const epsResult = await DirectDBTools.listActiveEPS();
      if (epsResult.success && epsResult.data?.eps_list?.length > 0) {
        epsResult.data.eps_list.forEach((eps: any, idx: number) => {
          epsMsg += `${idx + 1}. ${eps.name}\n`;
        });
        epsMsg += `\n_Responde con el número o el nombre de ${pronoun} EPS_`;
      } else {
        epsMsg += `_Escribe el nombre de ${pronoun} EPS_`;
      }
    } catch {
      epsMsg += `_Escribe el nombre de ${pronoun} EPS_`;
    }
    ctx.earlyResponse = epsMsg;
    return ctx;
  }

  // ── STEP 5: EPS ──
  if (step === 'eps') {
    let epsId: number | undefined;
    let epsName: string | undefined;

    try {
      const epsResult = await DirectDBTools.listActiveEPS();
      if (epsResult.success && epsResult.data?.eps_list?.length > 0) {
        const epsList = epsResult.data.eps_list;
        const numChoice = parseInt(trimmedMsg, 10);
        if (!isNaN(numChoice) && numChoice >= 1 && numChoice <= epsList.length) {
          epsId = epsList[numChoice - 1].id;
          epsName = epsList[numChoice - 1].name;
        } else {
          const msgLower = trimmedMsg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          const found = epsList.find((e: any) => {
            const n = e.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return n.includes(msgLower) || msgLower.includes(n);
          });
          if (found) { epsId = found.id; epsName = found.name; }
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Error searching EPS');
    }

    if (!epsId) {
      ctx.earlyResponse = 'No encontré esa EPS. 😅 Por favor responde con el *número* de la lista o escribe el nombre exacto de la EPS.';
      return ctx;
    }

    updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
      regStep: 'confirm', regEpsId: epsId, regEpsName: epsName,
    });

    const genderLabel = state.regGender || 'No especificado';
    const patronLabel = isThirdParty ? 'Datos del paciente' : 'Tus datos';
    ctx.earlyResponse = `📋 *${patronLabel} para registro:*\n\n` +
      `• *Nombre:* ${state.regName}\n` +
      `• *Cédula:* ${state.patientDocument}\n` +
      `• *Fecha de nacimiento:* ${formatBirthDateForDisplay(state.regBirthDate || '')}\n` +
      `• *Género:* ${genderLabel}\n` +
      `• *Teléfono:* ${state.regPhone}\n` +
      `• *EPS:* ${epsName}\n\n` +
      `¿Los datos son correctos? (Sí/No)`;
    return ctx;
  }

  // ── STEP 6: Confirm ──
  if (step === 'confirm') {
    if (isAffirmative(ctx.message)) {
      try {
        const regResult = await DirectDBTools.registerPatientSimple({
          document: state.patientDocument || '',
          name: state.regName || '',
          phone: state.regPhone,
          eps_id: state.regEpsId,
          birth_date: state.regBirthDate,
          gender: state.regGender,
          city: 'San Gil',
        });

        if (regResult.success && regResult.data?.patient_id) {
          const newPatientId = regResult.data.patient_id;
          const firstName = (state.regName || '').split(' ')[0];
          logger.info({ phone, patientId: newPatientId }, '✅ Patient registered');

          // Load EPS-authorized specialties for the new patient
          let authorizedSpecialties: Array<{ specialty_id: number; specialty_name: string }> | undefined;
          if (state.regEpsId) {
            try {
              const epsAuth = await DirectDBTools.getAuthorizedSpecialtiesForEPS({ eps_id: state.regEpsId });
              if (epsAuth.success && epsAuth.authorized_specialties?.length > 0) {
                authorizedSpecialties = epsAuth.authorized_specialties;
              }
            } catch { /* non-critical */ }
          }

          updateState(phone, ConversationState.AWAITING_SPECIALTY, {
            patientId: newPatientId,
            patientName: state.regName,
            patientDocument: state.patientDocument,
            patientPhone: state.regPhone,
            patientEpsId: state.regEpsId,
            patientEpsName: state.regEpsName,
            registrationPending: false,
            regStep: undefined, regName: undefined, regBirthDate: undefined,
            regGender: undefined, regPhone: undefined, regEpsId: undefined, regEpsName: undefined,
            authorizedSpecialties,
          });

          const genderSuffix = state.regGender === 'Femenino' ? 'a' : 'o';
          const specialtyMsg = buildSpecialtyListMessage(firstName, authorizedSpecialties);
          ctx.earlyResponse = `¡Listo! 🎉 *${firstName}* ha sido registrad${genderSuffix} exitosamente.\n\n${specialtyMsg}`;
          ctx.executedTools.push({ name: 'registerPatientSimple', result: `Paciente #${newPatientId} registrado` });
          return ctx;
        }

        ctx.earlyResponse = `Disculpa, hubo un error al crear el perfil: ${regResult.error || 'Error desconocido'}. 😔\n\nPuedes intentarlo en 🌐 *biosanarcall.site* o llamarnos al 607 691 1308.`;
        return ctx;
      } catch (err: any) {
        logger.error({ err }, 'Error registering patient');
        ctx.earlyResponse = 'Disculpa, tuve un problema técnico al crear el perfil. Puedes registrarte en 🌐 *biosanarcall.site* o llamarnos al 607 691 1308. 🏥';
        return ctx;
      }
    }

    if (isNegative(ctx.message)) {
      updateState(phone, ConversationState.AWAITING_PATIENT_DATA, {
        regStep: 'name', regName: undefined, regBirthDate: undefined,
        regGender: undefined, regPhone: undefined, regEpsId: undefined, regEpsName: undefined,
      });
      ctx.earlyResponse = 'Entendido, empecemos de nuevo. 😊\n\n¿Cuál es el nombre completo (nombres y apellidos)?';
      return ctx;
    }

    ctx.earlyResponse = 'Por favor responde *Sí* para confirmar o *No* para corregir los datos. 😊';
    return ctx;
  }

  return ctx;
}

// ─── Date helpers for registration ─────────────────────────────────────────

function parseBirthDate(input: string): string | null {
  const cleaned = input.trim();
  const meses: Record<string, string> = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12',
  };

  const slashMatch = cleaned.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (slashMatch) {
    const dd = slashMatch[1].padStart(2, '0');
    const mm = slashMatch[2].padStart(2, '0');
    const yyyy = slashMatch[3];
    if (+mm >= 1 && +mm <= 12 && +dd >= 1 && +dd <= 31) return `${yyyy}-${mm}-${dd}`;
  }

  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  const textMatch = cleaned.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .match(/(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:de\s+|del?\s+)?(\d{4})/);
  if (textMatch) {
    const mm = meses[textMatch[2]];
    if (mm) return `${textMatch[3]}-${mm}-${textMatch[1].padStart(2, '0')}`;
  }
  return null;
}

function formatBirthDateForDisplay(dateStr: string): string {
  if (!dateStr) return 'No especificada';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
// ─── Completed Cycle ──────────────────────────────────────────────────────

async function handleCompletedCycle(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;

  if (isAffirmative(ctx.message) || /otra cita|nueva cita|agendar otra|más citas|otro turno/i.test(msg)) {
    const requestorId = state.requestorPatientId || state.patientId;
    const requestorName = state.requestorPatientName || state.patientName;
    const requestorDoc = state.requestorPatientDocument || state.patientDocument;
    updateState(phone, ConversationState.AWAITING_BENEFICIARY, {
      patientId: requestorId,
      patientName: requestorName,
      patientDocument: requestorDoc,
      requestorPatientId: requestorId,
      requestorPatientName: requestorName,
      requestorPatientDocument: requestorDoc,
      specialtyId: undefined,
      specialtyName: undefined,
      selectedDoctor: undefined,
      selectedDoctorId: undefined,
      selectedDate: undefined,
      selectedTime: undefined,
      scheduledDatetime: undefined,
      availabilityId: undefined,
      timeSlots: undefined,
      availableAppointments: undefined,
      availableLocations: undefined,
      isThirdParty: undefined,
      isDoubleAppointment: undefined,
      reason: undefined,
    });
    const firstName = requestorName?.split(' ')[0] || '';
    ctx.earlyResponse = `¡Con gusto${firstName ? ', ' + firstName : ''}! 😊 ¿La nueva cita es para ti o para otra persona?`;
    return ctx;
  }

  if (isNegative(ctx.message)) {
    resetState(phone);
    const name = state.requestorPatientName || state.patientName || '';
    const firstName = name.split(' ')[0];
    ctx.earlyResponse = `¡Perfecto${firstName ? ', ' + firstName : ''}! Fue un gusto atenderte. ¡Hasta pronto! 😊`;
    return ctx;
  }

  return ctx;
}

// ─── Phone Confirmation ────────────────────────────────────────────────────

async function handlePhoneConfirmation(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;
  const patientName = state.patientName || 'paciente';

  if (isAffirmative(ctx.message)) {
    // After confirming identity, always ask for whom the appointment is
    updateState(phone, ConversationState.AWAITING_BENEFICIARY, {
      requestorPatientId: state.patientId,
      requestorPatientName: state.patientName,
      requestorPatientDocument: state.patientDocument,
    });
    const firstName = (state.patientName || '').split(' ')[0];
    ctx.earlyResponse = `¡Perfecto, ${firstName || patientName}! 😊\n\n¿La cita es para ti o para otra persona?`;
    return ctx;
  }

  if (isNegative(ctx.message)) {
    ctx.earlyResponse = 'Entendido. ¿Cuál es tu número de teléfono correcto? 📱';
    return ctx;
  }

  // Might be a new phone number
  const cleanedMsg = msg.replace(/[\s\-\.\(\)]/g, '');
  if (/^\d{7,15}$/.test(cleanedMsg)) {
    updateState(phone, ConversationState.AWAITING_SPECIALTY);
    const freshSpecs = await refreshAuthorizedSpecialties(phone, state.patientEpsId);
    const name = state.patientName?.split(' ')[0] || patientName;
    ctx.earlyResponse = `¡Perfecto, ${name}! He registrado tu número ${cleanedMsg}. 😊\n\n` + buildSpecialtyListMessage('', freshSpecs);
    return ctx;
  }

  return ctx; // Fall through to AI
}

// ─── Location Selection (NEW) ──────────────────────────────────────────────

async function handleLocationSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;
  const locations = state.availableLocations || [];
  if (!locations.length) return ctx;

  const firstName = state.patientName?.split(' ')[0] || '';

  // Match by number or fuzzy name
  const match = matchByNumberOrName(
    msg,
    locations.map((l: any) => ({ label: l.location_name, value: l })),
    0.5,
  );

  if (!match) {
    let response = `No entendí tu selección. 😅 Por favor elige una sede:\n\n`;
    locations.forEach((loc: any, i: number) => {
      response += `${i + 1}. 📍 ${loc.location_name}\n`;
    });
    response += '\nResponde con el número o el nombre de la sede.';
    ctx.earlyResponse = response;
    return ctx;
  }

  const selectedLoc = match.match;
  updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, {
    selectedLocationId: selectedLoc.location_id,
    selectedLocation: selectedLoc.location_name,
  });

  // Filter existing appointments by location, or fetch fresh data
  let appts = (state.availableAppointments || []).filter(
    (a: any) => a.location_id === selectedLoc.location_id,
  );

  if (appts.length === 0) {
    // Fetch availability filtered by specialty
    const availResult = await DirectDBTools.getAvailableAppointments({ specialty_name: state.specialtyName });
    if (availResult.success && availResult.data?.appointments?.length > 0) {
      appts = availResult.data.appointments.filter(
        (a: any) => a.location_id === selectedLoc.location_id,
      );
    }
  }

  if (appts.length === 0) {
    // No availability at this location
    updateState(phone, ConversationState.WAITING_LIST, {
      specialtyId: state.specialtyId,
      specialtyName: state.specialtyName,
      waitingListIntent: undefined,
    });
    ctx.earlyResponse = `${firstName ? firstName + ', no' : 'No'} hay citas disponibles para ${state.specialtyName} en ${selectedLoc.location_name} en este momento. 😔\n\n¿Te agrego a la lista de espera? Responde *sí* o *no*.`;
    return ctx;
  }

  // If specialty allows double appointment, ask before showing dates
  if (state.allowsDoubleAppointment) {
    updateState(phone, ConversationState.AWAITING_DOUBLE_APPOINTMENT, {
      pendingAppointments: appts,
      pendingLocationName: selectedLoc.location_name,
    });
    ctx.earlyResponse = `${firstName ? firstName + ', esta' : 'Esta'} especialidad permite *cita doble* (dos turnos consecutivos para mayor tiempo de atención). 📋\n\n¿Necesitas cita sencilla o doble?\n\n1. 🕐 *Sencilla* — un turno normal\n2. 🕐🕐 *Doble* — dos turnos consecutivos\n\nResponde *sencilla* o *doble*. 😊`;
    return ctx;
  }

  return routeDoctorsOrDates(ctx, phone, appts, state, firstName, selectedLoc.location_name);
}

/** Route to doctor selection or directly to date selection */
function routeDoctorsOrDates(
  ctx: PipelineContext, phone: string, appts: any[], state: any, firstName: string, locationName: string,
): PipelineContext {
  const uniqueDoctors = [...new Set(appts.map((a: any) => a.doctor_name))] as string[];
  const stateUpdate: Record<string, any> = {
    availableAppointments: appts,
    specialtyId: state.specialtyId || appts[0]?.specialty_id,
  };

  if (uniqueDoctors.length === 1) {
    stateUpdate.selectedDoctor = appts[0].doctor_name;
    stateUpdate.selectedDoctorId = appts[0].doctor_id;
    updateState(phone, ConversationState.AWAITING_DATE, stateUpdate);

    const uniqueDates = [...new Set(appts.map((a: any) => a.appointment_date_formatted))].slice(0, 7);
    let response = `¡Perfecto${firstName ? ', ' + firstName : ''}! 📅 En ${locationName} con el Dr(a). ${appts[0].doctor_name} tenemos:\n\n`;
    uniqueDates.forEach((f, i) => { response += `${i + 1}. ${String(f)}\n`; });
    response += '\n¿Cuál fecha te sirve? 😊';
    ctx.earlyResponse = response;
  } else {
    stateUpdate.availableDoctors = uniqueDoctors;
    updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, stateUpdate);

    let response = `${firstName ? firstName + ', en' : 'En'} ${locationName} para ${state.specialtyName} tenemos:\n\n`;
    uniqueDoctors.forEach((dn, i) => {
      const docAppts = appts.filter((a: any) => a.doctor_name === dn);
      const dates = [...new Set(docAppts.map((a: any) => a.appointment_date_formatted))].slice(0, 3);
      response += `${i + 1}. 👨‍⚕️ ${dn}\n   📅 ${dates.join(', ')}${docAppts.length > 3 ? '...' : ''}\n\n`;
    });
    response += '¿Con cuál doctor prefieres tu cita? 😊';
    ctx.earlyResponse = response;
  }
  return ctx;
}

// ─── Doctor Selection ──────────────────────────────────────────────────────

async function handleDoctorSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const doctors = state.availableDoctors || [];
  if (doctors.length === 0) return ctx;

  let selectedIndex: number | null = null;

  // Match by number
  const numPatterns = [/^(?:el )?primero?$/i, /^(?:el )?1$/, /^(?:el )?segundo$/i, /^(?:el )?2$/, /^(?:el )?tercero$/i, /^(?:el )?3$/, /^opci[oó]n\s*(\d)$/i, /^(\d)$/];
  for (const p of numPatterns) {
    const m = msg.match(p);
    if (m) {
      if (/primero?/i.test(msg) || msg === '1') selectedIndex = 0;
      else if (/segundo/i.test(msg) || msg === '2') selectedIndex = 1;
      else if (/tercero/i.test(msg) || msg === '3') selectedIndex = 2;
      else if (m[1]) selectedIndex = parseInt(m[1]) - 1;
      break;
    }
  }

  // Match by name
  if (selectedIndex === null) {
    for (let i = 0; i < doctors.length; i++) {
      const dn = doctors[i].toLowerCase();
      if (msg.includes(dn) || dn.includes(msg)) { selectedIndex = i; break; }
      for (const part of dn.split(' ')) {
        if (part.length > 3 && msg.includes(part)) { selectedIndex = i; break; }
      }
      if (selectedIndex !== null) break;
    }
  }

  if (selectedIndex !== null && selectedIndex >= 0 && selectedIndex < doctors.length) {
    const selectedDoctor = doctors[selectedIndex];
    const appts = state.availableAppointments || [];
    const doctorAppt = appts.find((a: any) => a.doctor_name?.toLowerCase() === selectedDoctor.toLowerCase());
    const update: Record<string, any> = { selectedDoctor };
    if (doctorAppt) {
      update.availabilityId = doctorAppt.availability_id;
      update.selectedDoctorId = doctorAppt.doctor_id;
      update.selectedDate = doctorAppt.appointment_date;
      update.specialtyId = doctorAppt.specialty_id;
    }
    updateState(ctx.phone, ConversationState.AWAITING_DATE, update);
    // Don't set earlyResponse — let AI present dates or let date step handle it
  }

  return ctx;
}

// ─── Date Selection ────────────────────────────────────────────────────────

async function handleDateSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const availAppts = state.availableAppointments || [];
  if (!availAppts.length) return ctx;

  const datePatterns = [
    /(?:el\s+)?(?:día\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\s*(\d{1,2})?/i,
    /(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i,
    /(?:fecha|opci[oó]n)\s*(\d+)/i, /^(\d)$/,
    /(?:me gusta(?:ría)?|prefiero|quiero|para)\s+(?:el\s+)?(\w+\s*\d*)/i,
  ];

  let dateMatched = false;
  for (const p of datePatterns) { if (p.test(msg)) { dateMatched = true; break; } }
  if (!dateMatched) return ctx;

  const uniqueDates = [...new Set(availAppts.map((a: any) => a.appointment_date_formatted))] as string[];
  let selectedFmt: string | null = null;

  // By option number
  const numMatch = msg.match(/(?:opci[oó]n\s*)?(\d)$/);
  if (numMatch) {
    const idx = parseInt(numMatch[1]) - 1;
    if (idx >= 0 && idx < uniqueDates.length) selectedFmt = uniqueDates[idx];
  }

  // By day name
  if (!selectedFmt) {
    const days = ['lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado', 'domingo'];
    for (const d of days) {
      if (msg.includes(d)) {
        selectedFmt = uniqueDates.find(f =>
          f.toLowerCase().includes(d) ||
          (d === 'miercoles' && f.toLowerCase().includes('miércoles')) ||
          (d === 'sabado' && f.toLowerCase().includes('sábado'))
        ) || null;
        if (selectedFmt) break;
      }
    }
  }

  // By day number
  if (!selectedFmt) {
    const dayNumMatch = msg.match(/(?:el\s+)?(\d{1,2})\s*(?:de\s+)?(\w+)?/i);
    if (dayNumMatch) {
      const dayNum = dayNumMatch[1];
      const month = dayNumMatch[2] || '';
      selectedFmt = uniqueDates.find(f => {
        const l = f.toLowerCase();
        if (month && l.includes(month.toLowerCase())) return l.includes(dayNum);
        return l.includes(` ${dayNum} `);
      }) || null;
    }
  }

  // Single option
  if (!selectedFmt && uniqueDates.length === 1) selectedFmt = uniqueDates[0];

  if (!selectedFmt) return ctx;

  const matchingAppts = availAppts.filter((a: any) => a.appointment_date_formatted === selectedFmt);
  if (!matchingAppts.length) return ctx;

  const selected = matchingAppts[0];
  const doctorId = state.selectedDoctorId || selected.doctor_id;
  const doctorName = state.selectedDoctor || selected.doctor_name;

  const slotsResult = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate({
    doctor_id: doctorId, date: selected.appointment_date, specialty_id: state.specialtyId || selected.specialty_id,
  });

  if (slotsResult.success && slotsResult.data?.available_times?.length > 0) {
    const times = slotsResult.data.available_times_formatted || slotsResult.data.available_times;
    const detail = slotsResult.data.slots_detail || [];

    updateState(ctx.phone, ConversationState.AWAITING_TIME, {
      timeSlots: detail, selectedDate: selected.appointment_date,
      selectedDoctor: doctorName, selectedDoctorId: doctorId,
      availabilityId: selected.availability_id, specialtyId: state.specialtyId || selected.specialty_id,
    });

    const dateLabel = slotsResult.data.date_formatted || selectedFmt;
    let response = `¡Excelente elección! 😊 Para el ${dateLabel}, tenemos estos horarios disponibles:\n\n`;
    times.slice(0, 5).forEach((t: string, i: number) => { response += `${i + 1}. ${t}\n`; });
    if (times.length > 5) response += `\n... y ${times.length - 5} horarios más.`;
    response += '\n\n¿Cuál horario te queda mejor? 🕐';

    ctx.executedTools.push({ name: 'getAvailableTimeSlotsForDoctorOnDate', result: `${times.length} slots` });
    ctx.earlyResponse = response;
    return ctx;
  }

  if (slotsResult.success && slotsResult.data?.available_times?.length === 0) {
    ctx.earlyResponse = `Lo siento, no hay horarios disponibles para el ${slotsResult.data.date_formatted || selectedFmt}. 😕\n\n¿Te gustaría ver otra fecha o te agrego a la lista de espera?`;
    return ctx;
  }

  return ctx;
}

// ─── Time Selection (with double appointment offer) ─────────────────────────

async function handleTimeSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const timeSlots = state.timeSlots || [];
  if (!timeSlots.length) return ctx;

  // "More options" request
  if (/m[aá]s\s*(opciones|horarios)|otras?\s*(opciones|horarios)|otro\s*horario/i.test(msg)) {
    const allTimes = timeSlots.map((s: any) => s.time_formatted || s.time_colombia);
    let response = '¡Claro! 😊 Estos son todos los horarios disponibles:\n\n';
    allTimes.forEach((t: string) => { response += `• ${t}\n`; });
    response += '\n¿Cuál te queda mejor?';
    ctx.earlyResponse = response;
    return ctx;
  }

  // Match by specific time (e.g. "1 pm", "2 de la tarde")
  const timePatterns = [
    /(\d{1,2})\s*(?:de la)?\s*(tarde|pm)/i,
    /(\d{1,2})\s*(?:de la)?\s*(mañana|am)/i,
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    /a las?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  ];

  let requestedHour: number | null = null;
  let requestedMinute = 0;
  let isPM = false;
  let isAM = false;

  for (const p of timePatterns) {
    const m = msg.match(p);
    if (m) {
      requestedHour = parseInt(m[1]);
      if (m[2] && /^\d{2}$/.test(m[2])) requestedMinute = parseInt(m[2]);
      const ampm = m[3] || m[2] || '';
      if (/pm|tarde/i.test(ampm)) isPM = true;
      else if (/am|mañana/i.test(ampm)) isAM = true;
      break;
    }
  }

  if (requestedHour !== null) {
    const foundSlot = findTimeSlot(timeSlots, requestedHour, requestedMinute, isPM, isAM);
    if (foundSlot) {
      return transitionAfterTimeSelection(ctx, state, foundSlot);
    } else {
      const available = timeSlots.slice(0, 5).map((s: any) => typeof s === 'string' ? s : (s.time_formatted || s.time)).join(', ');
      ctx.earlyResponse = `Disculpa, ese horario no está disponible. Los horarios que tenemos son: ${available}. ¿Cuál prefieres?`;
      return ctx;
    }
  }

  // Match by index number
  const numMatch = msg.match(/^(\d{1,2})$/);
  if (numMatch) {
    const n = parseInt(numMatch[1]);
    if (n >= 1 && n <= Math.min(10, timeSlots.length)) {
      return transitionAfterTimeSelection(ctx, state, timeSlots[n - 1]);
    }
  }

  // "mañana" / "tarde" shortcuts
  if (/mañana|temprano|primera hora/i.test(msg)) {
    return transitionAfterTimeSelection(ctx, state, timeSlots[0]);
  }

  if (/tarde/i.test(msg)) {
    const afternoon = timeSlots.find((s: any) => {
      const t = typeof s === 'string' ? s : (s.time_formatted || s.time);
      return /PM/i.test(t);
    });
    if (afternoon) {
      return transitionAfterTimeSelection(ctx, state, afternoon);
    }
  }

  return ctx;
}

/**
 * After selecting a time slot, go to AWAITING_REASON.
 * Double appointment question is already asked earlier (after location selection).
 */
async function transitionAfterTimeSelection(ctx: PipelineContext, state: any, slot: any): Promise<PipelineContext> {
  const selectedTime = typeof slot === 'string' ? slot : (slot.time_formatted || slot.time);
  const scheduledDatetime = typeof slot === 'object' ? slot.scheduled_datetime : null;

  // Save selected time
  const timeUpdate: Record<string, any> = { selectedTime };
  if (scheduledDatetime) timeUpdate.scheduledDatetime = scheduledDatetime;

  const doubleNote = state.isDoubleAppointment ? '\n\n📋 Se reservarán *dos turnos consecutivos*.' : '';

  updateState(ctx.phone, ConversationState.AWAITING_REASON, timeUpdate);
  ctx.earlyResponse = `¡Perfecto! Has seleccionado las ${selectedTime}.${doubleNote} 📋 ¿Cuál es el motivo de tu consulta?`;
  return ctx;
}

// ─── Double Appointment Selection ──────────────────────────────────────────

async function handleDoubleAppointmentSelection(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;
  const firstName = state.patientName?.split(' ')[0] || '';

  // Check if user answered the pre-dates double question (pendingAppointments present)
  const hasPendingAppts = state.pendingAppointments && state.pendingAppointments.length > 0;

  if (isAffirmative(ctx.message) || /doble|2|dos turnos/i.test(msg)) {
    updateState(phone, state.currentState, { isDoubleAppointment: true });
    if (hasPendingAppts) {
      // Continue to show dates
      const updatedState = getStateContext(phone);
      return routeDoctorsOrDates(ctx, phone, state.pendingAppointments, updatedState, firstName, state.pendingLocationName || state.selectedLocation || '');
    }
    // Fallback: already in time selection flow
    updateState(phone, ConversationState.AWAITING_REASON, { isDoubleAppointment: true });
    ctx.earlyResponse = `¡Listo! Se reservarán dos turnos consecutivos. 📋 ¿Cuál es el motivo de tu consulta?`;
    return ctx;
  }

  if (isNegative(ctx.message) || /sencilla|normal|una sola|no doble|1|simple/i.test(msg)) {
    updateState(phone, state.currentState, { isDoubleAppointment: false });
    if (hasPendingAppts) {
      // Continue to show dates
      const updatedState = getStateContext(phone);
      return routeDoctorsOrDates(ctx, phone, state.pendingAppointments, updatedState, firstName, state.pendingLocationName || state.selectedLocation || '');
    }
    // Fallback: already in time selection flow
    updateState(phone, ConversationState.AWAITING_REASON, { isDoubleAppointment: false });
    ctx.earlyResponse = `¡Perfecto! Se reservará una cita sencilla. 📋 ¿Cuál es el motivo de tu consulta?`;
    return ctx;
  }

  ctx.earlyResponse = `¿Necesitas cita *sencilla* o *doble*?\n\n1. 🕐 *Sencilla* — un turno normal\n2. 🕐🕐 *Doble* — dos turnos consecutivos\n\nResponde *sencilla* o *doble*. 😊`;
  return ctx;
}

// ─── Auto-schedule (AWAITING_REASON) with double appointment + SMS ──────────

async function handleAutoSchedule(ctx: PipelineContext, state: any, message: string): Promise<PipelineContext> {
  if (message.length <= 3 || !state.patientId || !state.availabilityId || !state.scheduledDatetime) return ctx;

  const wasAlreadyScheduled = await PersistenceService.wasScheduleAppointmentExecuted(ctx.phone, 5);
  if (wasAlreadyScheduled) {
    const last = await PersistenceService.getLastScheduledAppointment(ctx.phone);
    ctx.earlyResponse = `Ya tienes una cita confirmada:\n\n• **Cita #${last?.appointment_id}**\n• **Doctor:** ${last?.doctor_name}\n• **Fecha:** ${last?.scheduled_date}\n• **Hora:** ${last?.scheduled_time}\n\n¿Necesitas algo más? 😊`;
    return ctx;
  }

  const reason = message.length > 100 ? message.substring(0, 100) : message;
  try {
    const result = await DirectDBTools.scheduleAppointment({
      patient_id: state.patientId!, availability_id: state.availabilityId,
      scheduled_date: state.scheduledDatetime, reason,
      priority_level: 'Normal',
      create_double_appointment: state.isDoubleAppointment || false,
      cups_code: state.cupsCode || undefined,
      cups_manual_name: state.cupsName || undefined,
    });

    if (result.success) {
      const d = result.data;
      const firstName = state.patientName?.split(' ')[0] || '';
      const beneficiaryNote = state.isThirdParty
        ? `\n• **Paciente:** ${state.patientName || 'Beneficiario'}`
        : '';
      const locationName = d.location_name || state.selectedLocation || 'Sede principal';
      const doctorName = d.doctor_name || state.selectedDoctor;
      const appointmentDate = d.appointment_date || state.selectedDate;
      const appointmentTime = d.hora_cita_local || state.selectedTime;
      const doubleNote = state.isDoubleAppointment ? '\n• **Tipo:** Cita doble (2 turnos consecutivos)' : '';
      const cupsNote = state.cupsCode ? `\n• **Examen:** ${state.cupsName || 'Ecografía'} (CUPS ${state.cupsCode})` : '';

      updateState(ctx.phone, ConversationState.COMPLETED, { lastAppointmentId: d.appointment_id });
      ctx.earlyResponse = `¡Listo${firstName ? ', ' + firstName : ''}! 🎉 Tu cita ha sido confirmada:${beneficiaryNote}\n\n• **Cita #${d.appointment_id}**\n• **Doctor:** ${doctorName}\n• **Fecha:** ${appointmentDate}\n• **Hora:** ${appointmentTime}\n• **Sede:** ${locationName}\n• **Motivo:** ${reason}${doubleNote}${cupsNote}\n\nTe esperamos${firstName ? ', ' + firstName : ''}. 😊 Llega 15 minutos antes.\n\n¿Deseas agendar otra cita?`;
      ctx.executedTools.push({ name: 'scheduleAppointment', result: `Cita #${d.appointment_id}` });

      // Send SMS confirmation (fire-and-forget)
      sendSMSConfirmation({
        patientPhone: state.patientPhone || ctx.phone,
        patientName: state.patientName || '',
        patientId: state.patientId,
        appointmentId: d.appointment_id,
        doctorName: doctorName || '',
        specialtyName: state.specialtyName || '',
        appointmentDate: appointmentDate || '',
        appointmentTime: appointmentTime || '',
        locationName,
        isDouble: state.isDoubleAppointment || false,
      }).catch(err => logger.warn({ err }, 'SMS confirmation failed (non-blocking)'));

    } else {
      const isAuthError = /autoriza|no autoriza|sin autoriza|permiso/i.test(result.error || '');
      const errorMsg = isAuthError
        ? `Parece que tu EPS aún no ha autorizado esta especialidad. 😔\n\nPuedes:\n1. Verificar con tu EPS la autorización\n2. Ingresar a lista de espera\n3. Llámanos al 6076911308\n\n¿Te agrego a la lista de espera mientras gestionas la autorización?`
        : `Disculpa, tuve un inconveniente al confirmar tu cita. 😔\n\n¿Te agrego a la lista de espera o prefieres intentarlo de nuevo más tarde?`;

      if (state.specialtyId) {
        updateState(ctx.phone, ConversationState.WAITING_LIST, {
          waitingListIntent: undefined,
        });
      }
      ctx.earlyResponse = errorMsg;
    }
  } catch (err: any) {
    if (state.specialtyId) {
      updateState(ctx.phone, ConversationState.WAITING_LIST, { waitingListIntent: undefined });
      ctx.earlyResponse = 'Disculpa, tuve un problema técnico al confirmar tu cita. 😔\n\n¿Te agrego a la lista de espera o prefieres llamarnos al 6076911308?';
    } else {
      ctx.earlyResponse = 'Disculpa, tuve un problema técnico al confirmar tu cita. Por favor, llámanos al 6076911308 para agendarla. 🏥';
    }
  }
  return ctx;
}

// ─── SMS Confirmation Helper ───────────────────────────────────────────────

async function sendSMSConfirmation(params: {
  patientPhone: string; patientName: string; patientId: number;
  appointmentId: number; doctorName: string; specialtyName: string;
  appointmentDate: string; appointmentTime: string; locationName: string;
  isDouble: boolean;
}): Promise<void> {
  const firstName = params.patientName?.split(' ')[0] || '';
  const doubleMsg = params.isDouble ? ' (cita doble)' : '';
  const message = `Biosanar IPS: ${firstName ? firstName + ', tu' : 'Tu'} cita #${params.appointmentId} de ${params.specialtyName}${doubleMsg} con ${params.doctorName} el ${params.appointmentDate} a las ${params.appointmentTime} en ${params.locationName} ha sido confirmada. Llega 15 min antes. Info: biosanarcall.site`;

  await smsService.sendSMS({
    number: params.patientPhone,
    message: message.substring(0, 612), // LabsMobile max 4 SMS concatenados
    patient_id: params.patientId,
    appointment_id: params.appointmentId,
  });
  logger.info({ appointmentId: params.appointmentId, phone: params.patientPhone }, '📱 SMS confirmation sent');
}

// ─── Waiting List Confirmation ─────────────────────────────────────────────

async function handleWaitingListConfirmation(ctx: PipelineContext, state: any, msg: string): Promise<PipelineContext> {
  const { phone } = ctx;
  const firstName = state.patientName?.split(' ')[0] || '';

  // User says NO → go back to specialty selection
  if (isNegative(ctx.message)) {
    updateState(phone, ConversationState.AWAITING_SPECIALTY, {
      specialtyName: undefined,
      specialtyId: undefined,
      availableAppointments: undefined,
      waitingListIntent: undefined,
    });
    ctx.earlyResponse = `Entendido${firstName ? ', ' + firstName : ''}. 😊 ¿Te busco otra especialidad o hay algo más en lo que pueda ayudarte?`;
    return ctx;
  }

  // User says YES → determine priority, then add to waiting list
  if (isAffirmative(ctx.message)) {
    // Ask for priority if we don't have it yet
    if (!state.waitingListIntent) {
      updateState(phone, ConversationState.WAITING_LIST, { waitingListIntent: true });
      ctx.earlyResponse = `¡Con gusto${firstName ? ', ' + firstName : ''}! 😊 Para darte la prioridad adecuada, ¿tu consulta es de carácter:\n\n1. Urgente\n2. Alta\n3. Normal\n4. Baja\n\nResponde con el número o la palabra.`;
      return ctx;
    }
  }

  // Priority selection (when waitingListIntent is already true)
  if (state.waitingListIntent) {
    let priority = 'Normal';
    if (/urgente|1/i.test(msg)) priority = 'Urgente';
    else if (/alta?|2/i.test(msg)) priority = 'Alta';
    else if (/normal|3/i.test(msg)) priority = 'Normal';
    else if (/baja?|4/i.test(msg)) priority = 'Baja';

    if (!state.patientId || !state.specialtyId) {
      // Missing data — fall through to AI
      return ctx;
    }

    try {
      const result = await DirectDBTools.addToWaitingList({
        patient_id: state.patientId,
        specialty_id: state.specialtyId,
        reason: state.reason || `Consulta de ${state.specialtyName || 'especialidad'}`,
        priority_level: priority,
      });

      if (result.success) {
        const position = result.data?.queue_position ?? result.data?.position ?? '?';
        const waitingId = result.data?.waiting_list_id || result.data?.id || '';
        updateState(phone, ConversationState.COMPLETED, { waitingListIntent: undefined });
        ctx.earlyResponse = `✅ ¡Listo${firstName ? ', ' + firstName : ''}! Te he añadido a la lista de espera para ${state.specialtyName || 'la especialidad'} con prioridad *${priority}*.\n\n📋 Tu posición actual: *#${position}*${waitingId ? `\n🔖 Referencia: *#${waitingId}*` : ''}\n\nTe notificaremos en cuanto se libere un cupo. No necesitas volver a llamar. 😊\n\n¿Hay algo más en lo que pueda ayudarte?`;
        ctx.executedTools.push({ name: 'addToWaitingList', result: `WL position ${position}` });
      } else {
        // Friendly error
        const userMsg = result.error?.toLowerCase().includes('femen')
          ? result.error  // gender restriction already has a friendly message
          : `No pude inscribirte en la lista de espera en este momento. Por favor, llámanos al 6076911308 para hacerlo directamente. 🏥`;
        updateState(phone, ConversationState.COMPLETED, { waitingListIntent: undefined });
        ctx.earlyResponse = `😔 ${userMsg}`;
      }
    } catch {
      updateState(phone, ConversationState.COMPLETED, { waitingListIntent: undefined });
      ctx.earlyResponse = `Disculpa, tuve un problema técnico. Por favor, llámanos al 6076911308 para inscribirte en la lista de espera. 🏥`;
    }
    return ctx;
  }

  // Ambiguous response
  ctx.earlyResponse = `¿Deseas que te agregue a la lista de espera para ${state.specialtyName || 'esta especialidad'}? Responde *sí* o *no*. 😊`;
  return ctx;
}

// ─── Time Slot Finder Helper ───────────────────────────────────────────────

function findTimeSlot(slots: any[], hour: number, minute: number, isPM: boolean, isAM: boolean): any | null {
  const variations: string[] = [];
  if (isPM && hour <= 12) { variations.push(`${hour}:${String(minute).padStart(2, '0')} PM`); if (minute === 0) variations.push(`${hour}:00 PM`); }
  if (isAM || (!isPM && hour <= 12)) { variations.push(`${hour}:${String(minute).padStart(2, '0')} AM`); if (minute === 0) variations.push(`${hour}:00 AM`); }
  if (!isPM && !isAM) {
    variations.push(`${hour}:${String(minute).padStart(2, '0')} PM`);
    variations.push(`${hour}:${String(minute).padStart(2, '0')} AM`);
  }

  for (const slot of slots) {
    const slotTime = (typeof slot === 'string' ? slot : (slot.time_formatted || slot.time)).toUpperCase().trim();
    for (const v of variations) {
      if (slotTime === v.toUpperCase().trim()) return slot;
    }
  }
  return null;
}
