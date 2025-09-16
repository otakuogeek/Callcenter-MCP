#!/usr/bin/env python3
"""
Script de diagnóstico completo para Zadarma API
Ayuda a identificar problemas de configuración específicos
"""

import requests
import json
import socket
from zadarma_client_fixed import ZadarmaClient


def get_server_ip():
    """Obtener IP pública del servidor"""
    try:
        response = requests.get('https://ifconfig.me', timeout=5)
        return response.text.strip()
    except:
        return "No se pudo obtener IP"


def test_zadarma_endpoints():
    """Probar diferentes endpoints de Zadarma"""
    API_KEY = "2eeea07f46fcf59e3a10"
    API_SECRET = "c87065c63195ad4b3da"
    
    print("=" * 60)
    print("🔍 DIAGNÓSTICO COMPLETO ZADARMA API")
    print("=" * 60)
    
    # Información del servidor
    print(f"\n📡 INFORMACIÓN DEL SERVIDOR:")
    print(f"   IP Pública: {get_server_ip()}")
    print(f"   Hostname: {socket.gethostname()}")
    
    # Test con production
    print(f"\n🔧 TESTING PRODUCTION API:")
    client_prod = ZadarmaClient(API_KEY, API_SECRET, sandbox=False)
    
    endpoints_to_test = [
        ('/v1/info/balance/', 'GET', 'Balance de cuenta'),
        ('/v1/info/timezone/', 'GET', 'Timezone del usuario'),
        ('/v1/tariff/', 'GET', 'Información de tarifa'),
    ]
    
    for endpoint, method, description in endpoints_to_test:
        print(f"\n   Testing {description} ({endpoint})...")
        try:
            response = client_prod.call(endpoint, {}, method)
            print(f"   ✅ Status: {response.status_code}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"   ✅ Response: {json.dumps(data, indent=2)}")
                except:
                    print(f"   ⚠️  Response: {response.text}")
            elif response.status_code == 401:
                print(f"   ❌ Error 401: Problema de autorización")
                print(f"   🔑 Verificar configuración del panel:")
                print(f"      - Keys activas")
                print(f"      - IP {get_server_ip()} permitida")
                print(f"      - Permisos de API habilitados")
            else:
                print(f"   ❌ Error {response.status_code}: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Exception: {str(e)}")
    
    # Test con sandbox
    print(f"\n🧪 TESTING SANDBOX API:")
    client_sandbox = ZadarmaClient(API_KEY, API_SECRET, sandbox=True)
    
    try:
        response = client_sandbox.call('/v1/info/balance/', {}, 'GET')
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Sandbox funcionando: {json.dumps(data, indent=2)}")
        else:
            print(f"   ❌ Sandbox error: {response.text}")
    except Exception as e:
        print(f"   ❌ Sandbox exception: {str(e)}")
    
    # Test de signature generation
    print(f"\n🔐 TESTING SIGNATURE GENERATION:")
    test_params = {'format': 'json', 'test': 'value'}
    
    auth_header = client_prod.get_auth_header('/v1/info/balance/', test_params)
    filtered_params = {k: v for k, v in test_params.items() if not hasattr(v, '__dict__') and v is not None}
    params_string = client_prod.http_build_query(filtered_params)
    
    print(f"   Params: {filtered_params}")
    print(f"   Query string: '{params_string}'")
    print(f"   Auth header: {auth_header}")
    
    # Análisis de headers de respuesta
    print(f"\n📊 ANÁLISIS DE HEADERS:")
    try:
        response = client_prod.call('/v1/info/balance/')
        headers = dict(response.headers)
        
        rate_limit_headers = {k: v for k, v in headers.items() if 'rate-limit' in k.lower()}
        zadarma_headers = {k: v for k, v in headers.items() if 'zadarma' in k.lower()}
        
        print(f"   Rate Limiting: {rate_limit_headers}")
        print(f"   Zadarma Headers: {zadarma_headers}")
        
    except Exception as e:
        print(f"   ❌ Error obteniendo headers: {str(e)}")


def test_webhook_connectivity():
    """Probar conectividad para webhooks"""
    print(f"\n🌐 TESTING WEBHOOK CONNECTIVITY:")
    
    webhook_url = "https://biosanarcall.site/webhook/zadarma"
    
    try:
        # Test GET para verificar que el endpoint existe
        response = requests.get(webhook_url, timeout=5)
        print(f"   ✅ Webhook endpoint accesible")
        print(f"   Status: {response.status_code}")
        
        # Test POST simulando webhook de Zadarma
        test_payload = {
            "event": "NOTIFY_START",
            "caller_id": "+1234567890",
            "called_did": "+576076916019",
            "call_start": "2024-01-01 12:00:00"
        }
        
        response = requests.post(webhook_url, json=test_payload, timeout=5)
        print(f"   ✅ Webhook POST test completado")
        print(f"   Status: {response.status_code}")
        
    except requests.exceptions.ConnectionError:
        print(f"   ❌ Error: No se pudo conectar a {webhook_url}")
        print(f"   🔧 Verificar:")
        print(f"      - Nginx funcionando")
        print(f"      - Servicio voice-call en puerto 3001")
        print(f"      - DNS apuntando correctamente")
    except Exception as e:
        print(f"   ❌ Error: {str(e)}")


def generate_configuration_summary():
    """Generar resumen de configuración necesaria"""
    print(f"\n📋 RESUMEN DE CONFIGURACIÓN NECESARIA:")
    print(f"\n   🔑 En el Panel de Zadarma (https://my.zadarma.com):")
    print(f"      1. Integraciones y API → Claves y API")
    print(f"         ✅ Verificar keys activas: 2eeea07f46fcf59e3a10")
    print(f"         ✅ Permitir IP: {get_server_ip()}")
    print(f"         ✅ Activar TODOS los permisos")
    print(f"\n      2. Webhooks:")
    print(f"         ✅ URL: https://biosanarcall.site/webhook/zadarma")
    print(f"         ✅ Formato: JSON")
    print(f"         ✅ Eventos: Todas las notificaciones de llamadas")
    print(f"\n      3. Tus números → +576076916019:")
    print(f"         ✅ Habilitar servidor externo")
    print(f"         ✅ Configurar SIP URI")
    print(f"\n   ⚠️  DESPUÉS DE CONFIGURAR:")
    print(f"      - Esperar 5-10 minutos")
    print(f"      - Volver a ejecutar este script")
    print(f"      - El balance debería mostrarse correctamente")


if __name__ == "__main__":
    test_zadarma_endpoints()
    test_webhook_connectivity() 
    generate_configuration_summary()
    
    print(f"\n" + "=" * 60)
    print(f"✅ DIAGNÓSTICO COMPLETADO")
    print(f"📄 Ver guía completa: CONFIGURACION_PANEL_ZADARMA_FINAL.md")
    print(f"=" * 60)