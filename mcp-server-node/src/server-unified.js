"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var promise_1 = require("mysql2/promise");
var app = (0, express_1.default)();
var PORT = process.env.PORT || 8976;
// Configuración CORS amplia para MCP Inspector
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'x-requested-with'],
    credentials: false
}));
app.use(express_1.default.json({ limit: '50mb' }));
// Middleware para logging de requests del MCP Inspector
app.use(function (req, res, next) {
    if (req.path.includes('mcp')) {
        console.log("\uD83D\uDD0D MCP Request: ".concat(req.method, " ").concat(req.path));
        console.log("\uD83D\uDD0D Headers:", req.headers);
        if (req.body && Object.keys(req.body).length > 0) {
            console.log("\uD83D\uDD0D Body:", JSON.stringify(req.body, null, 2));
        }
    }
    next();
});
var pool;
rom;
'express';
var app = (0, express_1.default)();
var PORT = process.env.PORT || 8976;
// Configuración CORS
app.use((0, cors_1.default)({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-MCP-*'],
    credentials: false
}));
app.use(express_1.default.json({ limit: '50mb' }));
// Middleware para StreamableHttp
app.use(function (req, res, next) {
    var _a;
    // Soporte para MCP Inspector StreamableHttp
    if (((_a = req.headers['content-type']) === null || _a === void 0 ? void 0 : _a.includes('application/json')) ||
        req.headers['x-mcp-transport'] === 'streamable-http') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-MCP-*');
    }
    next();
});
var pool;
// Crear pool de conexiones
try {
    pool = promise_1.default.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'biosanar',
        charset: 'utf8mb4',
        timezone: '+00:00',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('✓ Configuración de pool MySQL completada');
}
catch (error) {
    console.error('✗ Error configurando pool MySQL:', error);
    process.exit(1);
}
// Helper functions
function createSuccessResponse(id, result) {
    return {
        jsonrpc: '2.0',
        id: id,
        result: result
    };
}
function createErrorResponse(id, code, message, data) {
    return {
        jsonrpc: '2.0',
        id: id,
        error: { code: code, message: message, data: data }
    };
}
// Herramientas MCP unificadas - Sistema médico completo
var UNIFIED_TOOLS = [
    // === PACIENTES ===
    {
        name: 'searchPatients',
        description: 'Buscar pacientes por nombre, documento o teléfono',
        inputSchema: {
            type: 'object',
            properties: {
                q: { type: 'string', description: 'Término de búsqueda (nombre, documento, teléfono)' },
                limit: { type: 'number', description: 'Máximo resultados (1-100)', minimum: 1, maximum: 100, default: 20 }
            },
            required: ['q']
        }
    },
    {
        name: 'getPatient',
        description: 'Obtener información detallada de un paciente por ID',
        inputSchema: {
            type: 'object',
            properties: {
                patient_id: { type: 'number', description: 'ID del paciente' }
            },
            required: ['patient_id']
        }
    },
    {
        name: 'createPatient',
        description: 'Crear nuevo paciente en el sistema',
        inputSchema: {
            type: 'object',
            properties: {
                document: { type: 'string', description: 'Documento de identidad' },
                document_type_id: { type: 'number', description: 'ID del tipo de documento' },
                name: { type: 'string', description: 'Nombre completo' },
                phone: { type: 'string', description: 'Teléfono principal' },
                phone_alt: { type: 'string', description: 'Teléfono alternativo' },
                email: { type: 'string', description: 'Email' },
                birth_date: { type: 'string', description: 'Fecha nacimiento YYYY-MM-DD' },
                gender: { type: 'string', enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'], description: 'Género' },
                address: { type: 'string', description: 'Dirección' },
                municipality_id: { type: 'number', description: 'ID del municipio' },
                zone_id: { type: 'number', description: 'ID de la zona' },
                insurance_eps_id: { type: 'number', description: 'ID de la EPS' },
                insurance_affiliation_type: { type: 'string', enum: ['Contributivo', 'Subsidiado', 'Vinculado', 'Particular', 'Otro'], description: 'Tipo de afiliación' },
                blood_group_id: { type: 'number', description: 'ID del grupo sanguíneo' },
                population_group_id: { type: 'number', description: 'ID del grupo poblacional' },
                education_level_id: { type: 'number', description: 'ID del nivel educativo' },
                marital_status_id: { type: 'number', description: 'ID del estado civil' },
                has_disability: { type: 'boolean', description: 'Tiene discapacidad', default: false },
                disability_type_id: { type: 'number', description: 'ID del tipo de discapacidad' },
                estrato: { type: 'number', description: 'Estrato socioeconómico (0-6)', minimum: 0, maximum: 6 },
                notes: { type: 'string', description: 'Notas adicionales' }
            },
            required: [
                'document',
                'document_type_id',
                'name',
                'birth_date',
                'gender',
                'address',
                'municipality_id',
                'phone',
                'email',
                'insurance_eps_id',
                'insurance_affiliation_type',
                'blood_group_id',
                'population_group_id',
                'education_level_id',
                'marital_status_id',
                'estrato'
            ]
        }
    },
    {
        name: 'updatePatient',
        description: 'Actualizar información de un paciente',
        inputSchema: {
            type: 'object',
            properties: {
                patient_id: { type: 'number', description: 'ID del paciente' },
                name: { type: 'string', description: 'Nombre completo' },
                phone: { type: 'string', description: 'Teléfono principal' },
                phone_alt: { type: 'string', description: 'Teléfono alternativo' },
                email: { type: 'string', description: 'Email' },
                address: { type: 'string', description: 'Dirección' },
                municipality_id: { type: 'number', description: 'ID del municipio' },
                zone_id: { type: 'number', description: 'ID de la zona' },
                insurance_eps_id: { type: 'number', description: 'ID de la EPS' },
                insurance_affiliation_type: { type: 'string', enum: ['Contributivo', 'Subsidiado', 'Vinculado', 'Particular', 'Otro'], description: 'Tipo de afiliación' },
                blood_group_id: { type: 'number', description: 'ID del grupo sanguíneo' },
                population_group_id: { type: 'number', description: 'ID del grupo poblacional' },
                education_level_id: { type: 'number', description: 'ID del nivel educativo' },
                marital_status_id: { type: 'number', description: 'ID del estado civil' },
                has_disability: { type: 'boolean', description: 'Tiene discapacidad' },
                disability_type_id: { type: 'number', description: 'ID del tipo de discapacidad' },
                estrato: { type: 'number', description: 'Estrato socioeconómico (0-6)', minimum: 0, maximum: 6 },
                notes: { type: 'string', description: 'Notas adicionales' },
                status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del paciente' }
            },
            required: ['patient_id']
        }
    },
    // === CITAS ===
    {
        name: 'getAppointments',
        description: 'Obtener citas por fecha específica',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' },
                status: { type: 'string', enum: ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'], description: 'Filtrar por estado' },
                patient_id: { type: 'number', description: 'Filtrar por paciente' },
                doctor_id: { type: 'number', description: 'Filtrar por médico' }
            }
        }
    },
    {
        name: 'createAppointment',
        description: 'Crear nueva cita médica',
        inputSchema: {
            type: 'object',
            properties: {
                patient_id: { type: 'number', description: 'ID del paciente' },
                doctor_id: { type: 'number', description: 'ID del médico' },
                specialty_id: { type: 'number', description: 'ID de la especialidad' },
                location_id: { type: 'number', description: 'ID de la sede' },
                scheduled_at: { type: 'string', description: 'Fecha y hora YYYY-MM-DD HH:MM:SS' },
                duration_minutes: { type: 'number', description: 'Duración en minutos', default: 30 },
                appointment_type: { type: 'string', enum: ['Presencial', 'Telemedicina'], description: 'Tipo de cita' },
                reason: { type: 'string', description: 'Motivo de la cita' }
            },
            required: ['patient_id', 'doctor_id', 'specialty_id', 'location_id', 'scheduled_at']
        }
    },
    {
        name: 'updateAppointmentStatus',
        description: 'Actualizar estado de una cita',
        inputSchema: {
            type: 'object',
            properties: {
                appointment_id: { type: 'number', description: 'ID de la cita' },
                status: { type: 'string', enum: ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'], description: 'Nuevo estado' },
                notes: { type: 'string', description: 'Notas adicionales' },
                cancellation_reason: { type: 'string', description: 'Razón de cancelación (si aplica)' }
            },
            required: ['appointment_id', 'status']
        }
    },
    // === MÉDICOS ===
    {
        name: 'getDoctors',
        description: 'Listar médicos con sus especialidades y ubicaciones',
        inputSchema: {
            type: 'object',
            properties: {
                active_only: { type: 'boolean', description: 'Solo médicos activos', default: true },
                specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
                location_id: { type: 'number', description: 'Filtrar por ubicación' }
            }
        }
    },
    {
        name: 'createDoctor',
        description: 'Crear nuevo médico en el sistema',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Nombre completo' },
                email: { type: 'string', description: 'Email' },
                phone: { type: 'string', description: 'Teléfono' },
                license_number: { type: 'string', description: 'Número de licencia médica' },
                specialties: { type: 'array', items: { type: 'number' }, description: 'IDs de especialidades' },
                locations: { type: 'array', items: { type: 'number' }, description: 'IDs de ubicaciones' }
            },
            required: ['name', 'license_number']
        }
    },
    // === ESPECIALIDADES ===
    {
        name: 'getSpecialties',
        description: 'Listar todas las especialidades médicas',
        inputSchema: {
            type: 'object',
            properties: {
                active_only: { type: 'boolean', description: 'Solo especialidades activas', default: true }
            }
        }
    },
    {
        name: 'createSpecialty',
        description: 'Crear nueva especialidad médica',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Nombre de la especialidad' },
                description: { type: 'string', description: 'Descripción' },
                default_duration_minutes: { type: 'number', description: 'Duración por defecto en minutos', default: 30 }
            },
            required: ['name']
        }
    },
    // === UBICACIONES ===
    {
        name: 'getLocations',
        description: 'Listar sedes/ubicaciones disponibles',
        inputSchema: {
            type: 'object',
            properties: {
                active_only: { type: 'boolean', description: 'Solo ubicaciones activas', default: true }
            }
        }
    },
    {
        name: 'createLocation',
        description: 'Crear nueva sede/ubicación',
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Nombre de la sede' },
                address: { type: 'string', description: 'Dirección' },
                phone: { type: 'string', description: 'Teléfono' },
                type: { type: 'string', description: 'Tipo de ubicación', default: 'Sucursal' },
                capacity: { type: 'number', description: 'Capacidad', default: 0 }
            },
            required: ['name']
        }
    },
    // === CONSULTAS ESPECIALES ===
    {
        name: 'getDaySummary',
        description: 'Resumen completo del día con estadísticas de citas',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
            }
        }
    },
    {
        name: 'getPatientHistory',
        description: 'Historial completo de citas de un paciente',
        inputSchema: {
            type: 'object',
            properties: {
                patient_id: { type: 'number', description: 'ID del paciente' },
                limit: { type: 'number', description: 'Número máximo de registros', default: 10 }
            },
            required: ['patient_id']
        }
    },
    {
        name: 'getDoctorSchedule',
        description: 'Agenda de un médico en una fecha específica',
        inputSchema: {
            type: 'object',
            properties: {
                doctor_id: { type: 'number', description: 'ID del médico' },
                date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
            },
            required: ['doctor_id']
        }
    },
    // === TABLAS LOOKUP ===
    {
        name: 'getDocumentTypes',
        description: 'Obtener tipos de documento disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'getBloodGroups',
        description: 'Obtener grupos sanguíneos disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'getEducationLevels',
        description: 'Obtener niveles educativos disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'getMaritalStatuses',
        description: 'Obtener estados civiles disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'getPopulationGroups',
        description: 'Obtener grupos poblacionales disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'getDisabilityTypes',
        description: 'Obtener tipos de discapacidad disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'getMunicipalities',
        description: 'Obtener municipios disponibles',
        inputSchema: {
            type: 'object',
            properties: {
                zone_id: { type: 'number', description: 'Filtrar por zona' }
            }
        }
    },
    {
        name: 'getZones',
        description: 'Obtener zonas disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'getEPS',
        description: 'Obtener EPS disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'executeCustomQuery',
        description: 'Ejecutar consulta SQL personalizada (solo SELECT)',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Consulta SQL SELECT' },
                params: { type: 'array', description: 'Parámetros para la consulta', items: { type: 'string' } }
            },
            required: ['query']
        }
    }
];
// Implementación de herramientas
function executeToolCall(name, args) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 55, , 56]);
                    _a = name;
                    switch (_a) {
                        case 'searchPatients': return [3 /*break*/, 1];
                        case 'getPatient': return [3 /*break*/, 3];
                        case 'createPatient': return [3 /*break*/, 5];
                        case 'updatePatient': return [3 /*break*/, 7];
                        case 'getAppointments': return [3 /*break*/, 9];
                        case 'createAppointment': return [3 /*break*/, 11];
                        case 'updateAppointmentStatus': return [3 /*break*/, 13];
                        case 'getDoctors': return [3 /*break*/, 15];
                        case 'createDoctor': return [3 /*break*/, 17];
                        case 'getSpecialties': return [3 /*break*/, 19];
                        case 'createSpecialty': return [3 /*break*/, 21];
                        case 'getLocations': return [3 /*break*/, 23];
                        case 'createLocation': return [3 /*break*/, 25];
                        case 'getDaySummary': return [3 /*break*/, 27];
                        case 'getPatientHistory': return [3 /*break*/, 29];
                        case 'getDoctorSchedule': return [3 /*break*/, 31];
                        case 'getDocumentTypes': return [3 /*break*/, 33];
                        case 'getBloodGroups': return [3 /*break*/, 35];
                        case 'getEducationLevels': return [3 /*break*/, 37];
                        case 'getMaritalStatuses': return [3 /*break*/, 39];
                        case 'getPopulationGroups': return [3 /*break*/, 41];
                        case 'getDisabilityTypes': return [3 /*break*/, 43];
                        case 'getMunicipalities': return [3 /*break*/, 45];
                        case 'getZones': return [3 /*break*/, 47];
                        case 'getEPS': return [3 /*break*/, 49];
                        case 'executeCustomQuery': return [3 /*break*/, 51];
                    }
                    return [3 /*break*/, 53];
                case 1: return [4 /*yield*/, searchPatients(args.q, args.limit || 20)];
                case 2: return [2 /*return*/, _b.sent()];
                case 3: return [4 /*yield*/, getPatientById(args.patient_id)];
                case 4: return [2 /*return*/, _b.sent()];
                case 5: return [4 /*yield*/, createPatient(args)];
                case 6: return [2 /*return*/, _b.sent()];
                case 7: return [4 /*yield*/, updatePatient(args.patient_id, args)];
                case 8: return [2 /*return*/, _b.sent()];
                case 9: return [4 /*yield*/, getAppointments(args)];
                case 10: return [2 /*return*/, _b.sent()];
                case 11: return [4 /*yield*/, createAppointment(args)];
                case 12: return [2 /*return*/, _b.sent()];
                case 13: return [4 /*yield*/, updateAppointmentStatus(args.appointment_id, args)];
                case 14: return [2 /*return*/, _b.sent()];
                case 15: return [4 /*yield*/, getDoctors(args)];
                case 16: return [2 /*return*/, _b.sent()];
                case 17: return [4 /*yield*/, createDoctor(args)];
                case 18: return [2 /*return*/, _b.sent()];
                case 19: return [4 /*yield*/, getSpecialties((args === null || args === void 0 ? void 0 : args.active_only) !== false)];
                case 20: return [2 /*return*/, _b.sent()];
                case 21: return [4 /*yield*/, createSpecialty(args)];
                case 22: return [2 /*return*/, _b.sent()];
                case 23: return [4 /*yield*/, getLocations((args === null || args === void 0 ? void 0 : args.active_only) !== false)];
                case 24: return [2 /*return*/, _b.sent()];
                case 25: return [4 /*yield*/, createLocation(args)];
                case 26: return [2 /*return*/, _b.sent()];
                case 27: return [4 /*yield*/, getDaySummary(args.date)];
                case 28: return [2 /*return*/, _b.sent()];
                case 29: return [4 /*yield*/, getPatientHistory(args.patient_id, args.limit || 10)];
                case 30: return [2 /*return*/, _b.sent()];
                case 31: return [4 /*yield*/, getDoctorSchedule(args.doctor_id, args.date)];
                case 32: return [2 /*return*/, _b.sent()];
                case 33: return [4 /*yield*/, getDocumentTypes()];
                case 34: return [2 /*return*/, _b.sent()];
                case 35: return [4 /*yield*/, getBloodGroups()];
                case 36: return [2 /*return*/, _b.sent()];
                case 37: return [4 /*yield*/, getEducationLevels()];
                case 38: return [2 /*return*/, _b.sent()];
                case 39: return [4 /*yield*/, getMaritalStatuses()];
                case 40: return [2 /*return*/, _b.sent()];
                case 41: return [4 /*yield*/, getPopulationGroups()];
                case 42: return [2 /*return*/, _b.sent()];
                case 43: return [4 /*yield*/, getDisabilityTypes()];
                case 44: return [2 /*return*/, _b.sent()];
                case 45: return [4 /*yield*/, getMunicipalities(args.zone_id)];
                case 46: return [2 /*return*/, _b.sent()];
                case 47: return [4 /*yield*/, getZones()];
                case 48: return [2 /*return*/, _b.sent()];
                case 49: return [4 /*yield*/, getEPS()];
                case 50: return [2 /*return*/, _b.sent()];
                case 51: return [4 /*yield*/, executeCustomQuery(args.query, args.params)];
                case 52: return [2 /*return*/, _b.sent()];
                case 53: throw new Error("Herramienta no implementada: ".concat(name));
                case 54: return [3 /*break*/, 56];
                case 55:
                    error_1 = _b.sent();
                    console.error("Error ejecutando ".concat(name, ":"), error_1);
                    throw new Error("Error en ".concat(name, ": ").concat(error_1.message));
                case 56: return [2 /*return*/];
            }
        });
    });
}
// === IMPLEMENTACIONES DE FUNCIONES ===
function searchPatients(query_1) {
    return __awaiter(this, arguments, void 0, function (query, limit) {
        var like, rows;
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    like = "%".concat(query, "%");
                    return [4 /*yield*/, pool.query('SELECT id, document, name, phone, email, birth_date, gender, status FROM patients WHERE name LIKE ? OR document LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT ?', [like, like, like, limit])];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, {
                            patients: rows,
                            total: rows.length,
                            query: query
                        }];
            }
        });
    });
}
function getPatientById(patientId) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT * FROM patients WHERE id = ? LIMIT 1', [patientId])];
                case 1:
                    rows = (_a.sent())[0];
                    if (!rows.length) {
                        throw new Error('Paciente no encontrado');
                    }
                    return [2 /*return*/, rows[0]];
            }
        });
    });
}
// Función para inferir género basado en nombre (heurística simple)
function inferGenderFromName(name) {
    var nameLower = name.toLowerCase().trim();
    // Nombres típicamente masculinos (terminaciones comunes)
    var maleEndings = ['o', 'an', 'el', 'on', 'en', 'ar', 'er', 'ir', 'or', 'ur'];
    var maleNames = ['juan', 'carlos', 'luis', 'miguel', 'jose', 'david', 'jorge', 'manuel', 'ricardo', 'francisco', 'antonio', 'sebastian', 'andres', 'diego', 'pablo', 'alejandro', 'pedro', 'rafael', 'jesus', 'daniel'];
    // Nombres típicamente femeninos (terminaciones comunes)
    var femaleEndings = ['a', 'ia', 'na', 'ra', 'ta', 'da', 'la', 'sa', 'ma', 'ca'];
    var femaleNames = ['maria', 'ana', 'carmen', 'lucia', 'patricia', 'rosa', 'laura', 'marta', 'elena', 'sofia', 'claudia', 'gabriela', 'andrea', 'paola', 'monica', 'teresa', 'cristina', 'diana', 'sandra', 'beatriz'];
    // Extraer primer nombre
    var firstName = nameLower.split(' ')[0];
    // Verificar nombres específicos
    if (maleNames.includes(firstName))
        return 'Masculino';
    if (femaleNames.includes(firstName))
        return 'Femenino';
    // Verificar terminaciones
    for (var _i = 0, femaleEndings_1 = femaleEndings; _i < femaleEndings_1.length; _i++) {
        var ending = femaleEndings_1[_i];
        if (firstName.endsWith(ending))
            return 'Femenino';
    }
    for (var _a = 0, maleEndings_1 = maleEndings; _a < maleEndings_1.length; _a++) {
        var ending = maleEndings_1[_a];
        if (firstName.endsWith(ending))
            return 'Masculino';
    }
    return 'No especificado';
}
function createPatient(data) {
    return __awaiter(this, void 0, void 0, function () {
        var requiredFields, missingFields, gender, document, document_type_id, name, phone, phone_alt, email, birth_date, address, municipality_id, zone_id, insurance_eps_id, insurance_affiliation_type, blood_group_id, population_group_id, education_level_id, marital_status_id, _a, has_disability, disability_type_id, estrato, notes, result;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    requiredFields = [
                        'document', 'document_type_id', 'name', 'birth_date', 'gender',
                        'address', 'municipality_id', 'phone', 'email', 'insurance_eps_id',
                        'insurance_affiliation_type', 'blood_group_id', 'population_group_id',
                        'education_level_id', 'marital_status_id', 'estrato'
                    ];
                    missingFields = requiredFields.filter(function (field) { return !data[field] && data[field] !== 0; });
                    if (missingFields.length > 0) {
                        throw new Error("Campos obligatorios faltantes: ".concat(missingFields.join(', ')));
                    }
                    // Validar formato de email
                    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
                        throw new Error('Formato de email inválido');
                    }
                    // Validar formato de fecha de nacimiento
                    if (data.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(data.birth_date)) {
                        throw new Error('Formato de fecha de nacimiento inválido (debe ser YYYY-MM-DD)');
                    }
                    // Validar estrato
                    if (data.estrato && (data.estrato < 0 || data.estrato > 6)) {
                        throw new Error('Estrato debe estar entre 0 y 6');
                    }
                    gender = data.gender;
                    if (!gender || gender === 'No especificado') {
                        gender = inferGenderFromName(data.name);
                    }
                    document = data.document, document_type_id = data.document_type_id, name = data.name, phone = data.phone, phone_alt = data.phone_alt, email = data.email, birth_date = data.birth_date, address = data.address, municipality_id = data.municipality_id, zone_id = data.zone_id, insurance_eps_id = data.insurance_eps_id, insurance_affiliation_type = data.insurance_affiliation_type, blood_group_id = data.blood_group_id, population_group_id = data.population_group_id, education_level_id = data.education_level_id, marital_status_id = data.marital_status_id, _a = data.has_disability, has_disability = _a === void 0 ? false : _a, disability_type_id = data.disability_type_id, estrato = data.estrato, notes = data.notes;
                    return [4 /*yield*/, pool.query("INSERT INTO patients (\n      document, document_type_id, name, phone, phone_alt, email, birth_date, \n      gender, address, municipality_id, zone_id, insurance_eps_id, \n      insurance_affiliation_type, blood_group_id, population_group_id, \n      education_level_id, marital_status_id, has_disability, disability_type_id, \n      estrato, notes, status\n    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Activo')", [
                            document, document_type_id || null, name, phone || null, phone_alt || null,
                            email || null, birth_date || null, gender, address || null,
                            municipality_id || null, zone_id || null, insurance_eps_id || null,
                            insurance_affiliation_type || null, blood_group_id || null,
                            population_group_id || null, education_level_id || null,
                            marital_status_id || null, has_disability, disability_type_id || null,
                            estrato || null, notes || null
                        ])];
                case 1:
                    result = (_b.sent())[0];
                    return [2 /*return*/, __assign(__assign({ id: result.insertId }, data), { status: 'Activo' })];
            }
        });
    });
}
function updatePatient(patientId, data) {
    return __awaiter(this, void 0, void 0, function () {
        var fields, values, allowedFields, _i, allowedFields_1, field;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    fields = [];
                    values = [];
                    allowedFields = [
                        'name', 'phone', 'phone_alt', 'email', 'address', 'municipality_id',
                        'zone_id', 'insurance_eps_id', 'insurance_affiliation_type',
                        'blood_group_id', 'population_group_id', 'education_level_id',
                        'marital_status_id', 'has_disability', 'disability_type_id',
                        'estrato', 'notes', 'status'
                    ];
                    for (_i = 0, allowedFields_1 = allowedFields; _i < allowedFields_1.length; _i++) {
                        field = allowedFields_1[_i];
                        if (data[field] !== undefined) {
                            fields.push("".concat(field, " = ?"));
                            values.push(data[field]);
                        }
                    }
                    if (!fields.length) {
                        throw new Error('No hay campos para actualizar');
                    }
                    values.push(patientId);
                    return [4 /*yield*/, pool.execute("UPDATE patients SET ".concat(fields.join(', '), " WHERE id = ?"), values)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, __assign({ id: patientId }, data)];
            }
        });
    });
}
function getAppointments() {
    return __awaiter(this, arguments, void 0, function (filters) {
        var where, values, whereClause, rows;
        if (filters === void 0) { filters = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    where = [];
                    values = [];
                    if (filters.date) {
                        where.push('DATE(a.scheduled_at) = ?');
                        values.push(filters.date);
                    }
                    if (filters.status) {
                        where.push('a.status = ?');
                        values.push(filters.status);
                    }
                    if (filters.patient_id) {
                        where.push('a.patient_id = ?');
                        values.push(filters.patient_id);
                    }
                    if (filters.doctor_id) {
                        where.push('a.doctor_id = ?');
                        values.push(filters.doctor_id);
                    }
                    whereClause = where.length ? "WHERE ".concat(where.join(' AND ')) : '';
                    return [4 /*yield*/, pool.execute("SELECT a.*, \n            p.name AS patient_name, p.phone AS patient_phone, p.document AS patient_document,\n            d.name AS doctor_name, \n            s.name AS specialty_name,\n            l.name AS location_name\n     FROM appointments a\n     JOIN patients p ON p.id = a.patient_id\n     JOIN doctors d ON d.id = a.doctor_id\n     JOIN specialties s ON s.id = a.specialty_id\n     JOIN locations l ON l.id = a.location_id\n     ".concat(whereClause, "\n     ORDER BY a.scheduled_at ASC\n     LIMIT 100"), values)];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, {
                            appointments: rows,
                            total: rows.length,
                            filters: filters
                        }];
            }
        });
    });
}
function createAppointment(data) {
    return __awaiter(this, void 0, void 0, function () {
        var patient_id, doctor_id, specialty_id, location_id, scheduled_at, _a, duration_minutes, _b, appointment_type, reason, conflicts, result;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    patient_id = data.patient_id, doctor_id = data.doctor_id, specialty_id = data.specialty_id, location_id = data.location_id, scheduled_at = data.scheduled_at, _a = data.duration_minutes, duration_minutes = _a === void 0 ? 30 : _a, _b = data.appointment_type, appointment_type = _b === void 0 ? 'Presencial' : _b, reason = data.reason;
                    return [4 /*yield*/, pool.execute("SELECT id FROM appointments\n     WHERE doctor_id = ? AND status != 'Cancelada'\n       AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)\n       AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?\n     LIMIT 1", [doctor_id, scheduled_at, duration_minutes, scheduled_at])];
                case 1:
                    conflicts = (_c.sent())[0];
                    if (conflicts.length > 0) {
                        throw new Error('Conflicto de horario: el médico ya tiene una cita en ese horario');
                    }
                    return [4 /*yield*/, pool.execute("INSERT INTO appointments (patient_id, doctor_id, specialty_id, location_id, scheduled_at, duration_minutes, appointment_type, status, reason)\n     VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente', ?)", [patient_id, doctor_id, specialty_id, location_id, scheduled_at, duration_minutes, appointment_type, reason])];
                case 2:
                    result = (_c.sent())[0];
                    return [2 /*return*/, __assign(__assign({ id: result.insertId }, data), { status: 'Pendiente' })];
            }
        });
    });
}
function updateAppointmentStatus(appointmentId, data) {
    return __awaiter(this, void 0, void 0, function () {
        var status, notes, cancellation_reason, fields, values;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    status = data.status, notes = data.notes, cancellation_reason = data.cancellation_reason;
                    fields = ['status = ?'];
                    values = [status];
                    if (notes !== undefined) {
                        fields.push('notes = ?');
                        values.push(notes);
                    }
                    if (cancellation_reason !== undefined) {
                        fields.push('cancellation_reason = ?');
                        values.push(cancellation_reason);
                    }
                    values.push(appointmentId);
                    return [4 /*yield*/, pool.execute("UPDATE appointments SET ".concat(fields.join(', '), " WHERE id = ?"), values)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, __assign({ id: appointmentId }, data)];
            }
        });
    });
}
function getDoctors() {
    return __awaiter(this, arguments, void 0, function (filters) {
        var query, values, doctors, specRows, locRows, specMap, locMap, _i, _a, row, _b, _c, row, result;
        if (filters === void 0) { filters = {}; }
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    query = 'SELECT * FROM doctors';
                    values = [];
                    if (filters.active_only !== false) {
                        query += ' WHERE active = true';
                    }
                    query += ' ORDER BY name ASC';
                    return [4 /*yield*/, pool.execute(query, values)];
                case 1:
                    doctors = (_d.sent())[0];
                    return [4 /*yield*/, pool.execute("SELECT ds.doctor_id, s.id, s.name\n     FROM doctor_specialties ds\n     JOIN specialties s ON s.id = ds.specialty_id")];
                case 2:
                    specRows = (_d.sent())[0];
                    return [4 /*yield*/, pool.execute("SELECT dl.doctor_id, l.id, l.name\n     FROM doctor_locations dl\n     JOIN locations l ON l.id = dl.location_id")];
                case 3:
                    locRows = (_d.sent())[0];
                    specMap = new Map();
                    locMap = new Map();
                    for (_i = 0, _a = specRows; _i < _a.length; _i++) {
                        row = _a[_i];
                        if (!specMap.has(row.doctor_id))
                            specMap.set(row.doctor_id, []);
                        specMap.get(row.doctor_id).push({ id: row.id, name: row.name });
                    }
                    for (_b = 0, _c = locRows; _b < _c.length; _b++) {
                        row = _c[_b];
                        if (!locMap.has(row.doctor_id))
                            locMap.set(row.doctor_id, []);
                        locMap.get(row.doctor_id).push({ id: row.id, name: row.name });
                    }
                    result = doctors.map(function (doctor) { return (__assign(__assign({}, doctor), { specialties: specMap.get(doctor.id) || [], locations: locMap.get(doctor.id) || [] })); });
                    return [2 /*return*/, {
                            doctors: result,
                            total: result.length
                        }];
            }
        });
    });
}
function createDoctor(data) {
    return __awaiter(this, void 0, void 0, function () {
        var name, email, phone, license_number, _a, specialties, _b, locations, connection, result, doctorId_1, specValues, locValues, error_2;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    name = data.name, email = data.email, phone = data.phone, license_number = data.license_number, _a = data.specialties, specialties = _a === void 0 ? [] : _a, _b = data.locations, locations = _b === void 0 ? [] : _b;
                    return [4 /*yield*/, pool.getConnection()];
                case 1:
                    connection = _c.sent();
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 10, 12, 13]);
                    return [4 /*yield*/, connection.beginTransaction()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, connection.execute('INSERT INTO doctors (name, email, phone, license_number, active) VALUES (?, ?, ?, ?, true)', [name, email || null, phone || null, license_number])];
                case 4:
                    result = (_c.sent())[0];
                    doctorId_1 = result.insertId;
                    if (!(specialties.length > 0)) return [3 /*break*/, 6];
                    specValues = specialties.map(function (sid) { return [doctorId_1, sid]; });
                    return [4 /*yield*/, connection.query('INSERT INTO doctor_specialties (doctor_id, specialty_id) VALUES ?', [specValues])];
                case 5:
                    _c.sent();
                    _c.label = 6;
                case 6:
                    if (!(locations.length > 0)) return [3 /*break*/, 8];
                    locValues = locations.map(function (lid) { return [doctorId_1, lid]; });
                    return [4 /*yield*/, connection.query('INSERT INTO doctor_locations (doctor_id, location_id) VALUES ?', [locValues])];
                case 7:
                    _c.sent();
                    _c.label = 8;
                case 8: return [4 /*yield*/, connection.commit()];
                case 9:
                    _c.sent();
                    return [2 /*return*/, {
                            id: doctorId_1,
                            name: name,
                            email: email,
                            phone: phone,
                            license_number: license_number,
                            specialties: specialties,
                            locations: locations,
                            active: true
                        }];
                case 10:
                    error_2 = _c.sent();
                    return [4 /*yield*/, connection.rollback()];
                case 11:
                    _c.sent();
                    throw error_2;
                case 12:
                    connection.release();
                    return [7 /*endfinally*/];
                case 13: return [2 /*return*/];
            }
        });
    });
}
function getSpecialties() {
    return __awaiter(this, arguments, void 0, function (activeOnly) {
        var query, rows;
        if (activeOnly === void 0) { activeOnly = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = 'SELECT * FROM specialties';
                    if (activeOnly) {
                        query += ' WHERE active = true';
                    }
                    query += ' ORDER BY name ASC';
                    return [4 /*yield*/, pool.execute(query)];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, {
                            specialties: rows,
                            total: rows.length
                        }];
            }
        });
    });
}
function createSpecialty(data) {
    return __awaiter(this, void 0, void 0, function () {
        var name, description, _a, default_duration_minutes, result;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    name = data.name, description = data.description, _a = data.default_duration_minutes, default_duration_minutes = _a === void 0 ? 30 : _a;
                    return [4 /*yield*/, pool.execute('INSERT INTO specialties (name, description, default_duration_minutes, active) VALUES (?, ?, ?, true)', [name, description || null, default_duration_minutes])];
                case 1:
                    result = (_b.sent())[0];
                    return [2 /*return*/, {
                            id: result.insertId,
                            name: name,
                            description: description,
                            default_duration_minutes: default_duration_minutes,
                            active: true
                        }];
            }
        });
    });
}
function getLocations() {
    return __awaiter(this, arguments, void 0, function (activeOnly) {
        var query, rows;
        if (activeOnly === void 0) { activeOnly = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = 'SELECT * FROM locations';
                    if (activeOnly) {
                        query += " WHERE status = 'Activa'";
                    }
                    query += ' ORDER BY name ASC';
                    return [4 /*yield*/, pool.execute(query)];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, {
                            locations: rows,
                            total: rows.length
                        }];
            }
        });
    });
}
function createLocation(data) {
    return __awaiter(this, void 0, void 0, function () {
        var name, address, phone, _a, type, _b, capacity, result;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    name = data.name, address = data.address, phone = data.phone, _a = data.type, type = _a === void 0 ? 'Sucursal' : _a, _b = data.capacity, capacity = _b === void 0 ? 0 : _b;
                    return [4 /*yield*/, pool.execute("INSERT INTO locations (name, address, phone, type, status, capacity, current_patients)\n     VALUES (?, ?, ?, ?, 'Activa', ?, 0)", [name, address || null, phone || null, type, capacity])];
                case 1:
                    result = (_c.sent())[0];
                    return [2 /*return*/, {
                            id: result.insertId,
                            name: name,
                            address: address,
                            phone: phone,
                            type: type,
                            status: 'Activa',
                            capacity: capacity,
                            current_patients: 0
                        }];
            }
        });
    });
}
function getDaySummary(date) {
    return __awaiter(this, void 0, void 0, function () {
        var targetDate, stats, topDoctors, summary;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    targetDate = date || new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, pool.execute("SELECT \n       COUNT(*) as total_citas,\n       SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completadas,\n       SUM(CASE WHEN status = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,\n       SUM(CASE WHEN status = 'Confirmada' THEN 1 ELSE 0 END) as confirmadas,\n       SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as canceladas\n     FROM appointments \n     WHERE DATE(scheduled_at) = ?", [targetDate])];
                case 1:
                    stats = (_a.sent())[0];
                    return [4 /*yield*/, pool.execute("SELECT d.name, COUNT(*) as citas\n     FROM appointments a\n     JOIN doctors d ON d.id = a.doctor_id\n     WHERE DATE(a.scheduled_at) = ?\n     GROUP BY a.doctor_id, d.name\n     ORDER BY citas DESC\n     LIMIT 5", [targetDate])];
                case 2:
                    topDoctors = (_a.sent())[0];
                    summary = stats[0];
                    return [2 /*return*/, {
                            fecha: targetDate,
                            estadisticas: summary,
                            medicos_mas_activos: topDoctors,
                            mensaje_resumen: "Resumen del ".concat(targetDate, ": ").concat(summary.total_citas, " citas programadas, ").concat(summary.completadas, " completadas, ").concat(summary.pendientes, " pendientes.")
                        }];
            }
        });
    });
}
function getPatientHistory(patientId_1) {
    return __awaiter(this, arguments, void 0, function (patientId, limit) {
        var appointments, patient;
        if (limit === void 0) { limit = 10; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.execute("SELECT a.*, d.name as doctor_name, s.name as specialty_name, l.name as location_name\n     FROM appointments a\n     JOIN doctors d ON d.id = a.doctor_id\n     JOIN specialties s ON s.id = a.specialty_id\n     JOIN locations l ON l.id = a.location_id\n     WHERE a.patient_id = ?\n     ORDER BY a.scheduled_at DESC\n     LIMIT ?", [patientId, limit])];
                case 1:
                    appointments = (_a.sent())[0];
                    return [4 /*yield*/, pool.execute('SELECT name, document FROM patients WHERE id = ? LIMIT 1', [patientId])];
                case 2:
                    patient = (_a.sent())[0];
                    return [2 /*return*/, {
                            paciente: patient[0] || null,
                            historial: appointments,
                            total: appointments.length
                        }];
            }
        });
    });
}
function getDoctorSchedule(doctorId, date) {
    return __awaiter(this, void 0, void 0, function () {
        var targetDate, appointments, doctor;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    targetDate = date || new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, pool.execute("SELECT a.*, p.name as patient_name, p.phone as patient_phone, s.name as specialty_name\n     FROM appointments a\n     JOIN patients p ON p.id = a.patient_id\n     JOIN specialties s ON s.id = a.specialty_id\n     WHERE a.doctor_id = ? AND DATE(a.scheduled_at) = ?\n     ORDER BY a.scheduled_at ASC", [doctorId, targetDate])];
                case 1:
                    appointments = (_a.sent())[0];
                    return [4 /*yield*/, pool.execute('SELECT name FROM doctors WHERE id = ? LIMIT 1', [doctorId])];
                case 2:
                    doctor = (_a.sent())[0];
                    return [2 /*return*/, {
                            medico: doctor[0] || null,
                            fecha: targetDate,
                            agenda: appointments,
                            total_citas: appointments.length
                        }];
            }
        });
    });
}
function executeCustomQuery(query_1) {
    return __awaiter(this, arguments, void 0, function (query, params) {
        var trimmedQuery, rows;
        if (params === void 0) { params = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    trimmedQuery = query.trim().toLowerCase();
                    if (!trimmedQuery.startsWith('select')) {
                        throw new Error('Solo se permiten consultas SELECT');
                    }
                    // Prevenir múltiples declaraciones
                    if (trimmedQuery.includes(';') && !trimmedQuery.endsWith(';')) {
                        throw new Error('No se permiten múltiples declaraciones SQL');
                    }
                    return [4 /*yield*/, pool.execute(query, params)];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, {
                            resultados: rows,
                            total: rows.length,
                            consulta: query
                        }];
            }
        });
    });
}
// === FUNCIONES LOOKUP ===
function getDocumentTypes() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, code, name FROM document_types ORDER BY name')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { document_types: rows }];
            }
        });
    });
}
function getBloodGroups() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, code, name FROM blood_groups ORDER BY code')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { blood_groups: rows }];
            }
        });
    });
}
function getEducationLevels() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, name FROM education_levels ORDER BY id')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { education_levels: rows }];
            }
        });
    });
}
function getMaritalStatuses() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, name FROM marital_statuses ORDER BY name')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { marital_statuses: rows }];
            }
        });
    });
}
function getPopulationGroups() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, name FROM population_groups ORDER BY name')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { population_groups: rows }];
            }
        });
    });
}
function getDisabilityTypes() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, name FROM disability_types ORDER BY name')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { disability_types: rows }];
            }
        });
    });
}
function getMunicipalities(zoneId) {
    return __awaiter(this, void 0, void 0, function () {
        var query, params, rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    query = 'SELECT m.id, m.name, m.zone_id, z.name as zone_name FROM municipalities m LEFT JOIN zones z ON m.zone_id = z.id';
                    params = [];
                    if (zoneId) {
                        query += ' WHERE m.zone_id = ?';
                        params.push(zoneId);
                    }
                    query += ' ORDER BY m.name';
                    return [4 /*yield*/, pool.query(query, params)];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { municipalities: rows }];
            }
        });
    });
}
function getZones() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, name, description FROM zones ORDER BY name')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { zones: rows }];
            }
        });
    });
}
function getEPS() {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, pool.query('SELECT id, name FROM eps ORDER BY name')];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, { eps: rows }];
            }
        });
    });
}
// === ENDPOINTS MCP ===
// Endpoint principal para tools/list
app.post('/mcp-unified', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a, name_1, args, result, error_3;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 3, , 4]);
                request = req.body;
                if (request.method === 'tools/list') {
                    return [2 /*return*/, res.json(createSuccessResponse(request.id, {
                            tools: UNIFIED_TOOLS
                        }))];
                }
                if (!(request.method === 'tools/call')) return [3 /*break*/, 2];
                _a = request.params, name_1 = _a.name, args = _a.arguments;
                return [4 /*yield*/, executeToolCall(name_1, args || {})];
            case 1:
                result = _c.sent();
                return [2 /*return*/, res.json(createSuccessResponse(request.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }))];
            case 2: return [2 /*return*/, res.json(createErrorResponse(request.id, -32601, 'Método no encontrado'))];
            case 3:
                error_3 = _c.sent();
                console.error('Error en MCP unified:', error_3);
                return [2 /*return*/, res.json(createErrorResponse(((_b = req.body) === null || _b === void 0 ? void 0 : _b.id) || 'unknown', -32603, error_3.message))];
            case 4: return [2 /*return*/];
        }
    });
}); });
// Endpoint específico para MCP Inspector con soporte StreamableHttp
app.all('/mcp-inspector', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var request, response, _a, name_2, args, result, error_4;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                console.log("=== MCP Inspector Request ===");
                console.log("Method: ".concat(req.method));
                console.log("Headers:", req.headers);
                console.log("Body:", req.body);
                console.log("URL: ".concat(req.url));
                // Headers específicos para MCP Inspector
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MCP-Transport, X-MCP-Session');
                if (req.method === 'OPTIONS') {
                    console.log('OPTIONS request handled');
                    return [2 /*return*/, res.status(200).end()];
                }
                _c.label = 1;
            case 1:
                _c.trys.push([1, 4, , 5]);
                // Manejar solicitudes GET para MCP Inspector
                if (req.method === 'GET') {
                    console.log('GET request to MCP Inspector endpoint');
                    return [2 /*return*/, res.json({
                            message: 'MCP Inspector endpoint ready',
                            server: 'Biosanar MCP Unified Server',
                            version: '1.0.0',
                            protocol: '2024-11-05',
                            transport: ['streamable-http', 'http'],
                            tools: UNIFIED_TOOLS.length,
                            capabilities: {
                                tools: {},
                                prompts: {},
                                resources: {}
                            },
                            endpoints: {
                                initialize: 'POST /mcp-inspector',
                                tools_list: 'POST /mcp-inspector',
                                tools_call: 'POST /mcp-inspector'
                            },
                            timestamp: new Date().toISOString()
                        })];
                }
                request = req.body || {};
                console.log('Parsed request:', JSON.stringify(request, null, 2));
                // Soporte para initialize request del MCP Inspector
                if (request.method === 'initialize') {
                    console.log('Initialize method detected');
                    response = createSuccessResponse(request.id, {
                        protocolVersion: '2024-11-05',
                        capabilities: {
                            tools: {},
                            prompts: {},
                            resources: {}
                        },
                        serverInfo: {
                            name: 'Biosanar MCP Unified Server',
                            version: '1.0.0'
                        }
                    });
                    console.log('Initialize response:', JSON.stringify(response, null, 2));
                    return [2 /*return*/, res.json(response)];
                }
                if (request.method === 'tools/list') {
                    return [2 /*return*/, res.json(createSuccessResponse(request.id, {
                            tools: UNIFIED_TOOLS
                        }))];
                }
                if (!(request.method === 'tools/call')) return [3 /*break*/, 3];
                _a = request.params, name_2 = _a.name, args = _a.arguments;
                return [4 /*yield*/, executeToolCall(name_2, args || {})];
            case 2:
                result = _c.sent();
                return [2 /*return*/, res.json(createSuccessResponse(request.id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }))];
            case 3:
                // Si no hay método específico, redirigir al endpoint principal
                if (!request.method) {
                    console.log('No method specified - returning default response');
                    return [2 /*return*/, res.json(createSuccessResponse('unknown', {
                            message: 'MCP Inspector endpoint ready',
                            server: 'Biosanar MCP Unified Server',
                            tools: UNIFIED_TOOLS.length
                        }))];
                }
                console.log("Unknown method: ".concat(request.method));
                return [2 /*return*/, res.json(createErrorResponse(request.id || 'unknown', -32601, "M\u00E9todo no encontrado: ".concat(request.method)))];
            case 4:
                error_4 = _c.sent();
                console.error('Error en MCP inspector:', error_4);
                return [2 /*return*/, res.json(createErrorResponse(((_b = req.body) === null || _b === void 0 ? void 0 : _b.id) || 'unknown', -32603, error_4.message))];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Endpoint de salud
app.get('/health', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var rows, error_5;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, pool.execute('SELECT 1 as connected')];
            case 1:
                rows = (_a.sent())[0];
                res.json({
                    status: 'healthy',
                    database: 'connected',
                    tools: UNIFIED_TOOLS.length,
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 2:
                error_5 = _a.sent();
                res.status(500).json({
                    status: 'unhealthy',
                    database: 'disconnected',
                    error: error_5.message
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// Test de conexión de base de datos
app.get('/test-db', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var result, result2, result3, error_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 4, , 5]);
                return [4 /*yield*/, pool.execute('SELECT COUNT(*) as patients FROM patients')];
            case 1:
                result = (_a.sent())[0];
                return [4 /*yield*/, pool.execute('SELECT COUNT(*) as doctors FROM doctors')];
            case 2:
                result2 = (_a.sent())[0];
                return [4 /*yield*/, pool.execute('SELECT COUNT(*) as appointments FROM appointments')];
            case 3:
                result3 = (_a.sent())[0];
                res.json({
                    database: 'connected',
                    stats: {
                        patients: result[0].patients,
                        doctors: result2[0].doctors,
                        appointments: result3[0].appointments
                    }
                });
                return [3 /*break*/, 5];
            case 4:
                error_6 = _a.sent();
                res.status(500).json({
                    database: 'error',
                    message: error_6.message
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// Iniciar servidor
app.listen(PORT, function () {
    console.log("\uD83D\uDE80 Servidor MCP Unificado ejecut\u00E1ndose en puerto ".concat(PORT));
    console.log("\uD83D\uDCCA ".concat(UNIFIED_TOOLS.length, " herramientas MCP disponibles"));
    console.log("\uD83D\uDD17 Endpoints disponibles:");
    console.log("   POST /mcp-unified - Protocolo MCP principal");
    console.log("   GET  /health - Estado del servidor");
    console.log("   GET  /test-db - Test de conexi\u00F3n a base de datos");
    console.log("\u2728 Sistema m\u00E9dico completo integrado");
});
exports.default = app;
