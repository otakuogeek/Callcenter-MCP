#!/usr/bin/env python3
"""
Script para reorganizar nombres en DATABASE.csv y agregar clasificación de zona
De: PRIMER APELLIDO, SEGUNDO APELLIDO, NOMBRES (columnas separadas)
A: NOMBRES PRIMER_APELLIDO SEGUNDO_APELLIDO (una sola columna) + ZONA
"""

import csv
import re
import sys

def identify_zone(address):
    """
    Identifica la zona geográfica basándose en la dirección
    """
    if not address:
        return "NO ESPECIFICADA"
    
    # Convertir a mayúsculas para búsqueda insensible a mayúsculas
    addr_upper = address.upper()
    
    # Municipios de la Provincia de San Gil (Santander)
    # Estos municipios pertenecen a San Gil, por lo que se clasificarán como SAN GIL
    san_gil_municipalities = {
        'SAN GIL': [
            r'\bSAN\s*GIL\b',
            r'\bSGIL\b',
            r'\bS\.GIL\b',
            r'\bSANGIL\b',
            r'\bSAN\s*G',
            r'\bS\s*GIL\b',
            # Variaciones mal escritas o cortadas
            r'SAN\s*SANAS',
            r'SAN\s*SANTAS',
            r'SAN\s*SAN\b',
            r'SANTNADER',
            r'SATNADER',
            r'SATANDER',
            r'SANANDER',
            r'SANANDERS',
            r'SANTANDERS',
            r'SANTANDR',
            r'SANTASS',
            r'SANTSAS',
            r'\bSNAT\b',
            r'\bSANT\b$',
            r'\bSANAS\b',
            r'\bSANTAS\b',
            r'\bSASAS\b',
            r'\bSASASS\b',
            r'\bSAAS\b',
            r'\bSSSS\b',
            r'\bSSS\b',
            r'\bSS\b$',
            r'\bSANA\b$',
            r'\bSNT\b',
            r'SANNN',
            r'SANSS',
            r'SASA$',
            # Barrios conocidos de San Gil
            r'LA\s*GRUTA',
            r'RAGONESS',
            r'FATIMA',
            r'MARIA\s*AUXILIADORA',
            r'ALTAMIRA',
            r'ALAMEDA\s*REAL',
            r'VILLA\s*OLIMPICA',
            r'PROVIVIENDA',
            r'BELLA\s*ISLA',
            r'CIUDADELA\s*DEL\s*FONCE',
            r'VISTA\s*CAMPESTRE',
            r'ALTOS\s*DE\s*SAN\s*JORGE',
            r'TORRES\s*DEL\s*CASTILLO',
            r'PASEO\s*DEL\s*MANGO',
            r'SAN\s*JUAN\s*DE\s*DIOS',
            r'SIMON\s*BOLIVAR',
            r'DIVINO\s*NI.O',
            r'PEDRO\s*FERMIN',
            r'PORTAL\s*DE\s*LA\s*CRUZ',
            r'SAN\s*CARLOS',
            r'SAN\s*ROQUE'
        ],
        'ARATOCA': [
            r'\bARATOCA\b',
            r'\bARATOKA\b'
        ],
        'BARICHARA': [
            r'\bBARICHARA\b',
            r'\bBARICHARARA\b'
        ],
        'CHARALÁ': [
            r'\bCHARALA\b',
            r'\bCHARALÁ\b'
        ],
        'CURITÍ': [
            r'\bCURITI\b',
            r'\bCURITÍ\b',
            r'\bKURITI\b'
        ],
        'MOGOTES': [
            r'\bMOGOTES\b'
        ],
        'OCAMONTE': [
            r'\bOCAMONTE\b',
            r'\bOKAMONTE\b'
        ],
        'PINCHOTE': [
            r'\bPINCHOTE\b'
        ],
        'VALLE DE SAN JOSÉ': [
            r'\bVALLE\s*DE\s*SAN\s*JOSE\b',
            r'\bVALLE\s*DE\s*SAN\s*JOSÉ\b'
        ],
        'ONZAGA': [
            r'\bONZAGA\b',
            r'\bONSAGA\b'
        ],
        'ENCINO': [
            r'\bENCINO\b'
        ],
        'PÁRAMO': [
            r'\bPARAMO\b',
            r'\bPÁRAMO\b'
        ]
    }
    
    # Municipios de la Provincia de Socorro (Santander)
    socorro_municipalities = {
        'SOCORRO': [
            r'\bSOCORRO\b',
            r'\bSCORRO\b',
            r'\bSOCORO\b'
        ],
        'CONFINES': [
            r'\bCONFINES\b'
        ],
        'CONTRATACIÓN': [
            r'\bCONTRATACION\b',
            r'\bCONTRATACIÓN\b'
        ],
        'CHIMA': [
            r'\bCHIMA\b'
        ],
        'GALÁN': [
            r'\bGALAN\b',
            r'\bGALÁN\b'
        ],
        'GAMBITA': [
            r'\bGAMBITA\b'
        ],
        'GUAPOTÁ': [
            r'\bGUAPOTA\b',
            r'\bGUAPOTÁ\b'
        ],
        'JORDÁN': [
            r'\bJORDAN\b',
            r'\bJORDÁN\b'
        ],
        'OIBA': [
            r'\bOIBA\b',
            r'\bOYBA\b'
        ],
        'PALMAR': [
            r'\bPALMAR\b'
        ],
        'SAN JOAQUÍN': [
            r'\bSAN\s*JOAQUIN\b',
            r'\bSAN\s*JOAQUÍN\b'
        ],
        'SIMACOTA': [
            r'\bSIMACOTA\b'
        ]
    }
    
    # Otras zonas importantes
    other_zones = {
        'VILLANUEVA': [
            r'\bVILLANUEVA\b',
            r'\bVILLA\s*NUEVA\b'
        ],
        'GUANE': [
            r'\bGUANE\b'
        ]
    }
    
    # Buscar primero en municipios de San Gil
    for municipality, patterns in san_gil_municipalities.items():
        for pattern in patterns:
            if re.search(pattern, addr_upper):
                # Todos los municipios de San Gil se clasifican como "SAN GIL"
                return "SAN GIL"
    
    # Buscar en municipios de Socorro
    for municipality, patterns in socorro_municipalities.items():
        for pattern in patterns:
            if re.search(pattern, addr_upper):
                # Todos los municipios de Socorro se clasifican como "SOCORRO"
                return "SOCORRO"
    
    # Buscar en otras zonas
    for zone, patterns in other_zones.items():
        for pattern in patterns:
            if re.search(pattern, addr_upper):
                return zone
    
    # Si contiene "SANTANDER" pero no se identificó otra zona, puede ser general
    if re.search(r'\bSANTANDER\b', addr_upper):
        return "SANTANDER (OTRA)"
    
    return "NO ESPECIFICADA"

def reorganize_names(input_file, output_file):
    """
    Lee el CSV original y reorganiza los nombres en una sola columna + zona
    """
    try:
        with open(input_file, 'r', encoding='iso-8859-1') as infile:
            reader = csv.DictReader(infile)
            
            # Preparar nuevas columnas
            fieldnames = ['id', 'external_id', 'document', 'full_name', 'TIPO SEXO', 
                         'DIRECCION RESIDENCIA', 'zona', 'TELEFONO RESIDENCIA', 'FECHA NACIMIENTO']
            
            rows_processed = 0
            rows_output = []
            zone_stats = {}
            
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
                
                # Identificar zona
                address = row.get('DIRECCION RESIDENCIA', '').strip()
                # Si la dirección está vacía o tiene menos de 3 caracteres, colocar "NO ESPECIFICADA"
                if not address or len(address) < 3:
                    address = 'NO ESPECIFICADA'
                zona = identify_zone(address)
                
                # Estadísticas de zonas
                zone_stats[zona] = zone_stats.get(zona, 0) + 1
                
                # Crear nueva fila
                new_row = {
                    'id': row.get('id', ''),
                    'external_id': row.get('external_id', ''),
                    'document': row.get('document', ''),
                    'full_name': full_name,
                    'TIPO SEXO': row.get('TIPO SEXO', ''),
                    'DIRECCION RESIDENCIA': address,
                    'zona': zona,
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
        
        # Mostrar estadísticas de zonas
        print("\n📍 Distribución por zonas:")
        for zone, count in sorted(zone_stats.items(), key=lambda x: x[1], reverse=True):
            percentage = (count / rows_processed) * 100
            print(f"  {zone}: {count} ({percentage:.1f}%)")
        
        # Mostrar algunos ejemplos
        print("\n📋 Ejemplos de registros reorganizados:")
        for i, row in enumerate(rows_output[:5], 1):
            print(f"  {i}. {row['full_name']} - Zona: {row['zona']}")
            print(f"     Dirección: {row['DIRECCION RESIDENCIA'][:60]}...")
        
        return True
        
    except Exception as e:
        print(f"❌ Error al procesar el archivo: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    input_file = "/home/ubuntu/app/DATABASE.csv"
    output_file = "/home/ubuntu/app/DATABASE_reorganized.csv"
    
    print("🔄 Reorganizando nombres y clasificando zonas en el CSV...")
    print(f"📂 Archivo entrada: {input_file}")
    print(f"📂 Archivo salida: {output_file}")
    print()
    
    success = reorganize_names(input_file, output_file)
    sys.exit(0 if success else 1)
