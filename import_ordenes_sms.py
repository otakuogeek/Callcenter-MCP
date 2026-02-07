#!/usr/bin/env python3
"""
Script para importar SMS desde ordenes.csv a sms_logs
Verifica duplicados antes de insertar
"""

import csv
import mysql.connector
from datetime import datetime
import re

# Configuración de base de datos
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'biosanar_user',
    'password': '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
    'database': 'biosanar'
}

def parse_csv_with_multiline(filepath):
    """Parsea CSV con mensajes que tienen saltos de línea"""
    records = []
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Usar regex para extraer cada registro completo
    # Formato: "id";"sender";"phone";"message";"sent_date";"cost";"status";"updated_date";"extra"
    pattern = r'"(\d+)";"([^"]*)";"([^"]*)";"(.*?)";"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})";"([^"]*)";"([^"]*)";"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})";"(\d+)"'
    
    matches = re.findall(pattern, content, re.DOTALL)
    
    for match in matches:
        external_id, sender, phone, message, sent_date, cost, status, updated_date, extra = match
        records.append({
            'external_id': external_id,
            'sender': sender,
            'phone': phone.strip(),
            'message': message.strip(),
            'sent_date': sent_date,
            'cost': float(cost) if cost and cost != '0' else 0.0,
            'status': status,
            'updated_date': updated_date
        })
    
    return records

def map_status(csv_status):
    """Mapea estado del CSV al enum de la BD"""
    status_lower = csv_status.lower()
    if 'aprobado' in status_lower:
        return 'success'
    elif 'no enviado' in status_lower or 'incorrecto' in status_lower:
        return 'failed'
    else:
        return 'pending'

def import_sms(records):
    """Importa registros verificando duplicados"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    
    inserted = 0
    duplicates = 0
    errors = 0
    
    for record in records:
        try:
            # Verificar si ya existe por número + fecha de envío (± 5 segundos)
            check_query = """
                SELECT id FROM sms_logs 
                WHERE recipient_number = %s 
                AND ABS(TIMESTAMPDIFF(SECOND, sent_at, %s)) < 60
                AND message = %s
                LIMIT 1
            """
            cursor.execute(check_query, (record['phone'], record['sent_date'], record['message']))
            existing = cursor.fetchone()
            
            if existing:
                duplicates += 1
                continue
            
            # Insertar nuevo registro
            insert_query = """
                INSERT INTO sms_logs (
                    recipient_number, 
                    message, 
                    sender_id,
                    status,
                    cost,
                    sent_at,
                    created_at,
                    error_message
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            db_status = map_status(record['status'])
            error_msg = record['status'] if db_status == 'failed' else None
            
            cursor.execute(insert_query, (
                record['phone'],
                record['message'],
                record['sender'],
                db_status,
                record['cost'],
                record['sent_date'],
                record['sent_date'],
                error_msg
            ))
            inserted += 1
            
        except Exception as e:
            errors += 1
            print(f"Error con registro {record['external_id']}: {e}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return inserted, duplicates, errors

def main():
    print("=" * 50)
    print("Importación de SMS desde ordenes.csv")
    print("=" * 50)
    
    # Parsear CSV
    print("\n📄 Leyendo archivo ordenes.csv...")
    records = parse_csv_with_multiline('/home/ubuntu/app/ordenes.csv')
    print(f"   Registros encontrados: {len(records)}")
    
    if not records:
        print("❌ No se encontraron registros para importar")
        return
    
    # Mostrar preview
    print("\n📋 Preview de primeros 3 registros:")
    for i, r in enumerate(records[:3]):
        print(f"   {i+1}. Tel: {r['phone']}, Fecha: {r['sent_date']}, Status: {r['status']}")
    
    # Confirmar
    print(f"\n⚠️  Se procesarán {len(records)} registros")
    
    # Importar
    print("\n🔄 Importando datos...")
    inserted, duplicates, errors = import_sms(records)
    
    print("\n" + "=" * 50)
    print("📊 RESULTADO:")
    print(f"   ✅ Insertados: {inserted}")
    print(f"   ⏭️  Duplicados (omitidos): {duplicates}")
    print(f"   ❌ Errores: {errors}")
    print("=" * 50)

if __name__ == '__main__':
    main()
