#!/usr/bin/env python3
"""
Script para actualizar zone_id en patients_cp basado en la columna zona
"""

import mysql.connector
from mysql.connector import Error
import sys

# Configuración de la base de datos
DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 3306,
    'user': 'biosanar_user',
    'password': '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
    'database': 'biosanar'
}

def connect_db():
    """Conectar a la base de datos"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        if conn.is_connected():
            print("✅ Conexión exitosa a la base de datos")
            return conn
    except Error as e:
        print(f"❌ Error al conectar a la base de datos: {e}")
        return None

def update_zone_relationships(conn):
    """Actualizar zone_id en patients_cp basado en la columna zona"""
    cursor = conn.cursor()
    
    try:
        # Mapeo de nombres de zona a zone_id
        zone_mapping = {
            'SAN GIL': 4,  # Zona San Gil
            'SOCORRO': 3,  # Zona de Socorro
        }
        
        total_updated = 0
        
        print("\n🔄 Actualizando relaciones zone_id en patients_cp...")
        
        for zona_name, zone_id in zone_mapping.items():
            # Actualizar zone_id basado en el valor de la columna zona
            cursor.execute("""
                UPDATE patients_cp 
                SET zone_id = %s 
                WHERE zona = %s AND (zone_id IS NULL OR zone_id != %s)
            """, (zone_id, zona_name, zone_id))
            
            rows_affected = cursor.rowcount
            total_updated += rows_affected
            
            print(f"   ✅ Zona '{zona_name}' → zone_id {zone_id}: {rows_affected} registros actualizados")
        
        # Establecer zone_id a NULL para otras zonas
        cursor.execute("""
            UPDATE patients_cp 
            SET zone_id = NULL 
            WHERE zona NOT IN ('SAN GIL', 'SOCORRO') 
            AND zone_id IS NOT NULL
        """)
        
        rows_nullified = cursor.rowcount
        if rows_nullified > 0:
            print(f"   ℹ️  {rows_nullified} registros con otras zonas establecidos a NULL")
        
        # Commit de los cambios
        conn.commit()
        
        print(f"\n✅ Total de registros actualizados: {total_updated}")
        
        # Mostrar estadísticas finales
        print("\n📊 Distribución final de zone_id:")
        cursor.execute("""
            SELECT 
                z.id as zone_id,
                z.name as zone_name,
                COUNT(p.id) as total_pacientes
            FROM zones z
            LEFT JOIN patients_cp p ON p.zone_id = z.id
            GROUP BY z.id, z.name
            ORDER BY z.id
        """)
        
        for zone_id, zone_name, count in cursor.fetchall():
            print(f"   Zone ID {zone_id} ({zone_name}): {count} pacientes")
        
        # Mostrar pacientes sin zone_id asignado
        cursor.execute("""
            SELECT COUNT(*) 
            FROM patients_cp 
            WHERE zone_id IS NULL
        """)
        null_count = cursor.fetchone()[0]
        print(f"   Sin zone_id asignado: {null_count} pacientes")
        
        # Mostrar resumen por zona (texto)
        print("\n📍 Resumen por zona (columna texto):")
        cursor.execute("""
            SELECT zona, zone_id, COUNT(*) as total
            FROM patients_cp
            GROUP BY zona, zone_id
            ORDER BY total DESC
        """)
        
        for zona, zone_id, count in cursor.fetchall():
            zone_id_str = str(zone_id) if zone_id else "NULL"
            print(f"   '{zona}' (zone_id: {zone_id_str}): {count} registros")
        
        return True
        
    except Exception as e:
        print(f"❌ Error al actualizar relaciones: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        cursor.close()

def main():
    print("🔄 Actualizando relaciones zone_id en patients_cp...")
    print(f"🗄️  Base de datos: {DB_CONFIG['database']}")
    print(f"📋 Tabla: patients_cp\n")
    
    # Conectar a la base de datos
    conn = connect_db()
    if not conn:
        sys.exit(1)
    
    # Actualizar relaciones
    success = update_zone_relationships(conn)
    
    # Cerrar conexión
    conn.close()
    print("\n🔒 Conexión cerrada")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
