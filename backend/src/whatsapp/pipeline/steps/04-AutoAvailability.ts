/**
 * @module whatsapp/pipeline/steps/04-AutoAvailability
 * @description Pipeline step 4: Automatic availability lookup.
 *              Validates EPS authorization, fuzzy-matches specialties,
 *              handles location selection, and fetches availability.
 */

import type { PipelineContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState } from '../../state/UnifiedStateManager';
import { logger } from '../../config';
import DirectDBTools from '../../../services/DirectDBTools';
import { findBestMatch, matchByNumberOrName } from '../../utils/fuzzyMatch';

// ─── Business-rule restrictions per specialty ─────────────────────────────

export function checkSpecialtyEligibility(
  specialtyName: string,
  patientGender?: string,
  patientAge?: number,
): string | null {
  const name = specialtyName.toLowerCase();

  if (/ginecolog[ií]a|control\s*prenatal|obstetr/i.test(name)) {
    if (patientGender && !/femen|mujer|f$/i.test(patientGender)) {
      return `La especialidad ${specialtyName} está disponible únicamente para pacientes de sexo femenino. ¿Deseas consultar otra especialidad?`;
    }
  }

  if (/pediatr[ií]a/i.test(name)) {
    if (patientAge !== undefined && patientAge >= 18) {
      return `La especialidad ${specialtyName} es para pacientes menores de 18 años. Como adulto(a), puedes consultar Medicina General u otras especialidades. ¿Te busco disponibilidad?`;
    }
  }

  return null;
}

// ─── EPS Authorization check ──────────────────────────────────────────────

/**
 * If the patient has EPS-authorized specialties loaded, validate and optionally
 * fuzzy-match the requested specialty against the authorized list.
 * Returns { authorized, resolvedName, specialtyId, listMsg } or null if no EPS filter applies.
 */
function checkEPSAuthorization(
  requestedSpecialty: string,
  authorizedSpecialties?: Array<{ specialty_id: number; specialty_name: string }>,
  epsName?: string,
): { authorized: boolean; resolvedName?: string; specialtyId?: number; listMsg?: string } | null {
  if (!authorizedSpecialties || authorizedSpecialties.length === 0) return null; // no EPS filter

  // Fuzzy-match the requested specialty against the authorized list
  const match = findBestMatch(
    requestedSpecialty,
    authorizedSpecialties.map(s => ({ label: s.specialty_name, value: s })),
    0.5,
  );

  if (match) {
    return { authorized: true, resolvedName: match.match.specialty_name, specialtyId: match.match.specialty_id };
  }

  // Not authorized — build a list of available options
  const list = authorizedSpecialties.map((s, i) => `${i + 1}. ${s.specialty_name}`).join('\n');
  return {
    authorized: false,
    listMsg: `Tu EPS${epsName ? ` (${epsName})` : ''} no tiene autorizada la especialidad *${requestedSpecialty}*. 😔\n\nLas especialidades disponibles para ti son:\n\n${list}\n\n¿Cuál te gustaría? 😊`,
  };
}

// ─── Fetch availability with optional location filtering ──────────────────

export async function fetchAndRouteAvailability(
  ctx: PipelineContext,
  phone: string,
  specialtyName: string,
  specialtyId: number | undefined,
  stateContext: any,
): Promise<PipelineContext> {
  const firstName = stateContext.patientName?.split(' ')[0] || '';

  // If specialty is Ecografía and no CUPS code yet → ask for it first
  if (specialtyName && specialtyName.toLowerCase().includes('ecograf') && !stateContext.cupsCode) {
    updateState(phone, ConversationState.AWAITING_CUPS, {
      specialtyName, specialtyId,
    });
    ctx.earlyResponse = `${firstName ? firstName + ', para' : 'Para'} agendar tu cita de *${specialtyName}* necesito el *código CUPS* que aparece en tu orden médica. 📋\n\nPor favor escríbelo (ejemplo: *881611*).`;
    return ctx;
  }

  // If patient has EPS + specialty_id → check authorized locations
  if (stateContext.patientEpsId && specialtyId) {
    try {
      const locResult = await DirectDBTools.getAuthorizedLocationsForPatient({
        eps_id: stateContext.patientEpsId,
        specialty_id: specialtyId,
      });

      if (locResult.success && locResult.locations?.length > 1) {
        // Multiple authorized locations → ask user to choose
        updateState(phone, ConversationState.AWAITING_LOCATION, {
          specialtyName, specialtyId,
          availableLocations: locResult.locations,
        });
        let response = `${firstName ? firstName + ', ¿' : '¿'}en cuál sede deseas tu cita de ${specialtyName}?\n\n`;
        locResult.locations.forEach((loc: any, i: number) => {
          response += `${i + 1}. 📍 ${loc.location_name}\n`;
        });
        response += '\nResponde con el número o el nombre de la sede. 😊';
        ctx.earlyResponse = response;
        return ctx;
      }

      // 0 or 1 location → continue with fetching availability (auto-select if 1)
      if (locResult.success && locResult.locations?.length === 1) {
        updateState(phone, stateContext.currentState, {
          selectedLocationId: locResult.locations[0].location_id,
          selectedLocation: locResult.locations[0].location_name,
        });
      }
    } catch (e) {
      logger.warn({ err: e }, 'Error fetching authorized locations, continuing without filter');
    }
  }

  // Fetch availability
  const availResult = await DirectDBTools.getAvailableAppointments({ specialty_name: specialtyName });

  if (availResult.success && availResult.data?.appointments?.length > 0) {
    let appts = availResult.data.appointments;

    // Filter by selected location if set
    const updatedState = getStateContext(phone);
    if (updatedState.selectedLocationId) {
      const filtered = appts.filter((a: any) => a.location_id === updatedState.selectedLocationId);
      if (filtered.length > 0) appts = filtered;
    }

    // If specialty allows double appointment, ask before showing dates
    if (updatedState.allowsDoubleAppointment) {
      const locationName = updatedState.selectedLocation || appts[0]?.location_name || '';
      updateState(phone, ConversationState.AWAITING_DOUBLE_APPOINTMENT, {
        availableAppointments: appts,
        specialtyId: specialtyId || appts[0]?.specialty_id,
        pendingAppointments: appts,
        pendingLocationName: locationName,
      });
      ctx.earlyResponse = `${firstName ? firstName + ', esta' : 'Esta'} especialidad permite *cita doble* (dos turnos consecutivos para mayor tiempo de atención). 📋\n\n¿Necesitas cita sencilla o doble?\n\n1. 🕐 *Sencilla* — un turno normal\n2. 🕐🕐 *Doble* — dos turnos consecutivos\n\nResponde *sencilla* o *doble*. 😊`;
      ctx.executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} citas, asking double` });
      return ctx;
    }

    const uniqueDoctors = [...new Set(appts.map((a: any) => a.doctor_name))] as string[];
    const stateUpdate: Record<string, any> = {
      availableAppointments: appts,
      specialtyId: specialtyId || appts[0]?.specialty_id,
    };

    if (uniqueDoctors.length === 1) {
      // Single doctor → skip doctor selection, show dates
      stateUpdate.selectedDoctor = appts[0].doctor_name;
      stateUpdate.selectedDoctorId = appts[0].doctor_id;
      updateState(phone, ConversationState.AWAITING_DATE, stateUpdate);

      const uniqueDates = [...new Set(appts.map((a: any) => a.appointment_date_formatted))].slice(0, 7);
      let response = `¡Perfecto${firstName ? ', ' + firstName : ''}! 📅\n\nPara ${specialtyName} con el Dr(a). ${appts[0].doctor_name}`;
      if (updatedState.selectedLocation) response += ` en ${updatedState.selectedLocation}`;
      response += `, tenemos disponibilidad en:\n\n`;
      uniqueDates.forEach((fecha, idx) => { response += `${idx + 1}. ${String(fecha)}\n`; });
      response += '\n¿Cuál fecha te sirve? 😊';

      ctx.executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} citas, ${uniqueDates.length} fechas` });
      ctx.earlyResponse = response;
    } else {
      // Multiple doctors → ask user to choose
      const doctorsMap = new Map<string, { name: string; dates: string[]; location: string }>();
      appts.forEach((apt: any) => {
        const dn = apt.doctor_name;
        if (!doctorsMap.has(dn)) doctorsMap.set(dn, { name: dn, dates: [], location: apt.location_name || '' });
        const f = apt.appointment_date_formatted || apt.appointment_date;
        if (!doctorsMap.get(dn)!.dates.includes(f)) doctorsMap.get(dn)!.dates.push(f);
      });

      updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, {
        ...stateUpdate,
        availableDoctors: Array.from(doctorsMap.keys()),
      });

      let response = `${firstName ? firstName + ', para' : 'Para'} ${specialtyName} tenemos:\n\n`;
      let idx = 1;
      doctorsMap.forEach((info, dn) => {
        response += `${idx}. 👨‍⚕️ ${dn}\n   📍 ${info.location || 'Sede principal'}\n   📅 ${info.dates.slice(0, 3).join(', ')}${info.dates.length > 3 ? '...' : ''}\n\n`;
        idx++;
      });
      response += '¿Con cuál doctor prefieres tu cita? 😊';

      ctx.executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} citas, ${doctorsMap.size} doctores` });
      ctx.earlyResponse = response;
    }
    return ctx;
  }

  // No slots → waiting list
  updateState(phone, ConversationState.WAITING_LIST, {
    specialtyId: availResult.data?.specialty_id || specialtyId || stateContext.specialtyId,
    specialtyName,
    waitingListIntent: undefined,
  });
  ctx.earlyResponse = `${firstName ? firstName + ', no' : 'No'} hay citas disponibles para ${specialtyName} en este momento. 😔\n\nTambién puedes consultar disponibilidad en nuestro portal 🌐 *biosanarcall.site*\n\n¿Te agrego a la lista de espera? Responde *sí* o *no*.`;
  return ctx;
}

/**
 * Step 4: Auto-fetch availability when enough context is known.
 */
export async function autoAvailabilityStep(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.earlyResponse) return ctx;

  const { phone, message, intent } = ctx;
  const stateContext = getStateContext(phone);

  // Skip if user is already in a downstream selection state (location, doctor, date, time, etc.)
  const downstreamStates = [
    ConversationState.AWAITING_BENEFICIARY,
    ConversationState.AWAITING_DOCUMENT,
    ConversationState.AWAITING_LOCATION,
    ConversationState.AWAITING_CUPS,
    ConversationState.AWAITING_DOCTOR_SELECTION,
    ConversationState.AWAITING_DATE,
    ConversationState.AWAITING_TIME,
    ConversationState.AWAITING_DOUBLE_APPOINTMENT,
    ConversationState.AWAITING_REASON,
    ConversationState.WAITING_LIST,
    ConversationState.COMPLETED,
  ];
  if (downstreamStates.includes(stateContext.currentState)) return ctx;

  // 4A: Patient + specialty + no availability → validate EPS + eligibility → fetch
  if (stateContext.patientId && stateContext.specialtyName && !stateContext.availableAppointments) {
    // Business rule: gender/age eligibility
    const eligibilityError = checkSpecialtyEligibility(
      stateContext.specialtyName,
      stateContext.patientGender,
      stateContext.patientAge,
    );
    if (eligibilityError) {
      updateState(phone, ConversationState.AWAITING_SPECIALTY, {
        specialtyName: undefined, specialtyId: undefined,
      });
      ctx.earlyResponse = `Lo siento. ${eligibilityError}`;
      logger.info({ phone, specialty: stateContext.specialtyName, gender: stateContext.patientGender, age: stateContext.patientAge }, '⚠️ Specialty eligibility check failed');
      return ctx;
    }

    // EPS authorization check (fuzzy-match specialty name)
    const epsCheck = checkEPSAuthorization(
      stateContext.specialtyName,
      stateContext.authorizedSpecialties,
      stateContext.patientEpsName,
    );

    if (epsCheck && !epsCheck.authorized) {
      updateState(phone, ConversationState.AWAITING_SPECIALTY, {
        specialtyName: undefined, specialtyId: undefined,
      });
      ctx.earlyResponse = epsCheck.listMsg!;
      logger.info({ phone, specialty: stateContext.specialtyName, eps: stateContext.patientEpsName }, '⚠️ EPS authorization check failed');
      return ctx;
    }

    // Use resolved name from EPS auth (handles fuzzy correction)
    const resolvedSpecialty = epsCheck?.resolvedName || stateContext.specialtyName;
    const resolvedSpecialtyId = epsCheck?.specialtyId || stateContext.specialtyId;

    if (resolvedSpecialty !== stateContext.specialtyName) {
      updateState(phone, stateContext.currentState, {
        specialtyName: resolvedSpecialty,
        specialtyId: resolvedSpecialtyId,
      });
    }

    return fetchAndRouteAvailability(ctx, phone, resolvedSpecialty, resolvedSpecialtyId, getStateContext(phone));
  }

  // 4B: Specialist query (user asks about doctors for a specialty)
  const askingForSpecialists = /especiali|doctore?s?|médico|quiénes|quienes|cuáles|cuales|profesional|atiende|disponible/i.test(message);
  const hasSpecialtyContext = stateContext.specialtyName || /odontolog|medicina|psicolog|nutrici|general/i.test(message);

  if (askingForSpecialists && hasSpecialtyContext) {
    let specialtyToSearch = stateContext.specialtyName;
    if (!specialtyToSearch) {
      if (/odontolog/i.test(message)) specialtyToSearch = 'Odontologia';
      else if (/psicolog/i.test(message)) specialtyToSearch = 'Psicologia';
      else if (/nutrici/i.test(message)) specialtyToSearch = 'Nutricion';
      else if (/medicina.*general|general/i.test(message)) specialtyToSearch = 'Medicina General';
    }

    if (specialtyToSearch) {
      const eligErr = checkSpecialtyEligibility(specialtyToSearch, stateContext.patientGender, stateContext.patientAge);
      if (eligErr) {
        updateState(phone, ConversationState.AWAITING_SPECIALTY, { specialtyName: undefined, specialtyId: undefined });
        ctx.earlyResponse = `Lo siento. ${eligErr}`;
        return ctx;
      }

      const epsCheck = checkEPSAuthorization(specialtyToSearch, stateContext.authorizedSpecialties, stateContext.patientEpsName);
      if (epsCheck && !epsCheck.authorized) {
        updateState(phone, ConversationState.AWAITING_SPECIALTY, { specialtyName: undefined, specialtyId: undefined });
        ctx.earlyResponse = epsCheck.listMsg!;
        return ctx;
      }

      const resolved = epsCheck?.resolvedName || specialtyToSearch;
      const resolvedId = epsCheck?.specialtyId;
      updateState(phone, stateContext.currentState, { specialtyName: resolved, specialtyId: resolvedId });
      return fetchAndRouteAvailability(ctx, phone, resolved, resolvedId, getStateContext(phone));
    }
  }

  // 4C: Explicit availability request when we have patient + specialty
  const wantsAvailability = /disponib|opciones|citas|agenda|horarios|cuando|qué hay|que hay|muestr/i.test(message) || intent === 'availability' || intent === 'schedule';
  if (wantsAvailability && stateContext.specialtyName && stateContext.patientId) {
    return fetchAndRouteAvailability(ctx, phone, stateContext.specialtyName, stateContext.specialtyId, stateContext);
  }

  return ctx;
}
