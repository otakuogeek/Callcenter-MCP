#!/usr/bin/env python3
"""
Zadarma API v1 Client - Versión corregida
Basado exactamente en el ejemplo oficial de PHP convertido a Python
"""

import hashlib
import hmac
import base64
import requests
import urllib.parse
import json
from typing import Dict, Any, Optional


class ZadarmaClientFixed:
    """Cliente Python corregido para Zadarma API v1"""
    
    def __init__(self, user_key: str, secret_key: str):
        self.user_key = user_key
        self.secret_key = secret_key
        self.api_url = 'https://api.zadarma.com'
    
    def call(self, method: str, params: Optional[Dict[str, Any]] = None, 
             is_get: bool = True) -> Dict[str, Any]:
        """
        Llamada a la API según implementación oficial de PHP
        """
        if params is None:
            params = {}
        
        # Agregar formato JSON
        params['format'] = 'json'
        
        # Crear URL del método
        method_url = f"/v1/{method.strip('/')}/"
        
        # Filtrar y preparar parámetros
        filtered_params = {}
        for key, value in params.items():
            if not isinstance(value, (dict, list)):
                filtered_params[key] = str(value)
        
        # Ordenar parámetros alfabéticamente
        sorted_params = dict(sorted(filtered_params.items()))
        
        # Crear query string
        if sorted_params:
            # Usar urllib.parse.urlencode que maneja correctamente el encoding
            params_string = urllib.parse.urlencode(sorted_params, quote_via=urllib.parse.quote)
        else:
            params_string = ''
        
        # Debug: mostrar lo que vamos a firmar
        print(f"DEBUG: Método: {method_url}")
        print(f"DEBUG: Parámetros: {params_string}")
        
        # Calcular MD5 de los parámetros
        params_md5 = hashlib.md5(params_string.encode('utf-8')).hexdigest()
        print(f"DEBUG: MD5 parámetros: {params_md5}")
        
        # Crear string para firmar: método + parámetros + MD5
        string_to_sign = method_url + params_string + params_md5
        print(f"DEBUG: String a firmar: {string_to_sign}")
        
        # Crear firma HMAC-SHA1
        signature = hmac.new(
            self.secret_key.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha1
        ).digest()
        signature_b64 = base64.b64encode(signature).decode('utf-8')
        print(f"DEBUG: Firma: {signature_b64}")
        
        # Crear header de autorización
        auth_header = f"{self.user_key}:{signature_b64}"
        print(f"DEBUG: Auth header: {auth_header}")
        
        # Configurar headers
        headers = {
            'Authorization': auth_header,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        # Realizar petición
        url = self.api_url + method_url
        
        try:
            if is_get:
                if params_string:
                    url += '?' + params_string
                print(f"DEBUG: GET URL: {url}")
                response = requests.get(url, headers=headers, timeout=30)
            else:
                print(f"DEBUG: POST URL: {url}")
                print(f"DEBUG: POST data: {params_string}")
                response = requests.post(url, data=params_string, headers=headers, timeout=30)
            
            print(f"DEBUG: Status code: {response.status_code}")
            print(f"DEBUG: Response: {response.text}")
            
            if response.status_code == 200:
                return response.json()
            else:
                return {
                    "status": "error", 
                    "message": f"HTTP {response.status_code}: {response.text}"
                }
                
        except Exception as e:
            return {"status": "error", "message": str(e)}


def test_simple():
    """Prueba simple con debug detallado"""
    # Credenciales
    API_KEY = "2eeea07f46fcf59e3a10" 
    API_SECRET = "c87065c63195ad4b3da"
    
    print("🔍 Prueba con debug detallado...")
    client = ZadarmaClientFixed(API_KEY, API_SECRET)
    
    # Prueba más simple: balance sin parámetros adicionales
    print("\n1️⃣ Probando balance (GET sin parámetros)...")
    result = client.call('info/balance', {}, True)
    print(f"Resultado: {result}")
    
    return result


if __name__ == "__main__":
    test_simple()