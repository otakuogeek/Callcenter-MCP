#!/usr/bin/env python3
"""
Script para analizar pacientes duplicados y generar recomendaciones
"""
import mysql.connector
import csv
from datetime import datetime

# Configuración de la base de datos
DB_CONFIG = {
    'host': '127.0.0.1',
    'user': 'biosanar_user',
    'password': '/6Tx0eXqFQONTFuoc7aqPicNlPhmuINU',
    'database': 'biosanar'
}

def get_duplicates():
    """Obtiene todos los pacientes duplicados con detalles"""
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)
    
    query = """
    SELECT 
        p.id,
        p.name,
        p.document,
        p.phone,
        p.email,
        p.birth_date,
        p.gender,
        p.address,
        eps.name as eps_name,
        p.created_at,
        z.name as zone_name,
        (SELECT COUNT(*) FROM patients WHERE name = p.name AND status = 1) as total_duplicados
    FROM patients p
    LEFT JOIN eps ON p.insurance_eps_id = eps.id
    LEFT JOIN zones z ON p.zone_id = z.id
    WHERE p.status = 1 
    AND p.name IN (
        SELECT name 
        FROM patients 
        WHERE status = 1 
        GROUP BY name 
        HAVING COUNT(*) > 1
    )
    ORDER BY p.name, p.created_at DESC
    """
    
    cursor.execute(query)
    results = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return results

def analyze_duplicates(duplicates):
    """Analiza duplicados y determina cuál conservar"""
    # Agrupar por nombre
    groups = {}
    for patient in duplicates:
        name = patient['name']
        if name not in groups:
            groups[name] = []
        groups[name].append(patient)
    
    # Analizar cada grupo
    recommendations = []
    for name, patients in groups.items():
        # Ordenar por criterios: documento más largo, más reciente
        patients_sorted = sorted(
            patients, 
            key=lambda p: (
                len(str(p['document'])) if p['document'] else 0,  # Documento más completo
                p['created_at'] if p['created_at'] else datetime.min  # Más reciente
            ),
            reverse=True
        )
        
        # El primero es el recomendado para conservar
        for i, patient in enumerate(patients_sorted):
            patient['recomendacion'] = 'CONSERVAR' if i == 0 else 'ELIMINAR'
            patient['razon'] = ''
            
            if i == 0:
                patient['razon'] = 'Documento más completo y registro más reciente'
            else:
                reasons = []
                best = patients_sorted[0]
                
                if len(str(patient['document'])) < len(str(best['document'])):
                    reasons.append('Documento incompleto')
                if patient['created_at'] < best['created_at']:
                    reasons.append('Registro más antiguo')
                if not patient['address'] and best['address']:
                    reasons.append('Sin dirección')
                if not patient['phone'] and best['phone']:
                    reasons.append('Sin teléfono')
                    
                patient['razon'] = ', '.join(reasons) if reasons else 'Duplicado'
            
            recommendations.append(patient)
    
    return recommendations

def export_to_csv(recommendations, filename):
    """Exporta las recomendaciones a CSV"""
    fieldnames = [
        'id', 'name', 'document', 'phone', 'email', 'birth_date', 
        'gender', 'address', 'eps_name', 'zone_name', 'created_at',
        'total_duplicados', 'recomendacion', 'razon'
    ]
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for rec in recommendations:
            # Convertir datetime a string
            row = rec.copy()
            if row.get('created_at'):
                row['created_at'] = row['created_at'].strftime('%Y-%m-%d %H:%M:%S')
            if row.get('birth_date'):
                row['birth_date'] = str(row['birth_date'])
            
            writer.writerow(row)
    
    print(f"✅ Archivo exportado: {filename}")

def print_summary(recommendations):
    """Imprime un resumen del análisis"""
    total = len(recommendations)
    conservar = sum(1 for r in recommendations if r['recomendacion'] == 'CONSERVAR')
    eliminar = sum(1 for r in recommendations if r['recomendacion'] == 'ELIMINAR')
    
    print("\n" + "="*60)
    print("RESUMEN DE PACIENTES DUPLICADOS")
    print("="*60)
    print(f"Total de registros duplicados: {total}")
    print(f"Registros a CONSERVAR: {conservar}")
    print(f"Registros a ELIMINAR: {eliminar}")
    print("="*60)
    
    # Mostrar algunos ejemplos
    print("\nEJEMPLOS DE DUPLICADOS:")
    print("-"*60)
    
    current_name = None
    examples = 0
    for rec in recommendations:
        if rec['name'] != current_name:
            if examples >= 5:  # Mostrar solo 5 ejemplos
                break
            current_name = rec['name']
            examples += 1
            print(f"\n👤 {rec['name']} (Total: {rec['total_duplicados']})")
        
        icon = "✅" if rec['recomendacion'] == 'CONSERVAR' else "❌"
        print(f"  {icon} ID: {rec['id']} | Doc: {rec['document']} | Tel: {rec['phone']}")
        print(f"     {rec['razon']}")

if __name__ == '__main__':
    print("🔍 Analizando pacientes duplicados...")
    
    # Obtener duplicados
    duplicates = get_duplicates()
    print(f"📊 Se encontraron {len(duplicates)} registros duplicados")
    
    # Analizar y generar recomendaciones
    recommendations = analyze_duplicates(duplicates)
    
    # Exportar a CSV
    output_file = '/home/ubuntu/app/pacientes_duplicados_analisis.csv'
    export_to_csv(recommendations, output_file)
    
    # Mostrar resumen
    print_summary(recommendations)
    
    print(f"\n📄 Archivo CSV generado: {output_file}")
    print("🔍 Revisa el archivo para decidir qué registros eliminar")
