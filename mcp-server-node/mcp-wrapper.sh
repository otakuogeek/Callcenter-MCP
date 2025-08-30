#!/bin/bash

# MCP Server wrapper for inspector
# This script acts as an MCP server that forwards requests to our HTTP endpoint

while IFS= read -r line; do
    # Parse the JSON-RPC request
    echo "$line" >&2  # Log to stderr for debugging
    
    # Forward to our HTTP endpoint with authentication
    curl -s -X POST http://localhost:8976/api/elevenlabs \
        -H "Content-Type: application/json" \
        -H "X-API-Key: biosanarcall_mcp_node_2025" \
        -d "$line"
done
