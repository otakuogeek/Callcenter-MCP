#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para parsear el PDF de códigos CUPS y generar SQL de importación.
"""

import re
import sys
from collections import defaultdict

def clean_text(text):
    """Limpia el texto removiendo caracteres especiales y normalizando espacios."""
    # Normalizar espacios
    text = re.sub(r'\s+', ' ', text)
    # Limpiar caracteres especiales
    text = text.strip()
    return text

def parse_cups_data(file_path):
    """Parsea el archivo de texto extraído del PDF."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    cups_records = []
    
    # Dividir por líneas pero mantener el contexto
    lines = content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Saltar líneas vacías y encabezado
        if not line or 'codigo cups' in line.lower() or 'nombrecups' in line.lower() or line == 'Monto':
            i += 1
            continue
        
        # Buscar código CUPS (6 dígitos al inicio de línea)
        match = re.match(r'^(\d{6})\s*(.*)', line)
        
        if match:
            code = match.group(1)
            name_parts = [match.group(2)] if match.group(2) else []
            
            # Avanzar y recoger las líneas del nombre hasta encontrar el precio
            i += 1
            price = None
            
            while i < len(lines):
                next_line = lines[i].strip()
                
                # Línea vacía, saltar
                if not next_line:
                    i += 1
                    continue
                
                # Si es un número solo, es el precio
                if re.match(r'^\d+$', next_line):
                    price = next_line
                    i += 1
                    break
                
                # Si encuentra otro código CUPS, este registro no tiene precio
                if re.match(r'^\d{6}', next_line):
                    price = "0"
                    break
                
                # Es parte del nombre
                name_parts.append(next_line)
                i += 1
                
                # Límite de seguridad para evitar bucles infinitos
                if len(name_parts) > 10:
                    price = "0"
                    break
            
            # Unir partes del nombre
            name = ' '.join(name_parts)
            name = clean_text(name)
            
            if not name:
                name = f"PROCEDIMIENTO {code}"
            
            if price is None:
                price = "0"
            
            # Determinar categoría
            category = determine_category(code)
            
            cups_records.append({
                'code': code,
                'name': name,
                'price': price,
                'category': category
            })
        else:
            i += 1
    
    return cups_records

def determine_category(code):
    """Determina la categoría basada en el código CUPS."""
    code_int = int(code)
    
    # Rangos comunes de códigos CUPS
    if 880000 <= code_int <= 889999:
        return 'Imágenes Diagnósticas'
    elif 890000 <= code_int <= 899999:
        return 'Consultas'
    elif 870000 <= code_int <= 879999:
        return 'Procedimientos'
    elif 900000 <= code_int <= 919999:
        return 'Laboratorio'
    elif 920000 <= code_int <= 939999:
        return 'Procedimientos'
    else:
        return 'Otros'

def generate_sql(cups_records):
    """Genera el script SQL de importación."""
    
    sql_statements = []
    
    # Eliminar duplicados manteniendo el de mayor precio
    unique_cups = {}
    for record in cups_records:
        code = record['code']
        price = int(record['price'])
        
        if code not in unique_cups or price > int(unique_cups[code]['price']):
            unique_cups[code] = record
    
    # Generar INSERT statements
    for code, record in sorted(unique_cups.items()):
        name = record['name'].replace("'", "''")  # Escapar comillas
        price = record['price']
        category = record['category']
        
        sql = f"""INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization) 
VALUES ('{code}', '{name}', '{category}', {price}.00, 'Activo', 'Media', FALSE)
ON DUPLICATE KEY UPDATE 
  name = VALUES(name),
  base_price = VALUES(base_price),
  updated_at = CURRENT_TIMESTAMP;"""
        
        sql_statements.append(sql)
    
    return sql_statements

def main():
    input_file = '/tmp/cups_data.txt'
    output_file = '/home/ubuntu/app/backend/migrations/import_cups_data.sql'
    
    print(f"📄 Parseando archivo: {input_file}")
    
    cups_records = parse_cups_data(input_file)
    
    print(f"✅ Encontrados {len(cups_records)} registros CUPS")
    
    # Mostrar algunos ejemplos
    print("\n📋 Primeros 5 registros:")
    for record in cups_records[:5]:
        print(f"  {record['code']} - {record['name'][:60]}... - ${record['price']}")
    
    # Generar SQL
    print(f"\n🔄 Generando SQL...")
    sql_statements = generate_sql(cups_records)
    
    # Escribir archivo SQL
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- Importación de códigos CUPS desde PDF\n")
        f.write("-- Generado automáticamente\n\n")
        f.write("USE biosanar;\n\n")
        f.write("\n\n".join(sql_statements))
        f.write("\n")
    
    print(f"✅ SQL generado: {output_file}")
    print(f"📊 Total de códigos únicos: {len(sql_statements)}")
    
    # Estadísticas por categoría
    categories = defaultdict(int)
    for record in cups_records:
        categories[record['category']] += 1
    
    print("\n📈 Distribución por categoría:")
    for cat, count in sorted(categories.items()):
        print(f"  {cat}: {count} códigos")

if __name__ == '__main__':
    main()
