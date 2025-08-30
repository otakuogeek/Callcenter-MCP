#!/bin/bash

# Test script para el servidor MCP Node.js con nuevos campos
# Prueba las funciones lookup y creación de pacientes con campos extendidos

BASE_URL="http://localhost:8977"
API_KEY="mcp-key-biosanarcall-2025"

echo "=== Testing MCP Server Node.js - Extended Patient Fields ==="
echo

# Test 1: Health check
echo "1. Health Check"
curl -s "$BASE_URL/health" | jq '.' || echo "No jq installed, raw output:"
curl -s "$BASE_URL/health"
echo -e "\n"

# Test 2: List tools (verificar que incluya las nuevas)
echo "2. List Tools"
curl -s -X POST "$BASE_URL/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }' | jq '.result.tools | length'
echo "Total tools available"
echo

# Test 3: Get Document Types
echo "3. Get Document Types"
curl -s -X POST "$BASE_URL/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "getDocumentTypes",
      "arguments": {}
    }
  }' | jq '.result.content[0].text' | sed 's/\\"/"/g' | sed 's/^"//;s/"$//' | jq '.document_types'
echo

# Test 4: Get Blood Groups
echo "4. Get Blood Groups"
curl -s -X POST "$BASE_URL/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "getBloodGroups",
      "arguments": {}
    }
  }' | jq '.result.content[0].text' | sed 's/\\"/"/g' | sed 's/^"//;s/"$//' | jq '.blood_groups'
echo

# Test 5: Get Education Levels
echo "5. Get Education Levels"
curl -s -X POST "$BASE_URL/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "getEducationLevels",
      "arguments": {}
    }
  }' | jq '.result.content[0].text' | sed 's/\\"/"/g' | sed 's/^"//;s/"$//' | jq '.education_levels'
echo

# Test 6: Create Patient with Extended Fields
echo "6. Create Patient with Extended Fields"
RANDOM_DOC="TEST$(date +%s)"
curl -s -X POST "$BASE_URL/mcp-unified" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "tools/call",
    "params": {
      "name": "createPatient",
      "arguments": {
        "document": "'$RANDOM_DOC'",
        "document_type_id": 1,
        "name": "Paciente Prueba MCP",
        "phone": "3001234567",
        "phone_alt": "3007654321",
        "email": "prueba@test.com",
        "birth_date": "1990-01-01",
        "gender": "Masculino",
        "address": "Calle Prueba 123",
        "insurance_affiliation_type": "Contributivo",
        "blood_group_id": 1,
        "population_group_id": 1,
        "education_level_id": 3,
        "marital_status_id": 1,
        "has_disability": false,
        "estrato": 3,
        "notes": "Paciente de prueba creado via MCP"
      }
    }
  }' | jq '.result.content[0].text' | sed 's/\\"/"/g' | sed 's/^"//;s/"$//' | jq '.'
echo

echo "=== Test completed ==="
