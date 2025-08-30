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
exports.pool = exports.db = void 0;
exports.testDbConnection = testDbConnection;
exports.executeQuery = executeQuery;
exports.getDbStats = getDbStats;
var promise_1 = require("mysql2/promise");
var logger_1 = require("../logger");
// Database configuration using provided credentials
var dbConfig = {
    host: '127.0.0.1',
    port: 3306,
    user: 'biosanar_user',
    password: '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
    database: 'biosanar',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 10000,
    timeout: 10000,
    reconnect: true,
    charset: 'utf8mb4'
};
exports.db = promise_1.default.createPool(dbConfig);
// Exportar pool para compatibilidad con queries.ts
exports.pool = exports.db;
// Test database connection
function testDbConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var connection, rows, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, exports.db.getConnection()];
                case 1:
                    connection = _a.sent();
                    return [4 /*yield*/, connection.execute('SELECT 1 as test, NOW() as timestamp')];
                case 2:
                    rows = (_a.sent())[0];
                    connection.release();
                    logger_1.logger.info('✅ MySQL connection successful:', rows);
                    return [2 /*return*/, true];
                case 3:
                    error_1 = _a.sent();
                    logger_1.logger.error('❌ MySQL connection failed:', error_1);
                    return [2 /*return*/, false];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// Utility function to execute queries safely
function executeQuery(query_1) {
    return __awaiter(this, arguments, void 0, function (query, params) {
        var rows, error_2;
        if (params === void 0) { params = []; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.db.execute(query, params)];
                case 1:
                    rows = (_a.sent())[0];
                    return [2 /*return*/, rows];
                case 2:
                    error_2 = _a.sent();
                    logger_1.logger.error('Query execution failed:', { query: query, params: params, error: error_2 });
                    throw error_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Get database stats
function getDbStats() {
    return __awaiter(this, void 0, void 0, function () {
        var patients, appointments, doctors, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, exports.db.execute('SELECT COUNT(*) as total FROM patients WHERE deleted_at IS NULL')];
                case 1:
                    patients = (_a.sent())[0];
                    return [4 /*yield*/, exports.db.execute('SELECT COUNT(*) as total FROM appointments WHERE DATE(appointment_date) = CURDATE()')];
                case 2:
                    appointments = (_a.sent())[0];
                    return [4 /*yield*/, exports.db.execute('SELECT COUNT(*) as total FROM users WHERE role = "doctor"')];
                case 3:
                    doctors = (_a.sent())[0];
                    return [2 /*return*/, {
                            totalPatients: patients[0].total,
                            todayAppointments: appointments[0].total,
                            totalDoctors: doctors[0].total,
                            timestamp: new Date().toISOString()
                        }];
                case 4:
                    error_3 = _a.sent();
                    logger_1.logger.error('Failed to get database stats:', error_3);
                    throw error_3;
                case 5: return [2 /*return*/];
            }
        });
    });
}
