#!/usr/bin/env python3
"""
Script para reorganizar nombres en DATABASE.csv
De: PRIMER APELLIDO, SEGUNDO APELLIDO, NOMBRES (columnas separadas)
A: NOMBRES PRIMER_APELLIDO SEGUNDO_APELLIDO (una sola columna)
"""

import csv
import sys

def reorganize_names(input_file, output_file):
    """
    Lee el CSV original y reorganiza los nombres en una sola columna
    """
    try:
        with open(input_file, 'r', encoding='iso-8859-1') as infile:
            reader = csv.DictReader(infile)
            
            # Preparar nuevas columnas
            fieldnames = ['id', 'external_id', 'document', 'full_name', 'TIPO SEXO', 
                         'DIRECCION RESIDENCIA', 'TELEFONO RESIDENCIA', 'FECHA NACIMIENTO']
            
            rows_processed = 0
            rows_output = []
            
            for row in reader:
                # Obtener los componentes del nombre
                nombres = row.get('NOMBRES', '').strip()
                primer_apellido = row.get('PRIMER APELLIDO', '').strip()
                segundo_apellido = row.get('SEGUNDO APELLIDO', '').strip()
                
                # Combinar en formato: NOMBRES PRIMER_APELLIDO SEGUNDO_APELLIDO
                full_name_parts = []
                if nombres:
                    full_name_parts.append(nombres)
                if primer_apellido:
                    full_name_parts.append(primer_apellido)
                if segundo_apellido:
                    full_name_parts.append(segundo_apellido)
                
                full_name = ' '.join(full_name_parts)
                
                # Crear nueva fila
                new_row = {
                    'id': row.get('id', ''),
                    'external_id': row.get('external_id', ''),
                    'document': row.get('document', ''),
                    'full_name': full_name,
                    'TIPO SEXO': row.get('TIPO SEXO', ''),
                    'DIRECCION RESIDENCIA': row.get('DIRECCION RESIDENCIA', ''),
                    'TELEFONO RESIDENCIA': row.get('TELEFONO RESIDENCIA', ''),
                    'FECHA NACIMIENTO': row.get('FECHA NACIMIENTO', '')
                }
                
                rows_output.append(new_row)
                rows_processed += 1
        
        # Escribir el nuevo CSV
        with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows_output)
        
        print(f"✅ Proceso completado exitosamente")
        print(f"📊 Filas procesadas: {rows_processed}")
        print(f"💾 Archivo generado: {output_file}")
        
        # Mostrar algunos ejemplos
        print("\n📋 Ejemplos de nombres reorganizados:")
        for i, row in enumerate(rows_output[:5], 1):
            print(f"  {i}. {row['full_name']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error al procesar el archivo: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    input_file = "/home/ubuntu/app/DATABASE.csv"
    output_file = "/home/ubuntu/app/DATABASE_reorganized.csv"
    
    print("🔄 Reorganizando nombres en el CSV...")
    print(f"📂 Archivo entrada: {input_file}")
    print(f"📂 Archivo salida: {output_file}")
    print()
    
    success = reorganize_names(input_file, output_file)
    sys.exit(0 if success else 1)
