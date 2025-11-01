# Manual de Uso - Generador Automático

Este directorio contiene el script de Playwright para generar automáticamente capturas de pantalla del sistema Biosanarcall Medical System y producir el Manual de Uso documentado.

## Archivos

- `generate_manual.js` — Script de Playwright que navega por la aplicación y captura pantallas.
- `run_manual_fixed.sh` — Script de shell que instala Playwright, sus navegadores y ejecuta el generador.
- `check_frontend.sh` — Verifica que el frontend esté disponible antes de ejecutar.
- `package.json` — (Generado automáticamente) Define Playwright como dependencia local.

## Configuración de Producción

El sistema está configurado para trabajar con **producción** por defecto:
- Frontend servido desde `frontend/dist/` vía Nginx
- URL de producción: `https://biosanarcall.site`
- No requiere levantar dev server (npm run dev)

## Requisitos previos

1. **Frontend en producción** (configuración por defecto):
   - Nginx sirviendo `frontend/dist/` en https://biosanarcall.site
   - Verificar que esté activo: `sudo systemctl status nginx`

2. **Credenciales demo**: El script usa por defecto:
   - Email: `demo@demo.com`
   - Password: `demo123`
   
   Asegúrate de que este usuario exista en la base de datos.

3. **Node.js 18+** instalado en el sistema.

## Uso básico

### Opción 1: Producción (recomendado - configuración por defecto)

```bash
# Desde la raíz del repositorio
bash scripts/manual/run_manual_fixed.sh
```

Este comando:
- Verifica que https://biosanarcall.site esté disponible
- Instala Playwright y navegadores automáticamente (si no están instalados)
- Ejecuta el generador de capturas en producción
- Guarda las imágenes en `docs/manual_screenshots/`

### Opción 2: Desarrollo local (override manual)

Si quieres generar capturas desde un dev server local:

```bash
# Terminal 1: Levantar dev server
cd frontend
npm run dev
# Esperar a que inicie en http://localhost:8080

# Terminal 2: Ejecutar generador apuntando a local
BASE_URL=http://localhost:8080 bash scripts/manual/run_manual_fixed.sh
```

### Opción 3: Ejecutar manualmente

```bash
# Instalar Playwright localmente
cd scripts/manual
npm install
npx playwright install --with-deps

# Ejecutar el generador (usa producción por defecto)
node generate_manual.js
```

## Variables de entorno opcionales

Puedes personalizar el comportamiento del script con variables de entorno:

```bash
# Usar dev local en lugar de producción
BASE_URL=http://localhost:8080 bash scripts/manual/run_manual_fixed.sh

# Usar staging u otro ambiente
BASE_URL=https://staging.biosanarcall.site bash scripts/manual/run_manual_fixed.sh

# Usar credenciales diferentes
MANUAL_EMAIL=admin@example.com MANUAL_PASSWORD=mypass123 bash scripts/manual/run_manual_fixed.sh

# Combinar múltiples variables
BASE_URL=http://localhost:8080 MANUAL_EMAIL=test@test.com bash scripts/manual/run_manual_fixed.sh
```

## Resultado esperado

Después de ejecutar el script exitosamente, encontrarás:

```
docs/manual_screenshots/
├── 01_dashboard.png
├── 02_queue.png
├── 03_daily_queue.png
├── 04_patients.png
├── 05_calls.png
├── 06_sms.png
├── 07_locations.png
├── 08_statistics.png
└── 09_settings.png
```

El manual base ya existe en `docs/MANUAL_DE_USO.md` con referencias a estas capturas.

## Troubleshooting

### El script falla con "Frontend not available"

Verifica:
1. Que Nginx esté corriendo: `sudo systemctl status nginx`
2. Que el frontend esté compilado: `ls -la /home/ubuntu/app/frontend/dist/`
3. Que la ruta en Nginx apunte a la carpeta `dist/`
4. Que el dominio resuelva correctamente: `curl -I https://biosanarcall.site`

### Timeouts o errores de navegación

- **Solucionado**: Se cambió de `networkidle` a `domcontentloaded` con timeout de 30s
- Si aún hay problemas, aumenta los `waitForTimeout` en `generate_manual.js`
- Revisa que el backend esté respondiendo: `curl -I http://localhost:4000/api/patients`
- Verifica que las credenciales de demo estén activas en la BD

### Screenshots vacíos o con spinners de carga

- Aumenta los `waitForTimeout` después de cada `page.goto()` (actualmente 2-3 segundos)
- Revisa que el backend no esté sobrecargado o lento

## Resultados

Las capturas se guardan en: `/home/ubuntu/app/docs/manual_screenshots/`

Archivos generados:
- `01_dashboard.png` - Pantalla principal
- `02_queue.png` - Cola de espera
- `03_daily_queue.png` - Cola diaria
- `04_patients.png` - Gestión de pacientes
- `05_calls.png` - Historial de llamadas
- `06_sms.png` - Envío de SMS
- `07_locations.png` - Ubicaciones/sedes
- `08_statistics.png` - Estadísticas y analytics
- `09_settings.png` - Configuración del sistema

El documento final está en: `/home/ubuntu/app/docs/MANUAL_DE_USO.md`

### Error: Login failed

```
Login failed: Timeout 10000ms exceeded
```

**Solución**: 
1. Verifica que las credenciales demo@demo.com / demo123 existan:
   ```bash
   cd backend
   npm run db:check
   ```
2. Si no existe, créalo con: `npm run db:seed`
3. Verifica que la página de login sea accesible en el navegador

### Error: Browser installation failed

```
Failed to install browsers
```

**Solución**: Ejecuta manualmente la instalación de navegadores:

```bash
cd scripts/manual
npx playwright install --with-deps
```

### Capturas en blanco o incompletas

**Solución**: 
1. Aumenta los timeouts en `generate_manual.js` (busca `waitForTimeout` y aumenta los milisegundos).
2. Ejecuta el script en modo visible (headful) para debug:

```javascript
// En generate_manual.js, línea ~42
const browser = await chromium.launch({ 
  headless: false,  // Cambiar a false
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### Error SSL/HTTPS en producción

Si obtienes errores de certificado SSL:

```bash
# El script ya incluye -k en curl, pero si persiste:
NODE_TLS_REJECT_UNAUTHORIZED=0 bash scripts/manual/run_manual_fixed.sh
```

## Mantenimiento

### Actualizar frontend en producción

Antes de generar el manual, asegúrate de que el frontend esté actualizado:

```bash
cd frontend
npm run build
# Los archivos se generan en dist/
# Nginx los sirve automáticamente
```

### Cambios en la estructura del frontend

Si cambias la estructura del frontend (nuevas rutas, componentes renombrados), actualiza los selectores en `generate_manual.js`:

```javascript
// Ejemplo: Si cambias el id del input de password
await page.fill('input[id="nuevo-password-id"]', CREDENTIALS.password);
```

## Próximos pasos

1. Ejecuta el script (usará producción automáticamente):
   ```bash
   bash scripts/manual/run_manual_fixed.sh
   ```

2. Revisa las capturas generadas en `docs/manual_screenshots/`.

3. Edita `docs/MANUAL_DE_USO.md` para añadir descripciones detalladas de cada pantalla.

4. Opcionalmente, añade más páginas al script (ej: distribución, agendamiento, etc.).

## Notas técnicas

- El script usa Playwright con navegador Chromium en modo headless.
- Las capturas son full-page (incluyen scroll completo).
- Se aplican delays (`waitForTimeout`) para permitir que animaciones y datos se carguen.
- Los navegadores se instalan localmente en `~/.cache/ms-playwright/`.
- **Por defecto apunta a producción** (https://biosanarcall.site) para facilitar el uso.
- El frontend debe estar construido (`npm run build`) y servido por Nginx.
