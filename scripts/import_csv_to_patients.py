#!/usr/bin/env python3
"""
Script para importar pacientes del CSV san_gil.csv a la tabla patients_cp
"""

import csv
import mysql.connector
from mysql.connector import Error
from datetime import datetime
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

def parse_date(date_str):
    """Convertir fecha del formato DD/MM/YYYY a YYYY-MM-DD"""
    if not date_str or date_str.strip() == '':
        return None
    
    try:
        # Intentar formato DD/MM/YYYY
        date_obj = datetime.strptime(date_str.strip(), '%d/%m/%Y')
        return date_obj.strftime('%Y-%m-%d')
    except:
        try:
            # Intentar formato DD/MM/YY
            date_obj = datetime.strptime(date_str.strip(), '%d/%m/%y')
            return date_obj.strftime('%Y-%m-%d')
        except:
            return None

def parse_gender(gender_str):
    """Convertir género del CSV al formato de la BD"""
    if not gender_str:
        return 'No especificado'
    
    gender = gender_str.strip().upper()
    if gender == 'M':
        return 'Masculino'
    elif gender == 'F':
        return 'Femenino'
    else:
        return 'No especificado'

def import_patients(csv_file, conn):
    """Importar pacientes del CSV a la base de datos"""
    cursor = conn.cursor()
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            inserted = 0
            updated = 0
            errors = 0
            skipped = 0
            
            print("\n🔄 Importando pacientes del CSV a patients_cp...\n")
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    # Extraer datos del CSV
                    document = row.get('document', '').strip()
                    full_name = row.get('full_name', '').strip()
                    phone = row.get('TELEFONO RESIDENCIA', '').strip()
                    birth_date = parse_date(row.get('FECHA NACIMIENTO', ''))
                    gender = parse_gender(row.get('TIPO SEXO', ''))
                    address = row.get('DIRECCION RESIDENCIA', '').strip()
                    zone_id = row.get('zona', '').strip()  # Será 4 para San Gil
                    insurance_eps_id = row.get('insurance_eps_id', '').strip()
                    
                    # Validar documento
                    if not document:
                        skipped += 1
                        continue
                    
                    # Convertir zone_id e insurance_eps_id a números o NULL
                    zone_id = int(zone_id) if zone_id and zone_id.isdigit() else None
                    insurance_eps_id = int(insurance_eps_id) if insurance_eps_id and insurance_eps_id.isdigit() else None
                    
                    # Verificar si el paciente ya existe
                    cursor.execute("SELECT id FROM patients_cp WHERE document = %s", (document,))
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Actualizar paciente existente
                        patient_id = existing[0]
                        cursor.execute("""
                            UPDATE patients_cp 
                            SET name = %s,
                                phone = %s,
                                birth_date = %s,
                                gender = %s,
                                address = %s,
                                zone_id = %s,
                                insurance_eps_id = %s,
                                status = 'Activo'
                            WHERE id = %s
                        """, (full_name, phone, birth_date, gender, address, zone_id, insurance_eps_id, patient_id))
                        updated += 1
                    else:
                        # Insertar nuevo paciente
                        cursor.execute("""
                            INSERT INTO patients_cp 
                            (document, name, phone, birth_date, gender, address, zone_id, insurance_eps_id, status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'Activo')
                        """, (document, full_name, phone, birth_date, gender, address, zone_id, insurance_eps_id))
                        inserted += 1
                    
                    # Commit cada 100 registros
                    if (inserted + updated) % 100 == 0:
                        conn.commit()
                        print(f"   Procesados: {inserted + updated + errors + skipped} | Insertados: {inserted} | Actualizados: {updated} | Errores: {errors} | Omitidos: {skipped}", end='\r')
                
                except Exception as e:
                    errors += 1
                    print(f"\n⚠️  Error en fila {row_num} (Doc: {document}): {e}")
                    continue
            
            # Commit final
            conn.commit()
            
            print(f"\n\n✅ PROCESO COMPLETADO:")
            print(f"   ✅ Pacientes insertados: {inserted}")
            print(f"   🔄 Pacientes actualizados: {updated}")
            print(f"   ⚠️  Errores: {errors}")
            print(f"   ⏭️  Omitidos (sin documento): {skipped}")
            print(f"   📊 Total procesado: {inserted + updated + errors + skipped}")
            
            # Mostrar estadísticas de la tabla
            print("\n📊 Estadísticas de patients_cp:")
            cursor.execute("SELECT COUNT(*) FROM patients_cp")
            total = cursor.fetchone()[0]
            print(f"   Total de pacientes: {total}")
            
            cursor.execute("SELECT COUNT(*) FROM patients_cp WHERE zone_id = 4")
            zone_4 = cursor.fetchone()[0]
            print(f"   Pacientes zona San Gil (zone_id=4): {zone_4}")
            
            cursor.execute("SELECT COUNT(*) FROM patients_cp WHERE insurance_eps_id = 12")
            eps_12 = cursor.fetchone()[0]
            print(f"   Pacientes con EPS 12: {eps_12}")
            
            return True
            
    except Exception as e:
        print(f"❌ Error al importar pacientes: {e}")
        import traceback
        traceback.print_exc()
        conn.rollback()
        return False
    finally:
        cursor.close()

def main():
    csv_file = "/home/ubuntu/app/san_gil.csv"
    
    print("🔄 Importando pacientes del CSV a la base de datos...")
    print(f"📂 Archivo CSV: {csv_file}")
    print(f"🗄️  Tabla destino: patients_cp")
    print(f"📋 Zona: 4 (San Gil)")
    print(f"🏥 EPS: 12\n")
    
    # Conectar a la base de datos
    conn = connect_db()
    if not conn:
        sys.exit(1)
    
    # Importar pacientes
    success = import_patients(csv_file, conn)
    
    # Cerrar conexión
    conn.close()
    print("\n🔒 Conexión cerrada")
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
