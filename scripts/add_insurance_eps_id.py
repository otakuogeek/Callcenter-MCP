#!/usr/bin/env python3
"""
Script para agregar la columna insurance_eps_id con valor 12 a san_gil.csv
"""

import csv

input_file = "/home/ubuntu/app/san_gil.csv"
output_file = "/home/ubuntu/app/san_gil_updated.csv"

# Leer el archivo original
with open(input_file, 'r', encoding='iso-8859-1') as infile:
    reader = csv.reader(infile)
    rows = list(reader)

# Agregar la columna al encabezado
if rows:
    header = rows[0]
    header.append('insurance_eps_id')
    
    # Agregar el valor 12 a cada fila de datos
    for i in range(1, len(rows)):
        rows[i].append('12')

# Escribir el archivo actualizado
with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
    writer = csv.writer(outfile)
    writer.writerows(rows)

print(f"✅ Archivo actualizado: {output_file}")
print(f"📊 Total de registros: {len(rows) - 1}")
print(f"✅ Columna 'insurance_eps_id' agregada con valor 12")
