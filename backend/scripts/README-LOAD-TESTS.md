# 🚀 Scripts de Prueba de Carga Concurrente

Sistema de pruebas de carga para evaluar el rendimiento del backend de Biosanarcall bajo condiciones de usuarios concurrentes.

## 📋 Scripts Disponibles

### 1. `load-test-concurrent.js`
Script principal de prueba de carga que simula múltiples usuarios concurrentes.

**Características:**
- Simula usuarios reales con tiempos de espera aleatorios
- Prueba múltiples endpoints de forma ponderada
- Genera estadísticas detalladas de rendimiento
- Calcula RPS (Requests Per Second), tiempos de respuesta y percentiles

**Uso básico:**
```bash
node scripts/load-test-concurrent.js
```

**Configuración mediante variables de entorno:**
```bash
CONCURRENT_USERS=50 \
REQUESTS_PER_USER=15 \
RAMP_UP_MS=5000 \
TEST_DURATION_MS=60000 \
BASE_URL=http://localhost:4000 \
node scripts/load-test-concurrent.js
```

**Variables de configuración:**
- `CONCURRENT_USERS`: Número de usuarios simultáneos (default: 50)
- `REQUESTS_PER_USER`: Requests que hará cada usuario (default: 20)
- `RAMP_UP_MS`: Tiempo para arrancar todos los usuarios (default: 5000ms)
- `TEST_DURATION_MS`: Duración máxima de la prueba (default: 60000ms)
- `BASE_URL`: URL del servidor a probar (default: http://localhost:4000)

### 2. `load-test-with-monitoring.sh`
Wrapper que ejecuta la prueba de carga mientras monitorea recursos del sistema.

**Características:**
- Monitoreo en tiempo real de CPU, memoria y conexiones
- Guarda logs detallados para análisis posterior
- Genera resumen automático de recursos utilizados
- Compatible con múltiples procesos Node.js

**Uso:**
```bash
# Prueba con 50 usuarios, 15 requests cada uno
./scripts/load-test-with-monitoring.sh 50 15

# Prueba ligera con 20 usuarios, 10 requests cada uno
./scripts/load-test-with-monitoring.sh 20 10

# Prueba intensiva con 100 usuarios, 20 requests cada uno
./scripts/load-test-with-monitoring.sh 100 20
```

**Resultados guardados en:**
- `/backend/load-test-results/load_test_TIMESTAMP.log` - Resultados de la prueba
- `/backend/load-test-results/resources_TIMESTAMP.log` - Métricas de recursos

### 3. `analyze-load-test.sh`
Herramienta de análisis y visualización de resultados de pruebas anteriores.

**Características:**
- Lista todas las pruebas realizadas
- Analiza la última prueba automáticamente
- Genera gráficos ASCII de conexiones en el tiempo
- Proporciona recomendaciones basadas en los resultados

**Uso:**
```bash
./scripts/analyze-load-test.sh
```

## 📊 Interpretación de Resultados

### Métricas Clave

**Requests Per Second (RPS)**
- < 10 RPS: Rendimiento bajo, investigar cuellos de botella
- 10-50 RPS: Rendimiento normal para aplicaciones web
- 50-100 RPS: Rendimiento bueno
- > 100 RPS: Rendimiento excelente

**Tiempo de Respuesta**
- < 100ms: Excelente
- 100-500ms: Bueno
- 500ms-1s: Aceptable
- > 1s: Necesita optimización

**Uso de CPU**
- < 50%: Saludable, puede manejar más carga
- 50-80%: Carga moderada, monitorear en producción
- > 80%: Cerca del límite, considerar escalar

**Uso de Memoria**
- Debe mantenerse estable durante la prueba
- Si crece continuamente, puede haber memory leaks
- Monitorear el máximo alcanzado vs RAM disponible

### Códigos HTTP Esperados

En las pruebas **sin autenticación**:
- **200 OK**: Endpoints públicos funcionando
- **401 Unauthorized**: Normal, endpoints protegidos
- **404 Not Found**: Normal, endpoints no implementados o de prueba
- **429 Too Many Requests**: ✅ Rate limiter funcionando correctamente

## 🎯 Casos de Uso Recomendados

### Prueba Rápida (Smoke Test)
```bash
CONCURRENT_USERS=10 REQUESTS_PER_USER=5 node scripts/load-test-concurrent.js
```
- Verificación rápida de que el servidor responde
- Tiempo estimado: ~5 segundos

### Prueba de Carga Normal
```bash
./scripts/load-test-with-monitoring.sh 50 15
```
- Simula carga normal de producción
- Tiempo estimado: ~20-30 segundos

### Prueba de Estrés
```bash
./scripts/load-test-with-monitoring.sh 100 20
```
- Prueba límites del servidor
- Tiempo estimado: ~30-60 segundos

### Prueba de Capacidad Máxima
```bash
CONCURRENT_USERS=200 REQUESTS_PER_USER=30 ./scripts/load-test-with-monitoring.sh
```
- Encontrar el punto de quiebre del servidor
- Tiempo estimado: 1-2 minutos
- ⚠️ Puede causar degradación del servicio

## 📈 Resultados de Pruebas Anteriores

### Última Prueba (50 usuarios concurrentes)
```
Fecha:              2026-02-12 01:30:10
Usuarios:           50
Requests totales:   751
Duración:           22.46s
RPS promedio:       33.44
RPS máximo:         39.20
Tiempo respuesta:   7.62ms promedio

Recursos:
  CPU promedio:     0.19%
  CPU máxima:       0.80%
  Memoria máxima:   596 MB
  Conexiones máx:   590
```

**Conclusión:** El servidor maneja excelentemente la carga concurrente con recursos mínimos.

## 🔧 Configuración de Endpoints Probados

Los scripts prueban los siguientes endpoints con ponderación:

| Endpoint | Peso | Descripción |
|----------|------|-------------|
| `/health` | 10% | Health check |
| `/api/lookups/municipalities` | 15% | Catálogo de municipios |
| `/api/lookups/eps` | 15% | Catálogo de EPS |
| `/api/lookups/specialties` | 20% | Especialidades médicas |
| `/api/appointments/available` | 25% | Disponibilidad de citas |
| `/api/analytics/summary` | 10% | Resumen de analytics |
| `/api/auth/login` | 5% | Intento de login |

Para modificar los endpoints, editar el array `config.endpoints` en [load-test-concurrent.js](./load-test-concurrent.js).

## 🐛 Troubleshooting

### Error: "El servidor no está disponible"
```bash
# Verificar que el servidor esté corriendo
curl http://localhost:4000/health

# Iniciar el servidor si está detenido
cd /home/ubuntu/app/backend && npm run dev
```

### Error: "ECONNREFUSED"
- El puerto 4000 puede estar bloqueado por firewall
- Verificar que no haya otro proceso usando el puerto: `lsof -i :4000`

### Error: "Too many open files"
- Aumentar límite de file descriptors:
```bash
ulimit -n 4096
```

### Resultados inconsistentes
- Ejecutar múltiples pruebas y promediar resultados
- Asegurarse de que no haya otros procesos consumiendo recursos
- Verificar que la base de datos esté disponible

## 📝 Notas Importantes

1. **No ejecutar en producción**: Estas pruebas generan carga artificial significativa
2. **Cache warming**: La primera prueba puede ser más lenta debido a caches fríos
3. **Base de datos**: Asegurarse de que MySQL esté corriendo y optimizado
4. **Rate limiting**: Los límites configurados pueden afectar resultados (códigos 429)
5. **Network**: Pruebas en localhost son más rápidas que en red

## 🚀 Próximos Pasos

1. **Autenticación**: Implementar login real para probar endpoints protegidos
2. **Escenarios**: Crear escenarios de usuario más realistas (buscar → agendar → confirmar)
3. **Métricas**: Integrar con herramientas de monitoreo (Prometheus, Grafana)
4. **CI/CD**: Automatizar pruebas de rendimiento en pipeline
5. **Benchmarks**: Establecer SLAs y alertas basadas en resultados

## 📚 Recursos Adicionales

- [Artillery](https://artillery.io/) - Herramienta de carga más avanzada
- [k6](https://k6.io/) - Pruebas de carga modernas
- [Apache Bench](https://httpd.apache.org/docs/2.4/programs/ab.html) - Herramienta clásica
- [wrk](https://github.com/wg/wrk) - Benchmarking HTTP moderno

---

**Autor**: Sistema de Pruebas Biosanarcall IPS  
**Última actualización**: 2026-02-12
