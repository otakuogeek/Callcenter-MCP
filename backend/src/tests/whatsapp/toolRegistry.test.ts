/**
 * Tests for whatsapp/tools/ToolRegistry.ts
 */

import { register, get, has, listNames, size, clear, registerAll } from '../../whatsapp/tools/ToolRegistry';
import type { ToolDefinition } from '../../whatsapp/types/tools';

const mockTool: ToolDefinition = {
  name: 'testTool',
  category: 'test',
  description: 'A test tool',
  handler: async () => ({ success: true, data: { result: 'ok' } }),
};

const mockTool2: ToolDefinition = {
  name: 'testTool2',
  category: 'test',
  description: 'A second test tool',
  handler: async () => ({ success: true, data: { result: 'ok2' } }),
};

describe('ToolRegistry', () => {
  beforeEach(() => {
    clear();
  });

  describe('register', () => {
    it('should register a tool', () => {
      register(mockTool);
      expect(has('testTool')).toBe(true);
    });

    it('should overwrite existing tool with same name', () => {
      register(mockTool);
      const updated = { ...mockTool, description: 'updated' };
      register(updated);
      expect(get('testTool')?.description).toBe('updated');
    });
  });

  describe('registerAll', () => {
    it('should register multiple tools', () => {
      registerAll([mockTool, mockTool2]);
      expect(size()).toBe(2);
    });
  });

  describe('get', () => {
    it('should return undefined for unregistered tool', () => {
      expect(get('nonExistent')).toBeUndefined();
    });

    it('should return the registered tool', () => {
      register(mockTool);
      expect(get('testTool')).toEqual(mockTool);
    });
  });

  describe('has', () => {
    it('should return false for unregistered tool', () => {
      expect(has('nonExistent')).toBe(false);
    });

    it('should return true for registered tool', () => {
      register(mockTool);
      expect(has('testTool')).toBe(true);
    });
  });

  describe('listNames', () => {
    it('should return empty array when no tools registered', () => {
      expect(listNames()).toEqual([]);
    });

    it('should return all registered tool names', () => {
      registerAll([mockTool, mockTool2]);
      const names = listNames();
      expect(names).toContain('testTool');
      expect(names).toContain('testTool2');
    });
  });

  describe('size', () => {
    it('should return 0 when empty', () => {
      expect(size()).toBe(0);
    });

    it('should return count of registered tools', () => {
      registerAll([mockTool, mockTool2]);
      expect(size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should remove all tools', () => {
      registerAll([mockTool, mockTool2]);
      clear();
      expect(size()).toBe(0);
    });
  });
});
