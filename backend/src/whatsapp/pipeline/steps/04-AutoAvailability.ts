/**
 * @module whatsapp/pipeline/steps/04-AutoAvailability
 * @description Pipeline step 4: Automatic availability lookup.
 *              If we have patient + specialty but no appointments, query them now.
 *              Also handles specialist queries without cédula.
 */

import type { PipelineContext } from '../../types';
import { ConversationState } from '../../types/state';
import { getStateContext, updateState } from '../../state/UnifiedStateManager';
import { logger } from '../../config';
import DirectDBTools from '../../../services/DirectDBTools';

/**
 * Step 4: Auto-fetch availability when enough context is known.
 */
export async function autoAvailabilityStep(ctx: PipelineContext): Promise<PipelineContext> {
  if (ctx.earlyResponse) return ctx;

  const { phone, message, intent } = ctx;
  const stateContext = getStateContext(phone);

  // 4A: Patient + specialty + no availability → fetch
  if (stateContext.patientId && stateContext.specialtyName && !stateContext.availableAppointments) {
    const availResult = await DirectDBTools.getAvailableAppointments({ specialty_name: stateContext.specialtyName });

    if (availResult.success && availResult.data?.appointments?.length > 0) {
      const appts = availResult.data.appointments;
      const uniqueDoctors = [...new Set(appts.map((a: any) => a.doctor_name))];
      const stateUpdate: Record<string, any> = {
        availableAppointments: appts,
        specialtyId: appts[0]?.specialty_id,
      };
      if (uniqueDoctors.length === 1) {
        stateUpdate.selectedDoctor = appts[0].doctor_name;
        stateUpdate.selectedDoctorId = appts[0].doctor_id;
      }
      updateState(phone, ConversationState.AWAITING_DATE, stateUpdate);

      const firstName = stateContext.patientName?.split(' ')[0] || '';
      const uniqueDates = [...new Set(appts.map((a: any) => a.appointment_date_formatted))].slice(0, 5);

      let response = `¡Perfecto${firstName ? ', ' + firstName : ''}! 📅\n\nPara ${stateContext.specialtyName} tenemos disponibilidad en:\n\n`;
      uniqueDates.forEach((fecha, idx) => { response += `${idx + 1}. ${String(fecha)}\n`; });
      response += '\n¿Cuál fecha te sirve? 😊';

      ctx.executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} citas, ${uniqueDates.length} fechas` });
      ctx.earlyResponse = response;
      return ctx;
    } else {
      const firstName = stateContext.patientName?.split(' ')[0] || '';
      ctx.earlyResponse = `${firstName ? firstName + ', no' : 'No'} hay citas disponibles para ${stateContext.specialtyName} en este momento. 😔\n\n¿Te agrego a la lista de espera?`;
      return ctx;
    }
  }

  // 4B: Specialist query (user asks about doctors/specialists for a specialty)
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
      const availResult = await DirectDBTools.getAvailableAppointments({ specialty_name: specialtyToSearch });
      if (availResult.success && availResult.data?.appointments?.length > 0) {
        const appts = availResult.data.appointments;
        const doctorsMap = new Map<string, { name: string; dates: string[]; location: string }>();
        appts.forEach((apt: any) => {
          const dn = apt.doctor_name;
          if (!doctorsMap.has(dn)) doctorsMap.set(dn, { name: dn, dates: [], location: apt.location_name || 'Sede San Gil' });
          const f = apt.appointment_date_formatted || apt.appointment_date;
          if (!doctorsMap.get(dn)!.dates.includes(f)) doctorsMap.get(dn)!.dates.push(f);
        });

        updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, {
          specialtyName: specialtyToSearch, availableAppointments: appts,
          availableDoctors: Array.from(doctorsMap.keys()),
        });

        let response = `Para ${specialtyToSearch} tenemos:\n\n`;
        doctorsMap.forEach((info, dn) => {
          response += `👨‍⚕️ **${dn}**\n   📍 ${info.location}\n   📅 ${info.dates.slice(0, 3).join(', ')}${info.dates.length > 3 ? '...' : ''}\n\n`;
        });
        response += '¿Con cuál doctor prefieres tu cita? 😊';
        if (!stateContext.patientId) response += '\n\n_Cuando elijas, te pediré tu cédula para agendar._';

        ctx.executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} citas, ${doctorsMap.size} doctores` });
        ctx.earlyResponse = response;
        return ctx;
      } else {
        ctx.earlyResponse = `No hay especialistas disponibles para ${specialtyToSearch} en este momento. 😔\n\n¿Te agrego a la lista de espera?`;
        return ctx;
      }
    }
  }

  // 4C: Explicit availability request when we have patient + specialty
  const wantsAvailability = /disponib|opciones|citas|agenda|horarios|cuando|qué hay|que hay|muestr/i.test(message) || intent === 'availability' || intent === 'schedule';
  if (wantsAvailability && stateContext.specialtyName && stateContext.patientId) {
    const availResult = await DirectDBTools.getAvailableAppointments({ specialty_name: stateContext.specialtyName });
    if (availResult.success && availResult.data?.appointments?.length > 0) {
      const appts = availResult.data.appointments;
      updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, {
        availableAppointments: appts, availableDoctors: availResult.data.unique_doctors || [],
        specialtyId: appts[0]?.specialty_id,
      });

      const firstName = stateContext.patientName?.split(' ')[0] || '';
      let response = `${firstName ? firstName + ', para' : 'Para'} ${stateContext.specialtyName} tenemos:\n\n`;
      appts.slice(0, 5).forEach((apt: any, idx: number) => {
        response += `${idx + 1}. ${apt.doctor_name} - ${apt.appointment_date_formatted || apt.appointment_date} a las ${apt.start_time_formatted || apt.start_time}\n`;
      });
      response += `\n¿Cuál te agendo${firstName ? `, ${firstName}` : ''}? 😊`;

      ctx.executedTools.push({ name: 'getAvailableAppointments', result: `${appts.length} found` });
      ctx.earlyResponse = response;
      return ctx;
    } else {
      const firstName = stateContext.patientName?.split(' ')[0] || '';
      ctx.earlyResponse = `${firstName ? firstName + ', no' : 'No'} hay citas disponibles para ${stateContext.specialtyName} en este momento. 😔\n\n¿Te agrego a la lista de espera?`;
      return ctx;
    }
  }

  return ctx;
}
