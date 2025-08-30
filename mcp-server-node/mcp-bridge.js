#!/usr/bin/env node

const { spawn } = require('child_process');

// Configuración del servidor MCP
const MCP_SERVER_URL = 'http://localhost:8976/api/elevenlabs';
const API_KEY = 'biosanarcall_mcp_node_2025';

// Simular un servidor MCP estándar que el inspector pueda usar
class MCPBridge {
  constructor() {
    this.messageId = 1;
  }

  async sendMessage(method, params = {}) {
    const message = {
      jsonrpc: '2.0',
      id: this.messageId++,
      method,
      params
    };

    try {
      const { default: fetch } = await import('node-fetch');
      const response = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify(message)
      });

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32000,
          message: error.message
        }
      };
    }
  }

  start() {
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', async (data) => {
      try {
        const lines = data.trim().split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          const request = JSON.parse(line);
          const response = await this.sendMessage(request.method, request.params);
          
          // Mantener el ID de la petición original
          response.id = request.id;
          
          console.log(JSON.stringify(response));
        }
      } catch (error) {
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32700,
            message: 'Parse error'
          }
        }));
      }
    });

    process.stdin.on('end', () => {
      process.exit(0);
    });
  }
}

if (require.main === module) {
  const bridge = new MCPBridge();
  bridge.start();
}

module.exports = MCPBridge;
