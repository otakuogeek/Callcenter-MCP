"use strict";
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
exports.COMPLETE_TOOLS = void 0;
var express_1 = require("express");
var mysql_1 = require("../db/mysql");
var logger_mysql_1 = require("../logger-mysql");
var router = (0, express_1.Router)();
// Funciones de respuesta JSON-RPC
function createSuccessResponse(id, result) {
    return { jsonrpc: '2.0', id: id, result: result };
}
function createErrorResponse(id, code, message) {
    return { jsonrpc: '2.0', id: id, error: { code: code, message: message } };
}
// Middleware de autenticación para algunos endpoints
var authenticateApiKey = function (req, res, next) {
    var _a;
    var apiKey = req.headers['x-api-key'] || ((_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
    var expectedApiKey = 'biosanarcall_mcp_node_2025';
    if (!apiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'API key required in X-API-Key header or Authorization Bearer token',
            timestamp: new Date().toISOString(),
            help: {
                header: 'X-API-Key',
                example: "X-API-Key: ".concat(expectedApiKey),
                documentation: 'https://biosanarcall.site/mcp-node-info'
            }
        });
    }
    if (apiKey !== expectedApiKey) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid API key',
            timestamp: new Date().toISOString()
        });
    }
    next();
};
// Definición completa de herramientas MCP
var COMPLETE_TOOLS = [
    // PACIENTES
    {
        name: 'searchPatients',
        description: 'Buscar pacientes por nombre, documento o teléfono',
        inputSchema: {
            type: 'object',
            properties: {
                q: { type: 'string', description: 'Término de búsqueda (nombre, documento, teléfono)' },
                limit: { type: 'number', description: 'Límite de resultados (1-100)', minimum: 1, maximum: 100 }
            },
            required: ['q']
        }
    },
    {
        name: 'getPatient',
        description: 'Obtener detalles de un paciente por ID',
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
        description: 'Crear un nuevo paciente',
        inputSchema: {
            type: 'object',
            properties: {
                document: { type: 'string', description: 'Documento de identidad' },
                name: { type: 'string', description: 'Nombre completo' },
                phone: { type: 'string', description: 'Teléfono (opcional)' },
                email: { type: 'string', description: 'Email (opcional)' },
                birth_date: { type: 'string', description: 'Fecha de nacimiento YYYY-MM-DD (opcional)' },
                gender: { type: 'string', enum: ['Masculino', 'Femenino', 'Otro', 'No especificado'], description: 'Género' },
                address: { type: 'string', description: 'Dirección (opcional)' }
            },
            required: ['document', 'name']
        }
    },
    // CITAS
    {
        name: 'getAppointments',
        description: 'Obtener citas con filtros opcionales',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional)' },
                status: { type: 'string', enum: ['Pendiente', 'Confirmada', 'Completada', 'Cancelada'], description: 'Estado de la cita' },
                patient_id: { type: 'number', description: 'ID del paciente' },
                doctor_id: { type: 'number', description: 'ID del doctor' }
            }
        }
    },
    {
        name: 'createAppointment',
        description: 'Crear una nueva cita médica',
        inputSchema: {
            type: 'object',
            properties: {
                patient_id: { type: 'number', description: 'ID del paciente' },
                doctor_id: { type: 'number', description: 'ID del doctor' },
                location_id: { type: 'number', description: 'ID de la ubicación' },
                specialty_id: { type: 'number', description: 'ID de la especialidad' },
                scheduled_at: { type: 'string', description: 'Fecha y hora YYYY-MM-DD HH:MM:SS' },
                duration_minutes: { type: 'number', description: 'Duración en minutos (por defecto 30)', minimum: 5, maximum: 480 },
                appointment_type: { type: 'string', enum: ['Presencial', 'Telemedicina'], description: 'Tipo de cita' },
                reason: { type: 'string', description: 'Motivo de la cita (opcional)' }
            },
            required: ['patient_id', 'doctor_id', 'location_id', 'specialty_id', 'scheduled_at']
        }
    },
    // DOCTORES
    {
        name: 'getDoctors',
        description: 'Obtener lista de doctores con filtros opcionales',
        inputSchema: {
            type: 'object',
            properties: {
                specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
                location_id: { type: 'number', description: 'Filtrar por ubicación' },
                status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del doctor' }
            }
        }
    },
    {
        name: 'getDoctor',
        description: 'Obtener detalles de un doctor por ID',
        inputSchema: {
            type: 'object',
            properties: {
                doctor_id: { type: 'number', description: 'ID del doctor' }
            },
            required: ['doctor_id']
        }
    },
    // ESPECIALIDADES
    {
        name: 'getSpecialties',
        description: 'Obtener lista de especialidades médicas',
        inputSchema: {
            type: 'object',
            properties: {
                status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado de la especialidad' }
            }
        }
    },
    // UBICACIONES
    {
        name: 'getLocations',
        description: 'Obtener lista de ubicaciones/consultorios',
        inputSchema: {
            type: 'object',
            properties: {
                location_type_id: { type: 'number', description: 'Filtrar por tipo de ubicación' },
                status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado de la ubicación' }
            }
        }
    },
    // DISPONIBILIDAD
    {
        name: 'getAvailabilities',
        description: 'Obtener disponibilidad de doctores',
        inputSchema: {
            type: 'object',
            properties: {
                doctor_id: { type: 'number', description: 'ID del doctor' },
                date: { type: 'string', description: 'Fecha YYYY-MM-DD' },
                location_id: { type: 'number', description: 'ID de la ubicación' }
            }
        }
    },
    // ESTADÍSTICAS Y REPORTES
    {
        name: 'getDashboardStats',
        description: 'Obtener estadísticas generales del dashboard',
        inputSchema: {
            type: 'object',
            properties: {
                date_from: { type: 'string', description: 'Fecha inicio YYYY-MM-DD (opcional)' },
                date_to: { type: 'string', description: 'Fecha fin YYYY-MM-DD (opcional)' }
            }
        }
    },
    {
        name: 'getDaySummary',
        description: 'Resumen completo del día para voz (citas, pacientes, estadísticas)',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
            }
        }
    },
    // SERVICIOS Y PRECIOS
    {
        name: 'getServices',
        description: 'Obtener lista de servicios médicos',
        inputSchema: {
            type: 'object',
            properties: {
                specialty_id: { type: 'number', description: 'Filtrar por especialidad' },
                status: { type: 'string', enum: ['Activo', 'Inactivo'], description: 'Estado del servicio' }
            }
        }
    },
    // CONSULTAS PERSONALIZADAS
    {
        name: 'executeCustomQuery',
        description: 'Ejecutar consulta SQL personalizada (solo SELECT)',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Consulta SQL SELECT' },
                params: { type: 'array', description: 'Parámetros para la consulta (opcional)' }
            },
            required: ['query']
        }
    }
];
exports.COMPLETE_TOOLS = COMPLETE_TOOLS;
// Funciones de ejecución de herramientas
function executeCompleteTool(name, args) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, query, limit, like, patients, patientArray, patientId, patientRows, patient, newPatient, insertResult, insertId, appointmentQuery, appointmentFilters, appointmentValues, appointments, appointmentArray, appointmentData, conflicts, appointmentInsert, appointmentId, doctorQuery, doctorFilters, doctorValues, doctors, doctorArray, doctorId, doctorRows, doctor, specialtyQuery, specialtyValues, specialties, specialtyArray, locationQuery, locationFilters, locationValues, locations, locationArray, availabilityQuery, availabilityFilters, availabilityValues, availabilities, availabilityArray, dateFrom, dateTo, appointmentStats, patientStats, stats, pStats, summaryDate, dayCitas, daySummaryStats, serviceQuery, serviceFilters, serviceValues, services, serviceArray, sqlQuery, params, customResults, resultArray, columns_1, output_1, error_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    logger_mysql_1.default.info("Executing complete tool: ".concat(name), { args: args });
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 34, , 35]);
                    _a = name;
                    switch (_a) {
                        case 'searchPatients': return [3 /*break*/, 2];
                        case 'getPatient': return [3 /*break*/, 4];
                        case 'createPatient': return [3 /*break*/, 6];
                        case 'getAppointments': return [3 /*break*/, 8];
                        case 'createAppointment': return [3 /*break*/, 10];
                        case 'getDoctors': return [3 /*break*/, 13];
                        case 'getDoctor': return [3 /*break*/, 15];
                        case 'getSpecialties': return [3 /*break*/, 17];
                        case 'getLocations': return [3 /*break*/, 19];
                        case 'getAvailabilities': return [3 /*break*/, 21];
                        case 'getDashboardStats': return [3 /*break*/, 23];
                        case 'getDaySummary': return [3 /*break*/, 26];
                        case 'getServices': return [3 /*break*/, 28];
                        case 'executeCustomQuery': return [3 /*break*/, 30];
                    }
                    return [3 /*break*/, 32];
                case 2:
                    query = (_b = args.q) === null || _b === void 0 ? void 0 : _b.trim();
                    if (!query)
                        throw new Error('Query parameter is required');
                    limit = Math.min(args.limit || 20, 100);
                    like = "%".concat(query, "%");
                    return [4 /*yield*/, mysql_1.default.execute("SELECT id, document, name, phone, email, birth_date, gender, status,\n                  CONCAT(name, ' (', document, ')') as display_name\n           FROM patients \n           WHERE name LIKE ? OR document LIKE ? OR phone LIKE ? \n           ORDER BY name ASC \n           LIMIT ?", [like, like, like, limit])];
                case 3:
                    patients = (_d.sent())[0];
                    patientArray = patients;
                    if (patientArray.length === 0) {
                        return [2 /*return*/, "No se encontraron pacientes con el t\u00E9rmino \"".concat(query, "\"")];
                    }
                    return [2 /*return*/, "".concat(patientArray.length, " paciente(s) encontrados:\n") +
                            patientArray.map(function (p) { return "\u2022 ".concat(p.display_name, " - Tel: ").concat(p.phone || 'N/A', " - Estado: ").concat(p.status); }).join('\n')];
                case 4:
                    patientId = parseInt(args.patient_id);
                    if (!patientId)
                        throw new Error('Valid patient_id is required');
                    return [4 /*yield*/, mysql_1.default.execute("SELECT p.*, m.name as municipality_name, z.name as zone_name, e.name as eps_name\n           FROM patients p\n           LEFT JOIN municipalities m ON p.municipality_id = m.id\n           LEFT JOIN zones z ON p.zone_id = z.id\n           LEFT JOIN eps e ON p.insurance_eps_id = e.id\n           WHERE p.id = ?", [patientId])];
                case 5:
                    patientRows = (_d.sent())[0];
                    patient = patientRows[0];
                    if (!patient)
                        return [2 /*return*/, "Paciente con ID ".concat(patientId, " no encontrado")];
                    return [2 /*return*/, "PACIENTE: ".concat(patient.name, "\n") +
                            "Documento: ".concat(patient.document, "\n") +
                            "Tel\u00E9fono: ".concat(patient.phone || 'N/A', "\n") +
                            "Email: ".concat(patient.email || 'N/A', "\n") +
                            "Fecha Nacimiento: ".concat(patient.birth_date || 'N/A', "\n") +
                            "G\u00E9nero: ".concat(patient.gender, "\n") +
                            "Direcci\u00F3n: ".concat(patient.address || 'N/A', "\n") +
                            "Municipio: ".concat(patient.municipality_name || 'N/A', "\n") +
                            "Zona: ".concat(patient.zone_name || 'N/A', "\n") +
                            "EPS: ".concat(patient.eps_name || 'N/A', "\n") +
                            "Estado: ".concat(patient.status)];
                case 6:
                    newPatient = {
                        document: args.document,
                        name: args.name,
                        phone: args.phone || null,
                        email: args.email || null,
                        birth_date: args.birth_date || null,
                        gender: args.gender || 'No especificado',
                        address: args.address || null,
                        status: 'Activo'
                    };
                    return [4 /*yield*/, mysql_1.default.execute("INSERT INTO patients (document, name, phone, email, birth_date, gender, address, status)\n           VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [newPatient.document, newPatient.name, newPatient.phone, newPatient.email,
                            newPatient.birth_date, newPatient.gender, newPatient.address, newPatient.status])];
                case 7:
                    insertResult = (_d.sent())[0];
                    insertId = insertResult.insertId;
                    return [2 /*return*/, "Paciente creado exitosamente:\nID: ".concat(insertId, "\nNombre: ").concat(newPatient.name, "\nDocumento: ").concat(newPatient.document)];
                case 8:
                    appointmentQuery = "\n          SELECT a.*, p.name AS patient_name, p.phone AS patient_phone, p.document AS patient_document,\n                 d.name AS doctor_name, s.name AS specialty_name, l.name AS location_name,\n                 DATE_FORMAT(a.scheduled_at, '%Y-%m-%d %H:%i') as formatted_time\n          FROM appointments a\n          JOIN patients p ON p.id = a.patient_id\n          JOIN doctors d ON d.id = a.doctor_id\n          JOIN specialties s ON s.id = a.specialty_id\n          JOIN locations l ON l.id = a.location_id\n        ";
                    appointmentFilters = [];
                    appointmentValues = [];
                    if (args.date) {
                        appointmentFilters.push('DATE(a.scheduled_at) = ?');
                        appointmentValues.push(args.date);
                    }
                    if (args.status) {
                        appointmentFilters.push('a.status = ?');
                        appointmentValues.push(args.status);
                    }
                    if (args.patient_id) {
                        appointmentFilters.push('a.patient_id = ?');
                        appointmentValues.push(args.patient_id);
                    }
                    if (args.doctor_id) {
                        appointmentFilters.push('a.doctor_id = ?');
                        appointmentValues.push(args.doctor_id);
                    }
                    if (appointmentFilters.length > 0) {
                        appointmentQuery += ' WHERE ' + appointmentFilters.join(' AND ');
                    }
                    appointmentQuery += ' ORDER BY a.scheduled_at DESC LIMIT 50';
                    return [4 /*yield*/, mysql_1.default.execute(appointmentQuery, appointmentValues)];
                case 9:
                    appointments = (_d.sent())[0];
                    appointmentArray = appointments;
                    if (appointmentArray.length === 0) {
                        return [2 /*return*/, 'No se encontraron citas con los filtros especificados'];
                    }
                    return [2 /*return*/, "".concat(appointmentArray.length, " cita(s) encontradas:\n") +
                            appointmentArray.map(function (a) {
                                return "\u2022 ".concat(a.formatted_time, " - ").concat(a.patient_name, " con Dr. ").concat(a.doctor_name, "\n") +
                                    "  Especialidad: ".concat(a.specialty_name, " | Estado: ").concat(a.status, " | Ubicaci\u00F3n: ").concat(a.location_name);
                            }).join('\n')];
                case 10:
                    appointmentData = {
                        patient_id: args.patient_id,
                        doctor_id: args.doctor_id,
                        location_id: args.location_id,
                        specialty_id: args.specialty_id,
                        scheduled_at: args.scheduled_at,
                        duration_minutes: args.duration_minutes || 30,
                        appointment_type: args.appointment_type || 'Presencial',
                        status: 'Pendiente',
                        reason: args.reason || null
                    };
                    return [4 /*yield*/, mysql_1.default.execute("SELECT id FROM appointments\n           WHERE doctor_id = ? AND status != 'Cancelada'\n             AND scheduled_at < DATE_ADD(?, INTERVAL ? MINUTE)\n             AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?\n           LIMIT 1", [appointmentData.doctor_id, appointmentData.scheduled_at, appointmentData.duration_minutes, appointmentData.scheduled_at])];
                case 11:
                    conflicts = (_d.sent())[0];
                    if (conflicts.length > 0) {
                        return [2 /*return*/, 'Error: El doctor ya tiene una cita que se solapa con ese horario'];
                    }
                    return [4 /*yield*/, mysql_1.default.execute("INSERT INTO appointments (patient_id, doctor_id, location_id, specialty_id, scheduled_at, \n                                   duration_minutes, appointment_type, status, reason)\n           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [appointmentData.patient_id, appointmentData.doctor_id, appointmentData.location_id,
                            appointmentData.specialty_id, appointmentData.scheduled_at, appointmentData.duration_minutes,
                            appointmentData.appointment_type, appointmentData.status, appointmentData.reason])];
                case 12:
                    appointmentInsert = (_d.sent())[0];
                    appointmentId = appointmentInsert.insertId;
                    return [2 /*return*/, "Cita creada exitosamente:\nID: ".concat(appointmentId, "\nFecha: ").concat(appointmentData.scheduled_at, "\nDuraci\u00F3n: ").concat(appointmentData.duration_minutes, " minutos")];
                case 13:
                    doctorQuery = "\n          SELECT d.*, s.name as specialty_name, l.name as location_name\n          FROM doctors d\n          LEFT JOIN specialties s ON d.specialty_id = s.id\n          LEFT JOIN locations l ON d.location_id = l.id\n        ";
                    doctorFilters = [];
                    doctorValues = [];
                    if (args.specialty_id) {
                        doctorFilters.push('d.specialty_id = ?');
                        doctorValues.push(args.specialty_id);
                    }
                    if (args.location_id) {
                        doctorFilters.push('d.location_id = ?');
                        doctorValues.push(args.location_id);
                    }
                    if (args.status) {
                        doctorFilters.push('d.status = ?');
                        doctorValues.push(args.status);
                    }
                    if (doctorFilters.length > 0) {
                        doctorQuery += ' WHERE ' + doctorFilters.join(' AND ');
                    }
                    doctorQuery += ' ORDER BY d.name ASC';
                    return [4 /*yield*/, mysql_1.default.execute(doctorQuery, doctorValues)];
                case 14:
                    doctors = (_d.sent())[0];
                    doctorArray = doctors;
                    if (doctorArray.length === 0) {
                        return [2 /*return*/, 'No se encontraron doctores con los filtros especificados'];
                    }
                    return [2 /*return*/, "".concat(doctorArray.length, " doctor(es) encontrados:\n") +
                            doctorArray.map(function (d) {
                                return "\u2022 Dr. ".concat(d.name, " - ").concat(d.specialty_name || 'Sin especialidad', "\n") +
                                    "  Ubicaci\u00F3n: ".concat(d.location_name || 'Sin ubicación', " | Estado: ").concat(d.status);
                            }).join('\n')];
                case 15:
                    doctorId = parseInt(args.doctor_id);
                    if (!doctorId)
                        throw new Error('Valid doctor_id is required');
                    return [4 /*yield*/, mysql_1.default.execute("SELECT d.*, s.name as specialty_name, l.name as location_name\n           FROM doctors d\n           LEFT JOIN specialties s ON d.specialty_id = s.id\n           LEFT JOIN locations l ON d.location_id = l.id\n           WHERE d.id = ?", [doctorId])];
                case 16:
                    doctorRows = (_d.sent())[0];
                    doctor = doctorRows[0];
                    if (!doctor)
                        return [2 /*return*/, "Doctor con ID ".concat(doctorId, " no encontrado")];
                    return [2 /*return*/, "DOCTOR: ".concat(doctor.name, "\n") +
                            "Especialidad: ".concat(doctor.specialty_name || 'Sin especialidad', "\n") +
                            "Ubicaci\u00F3n: ".concat(doctor.location_name || 'Sin ubicación', "\n") +
                            "Tel\u00E9fono: ".concat(doctor.phone || 'N/A', "\n") +
                            "Email: ".concat(doctor.email || 'N/A', "\n") +
                            "Estado: ".concat(doctor.status)];
                case 17:
                    specialtyQuery = 'SELECT * FROM specialties';
                    specialtyValues = [];
                    if (args.status) {
                        specialtyQuery += ' WHERE status = ?';
                        specialtyValues.push(args.status);
                    }
                    specialtyQuery += ' ORDER BY name ASC';
                    return [4 /*yield*/, mysql_1.default.execute(specialtyQuery, specialtyValues)];
                case 18:
                    specialties = (_d.sent())[0];
                    specialtyArray = specialties;
                    return [2 /*return*/, "".concat(specialtyArray.length, " especialidad(es):\n") +
                            specialtyArray.map(function (s) { return "\u2022 ".concat(s.name, " - ").concat(s.status); }).join('\n')];
                case 19:
                    locationQuery = "\n          SELECT l.*, lt.name as location_type_name\n          FROM locations l\n          LEFT JOIN location_types lt ON l.location_type_id = lt.id\n        ";
                    locationFilters = [];
                    locationValues = [];
                    if (args.location_type_id) {
                        locationFilters.push('l.location_type_id = ?');
                        locationValues.push(args.location_type_id);
                    }
                    if (args.status) {
                        locationFilters.push('l.status = ?');
                        locationValues.push(args.status);
                    }
                    if (locationFilters.length > 0) {
                        locationQuery += ' WHERE ' + locationFilters.join(' AND ');
                    }
                    locationQuery += ' ORDER BY l.name ASC';
                    return [4 /*yield*/, mysql_1.default.execute(locationQuery, locationValues)];
                case 20:
                    locations = (_d.sent())[0];
                    locationArray = locations;
                    return [2 /*return*/, "".concat(locationArray.length, " ubicaci\u00F3n(es):\n") +
                            locationArray.map(function (l) {
                                return "\u2022 ".concat(l.name, " - ").concat(l.location_type_name || 'Sin tipo', " | Estado: ").concat(l.status);
                            }).join('\n')];
                case 21:
                    availabilityQuery = "\n          SELECT av.*, d.name as doctor_name, l.name as location_name,\n                 DATE_FORMAT(av.start_time, '%H:%i') as start_formatted,\n                 DATE_FORMAT(av.end_time, '%H:%i') as end_formatted\n          FROM availabilities av\n          JOIN doctors d ON av.doctor_id = d.id\n          LEFT JOIN locations l ON av.location_id = l.id\n        ";
                    availabilityFilters = [];
                    availabilityValues = [];
                    if (args.doctor_id) {
                        availabilityFilters.push('av.doctor_id = ?');
                        availabilityValues.push(args.doctor_id);
                    }
                    if (args.date) {
                        availabilityFilters.push('av.date = ?');
                        availabilityValues.push(args.date);
                    }
                    if (args.location_id) {
                        availabilityFilters.push('av.location_id = ?');
                        availabilityValues.push(args.location_id);
                    }
                    if (availabilityFilters.length > 0) {
                        availabilityQuery += ' WHERE ' + availabilityFilters.join(' AND ');
                    }
                    availabilityQuery += ' ORDER BY av.date ASC, av.start_time ASC';
                    return [4 /*yield*/, mysql_1.default.execute(availabilityQuery, availabilityValues)];
                case 22:
                    availabilities = (_d.sent())[0];
                    availabilityArray = availabilities;
                    if (availabilityArray.length === 0) {
                        return [2 /*return*/, 'No se encontró disponibilidad con los filtros especificados'];
                    }
                    return [2 /*return*/, "".concat(availabilityArray.length, " horario(s) disponibles:\n") +
                            availabilityArray.map(function (av) {
                                return "\u2022 ".concat(av.date, " ").concat(av.start_formatted, "-").concat(av.end_formatted, " - Dr. ").concat(av.doctor_name, "\n") +
                                    "  Ubicaci\u00F3n: ".concat(av.location_name || 'Sin ubicación', " | Estado: ").concat(av.status);
                            }).join('\n')];
                case 23:
                    dateFrom = args.date_from || new Date().toISOString().split('T')[0];
                    dateTo = args.date_to || new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, mysql_1.default.execute("SELECT \n             COUNT(*) as total_appointments,\n             SUM(CASE WHEN status = 'Pendiente' THEN 1 ELSE 0 END) as pending,\n             SUM(CASE WHEN status = 'Confirmada' THEN 1 ELSE 0 END) as confirmed,\n             SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completed,\n             SUM(CASE WHEN status = 'Cancelada' THEN 1 ELSE 0 END) as cancelled\n           FROM appointments \n           WHERE DATE(scheduled_at) BETWEEN ? AND ?", [dateFrom, dateTo])];
                case 24:
                    appointmentStats = (_d.sent())[0];
                    return [4 /*yield*/, mysql_1.default.execute("SELECT COUNT(*) as total_patients,\n                  SUM(CASE WHEN status = 'Activo' THEN 1 ELSE 0 END) as active_patients\n           FROM patients")];
                case 25:
                    patientStats = (_d.sent())[0];
                    stats = appointmentStats[0];
                    pStats = patientStats[0];
                    return [2 /*return*/, "ESTAD\u00CDSTICAS DEL SISTEMA (".concat(dateFrom, " a ").concat(dateTo, "):\n\n") +
                            "CITAS:\n" +
                            "\u2022 Total: ".concat(stats.total_appointments, "\n") +
                            "\u2022 Pendientes: ".concat(stats.pending, "\n") +
                            "\u2022 Confirmadas: ".concat(stats.confirmed, "\n") +
                            "\u2022 Completadas: ".concat(stats.completed, "\n") +
                            "\u2022 Canceladas: ".concat(stats.cancelled, "\n\n") +
                            "PACIENTES:\n" +
                            "\u2022 Total: ".concat(pStats.total_patients, "\n") +
                            "\u2022 Activos: ".concat(pStats.active_patients)];
                case 26:
                    summaryDate = args.date || new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, mysql_1.default.execute("SELECT COUNT(*) as total,\n                  SUM(CASE WHEN status = 'Pendiente' THEN 1 ELSE 0 END) as pendientes,\n                  SUM(CASE WHEN status = 'Confirmada' THEN 1 ELSE 0 END) as confirmadas,\n                  SUM(CASE WHEN status = 'Completada' THEN 1 ELSE 0 END) as completadas\n           FROM appointments \n           WHERE DATE(scheduled_at) = ?", [summaryDate])];
                case 27:
                    dayCitas = (_d.sent())[0];
                    daySummaryStats = dayCitas[0];
                    if (daySummaryStats.total === 0) {
                        return [2 /*return*/, "Sin citas programadas para el ".concat(summaryDate)];
                    }
                    return [2 /*return*/, "RESUMEN DEL D\u00CDA ".concat(summaryDate, ":\n") +
                            "Total de citas: ".concat(daySummaryStats.total, "\n") +
                            "Pendientes: ".concat(daySummaryStats.pendientes, "\n") +
                            "Confirmadas: ".concat(daySummaryStats.confirmadas, "\n") +
                            "Completadas: ".concat(daySummaryStats.completadas)];
                case 28:
                    serviceQuery = "\n          SELECT s.*, sp.name as specialty_name\n          FROM services s\n          LEFT JOIN specialties sp ON s.specialty_id = sp.id\n        ";
                    serviceFilters = [];
                    serviceValues = [];
                    if (args.specialty_id) {
                        serviceFilters.push('s.specialty_id = ?');
                        serviceValues.push(args.specialty_id);
                    }
                    if (args.status) {
                        serviceFilters.push('s.status = ?');
                        serviceValues.push(args.status);
                    }
                    if (serviceFilters.length > 0) {
                        serviceQuery += ' WHERE ' + serviceFilters.join(' AND ');
                    }
                    serviceQuery += ' ORDER BY s.name ASC';
                    return [4 /*yield*/, mysql_1.default.execute(serviceQuery, serviceValues)];
                case 29:
                    services = (_d.sent())[0];
                    serviceArray = services;
                    return [2 /*return*/, "".concat(serviceArray.length, " servicio(s):\n") +
                            serviceArray.map(function (s) {
                                return "\u2022 ".concat(s.name, " - ").concat(s.specialty_name || 'Sin especialidad', "\n") +
                                    "  Precio: $".concat(s.price || 'N/A', " | Estado: ").concat(s.status);
                            }).join('\n')];
                case 30:
                    sqlQuery = (_c = args.query) === null || _c === void 0 ? void 0 : _c.trim();
                    if (!sqlQuery)
                        throw new Error('Query is required');
                    // Validar que sea solo SELECT
                    if (!sqlQuery.toLowerCase().startsWith('select')) {
                        throw new Error('Only SELECT queries are allowed');
                    }
                    params = args.params || [];
                    return [4 /*yield*/, mysql_1.default.execute(sqlQuery, params)];
                case 31:
                    customResults = (_d.sent())[0];
                    resultArray = customResults;
                    if (resultArray.length === 0) {
                        return [2 /*return*/, 'Query ejecutada exitosamente - Sin resultados'];
                    }
                    columns_1 = Object.keys(resultArray[0]);
                    output_1 = "Query ejecutada exitosamente - ".concat(resultArray.length, " resultado(s):\n\n");
                    resultArray.slice(0, 10).forEach(function (row, index) {
                        output_1 += "Registro ".concat(index + 1, ":\n");
                        columns_1.forEach(function (col) {
                            output_1 += "\u2022 ".concat(col, ": ").concat(row[col], "\n");
                        });
                        output_1 += '\n';
                    });
                    if (resultArray.length > 10) {
                        output_1 += "... y ".concat(resultArray.length - 10, " registro(s) m\u00E1s");
                    }
                    return [2 /*return*/, output_1];
                case 32: throw new Error("Tool not found: ".concat(name));
                case 33: return [3 /*break*/, 35];
                case 34:
                    error_1 = _d.sent();
                    logger_mysql_1.default.error("Error executing tool ".concat(name, ":"), error_1);
                    throw error_1;
                case 35: return [2 /*return*/];
            }
        });
    });
}
// Endpoint completo con todas las herramientas (requiere autenticación)
router.post('/mcp-complete', authenticateApiKey, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a, toolName, toolArgs, result, error_2;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                request = req.body;
                logger_mysql_1.default.info('MCP Complete request:', { method: request.method, params: request.params });
                _d.label = 1;
            case 1:
                _d.trys.push([1, 9, , 10]);
                _a = request.method;
                switch (_a) {
                    case 'initialize': return [3 /*break*/, 2];
                    case 'tools/list': return [3 /*break*/, 3];
                    case 'tools/call': return [3 /*break*/, 4];
                    case 'ping': return [3 /*break*/, 6];
                }
                return [3 /*break*/, 7];
            case 2:
                res.json(createSuccessResponse(request.id, {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: { listChanged: false }
                    },
                    serverInfo: {
                        name: 'biosanarcall-mcp-complete',
                        version: '1.0.0'
                    }
                }));
                return [2 /*return*/];
            case 3:
                res.json(createSuccessResponse(request.id, { tools: COMPLETE_TOOLS }));
                return [2 /*return*/];
            case 4:
                toolName = (_b = request.params) === null || _b === void 0 ? void 0 : _b.name;
                toolArgs = ((_c = request.params) === null || _c === void 0 ? void 0 : _c.arguments) || {};
                if (!toolName) {
                    return [2 /*return*/, res.json(createErrorResponse(request.id, -32602, 'Missing tool name'))];
                }
                return [4 /*yield*/, executeCompleteTool(toolName, toolArgs)];
            case 5:
                result = _d.sent();
                res.json(createSuccessResponse(request.id, {
                    content: [{ type: 'text', text: result }]
                }));
                return [2 /*return*/];
            case 6:
                res.json(createSuccessResponse(request.id, {}));
                return [2 /*return*/];
            case 7:
                res.json(createErrorResponse(request.id, -32601, "Method not found: ".concat(request.method)));
                return [2 /*return*/];
            case 8: return [3 /*break*/, 10];
            case 9:
                error_2 = _d.sent();
                logger_mysql_1.default.error('MCP Complete endpoint error:', error_2);
                res.json(createErrorResponse(request.id, -32000, error_2 instanceof Error ? error_2.message : 'Internal error'));
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); });
// Endpoint de demostración sin autenticación (solo para MCP Inspector)
router.post('/mcp-demo', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a, demoTools, demoToolName, demoToolArgs, demoResult, error_3;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                request = req.body;
                logger_mysql_1.default.info('MCP Demo request:', { method: request.method, params: request.params });
                _d.label = 1;
            case 1:
                _d.trys.push([1, 9, , 10]);
                _a = request.method;
                switch (_a) {
                    case 'initialize': return [3 /*break*/, 2];
                    case 'tools/list': return [3 /*break*/, 3];
                    case 'tools/call': return [3 /*break*/, 4];
                    case 'ping': return [3 /*break*/, 6];
                }
                return [3 /*break*/, 7];
            case 2:
                res.json(createSuccessResponse(request.id, {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: { listChanged: false }
                    },
                    serverInfo: {
                        name: 'biosanarcall-mcp-demo',
                        version: '1.0.0'
                    }
                }));
                return [3 /*break*/, 8];
            case 3:
                demoTools = COMPLETE_TOOLS.filter(function (tool) {
                    return tool.name.startsWith('get') || tool.name.startsWith('search');
                });
                res.json(createSuccessResponse(request.id, { tools: demoTools }));
                return [3 /*break*/, 8];
            case 4:
                demoToolName = (_b = request.params) === null || _b === void 0 ? void 0 : _b.name;
                demoToolArgs = ((_c = request.params) === null || _c === void 0 ? void 0 : _c.arguments) || {};
                if (!demoToolName) {
                    return [2 /*return*/, res.json(createErrorResponse(request.id, -32602, 'Missing tool name'))];
                }
                // Solo permitir herramientas de lectura en demo
                if (!demoToolName.startsWith('get') && !demoToolName.startsWith('search')) {
                    return [2 /*return*/, res.json(createErrorResponse(request.id, -32601, 'Demo mode: only read operations allowed'))];
                }
                return [4 /*yield*/, executeCompleteTool(demoToolName, demoToolArgs)];
            case 5:
                demoResult = _d.sent();
                res.json(createSuccessResponse(request.id, {
                    content: [{ type: 'text', text: demoResult }]
                }));
                return [3 /*break*/, 8];
            case 6:
                res.json(createSuccessResponse(request.id, {}));
                return [3 /*break*/, 8];
            case 7:
                res.json(createErrorResponse(request.id, -32601, "Method not found: ".concat(request.method)));
                _d.label = 8;
            case 8: return [3 /*break*/, 10];
            case 9:
                error_3 = _d.sent();
                logger_mysql_1.default.error('MCP Demo endpoint error:', error_3);
                res.json(createErrorResponse(request.id, -32000, error_3 instanceof Error ? error_3.message : 'Internal error'));
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
