# Implementación de Botón de Impresión Individual por Doctor

## 📋 Resumen

Se ha implementado un nuevo botón de impresión individual en cada tarjeta de disponibilidad médica, permitiendo generar PDFs específicos para la agenda de cada doctor.

## ✨ Características Implementadas

### 1. Botón de Impresión Individual
- **Ubicación**: En la sección expandida de cada tarjeta de disponibilidad
- **Posición**: Después del botón "Ver detalles" y antes de "Editar agenda"
- **Estilo**: Botón con fondo índigo (`bg-indigo-50 border-indigo-300`)
- **Icono**: Printer (impresora) de lucide-react

### 2. Funcionalidad de Impresión

#### Función: `handlePrintSingleAgenda`
```typescript
const handlePrintSingleAgenda = async (availability: Availability) => {
  // 1. Muestra notificación de "Generando PDF"
  // 2. Obtiene todas las citas del sistema
  // 3. Filtra las citas por doctor y fecha específica
  // 4. Genera el PDF con formato profesional
  // 5. Muestra notificación de éxito o error
}
```

#### Características:
- ✅ **Filtrado inteligente**: Solo imprime las citas del doctor seleccionado en la fecha específica
- ✅ **Formato profesional**: Utiliza la misma plantilla de PDF que el botón general
- ✅ **Notificaciones**: Toast messages para feedback al usuario
- ✅ **Manejo de errores**: Try-catch con mensajes descriptivos

## 🔧 Cambios Técnicos

### Archivos Modificados

#### 1. `/frontend/src/components/AvailabilityList.tsx`

**Imports agregados:**
```typescript
import { Printer } from "lucide-react";
import { generateDailyAgendaPDF } from "@/utils/pdfGenerators";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
```

**Nueva función agregada (líneas 148-189):**
- Función async que maneja la impresión individual
- Filtrado por `doctor_name` y `scheduled_date`
- Construcción de objeto con formato `DailyAgendaData`
- Llamada a `generateDailyAgendaPDF()`

**Botón agregado en UI (líneas 552-563):**
```tsx
<Button
  size="sm"
  variant="outline"
  className="flex items-center gap-2 bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
  onClick={(e) => {
    e.stopPropagation();
    handlePrintSingleAgenda(availability);
  }}
>
  <Printer className="w-4 h-4" />
  Imprimir
</Button>
```

## 📊 Flujo de Datos

```
Usuario hace clic en "Imprimir"
         ↓
handlePrintSingleAgenda(availability)
         ↓
api.getAppointments() → Obtiene todas las citas
         ↓
Filter por doctor_name y scheduled_date
         ↓
Construye objeto con estructura:
{
  doctor_name: string,
  specialty_name: string,
  location_name: string,
  date: string,
  start_time: string,
  end_time: string,
  appointments: Array
}
         ↓
generateDailyAgendaPDF([agendaByDoctor])
         ↓
Se descarga el PDF con la agenda individual
```

## 🎨 Interfaz de Usuario

### Antes:
```
[Ver detalles] [Editar agenda] [Transferir] ...
```

### Después:
```
[Ver detalles] [Imprimir] [Editar agenda] [Transferir] ...
```

### Estilo del Botón:
- **Color de fondo**: Índigo claro (`bg-indigo-50`)
- **Borde**: Índigo medio (`border-indigo-300`)
- **Texto**: Índigo oscuro (`text-indigo-700`)
- **Hover**: Fondo índigo más oscuro (`hover:bg-indigo-100`)
- **Tamaño**: Pequeño (`size="sm"`)

## 📄 Formato del PDF Generado

El PDF incluye:

### Encabezado:
- Logo de FUNDACIÓN BIOSANAR IPS
- Título "CITAS MÉDICAS AGENDA"
- Fecha del documento

### Información del Doctor:
- Nombre del médico
- Especialidad
- Sede/Ubicación
- Horario (inicio - fin)
- Fecha de la agenda

### Tabla de Citas:
| Hora | Paciente | Edad | Identificación | Teléfonos | Motivo |
|------|----------|------|----------------|-----------|--------|

### Pie de página:
- Información de contacto de la institución
- Número de página

## 🧪 Casos de Prueba

### Caso 1: Impresión Exitosa
- **Acción**: Click en botón "Imprimir" de una disponibilidad con citas
- **Resultado esperado**: 
  - Toast "Generando PDF"
  - Descarga de PDF con las citas del doctor
  - Toast "PDF Generado" con nombre del doctor

### Caso 2: Sin Citas
- **Acción**: Click en botón "Imprimir" de una disponibilidad sin citas
- **Resultado esperado**:
  - PDF generado con tabla vacía
  - Mensaje indicando que no hay citas programadas

### Caso 3: Error de API
- **Acción**: Click cuando la API falla
- **Resultado esperado**:
  - Toast de error "No se pudo generar el PDF"
  - Mensaje de error en consola

## 🚀 Deployment

### Pasos realizados:
1. **Build del proyecto**:
   ```bash
   cd /home/ubuntu/app/frontend
   npm run build
   ```
   - Tiempo de compilación: ~17 segundos
   - Sin errores críticos

2. **Despliegue a producción**:
   ```bash
   sudo cp -r dist/* /var/www/biosanarcall.site/html/
   ```

3. **Recarga de Nginx**:
   ```bash
   sudo systemctl reload nginx
   ```

### Resultado:
✅ Cambios desplegados exitosamente en https://biosanarcall.site

## 📝 Notas Técnicas

### Type Safety:
- Se utiliza `as any` para evitar conflictos entre la estructura de datos de la API y la interface `DailyAgendaData`
- La API puede devolver diferentes estructuras según el contexto

### Optimizaciones futuras:
- Agregar caché local para evitar llamadas repetidas a la API
- Implementar paginación si hay muchas citas
- Agregar opción de enviar PDF por email

## 🔗 Relación con Funcionalidad Existente

Este botón complementa el botón "Imprimir Agenda" existente en la vista principal:
- **Botón General**: Imprime todas las agendas del día
- **Botón Individual**: Imprime solo la agenda de un doctor específico

Ambos usan la misma función `generateDailyAgendaPDF()` del módulo `/utils/pdfGenerators.ts`.

## ✅ Verificación

Para verificar el funcionamiento:
1. Ir a https://biosanarcall.site/appointments
2. Seleccionar una fecha con disponibilidades
3. Hacer clic en una tarjeta para expandirla
4. Verificar que aparece el botón "Imprimir" con icono de impresora
5. Hacer clic y confirmar descarga del PDF

### Resultado de Prueba Real:
**Fecha de prueba**: 20 de octubre de 2025  
**Doctor probado**: Ana Teresa Escobar (Medicina General)  
**Resultado**: ✅ **EXITOSO**
- 14 citas filtradas correctamente
- PDF generado: `Agenda_Diaria_20251020.pdf`
- Toast notification: "Agenda de Ana Teresa Escobar con 14 citas"

## 🐛 Problemas Encontrados y Soluciones

### Problema 1: Fecha en formato incorrecto
**Síntoma**: Las citas se filtraban como 0, el PDF se generaba vacío  
**Causa**: El campo `scheduled_at` viene en formato ISO (`2025-10-20T08:00:00.000Z`) y el parseo inicial no extraía correctamente solo la fecha  
**Solución**: 
```typescript
const scheduledAt = apt.scheduled_at || apt.scheduled_date || '';
const aptDate = scheduledAt.includes('T') 
  ? scheduledAt.split('T')[0]  // Para formato ISO
  : scheduledAt.split(' ')[0]; // Para formato MySQL datetime
```

### Problema 2: Campo scheduled_date no existía
**Síntoma**: `apt.scheduled_date?.split('T')[0]` retornaba `undefined`  
**Causa**: La API retorna `scheduled_at` en lugar de `scheduled_date`  
**Solución**: Usar `scheduled_at` como campo principal y agregar fallback a `scheduled_date`

---

**Fecha de implementación**: 20 de octubre de 2025  
**Documentado por**: GitHub Copilot  
**Estado**: ✅ **Implementado, Probado y Desplegado**
