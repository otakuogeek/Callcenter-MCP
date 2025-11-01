#!/bin/bash
# Monitor de sincronización de llamadas ElevenLabs

echo "╔════════════════════════════════════════════════════════════╗"
echo "║   📊 MONITOR DE SINCRONIZACIÓN - LLAMADAS ELEVENLABS      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

while true; do
  clear
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║   📊 MONITOR DE SINCRONIZACIÓN - LLAMADAS ELEVENLABS      ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  echo "🕐 $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  
  # Estado del proceso
  if ps aux | grep -q "[s]ync-calls.sh"; then
    echo "✅ Estado: SINCRONIZANDO"
  else
    echo "⏸️  Estado: DETENIDO"
  fi
  echo ""
  
  # Estadísticas de la base de datos
  echo "📊 ESTADÍSTICAS DE BASE DE DATOS:"
  mysql -h127.0.0.1 -ubiosanar_user -p'/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU' biosanar -e "
    SELECT 
      COUNT(*) as 'Total Llamadas',
      COUNT(DISTINCT caller_number) as 'Números Únicos',
      COUNT(caller_number) as 'Con Número',
      COUNT(*) - COUNT(caller_number) as 'Sin Número',
      MIN(DATE(started_at)) as 'Primera',
      MAX(DATE(started_at)) as 'Última'
    FROM elevenlabs_calls
  " 2>/dev/null
  
  echo ""
  echo "📈 ÚLTIMOS LOTES SINCRONIZADOS:"
  tail -50 /tmp/sync_full.log 2>/dev/null | grep -E "(Lote|Sincronizadas|Errores)" | tail -10
  
  echo ""
  echo "Presiona Ctrl+C para salir"
  sleep 5
done
