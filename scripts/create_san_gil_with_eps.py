#!/usr/bin/env python3
"""
Script para crear san_gil.csv con insurance_eps_id=12
"""

import csv

input_file = "/home/ubuntu/app/DATABASE_reorganized.csv"
output_file = "/home/ubuntu/app/san_gil.csv"

with open(input_file, 'r', encoding='utf-8') as infile:
    reader = csv.DictReader(infile)
    
    # Obtener los nombres de las columnas originales y agregar insurance_eps_id
    fieldnames = reader.fieldnames + ['insurance_eps_id']
    
    with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        
        count = 0
        for row in reader:
            # Solo incluir registros con zona = 4
            if row.get('zona') == '4':
                row['insurance_eps_id'] = '12'
                writer.writerow(row)
                count += 1

print(f"✅ Archivo creado: {output_file}")
print(f"📊 Total de registros de zona 4: {count}")
print(f"✅ Columna 'insurance_eps_id' agregada con valor 12")
