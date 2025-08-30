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
var express_1 = require("express");
var cors_1 = require("cors");
var logger_mysql_1 = require("./src/logger-mysql");
var mcp_mysql_1 = require("./src/routes/mcp-mysql");
var mcp_complete_1 = require("./src/routes/mcp-complete");
var mysql_1 = require("./src/db/mysql");
var app = (0, express_1.default)();
var PORT = process.env.PORT || 8976;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logging
app.use(function (req, res, next) {
    logger_mysql_1.default.info("".concat(req.method, " ").concat(req.path), {
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next();
});
// Routes
app.use('/api', mcp_mysql_1.default);
app.use('/api', mcp_complete_1.default);
// Root endpoint
app.get('/', function (req, res) {
    res.json({
        service: 'Biosanarcall MCP Node.js Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /api/health - Health check',
            'POST /api/elevenlabs - MCP para ElevenLabs (3 tools)',
            'POST /api/mcp-simple - MCP simple (6 tools)',
            'POST /api/mcp-complete - MCP completo (15+ tools)',
            'POST /api/mcp-demo - MCP demo sin autenticación',
            'GET /api/tools - Lista de tools disponibles'
        ],
        features: [
            'Conexión directa MySQL',
            'Optimizado para ElevenLabs',
            'Autenticación API Key',
            'Logging estructurado'
        ]
    });
});
// Error handling
app.use(function (error, req, res, next) {
    logger_mysql_1.default.error('Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});
// 404 handler
app.use(function (req, res) {
    res.status(404).json({
        error: 'Not found',
        path: req.path,
        timestamp: new Date().toISOString()
    });
});
// Start server
function startServer() {
    return __awaiter(this, void 0, void 0, function () {
        var dbConnected_1, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, mysql_1.testDbConnection)()];
                case 1:
                    dbConnected_1 = _a.sent();
                    if (!dbConnected_1) {
                        logger_mysql_1.default.warn('Database connection failed, but starting server anyway');
                    }
                    else {
                        logger_mysql_1.default.info('Database connection successful');
                    }
                    app.listen(PORT, function () {
                        logger_mysql_1.default.info("Server started on port ".concat(PORT), {
                            port: PORT,
                            database: dbConnected_1 ? 'connected' : 'disconnected',
                            endpoints: ['/api/elevenlabs', '/api/mcp-simple', '/api/health']
                        });
                    });
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    logger_mysql_1.default.error('Failed to start server:', error_1);
                    process.exit(1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Graceful shutdown
process.on('SIGTERM', function () {
    logger_mysql_1.default.info('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});
process.on('SIGINT', function () {
    logger_mysql_1.default.info('Received SIGINT, shutting down gracefully');
    process.exit(0);
});
startServer();
