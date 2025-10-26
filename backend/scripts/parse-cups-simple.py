#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script simplificado para parsear códigos CUPS del PDF.
Formato esperado:
CODIGO NOMBRE
(línea vacía)
PRECIO
"""

import re
from collections import defaultdict

def determine_category(code):
    """Determina la categoría basada en el código CUPS."""
    code_int = int(code)
    
    if 880000 <= code_int <= 889999:
        return 'Imágenes Diagnósticas'
    elif 890000 <= code_int <= 899999:
        return 'Consultas'
    elif 870000 <= code_int <= 879999:
        return 'Procedimientos Quirúrgicos'
    elif 900000 <= code_int <= 919999:
        return 'Laboratorio'
    elif 920000 <= code_int <= 939999:
        return 'Procedimientos'
    elif 230000 <= code_int <= 239999:
        return 'Radiología'
    else:
        return 'Otros Servicios'

def parse_cups_simple(file_path):
    """Parsea el archivo de texto línea por línea."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = [line.strip() for line in f.readlines()]
    
    cups_dict = {}  # Usar dict para eliminar duplicados automáticamente
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Saltar líneas vacías, encabezados
        if not line or 'codigo cups' in line.lower() or line == 'Monto':
            i += 1
            continue
        
        # Buscar línea con código (6 dígitos al inicio)
        match = re.match(r'^(\d{6})\s+(.+)$', line)
        
        if match:
            code = match.group(1)
            name = match.group(2).strip()
            
            # Si el nombre está cortado, buscar continuación
            i += 1
            continuation_lines = []
            
            # Recoger líneas hasta encontrar precio o siguiente código
            while i < len(lines):
                next_line = lines[i].strip()
                
                # Línea vacía, continuar
                if not next_line:
                    i += 1
                    continue
                
                # Si es un precio (solo dígitos)
                if re.match(r'^\d+$', next_line):
                    price = int(next_line)
                    i += 1
                    
                    # Guardar en dict (sobrescribe duplicados automáticamente)
                    # Mantener el registro con mayor precio
                    if code not in cups_dict or price > cups_dict[code]['price']:
                        full_name = name
                        if continuation_lines:
                            full_name = name + ' ' + ' '.join(continuation_lines)
                        
                        cups_dict[code] = {
                            'code': code,
                            'name': full_name,
                            'price': price,
                            'category': determine_category(code)
                        }
                    break
                
                # Si es otro código CUPS, salir sin precio
                if re.match(r'^\d{6}', next_line):
                    if code not in cups_dict:
                        full_name = name
                        if continuation_lines:
                            full_name = name + ' ' + ' '.join(continuation_lines)
                        
                        cups_dict[code] = {
                            'code': code,
                            'name': full_name,
                            'price': 0,
                            'category': determine_category(code)
                        }
                    break
                
                # Es continuación del nombre
                continuation_lines.append(next_line)
                i += 1
        else:
            i += 1
    
    return list(cups_dict.values())

def generate_sql_bulk(cups_records):
    """Genera SQL con bulk INSERT para mejor rendimiento."""
    
    if not cups_records:
        return []
    
    # Ordenar por código
    sorted_records = sorted(cups_records, key=lambda x: x['code'])
    
    sql_lines = [
        "-- Importación masiva de códigos CUPS",
        "-- Fecha: " + __import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "",
        "USE biosanar;",
        "",
        "-- Comenzar transacción",
        "START TRANSACTION;",
        ""
    ]
    
    # Generar INSERTs individuales con ON DUPLICATE KEY UPDATE
    for record in sorted_records:
        name = record['name'].replace("'", "''")  # Escapar comillas
        code = record['code']
        price = record['price']
        category = record['category']
        
        sql = f"""INSERT INTO cups (code, name, category, base_price, status, complexity_level, requires_authorization, created_at)
VALUES ('{code}', '{name}', '{category}', {price}.00, 'Activo', 'Media', FALSE, NOW())
ON DUPLICATE KEY UPDATE 
    name = VALUES(name),
    base_price = VALUES(base_price),
    category = VALUES(category),
    updated_at = NOW();
"""
        sql_lines.append(sql)
    
    sql_lines.extend([
        "",
        "-- Confirmar transacción",
        "COMMIT;",
        ""
    ])
    
    return sql_lines

def main():
    input_file = '/tmp/cups_data.txt'
    output_file = '/home/ubuntu/app/backend/migrations/import_cups_data.sql'
    
    print("📄 Parseando códigos CUPS...")
    
    cups_records = parse_cups_simple(input_file)
    
    print(f"✅ Encontrados {len(cups_records)} códigos CUPS únicos\n")
    
    # Estadísticas
    categories = defaultdict(int)
    total_price = 0
    max_price = 0
    max_price_code = None
    
    for record in cups_records:
        categories[record['category']] += 1
        total_price += record['price']
        if record['price'] > max_price:
            max_price = record['price']
            max_price_code = record['code']
    
    print("📈 Distribución por categoría:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  • {cat}: {count} códigos")
    
    print(f"\n💰 Estadísticas de precios:")
    print(f"  • Precio promedio: ${total_price // len(cups_records):,}")
    print(f"  • Precio máximo: ${max_price:,} (código {max_price_code})")
    
    # Mostrar muestra
    print(f"\n📋 Muestra de registros:")
    for record in sorted(cups_records, key=lambda x: -x['price'])[:5]:
        name_short = record['name'][:60] + '...' if len(record['name']) > 60 else record['name']
        print(f"  {record['code']} - {name_short} - ${record['price']:,}")
    
    # Generar SQL
    print(f"\n🔄 Generando archivo SQL...")
    sql_lines = generate_sql_bulk(cups_records)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"✅ Archivo generado: {output_file}")
    print(f"📦 Total de statements: {len(cups_records)} INSERTs")
    
    return cups_records

if __name__ == '__main__':
    records = main()
