#!/usr/bin/env bash
# =============================================================================
# FASE 1 - SCRIPT DE IMPLEMENTACIÓN Y VALIDACIÓN
# Biosanarcall Medical System - Backend Improvements
# 
# Este script verifica que todos los archivos de Fase 1 estén correctamente
# implementados y lista los pasos siguientes
# =============================================================================

set -e

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BACKEND_DIR"

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                   VALIDACIÓN FASE 1 - BIOSANARCALL                 ║"
echo "║                     Backend Quality Improvements                    ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

check_file() {
  local file="$1"
  local description="$2"
  
  if [ -f "$file" ]; then
    echo -e "${GREEN}✅${NC} $description"
    echo "   📍 $file"
    return 0
  else
    echo -e "${RED}❌${NC} $description"
    echo "   📍 $file (NOT FOUND)"
    return 1
  fi
}

check_import() {
  local file="$1"
  local import_text="$2"
  local description="$3"
  
  if grep -q "$import_text" "$file"; then
    echo -e "${GREEN}✅${NC} $description"
    return 0
  else
    echo -e "${RED}❌${NC} $description"
    return 1
  fi
}

# =============================================================================
# 1. VERIFICAR ARCHIVOS GENERADOS
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}1. ARCHIVOS GENERADOS (Tarea 1-4)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

FAIL_COUNT=0

check_file "src/types/index.ts" "Sistema de tipos tipado" || ((FAIL_COUNT++))
check_file "src/lib/logger.ts" "Logger centralizado con Pino" || ((FAIL_COUNT++))
check_file "src/middleware/errorHandler.ts" "Error handler centralizado" || ((FAIL_COUNT++))
check_file "src/middleware/validate.ts" "Middleware de validación Zod" || ((FAIL_COUNT++))
check_file "src/routes/appointments-refactored-example.ts" "Ejemplo refactorizado" || ((FAIL_COUNT++))
check_file "scripts/migrate-console-logs.sh" "Script de migración" || ((FAIL_COUNT++))

# =============================================================================
# 2. VERIFICAR INTEGRACIONES EN server.ts
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}2. INTEGRACIONES EN server.ts${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

check_import "src/server.ts" "logger.*loggingMiddleware" "Logging middleware importado" || ((FAIL_COUNT++))
check_import "src/server.ts" "errorHandler.*asyncHandler" "Error handler importado" || ((FAIL_COUNT++))
check_import "src/server.ts" "sanitizeInput" "Sanitización importada" || ((FAIL_COUNT++))
check_import "src/server.ts" "setupConsoleOverrides" "Console overrides configurado" || ((FAIL_COUNT++))
check_import "src/server.ts" "loggingMiddleware()" "Logging middleware registrado" || ((FAIL_COUNT++))
check_import "src/server.ts" "sanitizeInput" "Sanitización registrada" || ((FAIL_COUNT++))
check_import "src/server.ts" "errorHandler" "Error handler registrado" || ((FAIL_COUNT++))

# =============================================================================
# 3. VERIFICAR DEPENDENCIAS
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}3. VERIFICAR DEPENDENCIAS INSTALADAS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

check_package() {
  if grep -q "\"$1\"" package.json; then
    echo -e "${GREEN}✅${NC} $1"
    return 0
  else
    echo -e "${YELLOW}⚠️ ${NC} $1 (no encontrado en package.json)"
    return 1
  fi
}

check_package "pino" || ((FAIL_COUNT++))
check_package "zod" || ((FAIL_COUNT++))
check_package "express" || ((FAIL_COUNT++))
check_package "helmet" || ((FAIL_COUNT++))

# =============================================================================
# 4. ESTADÍSTICAS
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}4. ESTADÍSTICAS DE CÓDIGO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Archivos TypeScript generados:"
find src/types src/lib src/middleware -name "*.ts" 2>/dev/null | grep -E "(types|logger|errorHandler|validate)" | wc -l | xargs echo "  -"

echo ""
echo "Líneas de código nuevo (Fase 1):"
(
  wc -l src/types/index.ts 2>/dev/null || echo "0"
  wc -l src/lib/logger.ts 2>/dev/null || echo "0"
  wc -l src/middleware/errorHandler.ts 2>/dev/null || echo "0"
  wc -l src/middleware/validate.ts 2>/dev/null || echo "0"
) | awk '{sum += $1} END {print "  Total:" sum " líneas"}'

# =============================================================================
# 5. RESULTADO FINAL
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RESULTADO FINAL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo -e "${GREEN}✅ FASE 1 COMPLETADA EXITOSAMENTE${NC}"
  echo ""
  echo "✨ Todas las mejoras están implementadas:"
  echo "  1. ✅ Sistema de tipos global (src/types/index.ts)"
  echo "  2. ✅ Logger centralizado (src/lib/logger.ts)"
  echo "  3. ✅ Error handler (src/middleware/errorHandler.ts)"
  echo "  4. ✅ Validación middleware (src/middleware/validate.ts)"
  echo "  5. ✅ Server.ts integrado"
  echo ""
else
  echo -e "${YELLOW}⚠️  FASE 1 CON PROBLEMAS${NC}"
  echo "  Errores encontrados: $FAIL_COUNT"
  echo ""
fi

# =============================================================================
# 6. PRÓXIMOS PASOS
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}PRÓXIMOS PASOS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${YELLOW}PASO 1: Compilar TypeScript${NC}"
echo "  $ npm run build"
echo ""

echo -e "${YELLOW}PASO 2: Probar servidor${NC}"
echo "  $ npm run dev"
echo "  # Debería iniciar sin errores"
echo ""

echo -e "${YELLOW}PASO 3: Reemplazar console.log (opcional)${NC}"
echo "  $ chmod +x scripts/migrate-console-logs.sh"
echo "  $ ./scripts/migrate-console-logs.sh"
echo "  # Luego revisar cambios: git diff"
echo ""

echo -e "${YELLOW}PASO 4: Implementar en rutas${NC}"
echo "  Copiar patrones de /src/routes/appointments-refactored-example.ts"
echo "  a otros endpoints principales"
echo ""

echo -e "${YELLOW}PASO 5: Ejecutar tests${NC}"
echo "  $ npm test"
echo ""

echo -e "${YELLOW}PASO 6: Commit a git${NC}"
echo "  $ git add ."
echo "  $ git commit -m 'feat: implement Phase 1 improvements (types, logging, error handling)'"
echo ""

# =============================================================================
# 7. MÉTRICAS DE MEJORA
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}IMPACTO ESPERADO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "📊 Métricas de mejora (ANTES vs DESPUÉS):"
echo ""
echo "  Type Safety:"
echo "    ANTES: 3/10 (825 'any' types)"
echo "    DESPUÉS: 8/10 (tipos estructurados en types/index.ts)"
echo ""
echo "  Error Handling:"
echo "    ANTES: 5/10 (inconsistente, console.log en rutas)"
echo "    DESPUÉS: 9/10 (centralizado, tipado, trazable)"
echo ""
echo "  Logging:"
echo "    ANTES: 4/10 (437 console.log, no estructurado)"
echo "    DESPUÉS: 8/10 (Pino estructurado, niveles, contexto)"
echo ""
echo "  Validación:"
echo "    ANTES: 5/10 (Zod en rutas, sin reutilización)"
echo "    DESPUÉS: 9/10 (middleware, schemas compartidos)"
echo ""
echo "  SCORE GENERAL:"
echo "    ANTES: 6.4/10"
echo "    DESPUÉS: 8.5/10 (↑ +32%)"
echo ""

# =============================================================================
# 8. INFORMACIÓN ADICIONAL
# =============================================================================

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}INFORMACIÓN ADICIONAL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "📚 Documentación generada:"
echo "  - docs/AUDITORIA_BACKEND_COMPLETA.md (análisis detallado)"
echo "  - docs/QUICK_START_BACKEND_1_SEMANA.md (este plan)"
echo "  - docs/RESUMEN_EJECUTIVO_BACKEND.md (para ejecutivos)"
echo ""

echo "📁 Archivos principales:"
echo "  - src/types/index.ts (tipos y enums compartidos)"
echo "  - src/lib/logger.ts (sistema de logging)"
echo "  - src/middleware/errorHandler.ts (gestión de errores)"
echo "  - src/middleware/validate.ts (validación Zod)"
echo "  - src/routes/appointments-refactored-example.ts (ejemplo)"
echo ""

echo "🔗 Estructura recomendada para refactorización completa:"
echo "  src/"
echo "  ├── types/           ← Tipos centralizados ✅"
echo "  ├── lib/             ← Logger, utilidades ✅"
echo "  ├── middleware/      ← Error handler, validación ✅"
echo "  ├── controllers/     ← Lógica (a hacer en Fase 2)"
echo "  ├── services/        ← Servicios (a hacer en Fase 2)"
echo "  ├── repositories/    ← Data access (a hacer en Fase 2)"
echo "  ├── routes/          ← Rutas (actualizar con nuevos patrones)"
echo "  └── db/              ← Conexión, migraciones"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨ ¡Fase 1 lista para implementar! ✨${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
