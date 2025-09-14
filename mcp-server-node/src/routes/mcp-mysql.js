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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var auth_1 = require("../middleware/auth");
var queries_1 = require("../db/queries");
var mysql_1 = require("../db/mysql");
var logger_mysql_1 = require("../logger-mysql");
var router = express_1.default.Router();
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
// MCP Tools for ElevenLabs (optimized set)
var ELEVENLABS_TOOLS = [
    {
        name: 'searchPatients',
        description: 'Buscar pacientes por nombre o documento',
        inputSchema: {
            type: 'object',
            properties: {
                q: { type: 'string', description: 'Término de búsqueda' },
                limit: { type: 'number', description: 'Máximo resultados (1-20)', minimum: 1, maximum: 20 }
            },
            required: ['q']
        }
    },
    {
        name: 'getAppointments',
        description: 'Ver citas de una fecha específica',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
            }
        }
    },
    {
        name: 'getDaySummary',
        description: 'Resumen hablado del día para voz',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Fecha YYYY-MM-DD (opcional, hoy por defecto)' }
            }
        }
    },
    {
        name: 'getLocations',
        description: 'Obtener ubicaciones/sedes disponibles',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    }
];
// Simple tools (9 tools for general MCP)
var SIMPLE_TOOLS = __spreadArray(__spreadArray([], ELEVENLABS_TOOLS, true), [
    {
        name: 'getPatient',
        description: 'Obtener detalle de un paciente',
        inputSchema: {
            type: 'object',
            properties: {
                patient_id: { type: 'number', description: 'ID del paciente' }
            },
            required: ['patient_id']
        }
    },
    {
        name: 'getDoctors',
        description: 'Listar médicos disponibles',
        inputSchema: {
            type: 'object',
            properties: {
                speciality: { type: 'string', description: 'Filtrar por especialidad (opcional)' }
            }
        }
    },
    {
        name: 'getStats',
        description: 'Estadísticas generales',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    }
], false);
// Tool execution
function executeTool(name, args) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, query, limit, patients, patientId, patient, date, appointments, summaryDate, doctors, dbConnected, error_1;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    logger_mysql_1.default.info("Executing tool: ".concat(name), { args: args });
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 16, , 17]);
                    _a = name;
                    switch (_a) {
                        case 'searchPatients': return [3 /*break*/, 2];
                        case 'getPatient': return [3 /*break*/, 4];
                        case 'getAppointments': return [3 /*break*/, 6];
                        case 'getDaySummary': return [3 /*break*/, 8];
                        case 'getDoctors': return [3 /*break*/, 10];
                        case 'getStats': return [3 /*break*/, 12];
                        case 'getLocations': return [3 /*break*/, 14];
                    }
                    return [3 /*break*/, 16];
                case 2:
                    query = (_b = args.q) === null || _b === void 0 ? void 0 : _b.trim();
                    if (!query)
                        throw new Error('Query parameter is required');
                    limit = Math.min(args.limit || 10, 20);
                    return [4 /*yield*/, (0, queries_1.searchPatients)(query, limit)];
                case 3:
                    patients = _c.sent();
                    return [2 /*return*/, "".concat(patients.length, " paciente(s) encontrados: ").concat(patients.map(function (p) { return "".concat(p.name, " (").concat(p.document, ")"); }).join(', '))];
                case 4:
                    patientId = parseInt(args.patient_id);
                    if (!patientId)
                        throw new Error('Valid patient_id is required');
                    return [4 /*yield*/, (0, queries_1.getPatientById)(patientId)];
                case 5:
                    patient = _c.sent();
                    if (!patient)
                        return [2 /*return*/, "Paciente ".concat(patientId, " no encontrado")];
                    return [2 /*return*/, "".concat(patient.name, ", ").concat(patient.document, ", ").concat(patient.phone || 'Sin teléfono', ", Estado: ").concat(patient.status)];
                case 6:
                    date = args.date || new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, (0, queries_1.getAppointmentsByDate)(date)];
                case 7:
                    appointments = _c.sent();
                    if (appointments.length === 0)
                        return [2 /*return*/, "Sin citas para ".concat(date)];
                    return [2 /*return*/, "".concat(appointments.length, " citas en ").concat(date, ": ").concat(appointments.map(function (a) {
                            return "".concat(a.patient_name, " ").concat(a.scheduled_at.substring(11, 16), " (").concat(a.status, ")");
                        }).join(', '))];
                case 8:
                    summaryDate = args.date || new Date().toISOString().split('T')[0];
                    return [4 /*yield*/, (0, queries_1.getDaySummary)(summaryDate)];
                case 9: return [2 /*return*/, _c.sent()];
                case 10: return [4 /*yield*/, (0, queries_1.getDoctors)(args.speciality)];
                case 11:
                    doctors = _c.sent();
                    return [2 /*return*/, "".concat(doctors.length, " m\u00E9dicos: ").concat(doctors.map(function (d) {
                            return "".concat(d.name).concat(d.speciality ? " (".concat(d.speciality, ")") : '');
                        }).join(', '))];
                case 12: return [4 /*yield*/, (0, mysql_1.testDbConnection)()];
                case 13:
                    dbConnected = _c.sent();
                    return [2 /*return*/, "Base de datos: ".concat(dbConnected ? 'Conectada' : 'Desconectada', ". Servidor funcionando correctamente.")];
                case 14: return [4 /*yield*/, (0, queries_1.getLocations)()];
                case 15:
                    var locations = _c.sent();
                    if (locations.length === 0)
                        return [2 /*return*/, "No hay ubicaciones disponibles"];
                    return [2 /*return*/, "".concat(locations.length, " ubicaciones disponibles: ").concat(locations.map(function (l) {
                            return "".concat(l.name, " en ").concat(l.address, " - ").concat(l.hours || 'Horarios por confirmar');
                        }).join(', '))];
                case 16: throw new Error("Tool '".concat(name, "' not found"));
                case 17: return [3 /*break*/, 19];
                case 18:
                    error_1 = _c.sent();
                    logger_mysql_1.default.error("Tool execution failed: ".concat(name), { error: error_1 instanceof Error ? error_1.message : error_1 });
                    throw error_1;
                case 17: return [2 /*return*/];
            }
        });
    });
}
// Routes
// Info endpoint (sin autenticación para debugging)
router.get('/info', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var currentTime, expectedApiKey;
    return __generator(this, function (_a) {
        currentTime = new Date().toISOString();
        expectedApiKey = process.env.MCP_API_KEY || 'biosanarcall_mcp_node_2025';
        res.json({
            server: 'Biosanarcall MCP Node.js',
            version: '1.0.0',
            timestamp: currentTime,
            endpoints: {
                elevenlabs: {
                    url: '/api/elevenlabs',
                    tools: ELEVENLABS_TOOLS.length,
                    description: 'Optimizado para ElevenLabs Voice AI',
                    methods: ['initialize', 'tools/list', 'tools/call', 'ping']
                },
                simple: {
                    url: '/api/mcp-simple',
                    tools: SIMPLE_TOOLS.length,
                    description: 'Set completo de herramientas MCP',
                    methods: ['initialize', 'tools/list', 'tools/call', 'ping']
                }
            },
            authentication: {
                method: 'API Key',
                header: 'X-API-Key',
                expected_key_format: 'biosanarcall_mcp_node_XXXX',
                key_length: expectedApiKey.length,
                note: 'Clave requerida para todos los endpoints MCP'
            },
            configuration: {
                domain: 'https://biosanarcall.site',
                direct_urls: {
                    health: 'https://biosanarcall.site/mcp-node-health',
                    elevenlabs: 'https://biosanarcall.site/mcp-elevenlabs',
                    simple: 'https://biosanarcall.site/mcp-simple',
                    info: 'https://biosanarcall.site/mcp-node-info'
                }
            },
            tools: {
                elevenlabs: ELEVENLABS_TOOLS.map(function (t) { return ({ name: t.name, description: t.description }); }),
                simple: SIMPLE_TOOLS.map(function (t) { return ({ name: t.name, description: t.description }); })
            },
            usage_examples: {
                test_auth: "curl -X POST https://biosanarcall.site/mcp-elevenlabs -H 'Content-Type: application/json' -H 'X-API-Key: " + expectedApiKey + "' -d '{\"jsonrpc\":\"2.0\",\"id\":\"test\",\"method\":\"tools/list\"}'",
                test_tool: "curl -X POST https://biosanarcall.site/mcp-elevenlabs -H 'Content-Type: application/json' -H 'X-API-Key: " + expectedApiKey + "' -d '{\"jsonrpc\":\"2.0\",\"id\":\"search\",\"method\":\"tools/call\",\"params\":{\"name\":\"searchPatients\",\"arguments\":{\"q\":\"Juan\",\"limit\":3}}}'"
            }
        });
        return [2 /*return*/];
    });
}); });
// Health endpoint
router.get('/health', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var dbConnected, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.race([
                        (0, mysql_1.testDbConnection)(),
                        new Promise(function (_, reject) { return setTimeout(function () { return reject(new Error('Database timeout')); }, 3000); })
                    ])];
            case 1:
                dbConnected = _a.sent();
                res.json({
                    status: 'ok',
                    database: dbConnected ? 'connected' : 'disconnected',
                    server: 'Biosanarcall MCP Node.js',
                    timestamp: new Date().toISOString(),
                    tools: {
                        elevenlabs: ELEVENLABS_TOOLS.length,
                        simple: SIMPLE_TOOLS.length
                    }
                });
                return [3 /*break*/, 3];
            case 2:
                error_2 = _a.sent();
                res.status(500).json({
                    status: 'error',
                    error: error_2 instanceof Error ? error_2.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
// MCP Endpoints
// GET endpoint para ElevenLabs - Llamadas directas a herramientas
router.get('/elevenlabs', auth_1.authenticateApiKey, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, method, tool, q, limit, date, patient_id, speciality, toolName, args, result, error_3;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.query, method = _a.method, tool = _a.tool, q = _a.q, limit = _a.limit, date = _a.date, patient_id = _a.patient_id, speciality = _a.speciality;
                logger_mysql_1.default.info('ElevenLabs GET request', { method: method, tool: tool, query: req.query });
                _b.label = 1;
            case 1:
                _b.trys.push([1, 4, , 5]);
                // Si se especifica un método MCP
                if (method === 'tools/list' || method === 'list') {
                    return [2 /*return*/, res.json({
                            tools: ELEVENLABS_TOOLS,
                            count: ELEVENLABS_TOOLS.length,
                            server: 'biosanarcall-elevenlabs'
                        })];
                }
                if (!tool) return [3 /*break*/, 3];
                toolName = tool;
                args = {};
                // Mapear parámetros de query a argumentos de herramienta
                if (q)
                    args.q = q;
                if (limit)
                    args.limit = parseInt(limit);
                if (date)
                    args.date = date;
                if (patient_id)
                    args.patient_id = parseInt(patient_id);
                if (speciality)
                    args.speciality = speciality;
                return [4 /*yield*/, executeTool(toolName, args)];
            case 2:
                result = _b.sent();
                return [2 /*return*/, res.json({
                        tool: toolName,
                        result: result,
                        timestamp: new Date().toISOString()
                    })];
            case 3:
                // Respuesta por defecto - información del servidor
                res.json({
                    server: 'Biosanarcall MCP ElevenLabs',
                    version: '1.0.0',
                    protocol: 'MCP 2024-11-05',
                    status: 'ready',
                    tools_available: ELEVENLABS_TOOLS.length,
                    capabilities: ['initialize', 'tools/list', 'tools/call', 'ping'],
                    direct_access: {
                        list_tools: '?method=tools/list',
                        search_patients: '?tool=searchPatients&q=Juan&limit=5',
                        get_appointments: '?tool=getAppointments&date=2025-08-19',
                        day_summary: '?tool=getDaySummary&date=2025-08-19'
                    },
                    note: 'Use POST for full MCP protocol communication',
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 5];
            case 4:
                error_3 = _b.sent();
                logger_mysql_1.default.error('ElevenLabs GET error:', error_3);
                res.status(500).json({
                    error: error_3 instanceof Error ? error_3.message : 'Internal error',
                    timestamp: new Date().toISOString()
                });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); });
// ElevenLabs endpoint POST - Protocolo MCP completo
router.post('/elevenlabs', auth_1.authenticateApiKey, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a, toolName, toolArgs, result, error_4;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                request = req.body;
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
                    capabilities: { tools: true },
                    serverInfo: { name: 'biosanarcall-elevenlabs', version: '1.0.0' }
                }));
                return [3 /*break*/, 8];
            case 3:
                res.json(createSuccessResponse(request.id, { tools: ELEVENLABS_TOOLS }));
                return [3 /*break*/, 8];
            case 4:
                toolName = (_b = request.params) === null || _b === void 0 ? void 0 : _b.name;
                toolArgs = ((_c = request.params) === null || _c === void 0 ? void 0 : _c.arguments) || {};
                if (!toolName) {
                    return [2 /*return*/, res.json(createErrorResponse(request.id, -32602, 'Missing tool name'))];
                }
                return [4 /*yield*/, executeTool(toolName, toolArgs)];
            case 5:
                result = _d.sent();
                res.json(createSuccessResponse(request.id, {
                    content: [{ type: 'text', text: result }]
                }));
                return [3 /*break*/, 8];
            case 6:
                res.json(createSuccessResponse(request.id, { pong: true }));
                return [3 /*break*/, 8];
            case 7:
                res.json(createErrorResponse(request.id, -32601, "Method not found: ".concat(request.method)));
                _d.label = 8;
            case 8: return [3 /*break*/, 10];
            case 9:
                error_4 = _d.sent();
                logger_mysql_1.default.error('ElevenLabs endpoint error:', error_4);
                res.json(createErrorResponse(request.id, -32000, error_4 instanceof Error ? error_4.message : 'Internal error'));
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); });
// Simple MCP endpoint (6 tools)
router.post('/mcp-simple', auth_1.authenticateApiKey, function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a, toolName, toolArgs, result, error_5;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                request = req.body;
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
                    capabilities: { tools: true },
                    serverInfo: { name: 'biosanarcall-mcp-simple', version: '1.0.0' }
                }));
                return [3 /*break*/, 8];
            case 3:
                res.json(createSuccessResponse(request.id, { tools: SIMPLE_TOOLS }));
                return [3 /*break*/, 8];
            case 4:
                toolName = (_b = request.params) === null || _b === void 0 ? void 0 : _b.name;
                toolArgs = ((_c = request.params) === null || _c === void 0 ? void 0 : _c.arguments) || {};
                if (!toolName) {
                    return [2 /*return*/, res.json(createErrorResponse(request.id, -32602, 'Missing tool name'))];
                }
                return [4 /*yield*/, executeTool(toolName, toolArgs)];
            case 5:
                result = _d.sent();
                res.json(createSuccessResponse(request.id, {
                    content: [{ type: 'text', text: result }]
                }));
                return [3 /*break*/, 8];
            case 6:
                res.json(createSuccessResponse(request.id, { pong: true }));
                return [3 /*break*/, 8];
            case 7:
                res.json(createErrorResponse(request.id, -32601, "Method not found: ".concat(request.method)));
                _d.label = 8;
            case 8: return [3 /*break*/, 10];
            case 9:
                error_5 = _d.sent();
                logger_mysql_1.default.error('Simple MCP endpoint error:', error_5);
                res.json(createErrorResponse(request.id, -32000, error_5 instanceof Error ? error_5.message : 'Internal error'));
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); });
// MCP Inspector endpoint - Sin autenticación para testing del Inspector
router.post('/mcp-inspector', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var request, _a, toolName, toolArgs, result, error_6;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                request = req.body;
                logger_mysql_1.default.info('MCP Inspector request:', { method: request.method, params: request.params });
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
                        name: 'biosanarcall-mcp-inspector',
                        version: '1.0.0'
                    }
                }));
                return [3 /*break*/, 8];
            case 3:
                res.json(createSuccessResponse(request.id, { tools: ELEVENLABS_TOOLS }));
                return [3 /*break*/, 8];
            case 4:
                toolName = (_b = request.params) === null || _b === void 0 ? void 0 : _b.name;
                toolArgs = ((_c = request.params) === null || _c === void 0 ? void 0 : _c.arguments) || {};
                if (!toolName) {
                    return [2 /*return*/, res.json(createErrorResponse(request.id, -32602, 'Missing tool name'))];
                }
                return [4 /*yield*/, executeTool(toolName, toolArgs)];
            case 5:
                result = _d.sent();
                res.json(createSuccessResponse(request.id, {
                    content: [{ type: 'text', text: result }]
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
                error_6 = _d.sent();
                logger_mysql_1.default.error('MCP Inspector endpoint error:', error_6);
                res.json(createErrorResponse(request.id, -32000, error_6 instanceof Error ? error_6.message : 'Internal error'));
                return [3 /*break*/, 10];
            case 10: return [2 /*return*/];
        }
    });
}); });
// Debug endpoints
router.get('/tools', function (req, res) {
    res.json({
        elevenlabs: ELEVENLABS_TOOLS,
        simple: SIMPLE_TOOLS,
        counts: {
            elevenlabs: ELEVENLABS_TOOLS.length,
            simple: SIMPLE_TOOLS.length
        }
    });
});
exports.default = router;
