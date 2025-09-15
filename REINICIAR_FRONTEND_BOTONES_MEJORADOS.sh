#!/bin/bash

echo "🚀 REINICIANDO FRONTEND CON BOTONES MEJORADOS - Biosanarcall"
echo "============================================================="
echo ""

echo "🔧 Aplicando mejoras al botón 'Registrar Cita':"
echo "   ✅ Banner verde prominente en cards activos"
echo "   ✅ Botón grande 'Registrar Cita Ahora' con contador de cupos"
echo "   ✅ Botón adicional en el header del card"
echo "   ✅ Múltiples puntos de acceso para mejor UX"
echo ""

echo "📱 Mejoras implementadas:"
echo "   - Banner verde superior: '¡Cupos Disponibles!' con botón"
echo "   - Botón central grande: 'Registrar Cita Ahora' con animaciones"
echo "   - Badge animado: 'X disponibles' en el header"
echo "   - Botón compacto: 'Registrar Cita' en el header"
echo ""

echo "🎯 Ahora deberías ver:"
echo "   1. Banner verde en la parte superior del card de la Dra. Valentina"
echo "   2. Mensaje '¡Cupos Disponibles! 8 de 8 cupos libres'"
echo "   3. Botón blanco 'Registrar Cita' prominente a la derecha"
echo "   4. Botón central 'Registrar Cita Ahora' con contador de cupos"
echo ""

# Compilar frontend
echo "🔄 Compilando frontend..."
cd /home/ubuntu/app/frontend
npm run build

echo ""
echo "✅ Frontend compilado exitosamente"
echo ""
echo "📋 INSTRUCCIONES:"
echo "   1. Ve a la sección de Gestión de Citas"
echo "   2. Busca la agenda de la Dra. Valentina Abaunza Ballesteros"
echo "   3. Verás múltiples botones 'Registrar Cita' prominentes"
echo "   4. Haz clic en cualquiera para abrir el modal de registro rápido"
echo ""

echo "🎊 ¡Los botones ahora son súper visibles!"