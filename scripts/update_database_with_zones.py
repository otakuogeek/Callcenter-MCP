#!/usr/bin/env python3
"""
Script para actualizar la base de datos MySQL con los datos reorganizados del CSV
incluyendo la columna de zona geográfica
"""

import csv
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

def add_zone_column(cursor):
    """Agregar columna 'zona' a la tabla patients_cp si no existe"""
    try:
        # Verificar si la columna ya existe
        cursor.execute("""
            SELECT COUNT(*) 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = 'biosanar' 
            AND TABLE_NAME = 'patients_cp' 
            AND COLUMN_NAME = 'zona'
        """)
        exists = cursor.fetchone()[0]
        
        if exists == 0:
            cursor.execute("""
                ALTER TABLE patients_cp 
                ADD COLUMN zona VARCHAR(100) DEFAULT 'NO ESPECIFICADA' 
                AFTER address
            """)
            print("✅ Columna 'zona' agregada a la tabla patients_cp")
        else:
            print("ℹ️  Columna 'zona' ya existe en la tabla")
        
        return True
    except Error as e:
        print(f"❌ Error al agregar columna zona: {e}")
        return False

def update_patient_zone(cursor, document, zona):
    """Actualizar la zona de un paciente basado en el documento"""
    try:
        cursor.execute("""
            UPDATE patients_cp 
            SET zona = %s 
            WHERE document = %s
        """, (zona, document))
        return cursor.rowcount
    except Error as e:
        print(f"❌ Error al actualizar paciente {document}: {e}")
        return 0

def process_csv_and_update(csv_file, conn):
    """Procesar el CSV y actualizar la base de datos"""
    cursor = conn.cursor()
    
    # Agregar columna zona si no existe
    if not add_zone_column(cursor):
        return False
    
    conn.commit()
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            updated_count = 0
            not_found_count = 0
            total_count = 0
            
            print("\n🔄 Actualizando zonas en la base de datos...")
            
            for row in reader:
                total_count += 1
                document = row.get('document', '').strip()
                zona = row.get('zona', 'NO ESPECIFICADA').strip()
                
                if not document:
                    continue
                
                rows_affected = update_patient_zone(cursor, document, zona)
                
                if rows_affected > 0:
                    updated_count += rows_affected
                else:
                    not_found_count += 1
                
                # Commit cada 100 registros para mejor rendimiento
                if total_count % 100 == 0:
                    conn.commit()
                    print(f"   Procesados: {total_count} | Actualizados: {updated_count} | No encontrados: {not_found_count}", end='\r')
            
            # Commit final
            conn.commit()
            
            print(f"\n\n✅ Proceso completado:")
            print(f"   📊 Total de registros en CSV: {total_count}")
            print(f"   ✅ Pacientes actualizados: {updated_count}")
            print(f"   ⚠️  No encontrados en BD: {not_found_count}")
            
            # Mostrar estadísticas de zonas en la BD
            print("\n📍 Distribución de zonas en la base de datos:")
            cursor.execute("""
                SELECT zona, COUNT(*) as total 
                FROM patients_cp 
                GROUP BY zona 
                ORDER BY total DESC
            """)
            
            for zona, count in cursor.fetchall():
                percentage = (count / updated_count * 100) if updated_count > 0 else 0
                print(f"   {zona}: {count} ({percentage:.1f}%)")
            
            return True
            
    except Exception as e:
        print(f"❌ Error al procesar el CSV: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        cursor.close()

def main():
    csv_file = "/home/ubuntu/app/DATABASE_reorganized.csv"
    
    print("🔄 Actualizando base de datos con zonas desde CSV...")
    print(f"📂 Archivo CSV: {csv_file}")
    print(f"🗄️  Base de datos: {DB_CONFIG['database']}")
    print(f"📋 Tabla: patients_cp\n")
    
    # Conectar a la base de datos
    conn = connect_db()
    if not conn:
        sys.exit(1)
    
    # Procesar y actualizar
    success = process_csv_and_update(csv_file, conn)
    
    # Cerrar conexión
    conn.close()
    print("\n🔒 Conexión cerrada")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
