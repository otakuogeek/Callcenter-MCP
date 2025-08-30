/**
 * Utility functions for safe array operations
 */

/**
 * Safely maps over an array, returning empty array if input is not an array
 * @param data - The data to map over
 * @param mapFn - The mapping function
 * @returns Mapped array or empty array
 */
export function safeMap<T, R>(data: any, mapFn: (item: T, index: number) => R): R[] {
  if (!Array.isArray(data)) {
    console.warn('safeMap: Expected array but received:', typeof data, data);
    return [];
  }
  return data.map(mapFn);
}

/**
 * Safely filters an array, returning empty array if input is not an array
 * @param data - The data to filter
 * @param filterFn - The filter function
 * @returns Filtered array or empty array
 */
export function safeFilter<T>(data: any, filterFn: (item: T, index: number) => boolean): T[] {
  if (!Array.isArray(data)) {
    console.warn('safeFilter: Expected array but received:', typeof data, data);
    return [];
  }
  return data.filter(filterFn);
}

/**
 * Ensures a value is an array, converting it if necessary
 * @param value - The value to ensure is an array
 * @returns Array or empty array
 */
export function ensureArray<T>(value: any): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  // If it's a single value, wrap it in an array
  return [value];
}

/**
 * Safely gets the length of an array-like object
 * @param data - The data to get length from
 * @returns Length or 0
 */
export function safeLength(data: any): number {
  if (Array.isArray(data)) {
    return data.length;
  }
  return 0;
}
