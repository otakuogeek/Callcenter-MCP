# 📚 Índice de Documentación — Biosanarcall Medical System

Bienvenido al sistema de gestión médica Biosanarcall. Esta página te guiará a toda la documentación disponible.

---

## 🎯 Inicio Rápido

**¿Eres nuevo?** Empieza aquí:
1. 📖 [Resumen Completo del Proyecto](./RESUMEN_PROYECTO_COMPLETO.md) - Arquitectura, funcionalidades, integraciones
2. 👤 [Manual de Usuario](./docs/MANUAL_DE_USO.md) - Guía visual con screenshots de todas las secciones
3. 🔧 [Guía de Mantenimiento](./GUIA_MANTENIMIENTO.md) - Actualizaciones, backups, troubleshooting

---

## 📂 Documentación por Categoría

### 🏗️ Arquitectura y Sistemas

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Resumen Proyecto Completo** | Arquitectura general, stack tecnológico, features, métricas | [RESUMEN_PROYECTO_COMPLETO.md](./RESUMEN_PROYECTO_COMPLETO.md) |
| **Análisis de Tablas BD** | Estructura de base de datos, relaciones, índices | [ANALISIS_TABLAS_BD.md](./ANALISIS_TABLAS_BD.md) |
| **Copilot Instructions** | Patrones de código, convenciones, flujos de trabajo | [.github/copilot-instructions.md](./.github/copilot-instructions.md) |

### 👥 Gestión de Pacientes y Citas

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Sistema Cola de Espera** | Prioridades, virtualización, optimización (summary mode + lazy load) | Integrado en [RESUMEN_PROYECTO_COMPLETO.md](./RESUMEN_PROYECTO_COMPLETO.md#2-cola-de-espera-waiting-list) |
| **Cola Diaria** | Filtros por especialidad, estados, navegación por fechas | Integrado en [RESUMEN_PROYECTO_COMPLETO.md](./RESUMEN_PROYECTO_COMPLETO.md#3-cola-diaria-daily-queue) |
| **Agrupación Citas por Día** | Lógica de agrupación en cola diaria | [AGRUPACION_CITAS_POR_DIA.md](./AGRUPACION_CITAS_POR_DIA.md) |
| **Actualización Números y Fechas** | Normalización de teléfonos y fechas | [ACTUALIZACION_NUMEROS_FECHAS.md](./ACTUALIZACION_NUMEROS_FECHAS.md) |
| **Sistema Formateo Teléfonos** | E.164 format, validación, normalización | [SISTEMA_FORMATEO_TELEFONOS.md](./SISTEMA_FORMATEO_TELEFONOS.md) |

### 💬 Comunicaciones (SMS y Llamadas)

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Sistema SMS - Resumen** | Arquitectura completa del sistema SMS | [SISTEMA_SMS_RESUMEN.md](./SISTEMA_SMS_RESUMEN.md) |
| **Estado Final SMS** | Implementación actual, features, limitaciones | [ESTADO_FINAL_SMS.md](./ESTADO_FINAL_SMS.md) |
| **Filtro EPS en SMS** | Exclusión de EPS en envío masivo | [FILTRO_EPS_SMS.md](./FILTRO_EPS_SMS.md) |
| **Rango Posiciones SMS** | Envío por posición en cola (X a Y) | [RANGO_POSICIONES_SMS.md](./RANGO_POSICIONES_SMS.md) |
| **Historial SMS** | Logs, estados, trazabilidad | [HISTORIAL_SMS_IMPLEMENTADO.md](./HISTORIAL_SMS_IMPLEMENTADO.md) |
| **SMS Personalizado** | Variables dinámicas en plantillas | [SMS_PERSONALIZADO_RESUMEN.txt](./SMS_PERSONALIZADO_RESUMEN.txt) |
| **Nueva Sección SMS** | Módulo dedicado en frontend | [NUEVA_SECCION_SMS.md](./NUEVA_SECCION_SMS.md) |
| **Migración LabsMobile** | Cambio de proveedor SMS | [MIGRACION_SMS_LABSMOBILE.md](./MIGRACION_SMS_LABSMOBILE.md) |
| **Refactorización LabsMobile** | Mejoras técnicas en integración | [REFACTORIZACION_SMS_LABSMOBILE.md](./REFACTORIZACION_SMS_LABSMOBILE.md) |
| **Sistema Llamadas - Resumen** | IVR, ElevenLabs, sincronización | [SISTEMA_LLAMADAS_BD_RESUMEN.md](./SISTEMA_LLAMADAS_BD_RESUMEN.md) |
| **ElevenLabs Sync System** | Arquitectura de sincronización de llamadas | [backend/docs/ELEVENLABS_SYNC_SYSTEM.md](./backend/docs/ELEVENLABS_SYNC_SYSTEM.md) |
| **ElevenLabs Quickstart** | Setup inicial y configuración | [backend/ELEVENLABS_QUICKSTART.md](./backend/ELEVENLABS_QUICKSTART.md) |

### 🩺 Portal de Doctores e Historias Clínicas

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Doctor Login Portal** | Autenticación separada, dashboard, features | [DOCTOR_LOGIN_PORTAL.md](./DOCTOR_LOGIN_PORTAL.md) |
| **Doctor Auth Summary** | Resumen de autenticación de doctores | [DOCTOR_AUTH_SUMMARY.md](./DOCTOR_AUTH_SUMMARY.md) |
| **Doctor Authentication System** | Arquitectura completa del sistema de auth | [backend/docs/DOCTOR_AUTHENTICATION_SYSTEM.md](./backend/docs/DOCTOR_AUTHENTICATION_SYSTEM.md) |
| **Gestión Contraseñas Doctores** | Creación, reset, seguridad | [backend/GESTION_CONTRASENA_DOCTORES.md](./backend/GESTION_CONTRASENA_DOCTORES.md) |
| **Sistema Historias Clínicas** | Estructura modular, campos, flujos | [docs/SISTEMA_HISTORIAS_CLINICAS.md](./docs/SISTEMA_HISTORIAS_CLINICAS.md) |
| **Integración Historias Clínicas Frontend** | Componentes React, forms, validaciones | [docs/INTEGRACION_HISTORIAS_CLINICAS_FRONTEND.md](./docs/INTEGRACION_HISTORIAS_CLINICAS_FRONTEND.md) |
| **Sistema Dictado Voz IA** | Whisper integration, transcripción en tiempo real | [docs/SISTEMA_DICTADO_VOZ_IA.md](./docs/SISTEMA_DICTADO_VOZ_IA.md) |
| **Mejoras UX/UI Historia Clínica** | Diseño, usabilidad, accesibilidad | [docs/MEJORAS_UX_UI_HISTORIA_CLINICA.md](./docs/MEJORAS_UX_UI_HISTORIA_CLINICA.md) |

### 🗓️ Agendas y Disponibilidad

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Sistema Pausar/Reanudar Agendas** | Control de pausas, logs, protecciones | [docs/SISTEMA_PAUSAR_REANUDAR_AGENDAS.md](./docs/SISTEMA_PAUSAR_REANUDAR_AGENDAS.md) |
| **Sistema Pausa Completo** | Implementación detallada backend | [backend/SISTEMA_PAUSA_COMPLETO.md](./backend/SISTEMA_PAUSA_COMPLETO.md) |
| **Múltiples Fechas en Availability** | Creación de agenda para varias fechas a la vez | [MULTIPLE_DATES_AVAILABILITY.md](./MULTIPLE_DATES_AVAILABILITY.md) |

### 📊 Consultas y Metadata

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Mejoras Consultations** | Features y optimizaciones del módulo | [MEJORAS_CONSULTATIONS.md](./MEJORAS_CONSULTATIONS.md) |
| **Mejoras Metadata Consultations** | Campos adicionales, validaciones | [MEJORAS_METADATA_CONSULTATIONS.md](./MEJORAS_METADATA_CONSULTATIONS.md) |
| **Mejora Buscador Consultations** | Búsqueda avanzada, filtros | [MEJORA_BUSCADOR_CONSULTATIONS.md](./MEJORA_BUSCADOR_CONSULTATIONS.md) |
| **Resumen CUPS** | Códigos CUPS, categorías | [RESUMEN_CUPS.md](./RESUMEN_CUPS.md) |

### 🛠️ Mantenimiento y Operaciones

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Guía de Mantenimiento** | Rutinas diarias/semanales/mensuales, backups, troubleshooting | [GUIA_MANTENIMIENTO.md](./GUIA_MANTENIMIENTO.md) |
| **Limpieza BD Completada** | Proceso de limpieza de duplicados y normalización | [LIMPIEZA_BD_COMPLETADA.md](./LIMPIEZA_BD_COMPLETADA.md) |
| **Resumen Duplicados** | Análisis de pacientes duplicados | [RESUMEN_DUPLICADOS.txt](./RESUMEN_DUPLICADOS.txt) |
| **Fix Filtro Citas Canceladas** | Corrección de filtro en cola diaria | [FIX_FILTRO_CITAS_CANCELADAS.md](./FIX_FILTRO_CITAS_CANCELADAS.md) |
| **Auditoría Final** | Revisión completa de sistema y BD | [AUDITORIA_FINAL_CONCLUSION.md](./AUDITORIA_FINAL_CONCLUSION.md) |
| **Auditoría Resumen Final** | Conclusiones y recomendaciones | [AUDITORIA_RESUMEN_FINAL.md](./AUDITORIA_RESUMEN_FINAL.md) |

### 📖 Manuales de Usuario

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Manual de Uso** | Guía completa con screenshots de todas las secciones | [docs/MANUAL_DE_USO.md](./docs/MANUAL_DE_USO.md) |
| **Doctor Portal Resumen** | Guía rápida para doctores | [DOCTOR_PORTAL_RESUMEN.txt](./DOCTOR_PORTAL_RESUMEN.txt) |

### 🤖 MCP y Automatización

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **MCP Server Node** | Implementación Node.js del servidor MCP | [mcp-server-node/README.md](./mcp-server-node/README.md) |
| **MCP Server Python** | 24 herramientas médicas para agentes IA | Ver carpeta `mcp-server-python/` |
| **Agente WhatsApp** | Bot conversacional con Twilio | [agentewhatsapp/README.md](./agentewhatsapp/README.md) |
| **Mejoras Valeria** | IA conversacional para agendamiento | [agentewhatsapp/MEJORAS_VALERIA.md](./agentewhatsapp/MEJORAS_VALERIA.md) |

### 📧 Otros Sistemas

| Documento | Descripción | Ubicación |
|-----------|-------------|-----------|
| **Servidor de Correo** | Configuración SMTP, mailer service | [RESUMEN_SERVIDOR_CORREO.md](./RESUMEN_SERVIDOR_CORREO.md) |

---

## 🚀 Guías de Inicio por Rol

### Para Administradores

1. Lee el [Resumen del Proyecto](./RESUMEN_PROYECTO_COMPLETO.md) para entender la arquitectura
2. Revisa la [Guía de Mantenimiento](./GUIA_MANTENIMIENTO.md) para operaciones diarias
3. Familiarízate con el [Manual de Usuario](./docs/MANUAL_DE_USO.md) para dar soporte

### Para Desarrolladores

1. Lee las [Copilot Instructions](./.github/copilot-instructions.md) para patrones de código
2. Revisa el [Análisis de Tablas BD](./ANALISIS_TABLAS_BD.md) para la estructura de datos
3. Consulta la [Guía de Mantenimiento](./GUIA_MANTENIMIENTO.md) para deployment y actualización
4. Explora los documentos técnicos específicos según el módulo que vayas a trabajar

### Para Doctores

1. Lee el [Doctor Portal Resumen](./DOCTOR_PORTAL_RESUMEN.txt) para inicio rápido
2. Consulta [Sistema Dictado Voz IA](./docs/SISTEMA_DICTADO_VOZ_IA.md) para aprovechar la transcripción
3. Revisa [Sistema Historias Clínicas](./docs/SISTEMA_HISTORIAS_CLINICAS.md) para el flujo completo

### Para Personal Administrativo

1. Lee el [Manual de Usuario](./docs/MANUAL_DE_USO.md) completo
2. Enfócate en las secciones de:
   - Cola de espera
   - Cola diaria
   - Envío de SMS
   - Gestión de pacientes

---

## 🔍 Búsqueda Rápida por Tema

### Autenticación
- [Doctor Login Portal](./DOCTOR_LOGIN_PORTAL.md)
- [Doctor Authentication System](./backend/docs/DOCTOR_AUTHENTICATION_SYSTEM.md)
- [Gestión Contraseñas](./backend/GESTION_CONTRASENA_DOCTORES.md)

### Base de Datos
- [Análisis Tablas](./ANALISIS_TABLAS_BD.md)
- [Limpieza BD](./LIMPIEZA_BD_COMPLETADA.md)
- [Guía Mantenimiento - Sección DB](./GUIA_MANTENIMIENTO.md#gestión-de-base-de-datos)

### Comunicaciones
- [Sistema SMS](./SISTEMA_SMS_RESUMEN.md)
- [Sistema Llamadas](./SISTEMA_LLAMADAS_BD_RESUMEN.md)
- [ElevenLabs Sync](./backend/docs/ELEVENLABS_SYNC_SYSTEM.md)

### Frontend
- [Manual de Uso](./docs/MANUAL_DE_USO.md)
- [Mejoras UX/UI Historia Clínica](./docs/MEJORAS_UX_UI_HISTORIA_CLINICA.md)
- [Copilot Instructions - Frontend]((./.github/copilot-instructions.md#frontend-fronted))

### Backend
- [Resumen Proyecto - Backend](./RESUMEN_PROYECTO_COMPLETO.md#backend-backendsrc)
- [Copilot Instructions - Backend](./.github/copilot-instructions.md#backend-backendsrc)
- [Guía Mantenimiento - Actualización Backend](./GUIA_MANTENIMIENTO.md#backend-nodejs--express)

### Deployment
- [Guía Mantenimiento - Deployment](./GUIA_MANTENIMIENTO.md#-deployment-y-producción)
- [Resumen Proyecto - Deployment](./RESUMEN_PROYECTO_COMPLETO.md#-deployment-y-producción)

---

## 📝 Datos y Archivos de Referencia

### CSVs de Datos
- `DATABASE.csv` - Datos originales del sistema
- `DATABASE_reorganized.csv` - Datos reorganizados
- `NUEVA EPS.csv` - Listado de EPS actualizado
- `NUEVA EPS_CON_ZONA.csv` - EPS con información de zona
- `pacientes_duplicados.csv` - Análisis de duplicados
- `pacientes_encontrados.csv` - Pacientes validados
- `pacientes_no_encontrados.csv` - Pacientes sin validar
- `san_gil.csv`, `san_gil_new.csv`, `socorro.csv` - Datos por sede

### Scripts SQL
- `biosanar (1).sql` - Estructura de BD
- `COMPLETA ANTES DE BORRAR.sql` - Backup pre-limpieza
- `scripts/cleanup_database.sql` - Script de limpieza

### Scripts Shell
- `test_*.sh` - Suite de tests para endpoints
- `scripts/manual/` - Scripts de generación de manual
- `scripts/normalize_all_phones.sh` - Normalización de teléfonos
- `backend/scripts/monitor-sync.sh` - Monitoreo ElevenLabs

---

## 🆘 ¿No encuentras lo que buscas?

1. **Usa la búsqueda de archivos**:
   ```bash
   cd /home/ubuntu/app
   grep -r "palabra_clave" --include="*.md"
   ```

2. **Revisa los commits recientes**:
   ```bash
   git log --oneline --all -20
   git show <commit_hash>
   ```

3. **Consulta el README del módulo específico**:
   - Backend: `/backend/README.md`
   - MCP Node: `/mcp-server-node/README.md`
   - Agente WhatsApp: `/agentewhatsapp/README.md`

4. **Revisa las Copilot Instructions** para convenciones de código:
   - `.github/copilot-instructions.md`

---

## 📊 Estadísticas de Documentación

- **Total de documentos**: 50+ archivos
- **Categorías principales**: 10 (Arquitectura, Pacientes, Comunicaciones, Doctores, etc.)
- **Última actualización**: 1 de noviembre de 2025
- **Idioma**: Español
- **Formato**: Markdown (.md), TXT (.txt), SQL (.sql), CSV (.csv)

---

## 🔄 Mantenimiento de esta Documentación

**Para agregar nueva documentación**:
1. Crea el archivo `.md` en la ubicación apropiada
2. Actualiza este índice con referencia al nuevo documento
3. Commit con mensaje descriptivo: `docs: Add [nombre documento]`

**Para actualizar documentación existente**:
1. Edita el archivo correspondiente
2. Actualiza la fecha al final del documento
3. Commit con mensaje: `docs: Update [nombre documento] - [breve descripción]`

**Regenerar manual de usuario**:
```bash
cd /home/ubuntu/app/scripts/manual
bash run_manual_fixed.sh
```

---

**Sistema**: Biosanarcall Medical System  
**Repositorio**: Callcenter-MCP  
**Última actualización**: 1 de noviembre de 2025  
**Mantenedor**: Equipo Biosanarcall
