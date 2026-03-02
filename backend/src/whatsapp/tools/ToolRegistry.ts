/**
 * @module whatsapp/tools/ToolRegistry
 * @description Declarative tool registry.
 *              Tools are registered once at startup and looked up by name.
 *              Adding a new tool = one `register()` call — zero switch statements.
 */

import { logger } from '../config';
import type { ToolDefinition, ToolResult, ToolContext } from '../types';

// ─── Internal Store ────────────────────────────────────────────────────────

const registry = new Map<string, ToolDefinition>();

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Register a tool definition. Overwrites if name already exists.
 */
export function register(def: ToolDefinition): void {
  if (registry.has(def.name)) {
    logger.warn({ tool: def.name }, 'Tool re-registered (overwrite)');
  }
  registry.set(def.name, def);
}

/**
 * Register several tool definitions at once.
 */
export function registerAll(defs: ToolDefinition[]): void {
  for (const def of defs) {
    register(def);
  }
}

/**
 * Retrieve a tool definition by name.
 */
export function get(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

/**
 * Check whether a tool is registered.
 */
export function has(name: string): boolean {
  return registry.has(name);
}

/**
 * Get all registered tool names.
 */
export function listNames(): string[] {
  return Array.from(registry.keys());
}

/**
 * Get count of registered tools.
 */
export function size(): number {
  return registry.size;
}

/**
 * Remove a tool from the registry.
 */
export function unregister(name: string): boolean {
  return registry.delete(name);
}

/**
 * Clear all registered tools (useful for testing).
 */
export function clear(): void {
  registry.clear();
}

/**
 * Get all tool definitions (for introspection / docs).
 */
export function getAll(): ToolDefinition[] {
  return Array.from(registry.values());
}
