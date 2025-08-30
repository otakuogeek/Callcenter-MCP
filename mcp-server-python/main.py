#!/usr/bin/env python3
"""
Servidor MCP en Python para Biosanarcall
Implementación ligera y directa del protocolo MCP
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Any, Optional, Union
import uvicorn
import json
import logging
import os
import asyncio
import httpx
from datetime import datetime

# =============================
# Config de backend
# =============================
BACKEND_BASE = os.getenv("BACKEND_BASE", "http://127.0.0.1:4000/api")
BACKEND_TOKEN = os.getenv("BACKEND_TOKEN")  # token JWT para Authorization si existe

async def backend_request(method: str, path: str, json_body: Optional[dict] = None, params: Optional[dict] = None):
    headers = {}
    if BACKEND_TOKEN:
        headers["Authorization"] = f"Bearer {BACKEND_TOKEN}"
    url = f"{BACKEND_BASE}{path}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.request(method, url, json=json_body, params=params, headers=headers)
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Backend error {resp.status_code}: {resp.text[:200]}")
        # CSV export devolvemos texto
        if "text/csv" in resp.headers.get("content-type", ""):
            return resp.text
        return resp.json()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Modelos de datos
class JSONRPCRequest(BaseModel):
    jsonrpc: str = "2.0"
    # Algunos clientes usan string para id; aceptar ambos
    id: Union[int, str]
    method: str
    params: Optional[Dict[str, Any]] = None

class Tool(BaseModel):
    name: str
    description: str
    input_schema: Dict[str, Any]

# Utilidad: convertir snake_case input_schema -> inputSchema requerido por MCP
def normalize_tools(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normaliza herramientas para distintos clientes MCP.
    - Convierte input_schema -> inputSchema
    - Duplica como 'parameters' (algunos clientes esperan esa clave estilo OpenAI tools)
    - Mantiene solo campos seguros
    """
    normalized: List[Dict[str, Any]] = []
    for t in tools:
        t_copy = dict(t)
        schema = None
        if "input_schema" in t_copy:
            schema = t_copy.pop("input_schema")
        elif "inputSchema" in t_copy:
            schema = t_copy["inputSchema"]
        if schema:
            t_copy["inputSchema"] = schema
            # Alias 'parameters'
            t_copy["parameters"] = schema
        # Filtrar campos inesperados
        cleaned = {k: v for k, v in t_copy.items() if k in ("name", "description", "inputSchema", "parameters")}
        normalized.append(cleaned)
    return normalized

def jsonrpc_result(request_id: Union[int, str], result: Dict[str, Any]):
    return {"jsonrpc": "2.0", "id": request_id, "result": result}

def jsonrpc_error(request_id: Union[int, str], code: int, message: str, data: Any = None):
    err: Dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": err}

# Herramientas médicas disponibles (versión completa)
MEDICAL_TOOLS = [
    # Gestión de Pacientes
    {
        "name": "searchPatients",
        "description": "Buscar pacientes por nombre, ID o documento",
        "input_schema": {
            "type": "object",
            "properties": {
                "q": {"type": "string", "description": "Término de búsqueda"},
                "page": {"type": "integer", "description": "Página (1..N)"},
                "page_size": {"type": "integer", "description": "Tamaño de página (máx 100)"}
            },
            "required": ["q"]
        }
    },
    {
        "name": "getPatient",
        "description": "Obtener información detallada de un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"}
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "createPatient",
        "description": "Crear un nuevo paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "first_name": {"type": "string", "description": "Nombre"},
                "last_name": {"type": "string", "description": "Apellido"},
                "document_type": {"type": "string", "description": "Tipo de documento"},
                "document_number": {"type": "string", "description": "Número de documento"},
                "email": {"type": "string", "description": "Email"},
                "phone": {"type": "string", "description": "Teléfono"},
                "birth_date": {"type": "string", "description": "Fecha de nacimiento"}
            }
        }
    },
    {
        "name": "updatePatient",
        "description": "Actualizar información de un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"},
                "data": {"type": "object", "description": "Datos a actualizar"}
            },
            "required": ["patient_id", "data"]
        }
    },
    {
        "name": "deletePatient",
        "description": "Eliminar (soft/hard) un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"},
                "hard": {"type": "boolean", "description": "Si true realiza hard delete"}
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "updatePatientStatus",
        "description": "Cambiar estado Activo/Inactivo de un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string"},
                "status": {"type": "string", "enum": ["Activo","Inactivo"]}
            },
            "required": ["patient_id", "status"]
        }
    },
    {
        "name": "updatePatientEPS",
        "description": "Actualizar EPS de un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string"},
                "insurance_eps_id": {"type": ["integer","null"], "description": "ID EPS o null"}
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "bulkImportPatients",
        "description": "Importar múltiples pacientes (array)",
        "input_schema": {
            "type": "object",
            "properties": {
                "patients": {"type": "array", "items": {"type": "object"}}
            },
            "required": ["patients"]
        }
    },
    {
        "name": "exportPatientsCsv",
        "description": "Exportar listado de pacientes en CSV",
        "input_schema": {"type": "object", "properties": {}}
    },
    
    # Gestión de Médicos
    {
        "name": "searchDoctors",
        "description": "Buscar médicos por nombre o especialidad",
        "input_schema": {
            "type": "object",
            "properties": {
                "q": {"type": "string", "description": "Término de búsqueda"}
            },
            "required": ["q"]
        }
    },
    {
        "name": "getDoctor",
        "description": "Obtener información detallada de un médico",
        "input_schema": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "string", "description": "ID del médico"}
            },
            "required": ["doctor_id"]
        }
    },
    {
        "name": "getDoctorSchedule",
        "description": "Obtener horario de un médico",
        "input_schema": {
            "type": "object",
            "properties": {
                "doctor_id": {"type": "string", "description": "ID del médico"},
                "date": {"type": "string", "description": "Fecha específica"}
            },
            "required": ["doctor_id"]
        }
    },
    
    # Gestión de Citas
    {
        "name": "getAppointments",
        "description": "Obtener citas médicas",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"},
                "doctor_id": {"type": "string", "description": "ID del médico"},
                "date": {"type": "string", "description": "Fecha específica"},
                "status": {"type": "string", "description": "Estado de la cita"}
            }
        }
    },
    {
        "name": "createAppointment",
        "description": "Crear una nueva cita médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"},
                "doctor_id": {"type": "string", "description": "ID del médico"},
                "appointment_date": {"type": "string", "description": "Fecha y hora de la cita"},
                "reason": {"type": "string", "description": "Motivo de la cita"},
                "notes": {"type": "string", "description": "Notas adicionales"}
            },
            "required": ["patient_id", "doctor_id", "appointment_date"]
        }
    },
    {
        "name": "updateAppointment",
        "description": "Actualizar una cita médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "ID de la cita"},
                "status": {"type": "string", "description": "Nuevo estado de la cita"},
                "notes": {"type": "string", "description": "Notas actualizadas"}
            },
            "required": ["appointment_id"]
        }
    },
    {
        "name": "cancelAppointment",
        "description": "Cancelar una cita médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "appointment_id": {"type": "string", "description": "ID de la cita"},
                "reason": {"type": "string", "description": "Motivo de cancelación"}
            },
            "required": ["appointment_id"]
        }
    },
    
    # Historial Médico
    {
        "name": "getMedicalHistory",
        "description": "Obtener historial médico de un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"}
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "addMedicalRecord",
        "description": "Agregar un registro médico",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"},
                "doctor_id": {"type": "string", "description": "ID del médico"},
                "diagnosis": {"type": "string", "description": "Diagnóstico"},
                "treatment": {"type": "string", "description": "Tratamiento"},
                "notes": {"type": "string", "description": "Notas del médico"}
            },
            "required": ["patient_id", "doctor_id", "diagnosis"]
        }
    },
    
    # Prescripciones
    {
        "name": "getPrescriptions",
        "description": "Obtener prescripciones de un paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"}
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "createPrescription",
        "description": "Crear una nueva prescripción",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"},
                "doctor_id": {"type": "string", "description": "ID del médico"},
                "medication": {"type": "string", "description": "Medicamento"},
                "dosage": {"type": "string", "description": "Dosis"},
                "frequency": {"type": "string", "description": "Frecuencia"},
                "duration": {"type": "string", "description": "Duración del tratamiento"}
            },
            "required": ["patient_id", "doctor_id", "medication", "dosage"]
        }
    },
    
    # Reportes y Análisis
    {
        "name": "getDashboardData",
        "description": "Obtener datos para el dashboard principal",
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
    "description": "Estadísticas de pacientes (analytics overview)",
        "input_schema": {
            "type": "object",
            "properties": {
        "range": {"type": "string", "description": "Rango 7d|30d|90d|365d"},
        "period": {"type": "string", "description": "Alias legacy de range"}
            }
        }
    },
    {
        "name": "getAppointmentStats",
        "description": "Estadísticas de citas médicas",
        "input_schema": {
            "type": "object",
            "properties": {
                "period": {"type": "string", "description": "Período de análisis"}
            }
        }
    },
    {
        "name": "getRevenueReport",
        "description": "Reporte de ingresos",
        "input_schema": {
            "type": "object",
            "properties": {
                "start_date": {"type": "string", "description": "Fecha de inicio"},
                "end_date": {"type": "string", "description": "Fecha de fin"},
                "group_by": {"type": "string", "description": "Agrupar por: day, week, month"}
            }
        }
    }
]

# Herramientas esenciales para ElevenLabs (solo las más importantes)
SIMPLE_TOOLS = [
    {
        "name": "searchPatients",
        "description": "Buscar pacientes por nombre o documento",
        "input_schema": {
            "type": "object",
            "properties": {
                "q": {"type": "string", "description": "Término de búsqueda"},
                "page": {"type": "integer", "description": "Página"},
                "page_size": {"type": "integer", "description": "Tamaño de página"}
            },
            "required": ["q"]
        }
    },
    {
        "name": "getPatient",
        "description": "Obtener detalle de paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string"}
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "getAppointments",
        "description": "Obtener citas médicas del día",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Fecha específica (YYYY-MM-DD)"}
            }
        }
    },
    {
        "name": "createAppointment",
        "description": "Crear nueva cita médica",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string", "description": "ID del paciente"},
                "doctor_id": {"type": "string", "description": "ID del médico"},
                "appointment_date": {"type": "string", "description": "Fecha y hora"}
            },
            "required": ["patient_id", "doctor_id", "appointment_date"]
        }
    },
    {
        "name": "searchDoctors",
        "description": "Buscar médicos disponibles",
        "input_schema": {
            "type": "object",
            "properties": {
                "speciality": {"type": "string", "description": "Especialidad médica"}
            }
        }
    },
    {
        "name": "getDashboardData",
        "description": "Resumen del día en la clínica",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Fecha específica"}
            }
        }
    }
    ,
    {
        "name": "updatePatientStatus",
        "description": "Cambiar estado paciente",
        "input_schema": {
            "type": "object",
            "properties": {
                "patient_id": {"type": "string"},
                "status": {"type": "string", "enum": ["Activo","Inactivo"]}
            },
            "required": ["patient_id", "status"]
        }
    }
    ,
    {
        "name": "getPatientStats",
        "description": "Estadísticas resumidas de pacientes y citas",
        "input_schema": {
            "type": "object",
            "properties": {
                "range": {"type": "string", "description": "Rango 7d|30d|90d|365d"}
            }
        }
    }
    ,
    {
        "name": "summarizeDayAppointments",
        "description": "Resumen hablado breve de las citas de un día (para voz)",
        "input_schema": {
            "type": "object",
            "properties": {
                "date": {"type": "string", "description": "Fecha YYYY-MM-DD (opcional, default hoy)"}
            }
        }
    }
]

app = FastAPI(title="Biosanarcall MCP Server Python", version="1.0.0")

# =============================
# Configuración de seguridad
# =============================
API_KEY = os.getenv("MCP_API_KEY")  # Si se define, se exigirá en cabecera X-API-Key

def check_api_key(request: Request):
    if API_KEY:
        provided = request.headers.get("x-api-key")
        if provided != API_KEY:
            raise HTTPException(status_code=401, detail="API key inválida o ausente")

# =============================
# Utilidades de alias de métodos
# =============================
def canonical_method(method: str) -> str:
    """Mapea alias comunes a los métodos JSON-RPC esperados."""
    mapping = {
        "tools.list": "tools/list",
        "listTools": "tools/list",
        "list_tools": "tools/list",
        "getTools": "tools/list",
        "tools.call": "tools/call",
        "callTool": "tools/call",
        "call_tool": "tools/call",
        "invokeTool": "tools/call",
        "ping": "ping",
        "capabilities": "capabilities",
        "initialize": "initialize"
    }
    return mapping.get(method, method)

# =============================
# Ejecución real de herramientas
# =============================
async def execute_tool(name: str, args: Dict[str, Any]) -> str:
    name = name.strip()
    # Helper para capturar errores del backend y entregar mensajes claros
    async def safe(fn_desc: str, coro):
        try:
            return await coro
        except HTTPException as he:
            msg = he.detail
            if '401' in msg or '403' in msg:
                raise HTTPException(502, f"{fn_desc}: No autorizado en backend. Configura BACKEND_TOKEN (JWT) en el entorno del MCP.")
            if 'Connection refused' in msg:
                raise HTTPException(502, f"{fn_desc}: Backend inaccesible en {BACKEND_BASE}. Verifica que el API esté corriendo.")
            raise
    # Init cache contenedor
    if not hasattr(execute_tool, "_cache"):
        execute_tool._cache = {}
    cache: Dict[str, Any] = execute_tool._cache  # type: ignore
    TTL = 60  # segundos

    # Pacientes
    if name == "searchPatients":
        q = (args.get("q") or "").strip()
        page = int(args.get("page", 1) or 1)
        page_size = int(args.get("page_size", 25) or 25)
        if page < 1: page = 1
        if page_size < 1: page_size = 1
        if page_size > 100: page_size = 100
        key = f"searchPatients:{q.lower()}"
        now = asyncio.get_event_loop().time()
        entry = cache.get(key)
        if entry and (now - entry["ts"]) < TTL:
            data = entry["data"]
        else:
            data = await safe('searchPatients', backend_request("GET", "/patients", params={"q": q} if q else None))
            cache[key] = {"ts": now, "data": data}
        total = len(data)
        start = (page - 1) * page_size
        end = start + page_size
        if start >= total:
            slice_data = []
        else:
            slice_data = data[start:end]
        return f"{len(slice_data)} de {total} paciente(s) (página {page})"

    if name == "getPatient":
        pid = args.get("patient_id")
        if not pid:
            raise HTTPException(400, "patient_id requerido")
        data = await safe('getPatient', backend_request("GET", f"/patients/{pid}"))
        return json.dumps(data, ensure_ascii=False)[:800]

    if name == "createPatient":
        payload = {}
        for k in ["name","document","phone","email","birth_date","gender","address","municipality_id","zone_id","insurance_eps_id"]:
            if k in args:
                payload[k] = args[k]
        if "document" not in payload or "name" not in payload:
            raise HTTPException(400, "document y name requeridos")
        data = await safe('createPatient', backend_request("POST", "/patients", json_body=payload))
        return f"Paciente creado id={data.get('id')}"

    if name == "updatePatient":
        pid = args.get("patient_id")
        patch = args.get("data", {})
        if not pid or not isinstance(patch, dict):
            raise HTTPException(400, "patient_id y data requeridos")
        await safe('updatePatient', backend_request("PUT", f"/patients/{pid}", json_body=patch))
        return f"Paciente {pid} actualizado"

    if name == "deletePatient":
        pid = args.get("patient_id")
        hard = bool(args.get("hard"))
        if not pid:
            raise HTTPException(400, "patient_id requerido")
        await safe('deletePatient', backend_request("DELETE", f"/patients/{pid}", params={"hard": "1" if hard else "0"}))
        return f"Paciente {pid} {'eliminado' if hard else 'inactivado'}"

    if name == "updatePatientStatus":
        pid = args.get("patient_id")
        status = args.get("status")
        if status not in ("Activo","Inactivo"):
            raise HTTPException(400, "status inválido")
        await safe('updatePatientStatus', backend_request("POST", f"/patients/{pid}/status", json_body={"status": status}))
        return f"Estado paciente {pid} -> {status}"

    if name == "updatePatientEPS":
        pid = args.get("patient_id")
        eps_id = args.get("insurance_eps_id")
        await safe('updatePatientEPS', backend_request("POST", f"/patients/{pid}/eps", json_body={"insurance_eps_id": eps_id}))
        return f"EPS paciente {pid} actualizada"

    if name == "bulkImportPatients":
        patients = args.get("patients")
        if not isinstance(patients, list) or not patients:
            raise HTTPException(400, "patients debe ser lista no vacía")
        data = await safe('bulkImportPatients', backend_request("POST", "/patients/bulk/import", json_body=patients))
        return f"Importación: {data}"

    if name == "exportPatientsCsv":
        csv_text = await safe('exportPatientsCsv', backend_request("GET", "/patients/export/csv"))
        return f"CSV generado ({len(csv_text)} bytes)"

    if name == "getPatientStats":
        rng = args.get("range") or args.get("period")
        data = await safe('getPatientStats', backend_request("GET", "/analytics/overview", params={"range": rng} if rng else None))
        totals = data.get('totals', {}) if isinstance(data, dict) else {}
        return ("Consultas: " + str(totals.get('total_consultations', 0)) +
                " | Pacientes únicos: " + str(totals.get('unique_patients', 0)))[:160]

    # Citas (simplificado)
    if name == "getAppointments":
        params = {}
        for k in ["patient_id","doctor_id","date","status"]:
            if k in args:
                params[k] = args[k]
        data = await safe('getAppointments', backend_request("GET", "/appointments", params=params if params else None))
        return f"{len(data)} cita(s) encontradas"

    if name == "summarizeDayAppointments":
        # Fecha por defecto: hoy en UTC (ajustar según necesidad de zona horaria)
        date_str = args.get("date") or datetime.utcnow().strftime("%Y-%m-%d")
        appts = await safe('summarizeDayAppointments', backend_request("GET", "/appointments", params={"date": date_str}))
        total = len(appts) if isinstance(appts, list) else 0
        if not total:
            return f"Sin citas para {date_str}"
        # Contar por status si existe
        status_counts: Dict[str, int] = {}
        times = []
        for a in appts:
            if isinstance(a, dict):
                st = a.get("status") or "?"
                status_counts[st] = status_counts.get(st, 0) + 1
                # Intentar extraer hora (appointment_date, start_time, etc.)
                dt_val = a.get("appointment_date") or a.get("start_time")
                if isinstance(dt_val, str):
                    # Normalizar HH:MM si viene completo
                    if 'T' in dt_val:
                        try:
                            times.append(dt_val.split('T')[1][:5])
                        except Exception:
                            pass
                    elif len(dt_val) >=5:
                        times.append(dt_val[:5])
        times_sorted = sorted(t for t in times if t)
        first_time = times_sorted[0] if times_sorted else "--"
        last_time = times_sorted[-1] if len(times_sorted) > 1 else first_time
        # Construir parte de estados más relevantes
        parts = [f"Total {total}"]
        # Priorizar algunos estados comunes
        for key in sorted(status_counts.keys()):
            parts.append(f"{key}:{status_counts[key]}")
        parts.append(f"Primera {first_time}")
        if last_time != first_time:
            parts.append(f"Última {last_time}")
        summary = f"Citas {date_str}: " + ", ".join(parts)
        # Limitar tamaño para respuesta de voz rápida
        return summary[:180]

    if name == "createAppointment":
        payload = {}
        for k in ["patient_id","doctor_id","appointment_date","reason","notes"]:
            if k in args:
                payload[k] = args[k]
        if not all(k in payload for k in ("patient_id","doctor_id","appointment_date")):
            raise HTTPException(400, "patient_id, doctor_id, appointment_date requeridos")
        data = await safe('createAppointment', backend_request("POST", "/appointments", json_body=payload))
        return f"Cita creada id={data.get('id')}"

    if name == "updateAppointment":
        aid = args.get("appointment_id")
        patch = {k: args[k] for k in ("status","notes") if k in args}
        if not aid:
            raise HTTPException(400, "appointment_id requerido")
        await safe('updateAppointment', backend_request("PUT", f"/appointments/{aid}", json_body=patch))
        return f"Cita {aid} actualizada"

    if name == "cancelAppointment":
        aid = args.get("appointment_id")
        reason = args.get("reason")
        if not aid:
            raise HTTPException(400, "appointment_id requerido")
        await safe('cancelAppointment', backend_request("POST", f"/appointments/{aid}/cancel", json_body={"reason": reason}))
        return f"Cita {aid} cancelada"

    # Fallback
    raise HTTPException(404, f"Tool no implementada: {name}")

# Middleware para logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"🔍 Request: {request.method} {request.url}")
    logger.info(f"📱 User-Agent: {request.headers.get('user-agent', 'Unknown')}")
    logger.info(f"🌐 Origin: {request.headers.get('origin', 'Unknown')}")
    
    response = await call_next(request)
    logger.info(f"✅ Response: {response.status_code}")
    return response

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

@app.get("/debug")
async def debug():
    """Endpoint de depuración para ver las herramientas en formato simple"""
    return {
        "status": "debug",
        "message": "Servidor MCP Python funcionando",
        "tools_simple": SIMPLE_TOOLS,
        "tools_count": len(SIMPLE_TOOLS)
    }

@app.options("/mcp-simple")
async def mcp_simple_options():
    """Manejar solicitudes OPTIONS para CORS"""
    return {"message": "CORS preflight"}

@app.options("/mcp")
async def mcp_options():
    """Manejar solicitudes OPTIONS para CORS"""
    return {"message": "CORS preflight"}

@app.post("/mcp")
async def mcp_endpoint(request: JSONRPCRequest, raw_request: Request):
    """Endpoint principal MCP con todas las herramientas"""
    check_api_key(raw_request)
    method = canonical_method(request.method)

    if method == "initialize":
        return jsonrpc_result(request.id, {
            "capabilities": {"tools": True},
            "serverInfo": {"name": "biosanarcall-mcp", "version": "1.0.0"}
        })
    if method == "capabilities":
        return jsonrpc_result(request.id, {"capabilities": {"tools": True}})
    if method == "ping":
        return jsonrpc_result(request.id, {"pong": True})
    if method == "tools/list":
        return jsonrpc_result(request.id, {"tools": normalize_tools(MEDICAL_TOOLS)})
    if method == "tools/call":
        params = request.params or {}
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        if not tool_name:
            return jsonrpc_error(request.id, -32602, "Missing tool name")
        try:
            result_text = await execute_tool(tool_name, arguments)
            return jsonrpc_result(request.id, {"content": [{"type": "text", "text": result_text}]})
        except HTTPException as he:  # ya estructurado
            return jsonrpc_error(request.id, -32001, he.detail)
        except Exception as e:
            return jsonrpc_error(request.id, -32002, f"Unhandled tool error: {e}")
    return jsonrpc_error(request.id, -32601, f"Method not found: {request.method}")

@app.post("/mcp-simple")
async def mcp_simple_endpoint(request: JSONRPCRequest, raw_request: Request):
    """Endpoint MCP simplificado para ElevenLabs (solo herramientas esenciales)"""
    check_api_key(raw_request)
    method = canonical_method(request.method)
    if method == "initialize":
        return jsonrpc_result(request.id, {
            "capabilities": {"tools": True},
            "serverInfo": {"name": "biosanarcall-mcp-simple", "version": "1.0.0"}
        })
    if method == "capabilities":
        return jsonrpc_result(request.id, {"capabilities": {"tools": True}})
    if method == "ping":
        return jsonrpc_result(request.id, {"pong": True})
    if method == "tools/list":
        return jsonrpc_result(request.id, {"tools": normalize_tools(SIMPLE_TOOLS)})
    if method == "tools/call":
        params = request.params or {}
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        if not tool_name:
            return jsonrpc_error(request.id, -32602, "Missing tool name")
        try:
            result_text = await execute_tool(tool_name, arguments)
            return jsonrpc_result(request.id, {"content": [{"type": "text", "text": result_text}]})
        except HTTPException as he:
            return jsonrpc_error(request.id, -32001, he.detail)
        except Exception as e:
            return jsonrpc_error(request.id, -32002, f"Unhandled tool error: {e}")
    return jsonrpc_error(request.id, -32601, f"Method not found: {request.method}")

@app.get("/mcp-tools-list")
async def mcp_tools_list():
    """Endpoint directo para obtener la lista de herramientas (para depuración)"""
    return {
        "tools": normalize_tools(SIMPLE_TOOLS),
        "count": len(SIMPLE_TOOLS)
    }

@app.get("/simple-tools")
async def simple_tools():
    """Endpoint ultra-simple para herramientas"""
    return [
        {
            "name": "searchPatients",
            "description": "Buscar pacientes"
        },
        {
            "name": "getAppointments", 
            "description": "Ver citas"
        }
    ]

@app.post("/stream")
async def stream_endpoint(request: dict):
    """Endpoint compatible con streaming para ElevenLabs"""
    return {
        "tools": [
            {
                "name": "searchPatients",
                "description": "Buscar pacientes",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "q": {"type": "string", "description": "Buscar"}
                    }
                }
            }
        ]
    }

@app.post("/elevenlabs")
async def elevenlabs_endpoint(request: JSONRPCRequest, raw_request: Request):
    """Endpoint específico optimizado para ElevenLabs con alias y seguridad opcional"""
    check_api_key(raw_request)
    method = canonical_method(request.method)
    print(f"ElevenLabs request: {request.method} -> {method}")

    if method == "initialize":
        return jsonrpc_result(request.id, {
            "capabilities": {"tools": True},
            "serverInfo": {"name": "biosanarcall-elevenlabs", "version": "1.0.0"}
        })
    if method == "capabilities":
        return jsonrpc_result(request.id, {"capabilities": {"tools": True}})
    if method == "ping":
        return jsonrpc_result(request.id, {"pong": True})
    if method == "tools/list":
        tools_min = [
            {"name": "searchPatients", "description": "Buscar pacientes", "input_schema": {"type": "object", "properties": {"q": {"type": "string", "description": "Buscar"}}, "required": ["q"]}},
            {"name": "getAppointments", "description": "Ver citas del día", "input_schema": {"type": "object", "properties": {"date": {"type": "string", "description": "Fecha"}}}}
        ]
        return jsonrpc_result(request.id, {"tools": normalize_tools(tools_min)})
    if method == "tools/call":
        params = request.params or {}
        tool_name = params.get("name")
        arguments = params.get("arguments", {})
        if not tool_name:
            return jsonrpc_error(request.id, -32602, "Missing tool name")
        try:
            result_text = await execute_tool(tool_name, arguments)
            return jsonrpc_result(request.id, {"content": [{"type": "text", "text": result_text}]})
        except HTTPException as he:
            return jsonrpc_error(request.id, -32001, he.detail)
        except Exception as e:
            return jsonrpc_error(request.id, -32002, f"Unhandled tool error: {e}")
    return jsonrpc_error(request.id, -32601, f"Método no encontrado: {request.method}")

# =============================
# Endpoints REST adicionales
# =============================
@app.get("/")
async def root():
    return {
        "name": "biosanarcall-mcp",
        "version": "1.0.0",
        "description": "Servidor MCP Python compatible con múltiples clientes (incluye aliases & manifest).",
        "endpoints": ["/", "/health", "/manifest", "/tools", "/mcp", "/mcp-simple", "/elevenlabs", "/events"],
        "tools": len(SIMPLE_TOOLS)
    }

@app.get("/manifest")
async def manifest():
    return {
        "name": "biosanarcall-mcp",
        "version": "1.0.0",
        "capabilities": {"tools": True},
        "endpoints": {
            "jsonrpc": ["/mcp", "/mcp-simple", "/elevenlabs"],
            "rest": ["/tools", "/manifest", "/health"],
            "sse": "/events"
        }
    }

@app.get("/tools")
async def tools_get():
    return {"tools": normalize_tools(SIMPLE_TOOLS), "count": len(SIMPLE_TOOLS)}

@app.get("/events")
async def events():
    """SSE simple que emite una lista de herramientas inicial una sola vez."""
    async def event_generator():
        # Pequeño retraso para asegurar subscripción
        await asyncio.sleep(0.05)
        payload = json.dumps({"tools": normalize_tools(SIMPLE_TOOLS)})
        yield f"event: tools\ndata: {payload}\n\n"
        # Fin del stream
        yield "event: end\ndata: done\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    print("🐍 Iniciando Biosanarcall MCP Server Python (modo standalone)")
    print("📊 Herramientas completas:", len(MEDICAL_TOOLS))
    print("⚡ Herramientas simples:", len(SIMPLE_TOOLS))
    print("🔗 Endpoints:")
    for ep in ["/", "/health", "/manifest", "/tools", "/mcp", "/mcp-simple", "/elevenlabs", "/events"]:
        print("   -", f"http://127.0.0.1:8975{ep}")
    uvicorn.run(app, host="127.0.0.1", port=8975, log_level="info")
