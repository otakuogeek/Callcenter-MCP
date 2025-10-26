# 🔍 Guía de Debugging - Error categories.map

## Error Actual
```
TypeError: s.map is not a function at categories.map()
```

## Posibles Causas

1. **La API devuelve un objeto en lugar de un array**
2. **Problema de caché del navegador**
3. **Error en la respuesta del servidor**
4. **Problema de autenticación**

## Pasos para Debugging

### 1. Limpiar Caché del Navegador
```
- Chrome/Edge: Ctrl+Shift+Delete → Limpiar caché
- Firefox: Ctrl+Shift+Delete → Limpiar caché
- O usar: Ctrl+F5 (Windows) / Cmd+Shift+R (Mac) para recarga forzada
```

### 2. Revisar Logs en Consola del Navegador

Abrir DevTools (F12) y buscar estos mensajes:

```javascript
// Debe aparecer al cargar la pestaña CUPS:
Categorías recibidas: [...]
Tipo: object
Es array: true
```

**Si ves algo diferente:**
- `Es array: false` → La API no está devolviendo un array
- `Tipo: undefined` → La petición falló
- Nada en consola → El componente no se está montando

### 3. Verificar la Respuesta de la API

En la consola del navegador (pestaña Network):

```
1. Ir a Network/Red
2. Filtrar por "categories"
3. Buscar la petición GET /api/cups/categories
4. Ver la respuesta en la pestaña "Response"
```

**Formato esperado:**
```json
{
  "success": true,
  "data": ["Categoría 1", "Categoría 2", ...]
}
```

### 4. Probar Endpoint Manualmente (Backend)

Desde la terminal del servidor:

```bash
# Primero obtener un token
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@biosanar.com","password":"TU_PASSWORD"}'

# Copiar el token y usarlo:
curl -H "Authorization: Bearer TOKEN_AQUI" \
  http://localhost:4000/api/cups/categories
```

**Respuesta esperada:**
```json
{
  "success": true,
  "data": ["Consulta", "Procedimiento", ...]
}
```

### 5. Verificar Base de Datos

```sql
SELECT DISTINCT category 
FROM cups 
WHERE category IS NOT NULL 
ORDER BY category;
```

Debe devolver filas con categorías.

## Correcciones Implementadas

### En `/frontend/src/lib/api.ts`
```typescript
getCupsCategories: async () => {
  const response = await request<{ success: boolean; data: string[] }>(`/cups/categories`);
  return response.data || [];
},
```

### En `/frontend/src/components/CupsManagement.tsx`

**Validación estricta:**
```typescript
let validCategories: string[] = [];

if (Array.isArray(cats)) {
  validCategories = cats.filter(c => typeof c === 'string' && c.length > 0);
} else if (cats && typeof cats === 'object' && 'data' in cats && Array.isArray(cats.data)) {
  validCategories = cats.data.filter(c => typeof c === 'string' && c.length > 0);
}

setCategories(validCategories);
```

**Validación en render:**
```typescript
{Array.isArray(categories) && categories.map((cat) => (
  <SelectItem key={cat} value={cat}>
    {cat}
  </SelectItem>
))}
```

## Si el Error Persiste

### Opción 1: Deshabilitar temporalmente el filtro de categorías

Comentar el Select de categorías temporalmente:

```typescript
{/* <div>
  <Label htmlFor="category-filter">Categoría</Label>
  <Select value={categoryFilter} onValueChange={...}>
    ...
  </Select>
</div> */}
```

### Opción 2: Verificar que el endpoint esté registrado

```bash
cd /home/ubuntu/app/backend
grep -r "router.get('/categories'" src/routes/cups.ts
```

Debe devolver:
```
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
```

### Opción 3: Reiniciar el backend

```bash
cd /home/ubuntu/app/backend
pm2 restart cita-central-backend
pm2 logs cita-central-backend --lines 50
```

## Información de Compilación

**Último build:**
- Frontend: ✅ Compilado exitosamente
- Backend: ✅ Compilado exitosamente
- Logs de debug: ✅ Agregados

**Archivos modificados:**
- `/frontend/src/lib/api.ts` - Método getCupsCategories
- `/frontend/src/components/CupsManagement.tsx` - Validaciones mejoradas
- Compilación: `components-Dbph2fsC.js`

## Próximos Pasos

1. ✅ Recargar página con Ctrl+F5
2. ✅ Abrir consola del navegador (F12)
3. ✅ Ir a Configuración → Gestión → CUPS
4. ✅ Revisar logs en consola
5. ✅ Compartir el output de los logs para diagnóstico

---

**Nota:** Los warnings de React Router (v7_startTransition, v7_relativeSplatPath) son normales y no afectan la funcionalidad. Son avisos sobre futuras versiones de React Router.
