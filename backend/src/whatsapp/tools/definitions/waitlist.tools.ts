/**
 * @module whatsapp/tools/definitions/waitlist.tools
 * @description Tool definitions for waiting list management.
 */

import DirectDBTools from '../../../services/DirectDBTools';
import type { ToolDefinition } from '../../types';

// ─── Definitions ───────────────────────────────────────────────────────────

export const addToWaitingListTool: ToolDefinition = {
  name: 'addToWaitingList',
  category: 'waitlist',
  description: 'Add a patient to the waiting list for a specialty',
  handler: async (args) => DirectDBTools.addToWaitingList(args as any),
};

export const addToWaitingListDirectTool: ToolDefinition = {
  name: 'addToWaitingListDirect',
  category: 'waitlist',
  description: 'Add a patient to waiting list directly',
  handler: async (args) => DirectDBTools.addToWaitingList(args as any),
};

export const getWaitingListPositionTool: ToolDefinition = {
  name: 'getWaitingListPosition',
  category: 'waitlist',
  description: 'Get a patient\'s position in the waiting list',
  handler: async (args) => DirectDBTools.getWaitingListPosition(args as any),
};

export const getWaitingListAppointmentsTool: ToolDefinition = {
  name: 'getWaitingListAppointments',
  category: 'waitlist',
  description: 'Get waiting list appointments, optionally filtered by patient',
  handler: async (args) => DirectDBTools.getWaitingListAppointments(args),
};

export const reassignWaitingListAppointmentsTool: ToolDefinition = {
  name: 'reassignWaitingListAppointments',
  category: 'waitlist',
  description: 'Reassign waiting list patients when slots become available',
  handler: async (args) => DirectDBTools.reassignWaitingListAppointments(args as any),
};

export const getPatientWaitingListTool: ToolDefinition = {
  name: 'getPatientWaitingList',
  category: 'waitlist',
  description: 'Get all waiting list entries for a specific patient',
  handler: async (args) => DirectDBTools.getPatientWaitingList(args as any),
};

// ─── Exported collection ───────────────────────────────────────────────────

export const waitlistTools: ToolDefinition[] = [
  addToWaitingListTool,
  addToWaitingListDirectTool,
  getWaitingListPositionTool,
  getWaitingListAppointmentsTool,
  reassignWaitingListAppointmentsTool,
  getPatientWaitingListTool,
];
