"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationMemoryManager = void 0;
const mysql_js_1 = require("./db/mysql.js");
const fs_1 = require("fs");
const path_1 = require("path");
// Directorio para archivos temporales de memoria
const MEMORY_DIR = '/tmp/biosanarcall-memory';
// Crear directorio si no existe
const fs_2 = require("fs");
try {
    (0, fs_2.mkdirSync)(MEMORY_DIR, { recursive: true });
}
catch (error) {
    // Directorio ya existe
}
class ConversationMemoryManager {
    /**
     * Inicializar memoria de conversación
     */
    static async initializeMemory(patientDocument, sessionId, purpose = 'general') {
        try {
            const memoryData = {
                patient_info: {
                    document: patientDocument,
                    verified: false
                },
                conversation_context: {
                    purpose,
                    current_step: 'initialization',
                    completed_steps: [],
                    pending_questions: []
                },
                collected_data: {
                    personal_info: {},
                    medical_info: {},
                    appointment_info: {},
                    preferences: {}
                },
                interaction_history: [{
                        timestamp: new Date().toISOString(),
                        type: 'action',
                        content: `Conversación iniciada para ${purpose}`,
                        validated: true
                    }],
                metadata: {
                    start_time: new Date().toISOString(),
                    last_activity: new Date().toISOString(),
                    total_interactions: 1,
                    conversation_quality: 'initiated'
                }
            };
            // Guardar en base de datos
            const query = `
        INSERT INTO conversation_memory (patient_document, session_id, conversation_data, status)
        VALUES (?, ?, ?, 'active')
        ON DUPLICATE KEY UPDATE 
        conversation_data = VALUES(conversation_data),
        last_updated = CURRENT_TIMESTAMP
      `;
            await mysql_js_1.pool.execute(query, [patientDocument, sessionId, JSON.stringify(memoryData)]);
            // Guardar archivo temporal JSON
            const filePath = (0, path_1.join)(MEMORY_DIR, `${sessionId}.json`);
            (0, fs_1.writeFileSync)(filePath, JSON.stringify(memoryData, null, 2), 'utf8');
            return JSON.stringify({
                success: true,
                session_id: sessionId,
                message: 'Memoria de conversación inicializada',
                memory_data: memoryData
            });
        }
        catch (error) {
            console.error('Error initializing memory:', error);
            return JSON.stringify({
                success: false,
                error: 'Error al inicializar memoria de conversación'
            });
        }
    }
    /**
     * Agregar información a la memoria
     */
    static async addToMemory(sessionId, type, content, field, data) {
        try {
            // Leer memoria actual
            const filePath = (0, path_1.join)(MEMORY_DIR, `${sessionId}.json`);
            let memoryData;
            if ((0, fs_1.existsSync)(filePath)) {
                memoryData = JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
            }
            else {
                return JSON.stringify({
                    success: false,
                    error: 'Sesión de memoria no encontrada'
                });
            }
            // Agregar nueva interacción
            const interaction = {
                timestamp: new Date().toISOString(),
                type,
                content,
                field,
                validated: type === 'answer' ? true : undefined
            };
            memoryData.interaction_history.push(interaction);
            // Actualizar metadata
            memoryData.metadata.last_activity = new Date().toISOString();
            memoryData.metadata.total_interactions = (memoryData.metadata.total_interactions || 0) + 1;
            // Agregar datos específicos si se proporcionan
            if (data && field) {
                if (field.includes('personal')) {
                    memoryData.collected_data.personal_info = {
                        ...memoryData.collected_data.personal_info,
                        [field]: data
                    };
                }
                else if (field.includes('medical')) {
                    memoryData.collected_data.medical_info = {
                        ...memoryData.collected_data.medical_info,
                        [field]: data
                    };
                }
                else if (field.includes('appointment')) {
                    memoryData.collected_data.appointment_info = {
                        ...memoryData.collected_data.appointment_info,
                        [field]: data
                    };
                }
            }
            // Guardar en archivo y base de datos
            (0, fs_1.writeFileSync)(filePath, JSON.stringify(memoryData, null, 2), 'utf8');
            const query = `
        UPDATE conversation_memory 
        SET conversation_data = ?, last_updated = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `;
            await mysql_js_1.pool.execute(query, [JSON.stringify(memoryData), sessionId]);
            return JSON.stringify({
                success: true,
                message: 'Información agregada a la memoria',
                total_interactions: memoryData.metadata.total_interactions
            });
        }
        catch (error) {
            console.error('Error adding to memory:', error);
            return JSON.stringify({
                success: false,
                error: 'Error al agregar información a la memoria'
            });
        }
    }
    /**
     * Verificar información en la memoria
     */
    static async checkMemory(sessionId, field) {
        try {
            const filePath = (0, path_1.join)(MEMORY_DIR, `${sessionId}.json`);
            if (!(0, fs_1.existsSync)(filePath)) {
                return JSON.stringify({
                    found: false,
                    message: 'Sesión de memoria no encontrada'
                });
            }
            const memoryData = JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
            // Buscar en diferentes secciones
            let foundData = null;
            let location = '';
            // Buscar en patient_info
            if (memoryData.patient_info && memoryData.patient_info[field]) {
                foundData = memoryData.patient_info[field];
                location = 'patient_info';
            }
            // Buscar en collected_data
            if (!foundData) {
                const sections = ['personal_info', 'medical_info', 'appointment_info', 'preferences'];
                for (const section of sections) {
                    const sectionData = memoryData.collected_data[section];
                    if (sectionData && sectionData[field]) {
                        foundData = sectionData[field];
                        location = section;
                        break;
                    }
                }
            }
            // Buscar en interaction_history
            if (!foundData) {
                const interactions = memoryData.interaction_history.filter(interaction => interaction.field === field && interaction.type === 'answer');
                if (interactions.length > 0) {
                    foundData = interactions[interactions.length - 1].content; // Última respuesta
                    location = 'interaction_history';
                }
            }
            return JSON.stringify({
                found: !!foundData,
                data: foundData,
                location,
                field,
                message: foundData ? `Información encontrada en ${location}` : 'Información no encontrada en la memoria'
            });
        }
        catch (error) {
            console.error('Error checking memory:', error);
            return JSON.stringify({
                found: false,
                error: 'Error al verificar memoria'
            });
        }
    }
    /**
     * Obtener memoria completa
     */
    static async getMemory(sessionId) {
        try {
            const filePath = (0, path_1.join)(MEMORY_DIR, `${sessionId}.json`);
            if (!(0, fs_1.existsSync)(filePath)) {
                return JSON.stringify({
                    success: false,
                    message: 'Sesión de memoria no encontrada'
                });
            }
            const memoryData = JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
            return JSON.stringify({
                success: true,
                memory_data: memoryData,
                summary: {
                    total_interactions: memoryData.metadata.total_interactions,
                    current_step: memoryData.conversation_context.current_step,
                    purpose: memoryData.conversation_context.purpose,
                    patient_verified: memoryData.patient_info.verified
                }
            });
        }
        catch (error) {
            console.error('Error getting memory:', error);
            return JSON.stringify({
                success: false,
                error: 'Error al obtener memoria'
            });
        }
    }
    /**
     * Actualizar contexto de conversación
     */
    static async updateContext(sessionId, updates) {
        try {
            const filePath = (0, path_1.join)(MEMORY_DIR, `${sessionId}.json`);
            if (!(0, fs_1.existsSync)(filePath)) {
                return JSON.stringify({
                    success: false,
                    message: 'Sesión de memoria no encontrada'
                });
            }
            const memoryData = JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
            // Actualizar contexto
            memoryData.conversation_context = {
                ...memoryData.conversation_context,
                ...updates
            };
            memoryData.metadata.last_activity = new Date().toISOString();
            // Guardar cambios
            (0, fs_1.writeFileSync)(filePath, JSON.stringify(memoryData, null, 2), 'utf8');
            const query = `
        UPDATE conversation_memory 
        SET conversation_data = ?, last_updated = CURRENT_TIMESTAMP
        WHERE session_id = ?
      `;
            await mysql_js_1.pool.execute(query, [JSON.stringify(memoryData), sessionId]);
            return JSON.stringify({
                success: true,
                message: 'Contexto actualizado',
                new_context: memoryData.conversation_context
            });
        }
        catch (error) {
            console.error('Error updating context:', error);
            return JSON.stringify({
                success: false,
                error: 'Error al actualizar contexto'
            });
        }
    }
    /**
     * Cerrar sesión de memoria
     */
    static async closeMemory(sessionId, reason = 'completed') {
        try {
            const filePath = (0, path_1.join)(MEMORY_DIR, `${sessionId}.json`);
            if ((0, fs_1.existsSync)(filePath)) {
                const memoryData = JSON.parse((0, fs_1.readFileSync)(filePath, 'utf8'));
                // Agregar interacción de cierre
                memoryData.interaction_history.push({
                    timestamp: new Date().toISOString(),
                    type: 'action',
                    content: `Conversación finalizada: ${reason}`,
                    validated: true
                });
                memoryData.metadata.last_activity = new Date().toISOString();
                // Actualizar en base de datos
                const query = `
          UPDATE conversation_memory 
          SET conversation_data = ?, status = 'completed', last_updated = CURRENT_TIMESTAMP
          WHERE session_id = ?
        `;
                await mysql_js_1.pool.execute(query, [JSON.stringify(memoryData), sessionId]);
                // Mantener archivo temporal para posible reanudación
                (0, fs_1.writeFileSync)(filePath, JSON.stringify(memoryData, null, 2), 'utf8');
            }
            return JSON.stringify({
                success: true,
                message: 'Sesión de memoria cerrada exitosamente'
            });
        }
        catch (error) {
            console.error('Error closing memory:', error);
            return JSON.stringify({
                success: false,
                error: 'Error al cerrar memoria'
            });
        }
    }
}
exports.ConversationMemoryManager = ConversationMemoryManager;
