/**
 * @module whatsapp/tools/definitions/lookup.tools
 * @description Tool definitions for reference data lookups (EPS, specialties, zones, CUPS).
 */

import DirectDBTools from '../../../services/DirectDBTools';
import type { ToolDefinition } from '../../types';

// ─── Definitions ───────────────────────────────────────────────────────────

export const listActiveEPSTool: ToolDefinition = {
  name: 'listActiveEPS',
  category: 'lookup',
  description: 'List all active EPS (insurance providers)',
  handler: async () => DirectDBTools.listActiveEPS(),
};

export const getAuthorizedSpecialtiesForEPSTool: ToolDefinition = {
  name: 'getAuthorizedSpecialtiesForEPS',
  category: 'lookup',
  description: 'Get authorized specialties for a given EPS',
  handler: async (args) => DirectDBTools.getAuthorizedSpecialtiesForEPS(args as any),
};

export const getAuthorizedLocationsForPatientTool: ToolDefinition = {
  name: 'getAuthorizedLocationsForPatient',
  category: 'lookup',
  description: 'Get authorized locations for a patient based on their EPS',
  handler: async (args) => DirectDBTools.getAuthorizedLocationsForPatient(args as any),
};

export const getCUPSInfoTool: ToolDefinition = {
  name: 'getCUPSInfo',
  category: 'lookup',
  description: 'Get CUPS procedure code information',
  handler: async (args) => DirectDBTools.getCUPSInfo(args as any),
};

export const searchSpecialtiesTool: ToolDefinition = {
  name: 'searchSpecialties',
  category: 'lookup',
  description: 'Search available medical specialties',
  handler: async (args) => DirectDBTools.searchSpecialties(args),
};

export const listZonesTool: ToolDefinition = {
  name: 'listZones',
  category: 'lookup',
  description: 'List all available geographic zones',
  handler: async () => DirectDBTools.listZones(),
};

export const getEPSServicesTool: ToolDefinition = {
  name: 'getEPSServices',
  category: 'lookup',
  description: 'Get services covered by a specific EPS',
  handler: async (args) => DirectDBTools.getEPSServices({ eps_id: args.eps_id }),
};

export const searchCupsTool: ToolDefinition = {
  name: 'searchCups',
  category: 'lookup',
  description: 'Search CUPS by code',
  handler: async (args) => DirectDBTools.searchCups({ code: args.cups_code, ...args }),
};

export const searchCupsByNameTool: ToolDefinition = {
  name: 'searchCupsByName',
  category: 'lookup',
  description: 'Search CUPS procedures by name',
  handler: async (args) => DirectDBTools.searchCupsByName({ name: args.name, limit: args.limit }),
};

// ─── Exported collection ───────────────────────────────────────────────────

export const lookupTools: ToolDefinition[] = [
  listActiveEPSTool,
  getAuthorizedSpecialtiesForEPSTool,
  getAuthorizedLocationsForPatientTool,
  getCUPSInfoTool,
  searchSpecialtiesTool,
  listZonesTool,
  getEPSServicesTool,
  searchCupsTool,
  searchCupsByNameTool,
];
