#!/usr/bin/env python3
"""
Zadarma API v1 Client para Python - IMPLEMENTACIÓN EXACTA DEL PHP OFICIAL
Basado en https://github.com/zadarma/user-api-v1/blob/main/lib/Client.php
"""

import hashlib
import hmac
import base64
import requests
from urllib.parse import quote_plus
import json


class ZadarmaClient:
    """Cliente Python que replica exactamente el comportamiento del Client.php oficial"""
    
    def __init__(self, api_key: str, api_secret: str, sandbox: bool = False):
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = 'https://api-sandbox.zadarma.com' if sandbox else 'https://api.zadarma.com'
    
    def encode_signature(self, signature_string: str) -> str:
        """
        Exact implementation from PHP Client.php line 111:
        return base64_encode(hash_hmac('sha1', $signatureString, $this->secret));
        """
        signature = hmac.new(
            self.api_secret.encode('utf-8'),
            signature_string.encode('utf-8'),
            hashlib.sha1
        ).digest()
        return base64.b64encode(signature).decode('utf-8')
    
    def http_build_query(self, params: dict) -> str:
        """
        Exact implementation from PHP Client.php line 148:
        return http_build_query($params, '', '&', PHP_QUERY_RFC1738);
        
        PHP_QUERY_RFC1738 means spaces become '+' not '%20'
        """
        query_parts = []
        for key, value in sorted(params.items()):
            # PHP quote behavior: spaces become '+', special chars get encoded
            encoded_key = quote_plus(str(key))
            encoded_value = quote_plus(str(value))
            query_parts.append(f"{encoded_key}={encoded_value}")
        return '&'.join(query_parts)
    
    def get_auth_header(self, method: str, params: dict) -> str:
        """
        Exact implementation from PHP Client.php lines 119-127:
        
        $params = array_filter($params, function ($a) {
            return !is_object($a);
        });
        ksort($params);
        $paramsString = $this->httpBuildQuery($params);
        $signature = $this->encodeSignature($method . $paramsString . md5($paramsString));
        return ['Authorization: ' . $this->key . ':' . $signature];
        """
        # Filter objects (keep only basic types)
        filtered_params = {}
        for k, v in params.items():
            if not hasattr(v, '__dict__') and v is not None:  # !is_object($a)
                filtered_params[k] = v
        
        # Sort by key (ksort in PHP)
        # Already handled in http_build_query via sorted()
        
        # Build query string
        params_string = self.http_build_query(filtered_params)
        
        # Create signature string: method + paramsString + md5(paramsString)
        md5_hash = hashlib.md5(params_string.encode('utf-8')).hexdigest()
        signature_string = method + params_string + md5_hash
        
        # Encode signature
        signature = self.encode_signature(signature_string)
        
        return f"{self.api_key}:{signature}"
    
    def call(self, method: str, params: dict = None, request_type: str = 'get', format_type: str = 'json'):
        """
        Exact implementation from PHP Client.php call() method
        """
        if params is None:
            params = {}
        
        # Add format parameter (from PHP line 51)
        params['format'] = format_type
        
        # Get authorization header
        auth_header = self.get_auth_header(method, params)
        
        headers = {
            'Authorization': auth_header
        }
        
        url = self.base_url + method
        request_type = request_type.upper()
        
        try:
            if request_type == 'GET':
                # For GET, append query string to URL
                if params:
                    filtered_params = {k: v for k, v in params.items() if not hasattr(v, '__dict__') and v is not None}
                    query_string = self.http_build_query(filtered_params)
                    if query_string:
                        url += '?' + query_string
                response = requests.get(url, headers=headers, timeout=10)
            else:
                # For POST/PUT/DELETE, send as form data
                filtered_params = {k: v for k, v in params.items() if not hasattr(v, '__dict__') and v is not None}
                data = self.http_build_query(filtered_params)
                headers['Content-Type'] = 'application/x-www-form-urlencoded'
                response = requests.request(request_type, url, data=data, headers=headers, timeout=10)
            
            return response
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"Request failed: {str(e)}")
    
    # API Methods
    def get_balance(self):
        """Get account balance"""
        response = self.call('/v1/info/balance/')
        return response.json() if response.status_code == 200 else response.text
    
    def request_callback(self, from_number: str, to_number: str, sip: str = None):
        """Request callback"""
        params = {
            'from': from_number,
            'to': to_number
        }
        if sip:
            params['sip'] = sip
        
        response = self.call('/v1/request/callback/', params, 'post')
        return response.json() if response.status_code == 200 else response.text


# Test the implementation
if __name__ == "__main__":
    # Credenciales reales del panel de Zadarma
    API_KEY = "2eeea07f46fcf59e3a10"
    API_SECRET = "c87065c63195ad4b3da"
    
    print("=== TESTING ZADARMA CLIENT WITH EXACT PHP IMPLEMENTATION ===")
    
    # Test with production API
    client = ZadarmaClient(API_KEY, API_SECRET, sandbox=False)
    
    print("\n1. Testing Balance API...")
    try:
        response = client.call('/v1/info/balance/')
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        print(f"Headers: {dict(response.headers)}")
    except Exception as e:
        print(f"Error: {e}")
    
    print("\n2. Testing with sandbox...")
    client_sandbox = ZadarmaClient(API_KEY, API_SECRET, sandbox=True)
    try:
        response = client_sandbox.call('/v1/info/balance/')
        print(f"Sandbox Status Code: {response.status_code}")
        print(f"Sandbox Response: {response.text}")
    except Exception as e:
        print(f"Sandbox Error: {e}")
    
    # Test signature generation for debugging
    print("\n3. Testing signature generation...")
    test_params = {'format': 'json'}
    auth_header = client.get_auth_header('/v1/info/balance/', test_params)
    print(f"Generated auth header: {auth_header}")
    
    # Breakdown of signature process
    filtered_params = {k: v for k, v in test_params.items() if not hasattr(v, '__dict__') and v is not None}
    params_string = client.http_build_query(filtered_params)
    md5_hash = hashlib.md5(params_string.encode('utf-8')).hexdigest()
    signature_string = '/v1/info/balance/' + params_string + md5_hash
    signature = client.encode_signature(signature_string)
    
    print(f"Filtered params: {filtered_params}")
    print(f"Params string: '{params_string}'")
    print(f"MD5 hash: {md5_hash}")
    print(f"Signature string: '{signature_string}'")
    print(f"Final signature: {signature}")