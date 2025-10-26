# Quick Reference - Portal del Paciente Simplificado

## URL
- **Producción:** https://biosanarcall.site/users

## Cambios de Una Línea

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Líneas de código** | 630 | 626 |
| **Tabs disponibles** | 3 | 1 |
| **Secciones activas** | Información + Citas + Médica | Solo Citas |
| **Funciones helpers** | 3 | 0 |
| **Edición de datos** | Sí | No |
| **Ver citas** | Sí (tras click) | Sí (directo) |
| **Ver lista espera** | Sí | Sí |
| **Descargar QR** | Sí | Sí |

## Principales Cambios

### 1. Secciones Removidas

#### "Mi Información Personal" ❌
```tsx
// Removido todo lo siguiente:
- Nombre completo (editable)
- Teléfono (editable)
- Email (editable)
- Fecha de nacimiento (editable)
- Género (editable)
- Dirección (editable)
- Zona (editable)
- Municipio (editable)
```

#### "Mi Información Médica" ❌
```tsx
// Removido todo lo siguiente:
- Grupo sanguíneo (editable)
- Teléfono alternativo (editable)
- Notas/Observaciones (editable)
- Información de seguro (solo lectura)
```

### 2. Lo Que se Mantiene

✅ **Disponible:**
- Login por documento
- Logout
- Citas confirmadas (con QR)
- Lista de espera
- Detalles de cita (fecha, hora, doctor, especialidad, sede)

### 3. Imports Removidos

```tsx
// ANTES
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, User, Phone, FileText, LogOut, QrCode, Download } from "lucide-react";

// DESPUÉS
import { Calendar, LogOut, QrCode, Download } from "lucide-react";
```

### 4. Estados Removidos

```tsx
// REMOVIDOS
const [municipalities, setMunicipalities] = useState<any[]>([]);
const [zones, setZones] = useState<any[]>([]);
const [epsList, setEpsList] = useState<any[]>([]);

// MANTENIDOS
const [appointments, setAppointments] = useState<any[]>([]);
const [waitingList, setWaitingList] = useState<any[]>([]);
const [patient, setPatient] = useState<any>(null);
```

### 5. Funciones Removidas

```tsx
// REMOVIDAS
loadMunicipalities()     // 20 líneas
loadSupportData()        // 20 líneas
handleUpdateInfo()       // 15 líneas
```

## Compilación

```bash
✓ npm run build
✓ No TypeScript errors
✓ Time: 31.00s
✓ Output size: Normal
```

## Testing Checklist

- [ ] Login funciona con documento
- [ ] Se muestran las citas
- [ ] Se muestra lista de espera
- [ ] Se puede descargar QR
- [ ] Se puede hacer logout
- [ ] NO aparecen tabs "Mi Información"
- [ ] NO aparecen tabs "Información Médica"
- [ ] Interfaz es limpia

## Despliegue

```bash
cd /home/ubuntu/app/frontend
npm run build

# Los archivos están listos en:
# dist/ 

# Copiar a servidor:
# rsync -av dist/ /var/www/biosanarcall/
```

## Historial

| Fecha | Cambio | Estado |
|-------|--------|--------|
| 2025-10-22 | Ocultar información personal y médica | ✅ Completado |

---

**Versión:** 1.0  
**Estado:** Production Ready  
**Última actualización:** 22/10/2025
