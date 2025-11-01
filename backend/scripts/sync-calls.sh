#!/bin/bash
# Script para sincronizar llamadas de ElevenLabs
# Uso: ./scripts/sync-calls.sh [limit]

cd "$(dirname "$0")/.."

LIMIT=${1:-100}

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   🔄 SINCRONIZACIÓN DE LLAMADAS ELEVENLABS                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Límite: $LIMIT llamadas"
echo ""

# Cargar .env y ejecutar
source .env 2>/dev/null || true

NODE_ENV=production node -e "
require('dotenv').config();
const { ElevenLabsSync } = require('./dist/src/services/elevenLabsSync');

async function sync() {
  try {
    console.log('[Sync] Starting...');
    const result = await ElevenLabsSync.syncLatestCalls($LIMIT);
    console.log('');
    console.log('✅ Sincronizadas:', result.synced);
    console.log('❌ Errores:', result.errors);
    process.exit(result.errors > 0 ? 1 : 0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

sync();
"
