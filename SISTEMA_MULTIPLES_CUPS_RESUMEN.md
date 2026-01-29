# SISTEMA DE MÚLTIPLES CÓDIGOS CUPS POR ORDEN - RESUMEN

## Fecha: 2025-01-17

## Objetivo Implementado
✅ **Permitir hasta 3 códigos CUPS por orden en el Portal de Usuario**

---

## 🗄️ CAMBIOS EN BASE DE DATOS

### Nueva Tabla: `waiting_list_cups`
```sql
CREATE TABLE waiting_list_cups (
  id BIGINT(20) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  waiting_list_id BIGINT(20) UNSIGNED NOT NULL,
  cups_id INT(10) UNSIGNED NULL,
  cups_code VARCHAR(20) NULL,
  cups_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NULL,
  is_manual BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Características:**
- Relación N:N entre lista de espera y códigos CUPS
- Soporta CUPS de la base de datos (cups_id) o manuales
- Migración automática de 167 registros existentes
- Foreign Keys con CASCADE para integridad referencial

**Migración:** `/home/ubuntu/app/backend/migrations/20250117_create_waiting_list_cups_relation.sql`

---

## 💻 CAMBIOS EN FRONTEND

### Archivo: `/home/ubuntu/app/frontend/src/pages/UserPortal.tsx`

#### 1️⃣ Nuevos Estados (Líneas ~175-177)
```typescript
const [cupsList, setCupsList] = useState<any[]>([]);  // Array de hasta 3 CUPS
const [currentCupsIndex, setCurrentCupsIndex] = useState(0);  // Índice actual
```

#### 2️⃣ Modal de CUPS Rediseñado (Líneas ~2236-2380)
**Características:**
- ✅ Lista visual de CUPS agregados (máx 3)
- ✅ Botón "Remover" para cada código
- ✅ Contador "X/3 estudios agregados"
- ✅ Formulario de búsqueda condicional (se oculta al llegar a 3)
- ✅ Mensaje de límite alcanzado
- ✅ Botones independientes "Agregar este estudio" para cada código

**Flujo de Usuario:**
1. Usuario busca código CUPS por número o nombre
2. Click en "Agregar este estudio" (encontrado) o ingresa manualmente
3. El código se agrega a la lista visual
4. Usuario puede agregar hasta 2 códigos más
5. Puede remover códigos individuales
6. Click en "Confirmar y continuar" cuando termine

#### 3️⃣ Validación Actualizada (Línea ~2210)
```typescript
const handleConfirmCups = () => {
  if (cupsList.length === 0) {
    toast({ title: "Error", description: "Debe agregar al menos un estudio" });
    return;
  }
  // ... continúa el flujo
};
```

#### 4️⃣ Función de Envío Modificada (Líneas ~780-850)
```typescript
const addToWaitingListWithCups = async (specialty: any) => {
  const requestBody: any = {
    patient_id: patient.patient_id,
    specialty_id: specialty.id,
    eps_id: patient.insurance_eps_id,
    reason: `Consulta de ${specialty.name}`
  };

  if (cupsList.length > 0) {
    requestBody.cups_list = cupsList.map(cups => ({
      cups_id: cups.id || null,
      cups_code: cups.code,
      cups_name: cups.name,
      category: cups.category || null,
      manual: cups.manual || false
    }));
    
    const studiesNames = cupsList.map(c => c.name).join(', ');
    requestBody.reason = `${specialty.name} - Estudios: ${studiesNames}`;
  }
  // ... envía al backend
};
```

#### 5️⃣ Modal de Resultado Actualizado (Líneas ~2945-3005)
- Muestra cantidad de estudios agregados
- Lista completa de nombres de CUPS
- Formato visual mejorado

---

## 🔧 CAMBIOS EN BACKEND

### Archivo: `/home/ubuntu/app/backend/src/routes/patients-updated.ts`

#### Endpoint Modificado: `POST /api/patients-v2/public/add-to-waiting-list-with-cups`

**Cambios Clave:**

1️⃣ **Recibe Array de CUPS:**
```typescript
const { patient_id, specialty_id, eps_id, reason, cups_list } = req.body;
```

2️⃣ **Validación de Array:**
```typescript
if (cups_list && (!Array.isArray(cups_list) || cups_list.length > 3)) {
  return res.status(400).json({
    error: 'cups_list debe ser un array con máximo 3 elementos'
  });
}
```

3️⃣ **Inserción en Lista de Espera:**
```typescript
// cups_id = NULL (ahora se usa tabla de relación)
INSERT INTO appointments_waiting_list (
  patient_id, specialty_id, cups_id, reason, ...
) VALUES (?, ?, NULL, ?, ...);
```

4️⃣ **Inserción de Cada CUPS:**
```typescript
for (const cups of cups_list) {
  await pool.execute(
    `INSERT INTO waiting_list_cups (
      waiting_list_id, cups_id, cups_code, cups_name, category, is_manual
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [waiting_list_id, cups.cups_id, cups.cups_code, ...]
  );
}
```

5️⃣ **Respuesta con Información Completa:**
```typescript
res.json({ 
  success: true, 
  data: { 
    waiting_list_id,
    position,
    cups_count: cups_list?.length || 0,
    cups_names: cupsNames.join(', '),
    message: 'Agregado a lista de espera exitosamente'
  } 
});
```

---

## 📊 FLUJO DE DATOS COMPLETO

### 1. Usuario Agrega Códigos (Frontend)
```
Usuario busca "890201" 
  → Sistema busca en BD 
  → Encuentra "ECOGRAFIA OBSTETRICA TRANSABDOMINAL"
  → Usuario click "Agregar este estudio"
  → Se agrega a cupsList[]
```

### 2. Usuario Confirma (Frontend)
```
cupsList = [
  { id: 123, code: "890201", name: "ECOGRAFIA OBSTETRICA...", category: "Ecografía", manual: false },
  { id: 124, code: "890202", name: "ECOGRAFIA GINECOLOGICA...", category: "Ecografía", manual: false }
]
  → Click "Confirmar y continuar"
  → Llama addToWaitingListWithCups()
```

### 3. Envío al Backend
```javascript
POST /api/patients-v2/public/add-to-waiting-list-with-cups
Body: {
  patient_id: 456,
  specialty_id: 5,
  eps_id: 12,
  reason: "Ecografía - Estudios: ECOGRAFIA OBSTETRICA..., ECOGRAFIA GINECOLOGICA...",
  cups_list: [
    { cups_id: 123, cups_code: "890201", cups_name: "ECOGRAFIA OBSTETRICA...", ... },
    { cups_id: 124, cups_code: "890202", cups_name: "ECOGRAFIA GINECOLOGICA...", ... }
  ]
}
```

### 4. Procesamiento en Backend
```sql
-- Paso 1: Insertar en lista de espera
INSERT INTO appointments_waiting_list (patient_id, specialty_id, reason, ...)
VALUES (456, 5, 'Ecografía - Estudios: ...', ...);
-- Retorna: waiting_list_id = 1465

-- Paso 2: Insertar cada CUPS
INSERT INTO waiting_list_cups (waiting_list_id, cups_id, cups_code, cups_name, ...)
VALUES (1465, 123, '890201', 'ECOGRAFIA OBSTETRICA...', ...);

INSERT INTO waiting_list_cups (waiting_list_id, cups_id, cups_code, cups_name, ...)
VALUES (1465, 124, '890202', 'ECOGRAFIA GINECOLOGICA...', ...);
```

### 5. Respuesta al Frontend
```json
{
  "success": true,
  "data": {
    "waiting_list_id": 1465,
    "position": 8,
    "cups_count": 2,
    "cups_names": "ECOGRAFIA OBSTETRICA TRANSABDOMINAL, ECOGRAFIA GINECOLOGICA",
    "message": "Agregado a lista de espera exitosamente"
  }
}
```

### 6. Modal de Confirmación (Frontend)
```
┌─────────────────────────────────────┐
│  ✓ ¡Agregado a Lista de Espera!    │
├─────────────────────────────────────┤
│ Especialidad: Ecografía             │
│ Estudios (2):                       │
│   ECOGRAFIA OBSTETRICA...           │
│   ECOGRAFIA GINECOLOGICA...         │
│ Posición: #8                        │
│ N° solicitud: #1465                 │
└─────────────────────────────────────┘
```

---

## 🧪 PRUEBAS REALIZADAS

✅ **Base de Datos:**
- Migración ejecutada exitosamente
- 167 registros migrados a nueva tabla
- Foreign keys funcionando correctamente

✅ **Backend:**
- Compilación exitosa (restart #331)
- Endpoint validando array de 1-3 elementos
- Inserción múltiple en `waiting_list_cups`

✅ **Frontend:**
- Compilación exitosa (49.97s)
- Modal con lista visual funcionando
- Validación de límite de 3 estudios
- Envío correcto de cupsList al backend

---

## 📝 CASOS DE USO SOPORTADOS

### Caso 1: Un Solo Estudio
- Usuario agrega 1 código CUPS
- Sistema permite continuar
- Se guarda 1 registro en `waiting_list_cups`

### Caso 2: Múltiples Estudios (2-3)
- Usuario agrega 2 o 3 códigos CUPS
- Sistema muestra lista visual con contador
- Se guardan N registros en `waiting_list_cups`

### Caso 3: Código Manual
- Usuario no encuentra código en BD
- Ingresa nombre manualmente
- Se guarda con `is_manual = true` y `cups_id = NULL`

### Caso 4: Eliminar Código
- Usuario se equivoca y agrega código incorrecto
- Click en botón "Remover"
- Código se elimina de `cupsList` sin afectar los demás

---

## 🔄 RETROCOMPATIBILIDAD

✅ **Mantenida:**
- Columna `cups_id` en `appointments_waiting_list` NO eliminada
- Código antiguo que use `cups_id` seguirá funcionando
- Nuevas solicitudes usan `waiting_list_cups` (cups_id = NULL en tabla principal)

---

## 🚀 DEPLOYMENT

### Backend
```bash
cd /home/ubuntu/app/backend
npm run build
pm2 restart cita-central-backend  # Restart #331
```

### Frontend
```bash
cd /home/ubuntu/app/frontend
npm run build
# Archivos generados en dist/
```

### Estado Actual
- ✅ Backend en producción (PM2 restart #331)
- ✅ Frontend compilado (build exitoso 49.97s)
- ✅ Base de datos migrada (167 registros)

---

## 🎯 URLs DE PRUEBA

**Portal de Usuario:** https://biosanarcall.site/users

**Flujo de Prueba:**
1. Seleccionar especialidad "Ecografía"
2. Verificar que no hay citas disponibles (para activar lista de espera)
3. Click en "Agregar a lista de espera"
4. Buscar código CUPS (ej: 890201)
5. Agregar hasta 3 códigos diferentes
6. Confirmar y verificar modal de resultado

---

## 📚 ARCHIVOS MODIFICADOS

### Frontend
- `/home/ubuntu/app/frontend/src/pages/UserPortal.tsx` (3532 líneas)
  - Estados: +2 líneas
  - Modal CUPS: ~144 líneas rediseñadas
  - Función envío: ~70 líneas modificadas
  - Modal resultado: ~60 líneas actualizadas

### Backend
- `/home/ubuntu/app/backend/src/routes/patients-updated.ts` (2183 líneas)
  - Endpoint: ~95 líneas modificadas (líneas 233-328)

### Base de Datos
- `/home/ubuntu/app/backend/migrations/20250117_create_waiting_list_cups_relation.sql` (nuevo)

---

## ✅ CARACTERÍSTICAS COMPLETADAS

1. ✅ Modal de CUPS con lista visual de hasta 3 códigos
2. ✅ Botón remover individual por cada código
3. ✅ Contador "X/3 estudios agregados"
4. ✅ Validación de límite máximo 3 estudios
5. ✅ Tabla de relación `waiting_list_cups` en BD
6. ✅ Endpoint backend procesando array de CUPS
7. ✅ Migración de datos existentes (167 registros)
8. ✅ Modal de confirmación mostrando múltiples estudios
9. ✅ Soporte para códigos de BD y manuales
10. ✅ Retrocompatibilidad mantenida

---

## 🎉 RESULTADO FINAL

El sistema ahora permite a los usuarios del portal público agregar hasta 3 códigos CUPS por orden cuando solicitan citas de Ecografía (o cualquier especialidad que requiera estudios múltiples). La implementación mantiene la integridad de datos, valida correctamente los límites y proporciona una interfaz de usuario intuitiva con feedback visual claro.
