#!/usr/bin/env python3
import csv
import re
from datetime import datetime

def process_csv_to_sql():
    # Mapeo de tipos de documento CSV a IDs de la base de datos
    document_type_mapping = {
        'CC': 1,
        'CE': 2, 
        'TI': 3,
        'PS': 4,
        'PT': 6,  # Mapear PT a "Otro" 
        'RC': 6,  # Mapear RC a "Otro"
        'NIT': 5
    }
    
    # Mapeo de géneros
    gender_mapping = {
        'M': 'Masculino',
        'F': 'Femenino',
        '': 'No especificado'
    }
    
    sql_statements = []
    errors = []
    
    with open('/home/ubuntu/app/socorro.csv', 'r', encoding='utf-8-sig') as file:  # utf-8-sig para manejar BOM
        reader = csv.DictReader(file)
        
        for row_num, row in enumerate(reader, start=2):  # Start at 2 because of header
            try:
                # Procesar nombre completo
                primer_apellido = row['Primer_Apellido'].strip() if row['Primer_Apellido'] and row['Primer_Apellido'] != 'NULL' else ''
                segundo_apellido = row['Segundo_Apellido'].strip() if row['Segundo_Apellido'] and row['Segundo_Apellido'] != 'NULL' else ''
                primer_nombre = row['Primer_Nombre'].strip() if row['Primer_Nombre'] and row['Primer_Nombre'] != 'NULL' else ''
                segundo_nombre = row['Segundo_Nombre'].strip() if row['Segundo_Nombre'] and row['Segundo_Nombre'] != 'NULL' else ''
                
                # Construir nombre completo
                nombres = []
                if primer_nombre:
                    nombres.append(primer_nombre)
                if segundo_nombre:
                    nombres.append(segundo_nombre)
                if primer_apellido:
                    nombres.append(primer_apellido)
                if segundo_apellido:
                    nombres.append(segundo_apellido)
                
                full_name = ' '.join(nombres)
                
                # Procesar documento
                document = row['Numero_Documento'].strip()
                document_type = row['Tipo_Documento'].strip()
                document_type_id = document_type_mapping.get(document_type, 6)  # Default to "Otro"
                
                # Procesar fecha de nacimiento
                birth_date = None
                if row['Fecha_Nacimiento'] and row['Fecha_Nacimiento'] != 'NULL':
                    try:
                        date_str = row['Fecha_Nacimiento'].strip()
                        # Convertir formato YYYY/MM/DD a YYYY-MM-DD
                        if '/' in date_str:
                            birth_date = date_str.replace('/', '-')
                        else:
                            birth_date = date_str
                        
                        # Validar que la fecha sea válida
                        datetime.strptime(birth_date, '%Y-%m-%d')
                    except:
                        birth_date = None
                
                # Procesar género
                gender = gender_mapping.get(row['Genero'].strip(), 'No especificado')
                
                # Validar que tengamos al menos documento y nombre
                if not document or not full_name:
                    errors.append(f"Fila {row_num}: Documento o nombre vacío")
                    continue
                
                # Escapar comillas simples en strings
                full_name = full_name.replace("'", "\\'")
                document = document.replace("'", "\\'")
                
                # Construir SQL
                sql = f"""INSERT IGNORE INTO patients_socorro (
                    document, 
                    name, 
                    birth_date, 
                    gender, 
                    document_type_id,
                    status,
                    created_at
                ) VALUES (
                    '{document}',
                    '{full_name}',
                    {'NULL' if not birth_date else f"'{birth_date}'"},
                    '{gender}',
                    {document_type_id},
                    'Activo',
                    NOW()
                );"""
                
                sql_statements.append(sql)
                
            except Exception as e:
                errors.append(f"Error en fila {row_num}: {str(e)}")
    
    return sql_statements, errors

# Ejecutar procesamiento
print("Procesando archivo CSV...")
statements, errors = process_csv_to_sql()

print(f"Generadas {len(statements)} sentencias SQL")
if errors:
    print(f"Errores encontrados: {len(errors)}")
    for error in errors[:5]:  # Mostrar solo los primeros 5 errores
        print(f"  {error}")

# Guardar SQL en archivo
with open('/home/ubuntu/app/import_socorro.sql', 'w', encoding='utf-8') as f:
    for statement in statements:
        f.write(statement + '\n')

print("Archivo SQL generado: /home/ubuntu/app/import_socorro.sql")

# Mostrar algunos ejemplos
print("\nEjemplos de sentencias generadas:")
for i, stmt in enumerate(statements[:3]):
    print(f"{i+1}. {stmt[:100]}...")