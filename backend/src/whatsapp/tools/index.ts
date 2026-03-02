/**
 * @module whatsapp/tools/index
 * @description Barrel export + auto-registration of all tools.
 */

export * from './ToolRegistry';
export { execute, summarizeToolResult, getSummaryFromResult } from './ToolExecutor';
export type { ExecutionResult } from './ToolExecutor';

// Re-export definition arrays for introspection
export { appointmentTools } from './definitions/appointment.tools';
export { patientTools } from './definitions/patient.tools';
export { lookupTools } from './definitions/lookup.tools';
export { waitlistTools } from './definitions/waitlist.tools';

// ─── Auto-register all tools ───────────────────────────────────────────────

import { registerAll } from './ToolRegistry';
import { appointmentTools } from './definitions/appointment.tools';
import { patientTools } from './definitions/patient.tools';
import { lookupTools } from './definitions/lookup.tools';
import { waitlistTools } from './definitions/waitlist.tools';

/**
 * Initialize the tool registry with all built-in tools.
 * Call this once during application startup.
 */
export function initializeTools(): void {
  registerAll(appointmentTools);
  registerAll(patientTools);
  registerAll(lookupTools);
  registerAll(waitlistTools);
}
