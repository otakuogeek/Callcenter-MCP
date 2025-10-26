#!/usr/bin/env python3
"""
Script para verificar qué pacientes del CSV ya están en patients_cp
"""

import csv
import mysql.connector
from mysql.connector import Error

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

def verify_patients(csv_file, conn):
    """Verificar qué pacientes del CSV están en la BD"""
    cursor = conn.cursor()
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            total_csv = 0
            found_in_db = 0
            not_found = 0
            found_documents = []
            not_found_documents = []
            
            print("\n🔍 Verificando pacientes del CSV en la base de datos...\n")
            
            for row in reader:
                total_csv += 1
                document = row.get('document', '').strip()
                full_name = row.get('full_name', '').strip()
                
                if not document:
                    continue
                
                # Buscar el documento en la BD
                cursor.execute("""
                    SELECT id, document, name, zone_id 
                    FROM patients_cp 
                    WHERE document = %s
                """, (document,))
                
                result = cursor.fetchone()
                
                if result:
                    found_in_db += 1
                    patient_id, db_document, db_name, zone_id = result
                    found_documents.append({
                        'document': document,
                        'csv_name': full_name,
                        'db_name': db_name,
                        'zone_id': zone_id,
                        'patient_id': patient_id
                    })
                else:
                    not_found += 1
                    not_found_documents.append({
                        'document': document,
                        'name': full_name
                    })
            
            # Mostrar estadísticas
            print(f"📊 ESTADÍSTICAS:")
            print(f"   Total en CSV: {total_csv}")
            print(f"   ✅ Encontrados en BD: {found_in_db} ({(found_in_db/total_csv*100):.1f}%)")
            print(f"   ❌ NO encontrados en BD: {not_found} ({(not_found/total_csv*100):.1f}%)")
            
            # Mostrar algunos ejemplos de encontrados
            print(f"\n✅ EJEMPLOS DE PACIENTES ENCONTRADOS (primeros 10):")
            for i, patient in enumerate(found_documents[:10], 1):
                zone_str = f"zone_id: {patient['zone_id']}" if patient['zone_id'] else "sin zona"
                print(f"   {i}. Doc: {patient['document']} - {patient['db_name']} ({zone_str})")
            
            # Mostrar algunos ejemplos de no encontrados
            if not_found > 0:
                print(f"\n❌ EJEMPLOS DE PACIENTES NO ENCONTRADOS (primeros 10):")
                for i, patient in enumerate(not_found_documents[:10], 1):
                    print(f"   {i}. Doc: {patient['document']} - {patient['name']}")
            
            # Guardar listas completas en archivos
            if found_documents:
                with open('/home/ubuntu/app/pacientes_encontrados.csv', 'w', encoding='utf-8', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=['patient_id', 'document', 'csv_name', 'db_name', 'zone_id'])
                    writer.writeheader()
                    writer.writerows(found_documents)
                print(f"\n💾 Lista completa de encontrados guardada en: pacientes_encontrados.csv")
            
            if not_found_documents:
                with open('/home/ubuntu/app/pacientes_no_encontrados.csv', 'w', encoding='utf-8', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=['document', 'name'])
                    writer.writeheader()
                    writer.writerows(not_found_documents)
                print(f"💾 Lista completa de NO encontrados guardada en: pacientes_no_encontrados.csv")
            
            return True
            
    except Exception as e:
        print(f"❌ Error al verificar pacientes: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        cursor.close()

def main():
    csv_file = "/home/ubuntu/app/san_gil.csv"
    
    print("🔄 Verificando pacientes del CSV en la base de datos...")
    print(f"📂 Archivo CSV: {csv_file}")
    print(f"🗄️  Tabla: patients_cp\n")
    
    conn = connect_db()
    if not conn:
        return 1
    
    success = verify_patients(csv_file, conn)
    
    conn.close()
    print("\n🔒 Conexión cerrada")
    
    return 0 if success else 1

if __name__ == "__main__":
    exit(main())
