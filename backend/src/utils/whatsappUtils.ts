/**
 * Utilidades compartidas para el sistema WhatsApp
 * Centraliza funciones comunes usadas por múltiples módulos
 */

/**
 * Normalizar texto entrante (eliminar caracteres invisibles y limpiar)
 * Usado por: whatsapp.ts (route), WhatsAppConnection.ts
 */
export function normalizeIncomingText(text: string): string {
  if (!text) return '';
  
  return text
    // Eliminar caracteres de control invisibles
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    // Eliminar Zero-Width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Eliminar espacios Unicode especiales (excepto espacio normal y nbsp)
    .replace(/[\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ')
    // Normalizar múltiples espacios a uno solo
    .replace(/\s+/g, ' ')
    // Eliminar espacios al inicio y final
    .trim();
}

/**
 * Limpiar número de teléfono para formato estándar
 * Elimina @s.whatsapp.net, guiones, espacios, etc.
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone
    .replace('@s.whatsapp.net', '')
    .replace(/[\s\-\(\)]/g, '')
    .trim();
}
