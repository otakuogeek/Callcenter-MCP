/**
 * @module whatsapp/tools/definitions/patient.tools
 * @description Tool definitions for patient search, registration, and updates.
 */

import DirectDBTools from '../../../services/DirectDBTools';
import type { ToolDefinition } from '../../types';

// ─── Definitions ───────────────────────────────────────────────────────────

export const searchPatientTool: ToolDefinition = {
  name: 'searchPatient',
  category: 'patient',
  description: 'Search for a patient by document number',
  handler: async (args) => DirectDBTools.searchPatient(args as any),
  afterExecute: async (result, args, ctx) => {
    if (!result?.success || !result.data?.found) return;
    const patient = result.data.patient;
    if (patient && ctx.conversation) {
      ctx.conversation.patient_id = patient.id;
      ctx.conversation.patient_name = patient.full_name;
      ctx.conversation.patient_document = args.document;
      ctx.conversation.patient_eps_id = patient.insurance_eps_id;
    }
  },
};

export const registerPatientSimpleTool: ToolDefinition = {
  name: 'registerPatientSimple',
  category: 'patient',
  description: 'Register a new patient with basic and optional info',
  handler: async (args) => DirectDBTools.registerPatientSimple(args as any),
};

export const actualizarPhoneTool: ToolDefinition = {
  name: 'actualizarPhone',
  category: 'patient',
  description: 'Update a patient\'s phone number',
  handler: async (args) => DirectDBTools.actualizarPhone(args as any),
};

// ─── Exported collection ───────────────────────────────────────────────────

export const patientTools: ToolDefinition[] = [
  searchPatientTool,
  registerPatientSimpleTool,
  actualizarPhoneTool,
];
