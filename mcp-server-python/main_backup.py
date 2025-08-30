#!/usr/bin/env python3
"""
Servidor MCP en Python para Biosanarcall
Implementación ligera y directa del protocolo MCP
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional
import uvicorn
import json

app = FastAPI(title="Biosanarcall MCP Server Python", version="1.0.0")

# CORS para ElevenLabs
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    """Endpoint de salud del servidor MCP Python"""
    return {
        "status": "ok",
        "server": "Biosanarcall MCP Python",
        "tools_count": len(MEDICAL_TOOLS),
        "simple_tools_count": len(SIMPLE_TOOLS),
        "endpoints": ["/mcp", "/mcp-simple", "/health"]
    }

@app.post("/mcp")
async def mcp_endpoint(request: JSONRPCRequest):

# Modelos de datos
class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: int
    method: str
    params: Optional[Dict[str, Any]] = None

class Tool(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]

# Herramientas médicas disponibles (versión completa)
MEDICAL_TOOLS = [
    # Gestión de Pacientes
    {
        "name": "searchPatients",
        "description": "Buscar pacientes por nombre, ID o documento",
        "input_schema": {
            "type": "object",
            "properties": {
                "q": {"type": "string", "description": "Término de búsqueda"}
            },
            "required": ["q"]
        }
    },
    {
        "name": "createPatient",
        "description": "Crear nuevo paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nombre completo"},
                "document": {"type": "string", "description": "Documento de identidad"},
                "phone": {"type": "string", "description": "Teléfono"},
                "email": {"type": "string", "description": "Email"}
            },
            "required": ["name", "document"]
        }
    },
    {
        "name": "updatePatient",
        "description": "Actualizar información del paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "ID del paciente"},
                "data": {"type": "object", "description": "Datos a actualizar"}
            },
            "required": ["id", "data"]
        }
    },
    {
        "name": "deletePatient",
        "description": "Eliminar paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "ID del paciente"}
            },
            "required": ["id"]
        }
    },
    
    # Gestión de Doctores
    {
        "name": "getDoctors",
        "description": "Listar todos los doctores disponibles",
        "input_schema": {
            "type": "object",
            "properties": {
                "specialty_id": {"type": "integer", "description": "Filtrar por especialidad"}
            }
        }
    },
    {
        "name": "createDoctor",
        "description": "Crear nuevo doctor",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nombre del doctor"},
                "license": {"type": "string", "description": "Número de licencia médica"},
                "phone": {"type": "string", "description": "Teléfono"},
                "email": {"type": "string", "description": "Email"}
            },
            "required": ["name", "license"]
        }
    },
    {
        "name": "updateDoctor",
        "description": "Actualizar información del doctor",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "ID del doctor"},
                "data": {"type": "object", "description": "Datos a actualizar"}
            },
            "required": ["id", "data"]
        }
    },
    
    # Especialidades Médicas
    {
        "name": "getSpecialties",
        "description": "Listar todas las especialidades médicas",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "createSpecialty",
        "description": "Crear nueva especialidad médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nombre de la especialidad"},
                "description": {"type": "string", "description": "Descripción"}
            },
            "required": ["name"]
        }
    },
    
    # Gestión de Citas
    {
        "name": "getAppointments",
        "description": "Listar citas médicas",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"},
                "doctor_id": {"type": "integer", "description": "ID del doctor"},
                "patient_id": {"type": "integer", "description": "ID del paciente"},
                "status": {"type": "string", "description": "Estado de la cita"}
            }
        }
    },
    {
        "name": "createAppointment",
        "description": "Crear nueva cita médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "integer", "description": "ID del paciente"},
                "doctor_id": {"type": "integer", "description": "ID del doctor"},
                "date": {"type": "string", "description": "Fecha y hora"},
                "reason": {"type": "string", "description": "Motivo de la cita"}
            },
            "required": ["patient_id", "doctor_id", "date"]
        }
    },
    {
        "name": "updateAppointment",
        "description": "Actualizar cita existente",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "ID de la cita"},
                "data": {"type": "object", "description": "Datos a actualizar"}
            },
            "required": ["id", "data"]
        }
    },
    {
        "name": "cancelAppointment",
        "description": "Cancelar cita médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "id": {"type": "integer", "description": "ID de la cita"},
                "reason": {"type": "string", "description": "Motivo de cancelación"}
            },
            "required": ["id"]
        }
    },
    
    # Disponibilidades
    {
        "name": "getAvailabilities",
        "description": "Ver disponibilidades de doctores",
        "input_schema": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "integer", "description": "ID del doctor"},
                "date": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"}
            }
        }
    },
    {
        "name": "createAvailability",
        "description": "Crear nueva disponibilidad",
        "input_schema": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "integer", "description": "ID del doctor"},
                "start_time": {"type": "string", "description": "Hora de inicio"},
                "end_time": {"type": "string", "description": "Hora de fin"},
                "date": {"type": "string", "description": "Fecha"}
            },
            "required": ["doctor_id", "start_time", "end_time", "date"]
        }
    },
    
    # Gestión de Sedes
    {
        "name": "getLocations",
        "description": "Listar todas las sedes médicas",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "createLocation",
        "description": "Crear nueva sede médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Nombre de la sede"},
                "address": {"type": "string", "description": "Dirección"},
                "phone": {"type": "string", "description": "Teléfono"},
                "city": {"type": "string", "description": "Ciudad"}
            },
            "required": ["name", "address"]
        }
    },
    
    # Analytics y Reportes
    {
        "name": "getAnalyticsOverview",
        "description": "Resumen general de métricas del sistema",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "description": "Período: daily, weekly, monthly"},
                "start_date": {"type": "string", "description": "Fecha de inicio"},
                "end_date": {"type": "string", "description": "Fecha de fin"}
            }
        }
    },
    {
        "name": "getPatientStats",
        "description": "Estadísticas de pacientes",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "description": "Período de análisis"}
            }
        }
    },
    {
        "name": "getAppointmentStats",
        "description": "Estadísticas de citas médicas",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "description": "Período de análisis"},
                "doctor_id": {"type": "integer", "description": "Filtrar por doctor"}
            }
        }
    }
]

# Versión simplificada para testing rápido
SIMPLE_TOOLS = [
    {
        "name": "searchPatients",
        "description": "Buscar pacientes por nombre, ID o documento",
        "input_schema": {
            "type": "object",
            "properties": {
                "q": {"type": "string", "description": "Término de búsqueda"}
            },
            "required": ["q"]
        }
    },
    {
        "name": "getSpecialties",
        "description": "Listar especialidades médicas disponibles",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "getDoctors",
        "description": "Listar doctores disponibles",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "getAppointments",
        "description": "Listar citas médicas",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Fecha en formato YYYY-MM-DD"}
            }
        }
    }
]

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"ok": True, "server": "python", "tools": len(MEDICAL_TOOLS)}

@app.get("/info")
async def info():
    """Información del servidor MCP"""
    return {
        "name": "Biosanarcall MCP Server Python",
        "version": "1.0.0",
        "protocol": "MCP 2024-11-05",
        "tools_count": len(MEDICAL_TOOLS),
        "simple_tools_count": len(SIMPLE_TOOLS),
        "endpoints": {
            "health": "/health",
            "mcp": "/mcp",
            "mcp_simple": "/mcp-simple"
        }
    }

@app.post("/mcp")
async def mcp_endpoint(request: JSONRPCRequest):
    """Endpoint principal MCP con todas las herramientas"""
    
    if request.method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "Biosanarcall MCP Server Python",
                    "version": "1.0.0"
                },
                "capabilities": {
                    "tools": {}
                }
            }
        }
    
    elif request.method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "tools": MEDICAL_TOOLS
            }
        }
    
    elif request.method == "tools/call":
        # Simulación de llamada a herramienta
        tool_name = request.params.get("name") if request.params else None
        
        if not tool_name:
            raise HTTPException(status_code=400, detail="Tool name required")
        
        # Buscar la herramienta
        tool = next((t for t in MEDICAL_TOOLS if t["name"] == tool_name), None)
        if not tool:
            return {
                "jsonrpc": "2.0",
                "id": request.id,
                "error": {
                    "code": -32601,
                    "message": f"Tool not found: {tool_name}"
                }
            }
        
        # Respuesta simulada
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "content": [{
                    "type": "text",
                    "text": f"Herramienta '{tool_name}' ejecutada correctamente. (Simulación - conectar con backend real para datos)"
                }]
            }
        }
    
    else:
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {request.method}"
            }
        }

@app.post("/mcp-simple")
async def mcp_simple_endpoint(request: JSONRPCRequest):
    """Endpoint MCP simplificado para testing rápido con ElevenLabs"""
    
    if request.method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "Biosanarcall MCP Server Python (Simple)",
                    "version": "1.0.0"
                },
                "capabilities": {
                    "tools": {}
                }
            }
        }
    
    elif request.method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "tools": SIMPLE_TOOLS
            }
        }
    
    elif request.method == "tools/call":
        tool_name = request.params.get("name") if request.params else None
        
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "result": {
                "content": [{
                    "type": "text",
                    "text": f"✅ Herramienta '{tool_name}' ejecutada en servidor Python. Sistema médico Biosanarcall funcionando correctamente."
                }]
            }
        }
    
    else:
        return {
            "jsonrpc": "2.0",
            "id": request.id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {request.method}"
            }
        }

if __name__ == "__main__":
    print("🐍 Iniciando Biosanarcall MCP Server Python")
    print("📊 Herramientas completas:", len(MEDICAL_TOOLS))
    print("⚡ Herramientas simples:", len(SIMPLE_TOOLS))
    print("🔗 Endpoints:")
    print("   - Health: http://127.0.0.1:8975/health")
    print("   - MCP Full: http://127.0.0.1:8975/mcp")
    print("   - MCP Simple: http://127.0.0.1:8975/mcp-simple")
    
    uvicorn.run(app, host="127.0.0.1", port=8975, log_level="info")
