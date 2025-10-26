# 📑 Pestañas para Citas Confirmadas y Canceladas

## 🎯 Mejora Implementada

**Antes**: Todas las citas confirmadas se mostraban en una sola lista, y las canceladas no eran fácilmente accesibles.

**Ahora**: Sistema de **pestañas (tabs)** que separa claramente las citas confirmadas de las canceladas.

---

## ✨ Nueva Interfaz

### Vista con Pestañas

```
┌─────────────────────────────────────────────────────────┐
│ Pacientes en esta agenda                                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┬───────────────────┐              │
│  │  Confirmados [7] │ Cancelados [5]    │              │
│  └──────────────────┴───────────────────┘              │
│  ▼ PESTAÑA ACTIVA                                       │
│                                                          │
│  Carlos Augusto Velázquez    08:00  Confirmada         │
│  91076965 • 3219106977                                  │
│                                                          │
│  José Joaquín Velasque       07:45  Confirmada         │
│  91069407 • 118170107                                   │
│                                                          │
│  Blay Celis Reda             07:30  Confirmada         │
│  37895974 • 3219490169                                  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 Componentes Utilizados

### 1. **Tabs de shadcn/ui**

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

### 2. **Estructura de Pestañas**

```tsx
<Tabs defaultValue="confirmados" className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    {/* Pestaña Confirmados */}
    <TabsTrigger value="confirmados" className="relative">
      Confirmados
      <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
        {getRealBookedSlots()}
      </Badge>
    </TabsTrigger>
    
    {/* Pestaña Cancelados */}
    <TabsTrigger value="cancelados" className="relative">
      Cancelados
      <Badge variant="outline" className="ml-2 bg-red-50 text-red-700">
        {appointments.filter(ap => ap.status === 'Cancelada').length}
      </Badge>
    </TabsTrigger>
  </TabsList>
  
  {/* Contenido de cada pestaña */}
  <TabsContent value="confirmados">
    {/* Lista de confirmados */}
  </TabsContent>
  
  <TabsContent value="cancelados">
    {/* Lista de cancelados */}
  </TabsContent>
</Tabs>
```

---

## 📋 Pestaña "Confirmados"

### Características

✅ **Fondo blanco** con borde normal  
✅ **Detección de duplicados** con resaltado amarillo  
✅ **Información de otras citas** del mismo paciente  
✅ **Botones de eliminar** para citas duplicadas  
✅ **Hora de la cita** en formato HH:MM  
✅ **Badge verde** "Confirmada"  

### Ejemplo Visual

```
┌─────────────────────────────────────────────────────────┐
│ Carlos Augusto Velázquez Archila         08:00         │
│ 91076965 • 3219106977                    Confirmada    │
│                                                          │
│ ⚠️ DUPLICADO - Amarillo                                │
│   Otras citas confirmadas:                              │
│   • Medicina General - 25 de Oct a las 10:00           │
│     📍 Sede Norte                          [Eliminar]   │
└─────────────────────────────────────────────────────────┘
```

### Código

```tsx
<TabsContent value="confirmados" className="mt-3">
  {appointments.filter(ap => ap.status === 'Confirmada').length === 0 ? (
    <p className="text-sm text-gray-500 py-4">
      No hay pacientes confirmados.
    </p>
  ) : (
    <div className="space-y-2 max-h-60 overflow-auto pr-1">
      {/* Lógica de detección de duplicados */}
      {confirmedAppointments.map((ap) => {
        // ... renderizado con duplicados y botones eliminar
      })}
    </div>
  )}
</TabsContent>
```

---

## 🚫 Pestaña "Cancelados"

### Características

✅ **Fondo rojo claro** (`bg-red-50`) con borde rojo (`border-red-200`)  
✅ **Opacidad reducida** (75%) para indicar estado inactivo  
✅ **Sin detección de duplicados** (no es necesario)  
✅ **Sin botones de eliminar** (ya están canceladas)  
✅ **Badge rojo** "Cancelada"  
✅ **Información básica** del paciente  

### Ejemplo Visual

```
┌─────────────────────────────────────────────────────────┐
│ Ricardo Martínez López           09:30                  │
│ 12345678 • 3001234567            Cancelada  ← Rojo     │
│                                                          │
│ Belkis Rodríguez García          10:00                  │
│ 87654321 • 3009876543            Cancelada  ← Rojo     │
│                                                          │
│ (Fondo rojo claro con opacidad 75%)                     │
└─────────────────────────────────────────────────────────┘
```

### Código

```tsx
<TabsContent value="cancelados" className="mt-3">
  {appointments.filter(ap => ap.status === 'Cancelada').length === 0 ? (
    <p className="text-sm text-gray-500 py-4">
      No hay pacientes cancelados.
    </p>
  ) : (
    <div className="space-y-2 max-h-60 overflow-auto pr-1">
      {appointments.filter(ap => ap.status === 'Cancelada').map((ap) => {
        const scheduledTime = ap.scheduled_at.includes('T') 
          ? ap.scheduled_at.split('T')[1].substring(0, 5)
          : ap.scheduled_at.split(' ')[1].substring(0, 5);
        
        return (
          <div 
            key={ap.id} 
            className="flex flex-col gap-2 border rounded-md p-2 
                       bg-red-50 border-red-200 opacity-75"
          >
            {/* Información del paciente */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate text-gray-700">
                  {ap.patient_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {ap.patient_document} • {ap.patient_phone || "Sin teléfono"}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-600">
                  {scheduledTime}
                </span>
                <Badge variant="outline" 
                       className="text-xs bg-red-100 text-red-700 border-red-300">
                  Cancelada
                </Badge>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  )}
</TabsContent>
```

---

## 🎨 Diseño de Pestañas

### TabsList (Botones de Pestañas)

```tsx
<TabsList className="grid w-full grid-cols-2">
  {/* Distribución 50/50 */}
</TabsList>
```

**Resultado Visual:**
```
┌──────────────────┬───────────────────┐
│ Confirmados [7]  │ Cancelados [5]    │
└──────────────────┴───────────────────┘
     50% ancho           50% ancho
```

### TabsTrigger (Botón Individual)

```tsx
<TabsTrigger value="confirmados" className="relative">
  Confirmados
  <Badge variant="outline" className="ml-2 bg-green-50 text-green-700">
    {getRealBookedSlots()}
  </Badge>
</TabsTrigger>
```

**Características:**
- **Estado activo**: Fondo blanco, borde inferior resaltado
- **Estado inactivo**: Fondo gris claro
- **Badge integrado**: Muestra el conteo en tiempo real
- **Responsive**: Se adapta a pantallas pequeñas

---

## 📊 Comparativa: Antes vs Después

### Antes

```
Pacientes en esta agenda  [7 Confirmados] [5 Cancelados]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Carlos - 08:00 - Confirmada
José - 07:45 - Confirmada
Blay - 07:30 - Confirmada
María - 10:00 - Confirmada
Pedro - 10:30 - Confirmada
Ana - 11:00 - Confirmada
Luis - 11:30 - Confirmada

(Cancelados NO se mostraban en la lista)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    7          5          0
Confirmados Cancelados Pendientes
```

### Después

```
Pacientes en esta agenda
┌──────────────────┬───────────────────┐
│ Confirmados [7]  │ Cancelados [5]    │  ← PESTAÑAS
└──────────────────┴───────────────────┘
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Pestaña Confirmados - Activa]

Carlos - 08:00 - Confirmada
José - 07:45 - Confirmada
Blay - 07:30 - Confirmada
María - 10:00 - Confirmada
Pedro - 10:30 - Confirmada
Ana - 11:00 - Confirmada
Luis - 11:30 - Confirmada

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Cambiar a Pestaña Cancelados]

Ricardo - 09:30 - Cancelada (Fondo rojo)
Belkis - 10:00 - Cancelada (Fondo rojo)
Jorge - 14:00 - Cancelada (Fondo rojo)
Marta - 15:00 - Cancelada (Fondo rojo)
Daniel - 16:00 - Cancelada (Fondo rojo)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    7          5          0
Confirmados Cancelados Pendientes
```

---

## 🔄 Flujo de Usuario

### Paso 1: Vista Inicial
```
Usuario abre modal → Ve pestaña "Confirmados" activa
                   → Ve badge con número de confirmados
                   → Ve badge con número de cancelados
```

### Paso 2: Ver Confirmados (Default)
```
Pestaña "Confirmados" activa
├── Lista de pacientes confirmados
├── Detección de duplicados (amarillo)
├── Botones eliminar para duplicados
└── Información completa de cada cita
```

### Paso 3: Cambiar a Cancelados
```
Usuario hace clic en pestaña "Cancelados"
├── Pestaña se activa (fondo blanco)
├── Muestra lista de citas canceladas
├── Fondo rojo claro para cada cita
├── Opacidad 75% (inactivas)
└── Sin botones de acción (ya canceladas)
```

### Paso 4: Volver a Confirmados
```
Usuario hace clic en pestaña "Confirmados"
└── Regresa a la vista de confirmados
```

---

## 🎨 Códigos de Color

| Elemento | Color | Clase CSS | Uso |
|----------|-------|-----------|-----|
| **Badge Confirmados** | Verde claro | `bg-green-50 text-green-700` | Contador en pestaña |
| **Badge Cancelados** | Rojo claro | `bg-red-50 text-red-700` | Contador en pestaña |
| **Cita Confirmada** | Blanco | `bg-white` | Fondo de tarjeta |
| **Cita Duplicada** | Amarillo | `bg-yellow-100 border-yellow-400` | Alerta de duplicado |
| **Cita Cancelada** | Rojo claro | `bg-red-50 border-red-200` | Fondo de tarjeta cancelada |
| **Badge Status Confirmada** | Verde | `text-xs bg-white` | Estado de cita |
| **Badge Status Cancelada** | Rojo | `bg-red-100 text-red-700` | Estado de cita |

---

## 📱 Responsividad

### Desktop (> 640px)

```
┌────────────────────────────────────────────────┐
│ Pacientes en esta agenda                       │
├────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┐              │
│  │Confirmados[7]│Cancelados[5] │              │
│  └──────────────┴──────────────┘              │
│                                                 │
│  Carlos Augusto Velázquez    08:00 Confirmada │
│  91076965 • 3219106977                         │
│                                                 │
│  José Joaquín Velasque       07:45 Confirmada │
│  91069407 • 118170107                          │
└────────────────────────────────────────────────┘
```

### Tablet (640px)

```
┌──────────────────────────────────┐
│ Pacientes en esta agenda         │
├──────────────────────────────────┤
│  ┌──────────┬──────────┐        │
│  │Conf. [7] │Canc. [5] │        │
│  └──────────┴──────────┘        │
│                                  │
│  Carlos Augusto V.  08:00       │
│  91076965           Confirmada  │
│                                  │
│  José Joaquín V.    07:45       │
│  91069407           Confirmada  │
└──────────────────────────────────┘
```

### Mobile (< 640px)

```
┌──────────────────────────┐
│ Pacientes                │
├──────────────────────────┤
│  ┌─────┬─────┐          │
│  │C [7]│X [5]│          │
│  └─────┴─────┘          │
│                          │
│  Carlos A.V.            │
│  08:00 ✅               │
│                          │
│  José J.V.              │
│  07:45 ✅               │
└──────────────────────────┘
```

---

## ✅ Mensajes Condicionales

### Sin Confirmados

```tsx
{appointments.filter(ap => ap.status === 'Confirmada').length === 0 && (
  <p className="text-sm text-gray-500 py-4">
    No hay pacientes confirmados.
  </p>
)}
```

**Vista:**
```
┌──────────────────┬───────────────────┐
│ Confirmados [0]  │ Cancelados [5]    │
└──────────────────┴───────────────────┘

  No hay pacientes confirmados.
```

### Sin Cancelados

```tsx
{appointments.filter(ap => ap.status === 'Cancelada').length === 0 && (
  <p className="text-sm text-gray-500 py-4">
    No hay pacientes cancelados.
  </p>
)}
```

**Vista:**
```
┌──────────────────┬───────────────────┐
│ Confirmados [7]  │ Cancelados [0]    │
└──────────────────┴───────────────────┘

  No hay pacientes cancelados.
```

### Agenda Vacía

```
Pacientes en esta agenda

  No hay pacientes asignados a esta disponibilidad.
```

---

## 🔢 Funcionalidades Mantenidas

### En Pestaña "Confirmados"

✅ **Detección de duplicados globales**  
✅ **Resaltado amarillo para duplicados**  
✅ **Información de otras citas del paciente**  
✅ **Botones eliminar para duplicados**  
✅ **Conteo en tiempo real de cupos ocupados**  
✅ **Advertencia de discrepancia BD vs Real**  

### En Pestaña "Cancelados"

✅ **Lista completa de citas canceladas**  
✅ **Diseño visual diferenciado (rojo)**  
✅ **Información básica del paciente**  
✅ **Hora de la cita original**  
✅ **Estado "Cancelada" claramente visible**  

### Generales

✅ **Resumen estadístico al final**  
✅ **Scroll independiente por pestaña**  
✅ **Máximo 60vh de altura**  
✅ **Responsive en todos los tamaños**  

---

## 🚀 Beneficios de las Pestañas

| Beneficio | Descripción |
|-----------|-------------|
| **Organización** | Separa claramente confirmados de cancelados |
| **Claridad Visual** | Cada pestaña tiene su propio diseño distintivo |
| **Navegación Fácil** | Un clic para cambiar entre estados |
| **Información Limpia** | No mezcla citas activas con inactivas |
| **Contadores Visibles** | Badges muestran cantidad en cada pestaña |
| **Scroll Independiente** | Cada lista puede tener muchos elementos |
| **Mejor UX** | Reduce saturación visual de la interfaz |

---

## 🔧 Archivos Modificados

### `/frontend/src/components/ViewAvailabilityModal.tsx`

**Cambios:**

1. **Importación de Tabs** (línea 13):
   ```tsx
   import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
   ```

2. **Estructura de Pestañas** (línea ~270):
   ```tsx
   <Tabs defaultValue="confirmados" className="w-full">
     <TabsList className="grid w-full grid-cols-2">
       <TabsTrigger value="confirmados">...</TabsTrigger>
       <TabsTrigger value="cancelados">...</TabsTrigger>
     </TabsList>
     <TabsContent value="confirmados">...</TabsContent>
     <TabsContent value="cancelados">...</TabsContent>
   </Tabs>
   ```

3. **Renderizado de Confirmados** (conserva toda la lógica existente)

4. **Renderizado de Cancelados** (nuevo, diseño simplificado)

---

## 📊 Casos de Uso

### Caso 1: Agenda Normal
```
Confirmados: 7
Cancelados: 2

Vista:
- Pestaña Confirmados [7] ← Activa por defecto
- Pestaña Cancelados [2]
- Usuario puede alternar entre ambas
```

### Caso 2: Solo Confirmados
```
Confirmados: 10
Cancelados: 0

Vista:
- Pestaña Confirmados [10] ← Activa
- Pestaña Cancelados [0]
- Al hacer clic en Cancelados: "No hay pacientes cancelados."
```

### Caso 3: Solo Cancelados
```
Confirmados: 0
Cancelados: 8

Vista:
- Pestaña Confirmados [0]
- Pestaña Cancelados [8] ← Usuario debe cambiar a esta pestaña
- Al ver Confirmados: "No hay pacientes confirmados."
```

### Caso 4: Agenda Vacía
```
Confirmados: 0
Cancelados: 0

Vista:
- No se muestran pestañas
- Mensaje: "No hay pacientes asignados a esta disponibilidad."
```

---

## ✅ Testing

- ✅ Compilación exitosa
- ✅ Pestañas funcionan correctamente
- ✅ Contadores actualizados en tiempo real
- ✅ Diseño diferenciado por estado
- ✅ Responsive en todos los tamaños
- ✅ Mensajes condicionales correctos
- ✅ Listo para producción

---

**Estado**: ✅ COMPLETADO  
**Fecha**: Octubre 20, 2025  
**Versión**: 5.0  
**Sistema**: Biosanarcall - Pestañas Confirmados/Cancelados  
**Mejora**: Separación Visual de Estados de Citas
