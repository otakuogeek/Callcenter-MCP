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
exports.executeQuery = executeQuery;
exports.executeQueryWithCache = executeQueryWithCache;
exports.getPatientById = getPatientById;
exports.getDoctorById = getDoctorById;
exports.getAppointmentsByDate = getAppointmentsByDate;
exports.getTodayAppointments = getTodayAppointments;
exports.createAppointment = createAppointment;
exports.updateAppointmentStatus = updateAppointmentStatus;
exports.getPatientAppointments = getPatientAppointments;
exports.getDoctorAppointments = getDoctorAppointments;
exports.searchPatients = searchPatients;
exports.getAvailableDoctors = getAvailableDoctors;
exports.healthCheck = healthCheck;
var mysql_1 = require("./mysql");
var logger_mysql_1 = require("../logger-mysql");
// Simple cache implementation
var cache = new Map();
function getFromCache(key) {
    var item = cache.get(key);
    if (item && item.expiry > Date.now()) {
        return item.data;
    }
    cache.delete(key);
    return null;
}
function setCache(key, data, ttlSeconds) {
    if (ttlSeconds === void 0) { ttlSeconds = 60; }
    cache.set(key, {
        data: data,
        expiry: Date.now() + (ttlSeconds * 1000)
    });
}
function executeQuery(query_1) {
    return __awaiter(this, arguments, void 0, function (query, params) {
        var startTime, rows, duration, error_1, duration;
        if (params === void 0) { params = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    startTime = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, mysql_1.pool.execute(query, params)];
                case 2:
                    rows = (_a.sent())[0];
                    duration = Date.now() - startTime;
                    logger_mysql_1.default.info('Query executed successfully', {
                        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                        params: params.length > 0 ? params : undefined,
                        duration: "".concat(duration, "ms"),
                        rowCount: Array.isArray(rows) ? rows.length : 'N/A'
                    });
                    return [2 /*return*/, rows];
                case 3:
                    error_1 = _a.sent();
                    duration = Date.now() - startTime;
                    logger_mysql_1.default.error('Query execution failed', {
                        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
                        params: params.length > 0 ? params : undefined,
                        duration: "".concat(duration, "ms"),
                        error: error_1 instanceof Error ? error_1.message : 'Unknown error'
                    });
                    throw error_1;
                case 4: return [2 /*return*/];
            }
        });
    });
}
function executeQueryWithCache(query_1) {
    return __awaiter(this, arguments, void 0, function (query, params, cacheTTL) {
        var cacheKey, cached, result;
        if (params === void 0) { params = []; }
        if (cacheTTL === void 0) { cacheTTL = 60; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    cacheKey = "query:".concat(Buffer.from(query + JSON.stringify(params)).toString('base64').substring(0, 50));
                    cached = getFromCache(cacheKey);
                    if (cached) {
                        logger_mysql_1.default.debug('Query result served from cache', { cacheKey: cacheKey });
                        return [2 /*return*/, cached];
                    }
                    return [4 /*yield*/, executeQuery(query, params)];
                case 1:
                    result = _a.sent();
                    setCache(cacheKey, result, cacheTTL);
                    return [2 /*return*/, result];
            }
        });
    });
}
// Funciones específicas para operaciones comunes
function getPatientById(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, executeQueryWithCache('SELECT * FROM patients WHERE id = ?', [id], 300 // 5 minutos
                )];
        });
    });
}
function getDoctorById(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, executeQueryWithCache('SELECT * FROM doctors WHERE id = ?', [id], 300 // 5 minutos
                )];
        });
    });
}
function getAppointmentsByDate(date) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, executeQueryWithCache("SELECT a.*, \n            p.first_name as patient_first_name, p.last_name as patient_last_name,\n            d.first_name as doctor_first_name, d.last_name as doctor_last_name\n     FROM appointments a\n     LEFT JOIN patients p ON a.patient_id = p.id\n     LEFT JOIN doctors d ON a.doctor_id = d.id\n     WHERE DATE(a.appointment_date) = ?\n     ORDER BY a.appointment_date", [date], 60 // 1 minuto
                )];
        });
    });
}
function getTodayAppointments() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, executeQueryWithCache("SELECT a.*, \n            p.first_name as patient_first_name, p.last_name as patient_last_name,\n            d.first_name as doctor_first_name, d.last_name as doctor_last_name\n     FROM appointments a\n     LEFT JOIN patients p ON a.patient_id = p.id\n     LEFT JOIN doctors d ON a.doctor_id = d.id\n     WHERE DATE(a.appointment_date) = CURDATE()\n     ORDER BY a.appointment_date", [], 30 // 30 segundos
                )];
        });
    });
}
function createAppointment(appointmentData) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, executeQuery("INSERT INTO appointments (patient_id, doctor_id, appointment_date, notes, status) \n     VALUES (?, ?, ?, ?, 'pendiente')", [
                        appointmentData.patient_id,
                        appointmentData.doctor_id,
                        appointmentData.appointment_date,
                        appointmentData.notes || ''
                    ])];
                case 1:
                    result = _a.sent();
                    // Invalidar cache relacionado
                    cache.delete('dashboard_stats');
                    return [2 /*return*/, result];
            }
        });
    });
}
function updateAppointmentStatus(appointmentId, status) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, executeQuery('UPDATE appointments SET status = ?, updated_at = NOW() WHERE id = ?', [status, appointmentId])];
                case 1:
                    result = _a.sent();
                    // Invalidar cache relacionado
                    cache.delete('dashboard_stats');
                    return [2 /*return*/, result];
            }
        });
    });
}
function getPatientAppointments(patientId_1) {
    return __awaiter(this, arguments, void 0, function (patientId, limit) {
        if (limit === void 0) { limit = 10; }
        return __generator(this, function (_a) {
            return [2 /*return*/, executeQueryWithCache("SELECT a.*, \n            d.first_name as doctor_first_name, d.last_name as doctor_last_name,\n            d.specialization as doctor_specialization\n     FROM appointments a\n     LEFT JOIN doctors d ON a.doctor_id = d.id\n     WHERE a.patient_id = ?\n     ORDER BY a.appointment_date DESC\n     LIMIT ?", [patientId, limit], 120 // 2 minutos
                )];
        });
    });
}
function getDoctorAppointments(doctorId, date) {
    return __awaiter(this, void 0, void 0, function () {
        var query, params;
        return __generator(this, function (_a) {
            query = "\n    SELECT a.*, \n           p.first_name as patient_first_name, p.last_name as patient_last_name,\n           p.phone as patient_phone, p.email as patient_email\n    FROM appointments a\n    LEFT JOIN patients p ON a.patient_id = p.id\n    WHERE a.doctor_id = ?\n  ";
            params = [doctorId];
            if (date) {
                query += ' AND DATE(a.appointment_date) = ?';
                params.push(date);
            }
            else {
                query += ' AND a.appointment_date >= CURDATE()';
            }
            query += ' ORDER BY a.appointment_date';
            return [2 /*return*/, executeQueryWithCache(query, params, 60)];
        });
    });
}
function searchPatients(searchTerm_1) {
    return __awaiter(this, arguments, void 0, function (searchTerm, limit) {
        if (limit === void 0) { limit = 20; }
        return __generator(this, function (_a) {
            return [2 /*return*/, executeQueryWithCache("SELECT id, first_name, last_name, email, phone, date_of_birth\n     FROM patients \n     WHERE first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?\n     ORDER BY last_name, first_name\n     LIMIT ?", ["%".concat(searchTerm, "%"), "%".concat(searchTerm, "%"), "%".concat(searchTerm, "%"), "%".concat(searchTerm, "%"), limit], 180 // 3 minutos
                )];
        });
    });
}
function getAvailableDoctors(date) {
    return __awaiter(this, void 0, void 0, function () {
        var query, params;
        return __generator(this, function (_a) {
            query = "\n    SELECT id, first_name, last_name, specialization, email, phone\n    FROM doctors \n    WHERE status = 'activo'\n  ";
            params = [];
            if (date) {
                // Aquí podrías agregar lógica para verificar disponibilidad en una fecha específica
                // Por ahora solo retornamos doctores activos
            }
            query += ' ORDER BY last_name, first_name';
            return [2 /*return*/, executeQueryWithCache(query, params, 300)];
        });
    });
}
// Función para health check de la base de datos
function healthCheck() {
    return __awaiter(this, void 0, void 0, function () {
        var error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, executeQuery('SELECT 1 as health_check')];
                case 1:
                    _a.sent();
                    return [2 /*return*/, true];
                case 2:
                    error_2 = _a.sent();
                    logger_mysql_1.default.error('Database health check failed', error_2);
                    return [2 /*return*/, false];
                case 3: return [2 /*return*/];
            }
        });
    });
}
