# Ejemplos de Uso - Sistema de Autorizaciones EPS

## 🎯 Casos de Uso Completos con Código

---

## 1. Validar EPS al Agendar Cita (Frontend)

### Componente React con Validación

```typescript
// frontend/src/components/AppointmentForm.tsx
import React, { useState, useEffect } from 'react';

interface EPSValidationProps {
  epsId: number;
  specialtyId: number;
  locationId: number;
}

const useEPSAuthorization = ({ epsId, specialtyId, locationId }: EPSValidationProps) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const validateAuthorization = async () => {
      if (!epsId || !specialtyId || !locationId) {
        setIsAuthorized(null);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/eps-authorizations/check/${epsId}/${specialtyId}/${locationId}`
        );
        const data = await response.json();
        setIsAuthorized(data.authorized);
      } catch (error) {
        console.error('Error validating EPS authorization:', error);
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    };

    validateAuthorization();
  }, [epsId, specialtyId, locationId]);

  return { isAuthorized, loading };
};

// Uso en el componente
export const AppointmentForm: React.FC = () => {
  const [selectedEPS, setSelectedEPS] = useState<number | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<number | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const { isAuthorized, loading } = useEPSAuthorization({
    epsId: selectedEPS!,
    specialtyId: selectedSpecialty!,
    locationId: selectedLocation!,
  });

  return (
    <div className="appointment-form">
      {/* ... otros campos ... */}
      
      {isAuthorized === false && (
        <div className="alert alert-warning">
          ⚠️ La EPS seleccionada no está autorizada para esta especialidad en esta sede.
          Por favor, seleccione otra combinación.
        </div>
      )}

      {isAuthorized === true && (
        <div className="alert alert-success">
          ✅ EPS autorizada para esta especialidad en la sede seleccionada
        </div>
      )}

      <button 
        type="submit" 
        disabled={!isAuthorized || loading}
      >
        {loading ? 'Validando...' : 'Agendar Cita'}
      </button>
    </div>
  );
};
```

---

## 2. Filtrar Especialidades Disponibles por EPS

### Component con shadcn/ui

```typescript
// frontend/src/components/SpecialtySelector.tsx
import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Specialty {
  specialty_id: number;
  specialty_name: string;
  description: string;
  notes?: string;
}

interface SpecialtySelectorProps {
  epsId: number;
  locationId: number;
  onSelect: (specialtyId: number) => void;
}

export const SpecialtySelector: React.FC<SpecialtySelectorProps> = ({
  epsId,
  locationId,
  onSelect,
}) => {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAuthorizedSpecialties = async () => {
      if (!epsId || !locationId) {
        setSpecialties([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/eps-authorizations/eps/${epsId}/location/${locationId}/specialties`
        );
        const { data } = await response.json();
        setSpecialties(data || []);
      } catch (error) {
        console.error('Error fetching authorized specialties:', error);
        setSpecialties([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAuthorizedSpecialties();
  }, [epsId, locationId]);

  if (loading) {
    return <div>Cargando especialidades autorizadas...</div>;
  }

  if (specialties.length === 0) {
    return (
      <div className="text-yellow-600">
        No hay especialidades autorizadas para esta EPS en esta sede
      </div>
    );
  }

  return (
    <Select onValueChange={(value) => onSelect(Number(value))}>
      <SelectTrigger>
        <SelectValue placeholder="Seleccione una especialidad autorizada" />
      </SelectTrigger>
      <SelectContent>
        {specialties.map((specialty) => (
          <SelectItem 
            key={specialty.specialty_id} 
            value={specialty.specialty_id.toString()}
          >
            {specialty.specialty_name}
            {specialty.notes && ` (${specialty.notes})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

---

## 3. Panel de Administración de Autorizaciones

### CRUD Completo

```typescript
// frontend/src/pages/EPSAuthorizationsManagement.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface Authorization {
  id: number;
  eps_name: string;
  specialty_name: string;
  location_name: string;
  authorized: boolean;
  authorization_date: string;
  is_currently_valid: boolean;
}

export const EPSAuthorizationsManagement: React.FC = () => {
  const [authorizations, setAuthorizations] = useState<Authorization[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Cargar todas las autorizaciones
  const loadAuthorizations = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/eps-authorizations`
      );
      const { data } = await response.json();
      setAuthorizations(data);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las autorizaciones',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Crear nueva autorización
  const createAuthorization = async (authData: any) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/eps-authorizations`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(authData),
        }
      );

      if (!response.ok) {
        throw new Error('Error al crear autorización');
      }

      toast({
        title: 'Éxito',
        description: 'Autorización creada exitosamente',
      });

      loadAuthorizations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Activar/Desactivar autorización
  const toggleAuthorization = async (id: number, currentStatus: boolean) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/eps-authorizations/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            authorized: !currentStatus,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error al actualizar autorización');
      }

      toast({
        title: 'Éxito',
        description: 'Autorización actualizada exitosamente',
      });

      loadAuthorizations();
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    loadAuthorizations();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Gestión de Autorizaciones EPS
      </h1>

      {loading ? (
        <div>Cargando...</div>
      ) : (
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">EPS</th>
              <th className="border px-4 py-2">Especialidad</th>
              <th className="border px-4 py-2">Sede</th>
              <th className="border px-4 py-2">Estado</th>
              <th className="border px-4 py-2">Vigente</th>
              <th className="border px-4 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {authorizations.map((auth) => (
              <tr key={auth.id}>
                <td className="border px-4 py-2">{auth.eps_name}</td>
                <td className="border px-4 py-2">{auth.specialty_name}</td>
                <td className="border px-4 py-2">{auth.location_name}</td>
                <td className="border px-4 py-2">
                  {auth.authorized ? (
                    <span className="text-green-600">✅ Activo</span>
                  ) : (
                    <span className="text-red-600">❌ Inactivo</span>
                  )}
                </td>
                <td className="border px-4 py-2">
                  {auth.is_currently_valid ? (
                    <span className="text-green-600">✅ Vigente</span>
                  ) : (
                    <span className="text-gray-600">⏸️ No vigente</span>
                  )}
                </td>
                <td className="border px-4 py-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleAuthorization(auth.id, auth.authorized)}
                  >
                    {auth.authorized ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
```

---

## 4. Integración en MCP Server (Python)

### Tool para Validar Autorizaciones en Llamadas

```python
# mcp-server-python/src/tools/eps_authorization_tools.py
import httpx
from typing import Optional, Dict, List

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://127.0.0.1:4000/api")
BACKEND_TOKEN = os.getenv("BACKEND_TOKEN", "")

async def check_eps_authorization(
    eps_id: int,
    specialty_id: int,
    location_id: int
) -> Dict:
    """
    Verifica si una EPS está autorizada para una especialidad en una sede.
    
    Args:
        eps_id: ID de la EPS
        specialty_id: ID de la especialidad
        location_id: ID de la sede
        
    Returns:
        Dict con 'authorized' (bool) y detalles adicionales
    """
    headers = {"Authorization": f"Bearer {BACKEND_TOKEN}"}
    url = f"{BACKEND_BASE}/eps-authorizations/check/{eps_id}/{specialty_id}/{location_id}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, timeout=10.0)
        response.raise_for_status()
        return response.json()

async def get_authorized_specialties_for_patient(
    eps_id: int,
    location_id: int
) -> List[Dict]:
    """
    Obtiene las especialidades autorizadas para la EPS del paciente.
    
    Args:
        eps_id: ID de la EPS del paciente
        location_id: ID de la sede seleccionada
        
    Returns:
        Lista de especialidades autorizadas
    """
    headers = {"Authorization": f"Bearer {BACKEND_TOKEN}"}
    url = f"{BACKEND_BASE}/eps-authorizations/eps/{eps_id}/location/{location_id}/specialties"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])

# Uso en el flujo de agendamiento
async def schedule_appointment_with_validation(
    patient_eps_id: int,
    specialty_id: int,
    location_id: int,
    **appointment_data
):
    """
    Agenda una cita validando previamente la autorización de la EPS.
    """
    # 1. Validar autorización
    auth_result = await check_eps_authorization(
        patient_eps_id,
        specialty_id,
        location_id
    )
    
    if not auth_result.get("authorized"):
        return {
            "success": False,
            "error": "La EPS del paciente no está autorizada para esta especialidad en esta sede",
            "suggestion": "Solicite cambio de sede o especialidad"
        }
    
    # 2. Continuar con el agendamiento normal
    # ... lógica de agendamiento ...
    
    return {"success": True, "message": "Cita agendada exitosamente"}
```

---

## 5. SQL Queries Útiles

### Consultas Comunes

```sql
-- Ver todas las autorizaciones activas por EPS
SELECT 
  e.name AS eps,
  s.name AS especialidad,
  l.name AS sede,
  ea.authorization_date AS desde,
  ea.notes
FROM eps_specialty_location_authorizations ea
JOIN eps e ON ea.eps_id = e.id
JOIN specialties s ON ea.specialty_id = s.id
JOIN locations l ON ea.location_id = l.id
WHERE ea.authorized = 1
  AND (ea.expiration_date IS NULL OR ea.expiration_date >= CURDATE())
ORDER BY e.name, s.name, l.name;

-- Encontrar especialidades sin ninguna autorización EPS
SELECT 
  s.id,
  s.name,
  COUNT(ea.id) AS autorizaciones
FROM specialties s
LEFT JOIN eps_specialty_location_authorizations ea 
  ON s.id = ea.specialty_id AND ea.authorized = 1
GROUP BY s.id, s.name
HAVING autorizaciones = 0;

-- EPS con más autorizaciones
SELECT 
  e.name AS eps,
  COUNT(ea.id) AS total_autorizaciones,
  COUNT(DISTINCT ea.specialty_id) AS especialidades_distintas,
  COUNT(DISTINCT ea.location_id) AS sedes_distintas
FROM eps e
LEFT JOIN eps_specialty_location_authorizations ea 
  ON e.id = ea.eps_id AND ea.authorized = 1
GROUP BY e.id, e.name
ORDER BY total_autorizaciones DESC;

-- Autorizaciones que expiran en los próximos 30 días
SELECT 
  e.name AS eps,
  s.name AS especialidad,
  l.name AS sede,
  ea.expiration_date,
  DATEDIFF(ea.expiration_date, CURDATE()) AS dias_restantes
FROM eps_specialty_location_authorizations ea
JOIN eps e ON ea.eps_id = e.id
JOIN specialties s ON ea.specialty_id = s.id
JOIN locations l ON ea.location_id = l.id
WHERE ea.authorized = 1
  AND ea.expiration_date IS NOT NULL
  AND ea.expiration_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
ORDER BY ea.expiration_date;
```

---

## 6. Test con cURL

### Crear Múltiples Autorizaciones en Batch

```bash
# Crear autorizaciones para Nueva EPS en ambas sedes
curl -X POST http://localhost:4000/api/eps-authorizations/batch \
  -H "Content-Type: application/json" \
  -d '{
    "authorizations": [
      {
        "eps_id": 14,
        "specialty_id": 1,
        "location_id": 1,
        "authorized": true,
        "notes": "Medicina General - Nueva EPS San Gil"
      },
      {
        "eps_id": 14,
        "specialty_id": 1,
        "location_id": 3,
        "authorized": true,
        "notes": "Medicina General - Nueva EPS Socorro"
      },
      {
        "eps_id": 14,
        "specialty_id": 3,
        "location_id": 1,
        "authorized": true,
        "notes": "Cardiología - Nueva EPS San Gil"
      }
    ]
  }'

# Actualizar una autorización
curl -X PUT http://localhost:4000/api/eps-authorizations/1 \
  -H "Content-Type: application/json" \
  -d '{
    "authorized": false,
    "notes": "Convenio suspendido temporalmente"
  }'

# Eliminar una autorización
curl -X DELETE http://localhost:4000/api/eps-authorizations/15

# Ver historial de auditoría
curl http://localhost:4000/api/eps-authorizations/audit/1
```

---

## 7. Integración con Sistema de Disponibilidades

### Modificar getAvailableAppointments

```typescript
// backend/src/routes/availabilities.ts - Agregar filtro por EPS
router.get('/available-with-eps-filter', async (req: Request, res: Response) => {
  const { eps_id, specialty_id, location_id } = req.query;

  // 1. Verificar autorización
  if (eps_id) {
    const [authCheck] = await pool.query(
      'SELECT is_eps_authorized(?, ?, ?) AS authorized',
      [eps_id, specialty_id || null, location_id || null]
    );
    
    if (!(authCheck as any)[0]?.authorized) {
      return res.json({
        success: false,
        error: 'EPS no autorizada para esta combinación',
        data: []
      });
    }
  }

  // 2. Continuar con la búsqueda normal de disponibilidades
  // ... resto de la lógica ...
});
```

---

¡Sistema listo para usar! 🎉
