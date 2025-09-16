#!/usr/bin/env python3
"""
Cliente Zadarma API v1 - Implementación exacta del algoritmo PHP oficial
Basado en: https://github.com/zadarma/user-api-v1/blob/main/lib/Client.php
"""

import requests
import hashlib
import hmac
import base64
from urllib.parse import urlencode, quote_plus
import json

class ZadarmaClient:
    """Cliente para la API de Zadarma v1"""
    
    PROD_URL = 'https://api.zadarma.com'
    SANDBOX_URL = 'https://api-sandbox.zadarma.com'
    
    def __init__(self, key=None, secret=None, is_sandbox=False):
        self.url = self.SANDBOX_URL if is_sandbox else self.PROD_URL
        # CORRECCIÓN: Secret correcto con 0 extra
        self.key = key or os.getenv('ZADARMA_KEY', '2eeea07f46fcf59e3a10')
        self.secret = secret or os.getenv('ZADARMA_SECRET', 'c87065c063195ad4b3da')
        self.http_code = None
        self.limits = {}
        
        if not self.key or not self.secret:
            raise ValueError("Zadarma API key and secret are required")
    
    def encode_signature(self, signature_string):
        """
        Generar firma HMAC-SHA1 exactamente como en la implementación que funciona
        hmac.hexdigest() -> base64.encode() (no hmac.digest() directo)
        """
        hmac_obj = hmac.new(
            self.secret.encode('utf-8'),
            signature_string.encode('utf-8'),
            hashlib.sha1
        )
        # CLAVE: Usar hexdigest() primero, luego base64
        hex_digest = hmac_obj.hexdigest().encode('utf-8')
        return base64.b64encode(hex_digest).decode('utf-8')
    
    def http_build_query(self, params):
        """
        Replicar PHP http_build_query con RFC1738 (espacios como +)
        return http_build_query($params, '', '&', PHP_QUERY_RFC1738);
        """
        if not params:
            return ''
        
        # Filtrar objetos (como en PHP)
        filtered_params = {k: v for k, v in params.items() if not hasattr(v, '__dict__')}
        
        # Ordenar por clave (como en PHP ksort)
        sorted_params = dict(sorted(filtered_params.items()))
        
        # Construir query string con RFC1738 (espacios como +)
        return urlencode(sorted_params, quote_via=quote_plus)
    
    def get_auth_header(self, method, params):
        """
        Generar header de autorización exactamente como en PHP
        """
        # Filtrar objetos y ordenar parámetros
        params_string = self.http_build_query(params)
        
        # Algoritmo exacto del PHP:
        # $signature = $this->encodeSignature($method . $paramsString . md5($paramsString));
        md5_params = hashlib.md5(params_string.encode('utf-8')).hexdigest()
        signature_string = method + params_string + md5_params
        signature = self.encode_signature(signature_string)
        
        return f"{self.key}:{signature}"
    
    def call(self, method, params=None, request_type='get', format='json'):
        """
        Hacer llamada a la API
        """
        if params is None:
            params = {}
        
        # Agregar formato
        params['format'] = format
        
        # Construir URL y headers
        url = f"{self.url}{method}"
        auth_header = self.get_auth_header(method, params)
        
        headers = {
            'Authorization': auth_header,
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Biosanarcall Zadarma Client/1.0'
        }
        
        try:
            request_type = request_type.lower()
            
            if request_type == 'get':
                params_string = self.http_build_query(params)
                if params_string:
                    url += f"?{params_string}"
                response = requests.get(url, headers=headers, timeout=30)
            elif request_type == 'post':
                data = self.http_build_query(params)
                response = requests.post(url, data=data, headers=headers, timeout=30)
            else:
                raise Exception(f"Método HTTP no soportado: {request_type}")
            
            self.http_code = response.status_code
            
            # Parsear rate limits de headers
            for header, value in response.headers.items():
                if header.startswith('X-RateLimit-'):
                    limit_type = header.replace('X-RateLimit-', '').lower()
                    self.limits[limit_type] = int(value)
            
            return response.text
            
        except Exception as e:
            raise Exception(f"Error en llamada API: {str(e)}")
    
    def get_balance(self):
        """Obtener balance de la cuenta"""
        return self.call('/v1/info/balance/')
    
    def get_timezone(self):
        """Obtener zona horaria"""
        return self.call('/v1/info/timezone/')
    
    def get_tariff(self):
        """Obtener información de tarifa"""
        return self.call('/v1/info/tariff/')


def test_zadarma_api():
    """Probar la API de Zadarma con el cliente"""
    
    # Credenciales CORREGIDAS
    ZADARMA_KEY = "2eeea07f46fcf59e3a10"
    ZADARMA_SECRET = "c87065c063195ad4b3da"  # Con 0 extra - CORRECCIÓN APLICADA
    
    print("🔧 Probando cliente Zadarma API v1...")
    print(f"🔑 Key: {ZADARMA_KEY}")
    
    # Crear cliente
    client = ZadarmaClient(ZADARMA_KEY, ZADARMA_SECRET)
    
    # Probar balance
    print("\n1️⃣ Probando getBalance()...")
    try:
        result = client.get_balance()
        print(f"✅ Status Code: {client.http_code}")
        print(f"📊 Response: {result}")
        
        if client.http_code == 200:
            try:
                json_result = json.loads(result)
                print(f"💰 Balance: {json.dumps(json_result, indent=2)}")
            except:
                print("⚠️ Respuesta no es JSON válido")
        else:
            print(f"❌ Error HTTP: {client.http_code}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    # Probar timezone
    print("\n2️⃣ Probando getTimezone()...")
    try:
        result = client.get_timezone()
        print(f"✅ Status Code: {client.http_code}")
        print(f"🌍 Response: {result}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
    
    # Mostrar rate limits
    if client.limits:
        print(f"\n📈 Rate Limits: {client.limits}")

if __name__ == "__main__":
    test_zadarma_api()