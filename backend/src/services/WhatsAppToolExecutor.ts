import { RowDataPacket } from 'mysql2';
import pool from '../db/pool';
import pino from 'pino';
import DirectDBTools from './DirectDBTools';
import { getStateContext, updateState, ConversationState } from './WhatsAppStateManager';
import * as PersistenceService from './WhatsAppPersistenceService';
import * as ChatMemoryService from './ChatMemoryService';

const aiLogger = pino({
    level: process.env.LOG_LEVEL || 'info',
    name: 'whatsapp-tool-executor',
    transport: process.env.NODE_ENV !== 'production' ? {
        target: 'pino-pretty',
        options: { colorize: true }
    } : undefined
});

// Helper de fechas
function filterPastAppointments(appointments: any[]): any[] {
    if (!appointments || appointments.length === 0) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    return appointments.filter((appt: any) => {
        const apptDate = appt.appointment_date || appt.fecha_iso || appt.scheduled_date || appt.date;
        if (!apptDate) return false;
        return apptDate >= todayStr;
    });
}

// Obtener session ID
async function getSessionIdForPhone(phone: string): Promise<number | null> {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM whatsapp_chat_sessions WHERE phone = ? LIMIT 1',
            [phone]
        );
        return rows.length > 0 ? rows[0].id : null;
    } catch (error) {
        aiLogger.error({ error }, 'Error obteniendo session_id');
        return null;
    }
}

// Resumen del resultado para auditoría
export function getSummaryFromResult(result: any): any {
    if (!result?.data) return { dataPresent: false };
    if (result.data.appointment_id) {
        return {
            appointment_id: result.data.appointment_id,
            doctor_name: result.data.doctor_name,
            specialty_name: result.data.specialty_name
        };
    }
    if (result.data.found !== undefined) {
        return {
            found: result.data.found,
            patient_id: result.data.patient?.id
        };
    }
    if (result.data.appointments) {
        return {
            appointmentsCount: result.data.appointments.length
        };
    }
    return { dataPresent: true };
}

// === FIX TOOL CALLS HELPER (reducido para executor) ===
function fixToolCallPlaceholders(args: Record<string, any>, stateCtx: any, context: any, phone: string) {
    if (args.appointment_id && typeof args.appointment_id === 'string' && /\[|\]|placeholder/.test(args.appointment_id)) {
        if (stateCtx?.lastAppointmentId) {
            args.appointment_id = stateCtx.lastAppointmentId;
            aiLogger.info({ phone, fixed: stateCtx.lastAppointmentId }, 'Fixed appointment_id placeholder');
        }
    }
    if (args.availability_id && typeof args.availability_id === 'string' && /\[|\]|placeholder/.test(args.availability_id)) {
        if (stateCtx?.availabilityId) {
            args.availability_id = stateCtx.availabilityId;
            aiLogger.info({ phone, fixed: stateCtx.availabilityId }, 'Fixed availability_id placeholder');
        }
    }
    if (args.patient_id && typeof args.patient_id === 'string' && /\[|\]|placeholder/.test(args.patient_id)) {
        if (context.patient_id) {
            args.patient_id = context.patient_id;
            aiLogger.info({ phone, fixed: context.patient_id }, 'Fixed patient_id placeholder');
        }
    }
}

// ============================================================================
// EJECUCIÓN DE HERRAMIENTAS MCP CORE
// ============================================================================

export async function executeToolCall(
    toolName: string,
    args: Record<string, any>,
    context: any // ConversationContext de WhatsAppAIService
): Promise<any> {
    aiLogger.debug({ tool: toolName, args }, 'Executing tool');
    const toolStartTime = Date.now();

    try {
        let result: any;

        // HERRAMIENTAS DIRECTAS A BD
        switch (toolName) {
            case 'searchPatient': {
                result = await DirectDBTools.searchPatient(args);
                if (result.success && result.data?.found) {
                    context.patient_id = result.data.patient?.id;
                    context.patient_name = result.data.patient?.full_name;
                    context.patient_document = args.document;
                    context.patient_eps_id = result.data.patient?.insurance_eps_id;
                }
                break;
            }

            case 'registerPatientSimple':
                result = await DirectDBTools.registerPatientSimple(args as any);
                break;

            case 'listActiveEPS':
                result = await DirectDBTools.listActiveEPS();
                break;

            case 'getAvailableAppointments':
                if (!args.location_id && context.phone) {
                    const phoneState = getStateContext(context.phone);
                    if (phoneState.selectedLocationId) {
                        args.location_id = phoneState.selectedLocationId;
                    }
                }
                if (!args.eps_id && context.patient_eps_id) {
                    args.eps_id = context.patient_eps_id;
                    aiLogger.info({ eps_id: args.eps_id }, 'Injected eps_id from patient context for EPS-based filtering');
                }
                result = await DirectDBTools.getAvailableAppointments(args);
                if (result.success && result.data) {
                    const phone = context.phone;
                    if (phone) {
                        const appointments = filterPastAppointments(result.data.appointments || []);
                        const stateUpdate: Record<string, any> = {
                            specialtyName: args.specialty_name || appointments[0]?.specialty_name,
                            specialtyId: appointments[0]?.specialty_id
                        };

                        if (result.data.unique_doctors) {
                            stateUpdate.availableDoctors = result.data.unique_doctors;
                        }

                        if (appointments.length === 1) {
                            stateUpdate.availabilityId = appointments[0].availability_id;
                            stateUpdate.selectedDoctor = appointments[0].doctor || appointments[0].doctor_name;
                            stateUpdate.selectedDoctorId = appointments[0].doctor_id;
                            stateUpdate.selectedDate = appointments[0].fecha_iso || appointments[0].appointment_date;
                            aiLogger.info({
                                phone,
                                availabilityId: appointments[0].availability_id,
                                doctor: appointments[0].doctor || appointments[0].doctor_name
                            }, 'Pre-selected single availability option');
                        }

                        stateUpdate.availableAppointments = appointments;
                        updateState(phone, ConversationState.AWAITING_DOCTOR_SELECTION, stateUpdate);
                    }
                }
                break;

            case 'getAvailableTimeSlots':
                result = await DirectDBTools.getAvailableTimeSlots(args as any);
                break;

            case 'getAvailableTimeSlotsForDoctorOnDate':
                result = await DirectDBTools.getAvailableTimeSlotsForDoctorOnDate(args as any);
                break;

            case 'scheduleAppointment': {
                const phone = context.phone;
                const stateCtx = phone ? getStateContext(phone) : null;

                fixToolCallPlaceholders(args, stateCtx, context, phone || '');

                aiLogger.info({
                    phone,
                    correctedArgs: {
                        patient_id: args.patient_id,
                        availability_id: args.availability_id,
                        scheduled_date: args.scheduled_date
                    }
                }, '📋 Args finales para scheduleAppointment');

                result = await DirectDBTools.scheduleAppointment(args as any);

                if (result.success && result.data?.appointment_id && context.phone) {
                    try {
                        const sessionId = await getSessionIdForPhone(context.phone);

                        await PersistenceService.recordScheduledAppointment({
                            session_id: sessionId || 0,
                            phone: context.phone,
                            patient_id: args.patient_id || result.data.patient_id,
                            appointment_id: result.data.appointment_id,
                            availability_id: args.availability_id,
                            doctor_name: result.data.doctor_name,
                            specialty_name: result.data.specialty_name,
                            scheduled_date: result.data.appointment_date || args.scheduled_date?.split(' ')[0],
                            scheduled_time: result.data.scheduled_time_formatted || result.data.scheduled_time_colombia || args.scheduled_date?.split(' ')[1],
                            location_name: result.data.location_name,
                            status: 'scheduled'
                        });

                        if (sessionId) {
                            await ChatMemoryService.updateSessionAppointmentSelection(sessionId, {
                                last_appointment_id: result.data.appointment_id
                            });
                        }

                        aiLogger.info({
                            phone: context.phone,
                            appointmentId: result.data.appointment_id
                        }, '✅ Cita registrada en persistencia');
                    } catch (persistError: any) {
                        aiLogger.error({ error: persistError.message }, 'Error registrando cita en persistencia');
                    }
                }
                break;
            }

            case 'cancelAppointment':
                result = await DirectDBTools.cancelAppointment(args as any);
                if (result.success && args.appointment_id) {
                    try {
                        await PersistenceService.updateAppointmentStatus(args.appointment_id, 'cancelled');
                        aiLogger.info({ appointmentId: args.appointment_id }, '✅ Cancelación actualizada en persistencia');
                    } catch (persistError: any) {
                        aiLogger.error({ error: persistError.message }, 'Error actualizando cancelación en persistencia');
                    }
                }
                break;

            case 'searchSpecialties':
                result = await DirectDBTools.searchSpecialties(args);
                break;

            case 'getPatientAppointments':
                result = await DirectDBTools.getPatientAppointments(args);
                break;

            case 'actualizarPhone':
                result = await DirectDBTools.actualizarPhone(args as any);
                break;

            case 'checkConsecutiveSlots':
                result = await DirectDBTools.checkConsecutiveSlots(args as any);
                break;

            case 'scheduleDoubleAppointment':
                result = await DirectDBTools.scheduleDoubleAppointment(args as any);
                break;

            case 'addToWaitingListDirect':
            case 'addToWaitingList':
                result = await DirectDBTools.addToWaitingList(args as any);
                break;

            case 'getWaitingListPosition':
                result = await DirectDBTools.getWaitingListPosition(args as any);
                break;

            case 'getAvailabilityByDoctor':
                result = await DirectDBTools.getAvailabilityByDoctor(args as any);
                break;

            case 'listZones':
                result = await DirectDBTools.listZones();
                break;

            case 'getEPSServices':
                result = await DirectDBTools.getEPSServices({ eps_id: args.eps_id });
                break;

            case 'checkAvailabilityQuota':
                result = await DirectDBTools.checkAvailabilityQuota(args as any);
                break;

            case 'searchCups':
                result = await DirectDBTools.searchCups({ code: args.cups_code, ...args });
                break;

            case 'searchCupsByName':
                result = await DirectDBTools.searchCupsByName({ name: args.name, limit: args.limit });
                break;

            case 'getWaitingListAppointments':
                result = await DirectDBTools.getWaitingListAppointments(args);
                break;

            case 'reassignWaitingListAppointments':
                result = await DirectDBTools.reassignWaitingListAppointments(args as any);
                break;

            case 'cancelarCitasVencidas':
                result = await DirectDBTools.cancelarCitasVencidas(args as any);
                break;

            case 'getAuthorizedSpecialtiesForEPS':
                result = await DirectDBTools.getAuthorizedSpecialtiesForEPS(args as any);
                break;

            case 'getCUPSInfo':
                result = await DirectDBTools.getCUPSInfo(args as any);
                break;

            case 'getAuthorizedLocationsForPatient': {
                let resolvedArgs = { ...args };
                if (!resolvedArgs.eps_id && resolvedArgs.patient_id) {
                    try {
                        const [patientRows] = await pool.execute(
                            'SELECT insurance_eps_id FROM patients WHERE id = ? LIMIT 1',
                            [resolvedArgs.patient_id]
                        );
                        if ((patientRows as any[]).length > 0 && (patientRows as any[])[0].insurance_eps_id) {
                            resolvedArgs.eps_id = (patientRows as any[])[0].insurance_eps_id;
                        } else {
                            result = { success: false, error: 'El paciente no tiene EPS registrada. No se pueden determinar sedes autorizadas.' };
                            break;
                        }
                    } catch (err: any) {
                        result = { success: false, error: 'Error al consultar la EPS del paciente' };
                        break;
                    }
                }
                if (!resolvedArgs.eps_id && context.patient_eps_id) {
                    resolvedArgs.eps_id = context.patient_eps_id;
                }
                result = await DirectDBTools.getAuthorizedLocationsForPatient(resolvedArgs as any);
                break;
            }

            default:
                aiLogger.warn({ tool: toolName }, 'Unknown tool requested');
                return { success: false, error: `Herramienta desconocida: ${toolName}` };
        }

        const elapsed = Date.now() - toolStartTime;
        aiLogger.info({ tool: toolName, elapsed, success: result?.success }, 'Tool execution completed');

        if (context.phone) {
            try {
                await PersistenceService.recordToolCall({
                    phone: context.phone,
                    tool_name: toolName,
                    tool_args: args,
                    tool_result: result?.success ? { success: true, summary: getSummaryFromResult(result) } : result,
                    success: result?.success ?? false,
                    execution_time_ms: elapsed,
                    error_message: result?.error || null
                });
            } catch (recordError: any) {
                aiLogger.debug({ error: recordError.message }, 'Error registrando tool call (no crítico)');
            }
        }

        return result;
    } catch (error: any) {
        const elapsed = Date.now() - toolStartTime;
        aiLogger.error({ tool: toolName, error: error.message }, 'Tool execution failed');

        if (context.phone) {
            try {
                await PersistenceService.recordToolCall({
                    phone: context.phone,
                    tool_name: toolName,
                    tool_args: args,
                    tool_result: null,
                    success: false,
                    execution_time_ms: elapsed,
                    error_message: error.message
                });
            } catch (recordError: any) { }
        }

        return { success: false, error: error.message };
    }
}
