import { EventEmitter } from 'events';
import * as dgram from 'dgram';
import { VoiceAssistantService } from './VoiceAssistantService';

interface SipMessage {
  method?: string;
  uri?: string;
  version?: string;
  headers: Map<string, string>;
  body?: string;
  raw: string;
}

interface SipEndpoint {
  host: string;
  port: number;
}

/**
 * Servidor SIP Proxy que actúa como intermediario entre Zadarma y nuestro sistema
 */
export class SipProxyServer extends EventEmitter {
  private server: dgram.Socket;
  private port: number;
  private host: string;
  private voiceAssistant: VoiceAssistantService;
  private zadarmaEndpoint: SipEndpoint;
  private registeredClients = new Map<string, SipEndpoint>();

  constructor(
    port = 5060,
    host = '0.0.0.0',
    voiceAssistant: VoiceAssistantService
  ) {
    super();
    this.port = port;
    this.host = host;
    this.voiceAssistant = voiceAssistant;
    this.server = dgram.createSocket('udp4');
    
    // Configuración de Zadarma
    this.zadarmaEndpoint = {
      host: 'pbx.zadarma.com',
      port: 5060
    };

    this.setupServer();
  }

  private setupServer(): void {
    this.server.on('message', (msg, rinfo) => {
      this.handleSipMessage(msg.toString(), rinfo);
    });

    this.server.on('error', (err) => {
      console.error('[SIP Proxy] Error del servidor:', err);
    });

    this.server.on('listening', () => {
      const address = this.server.address();
      console.log(`[SIP Proxy] 🌐 Servidor SIP escuchando en ${address?.address}:${address?.port}`);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.bind(this.port, this.host);
      this.server.on('listening', () => {
        resolve();
      });
      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        console.log('[SIP Proxy] Servidor detenido');
        resolve();
      });
    });
  }

  private handleSipMessage(message: string, rinfo: dgram.RemoteInfo): void {
    console.log(`[SIP Proxy] 📨 Mensaje recibido de ${rinfo.address}:${rinfo.port}`);
    console.log(message);

    const sipMsg = this.parseSipMessage(message);
    
    if (sipMsg.method === 'REGISTER') {
      this.handleRegister(sipMsg, rinfo);
    } else if (sipMsg.method === 'INVITE') {
      this.handleInvite(sipMsg, rinfo);
    } else if (sipMsg.method === 'ACK') {
      this.handleAck(sipMsg, rinfo);
    } else if (sipMsg.method === 'BYE') {
      this.handleBye(sipMsg, rinfo);
    } else if (sipMsg.method === 'OPTIONS') {
      this.handleOptions(sipMsg, rinfo);
    } else {
      // Reenviar otros mensajes a Zadarma
      this.forwardToZadarma(message, rinfo);
    }
  }

  private parseSipMessage(message: string): SipMessage {
    const lines = message.split('\r\n');
    const firstLine = lines[0];
    const headers = new Map<string, string>();
    
    let bodyStart = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '') {
        bodyStart = i + 1;
        break;
      }
      const colonIndex = lines[i].indexOf(':');
      if (colonIndex > 0) {
        const key = lines[i].substring(0, colonIndex).trim();
        const value = lines[i].substring(colonIndex + 1).trim();
        headers.set(key.toLowerCase(), value);
      }
    }

    const body = bodyStart > 0 ? lines.slice(bodyStart).join('\r\n') : undefined;

    // Parsear primera línea
    const parts = firstLine.split(' ');
    if (parts[0].startsWith('SIP/')) {
      // Es una respuesta
      return {
        version: parts[0],
        headers,
        body,
        raw: message
      };
    } else {
      // Es una petición
      return {
        method: parts[0],
        uri: parts[1],
        version: parts[2],
        headers,
        body,
        raw: message
      };
    }
  }

  private handleRegister(sipMsg: SipMessage, rinfo: dgram.RemoteInfo): void {
    console.log('[SIP Proxy] 📝 Manejando REGISTER');
    
    const callId = sipMsg.headers.get('call-id');
    const contact = sipMsg.headers.get('contact');
    
    if (callId && contact) {
      // Registrar cliente
      this.registeredClients.set(callId, {
        host: rinfo.address,
        port: rinfo.port
      });
      
      // Responder con 200 OK
      const response = this.createResponse(sipMsg, 200, 'OK', rinfo);
      this.sendResponse(response, rinfo);
    }
  }

  private async handleInvite(sipMsg: SipMessage, rinfo: dgram.RemoteInfo): Promise<void> {
    console.log('[SIP Proxy] 📞 Manejando INVITE - Llamada entrante');
    
    const callId = sipMsg.headers.get('call-id') || '';
    const from = sipMsg.headers.get('from') || '';
    const to = sipMsg.headers.get('to') || '';
    
    // Extraer número del From header
    const phoneMatch = from.match(/sip:(\+?\d+)/);
    const phoneNumber = phoneMatch ? phoneMatch[1] : 'Desconocido';
    
    console.log(`[SIP Proxy] 📱 Llamada de: ${phoneNumber}`);
    
    // Responder con 100 Trying
    const trying = this.createResponse(sipMsg, 100, 'Trying', rinfo);
    this.sendResponse(trying, rinfo);
    
    // Responder con 180 Ringing
    setTimeout(() => {
      const ringing = this.createResponse(sipMsg, 180, 'Ringing', rinfo);
      this.sendResponse(ringing, rinfo);
    }, 500);
    
    // Aceptar la llamada automáticamente después de 2 segundos
    setTimeout(async () => {
      try {
        // Iniciar el asistente de voz
        const callData = {
          phone: phoneNumber,
          callId: callId,
          from: from,
          to: to
        };
        await this.voiceAssistant.handleIncomingCall(callData);
        
        // Responder con 200 OK
        const ok = this.createResponse(sipMsg, 200, 'OK', rinfo, this.generateSDP());
        this.sendResponse(ok, rinfo);
        
        console.log('[SIP Proxy] ✅ Llamada aceptada, asistente de voz iniciado');
        
      } catch (error) {
        console.error('[SIP Proxy] Error al manejar llamada:', error);
        
        // Responder con 500 Server Error
        const serverError = this.createResponse(sipMsg, 500, 'Server Internal Error', rinfo);
        this.sendResponse(serverError, rinfo);
      }
    }, 2000);
  }

  private handleAck(sipMsg: SipMessage, rinfo: dgram.RemoteInfo): void {
    console.log('[SIP Proxy] ✅ Manejando ACK - Llamada establecida');
    
    const callId = sipMsg.headers.get('call-id') || '';
    
    // Notificar que la llamada está conectada
    this.emit('callConnected', {
      callId,
      remoteAddress: `${rinfo.address}:${rinfo.port}`
    });
  }

  private handleBye(sipMsg: SipMessage, rinfo: dgram.RemoteInfo): void {
    console.log('[SIP Proxy] 📴 Manejando BYE - Fin de llamada');
    
    const callId = sipMsg.headers.get('call-id') || '';
    
    // Terminar llamada en el asistente de voz
    this.voiceAssistant.endCall(callId);
    
    // Responder con 200 OK
    const response = this.createResponse(sipMsg, 200, 'OK', rinfo);
    this.sendResponse(response, rinfo);
    
    this.emit('callEnded', { callId });
  }

  private handleOptions(sipMsg: SipMessage, rinfo: dgram.RemoteInfo): void {
    console.log('[SIP Proxy] ❓ Manejando OPTIONS');
    
    // Responder con 200 OK y capacidades
    const response = this.createResponse(sipMsg, 200, 'OK', rinfo);
    this.sendResponse(response, rinfo);
  }

  private forwardToZadarma(message: string, rinfo: dgram.RemoteInfo): void {
    console.log('[SIP Proxy] ↗️ Reenviando mensaje a Zadarma');
    
    this.server.send(
      message, 
      0, 
      message.length, 
      this.zadarmaEndpoint.port, 
      this.zadarmaEndpoint.host,
      (err) => {
        if (err) {
          console.error('[SIP Proxy] Error al reenviar a Zadarma:', err);
        }
      }
    );
  }

  private createResponse(
    originalMsg: SipMessage, 
    code: number, 
    reason: string, 
    rinfo: dgram.RemoteInfo,
    body?: string
  ): string {
    const via = originalMsg.headers.get('via') || '';
    const from = originalMsg.headers.get('from') || '';
    const to = originalMsg.headers.get('to') || '';
    const callId = originalMsg.headers.get('call-id') || '';
    const cseq = originalMsg.headers.get('cseq') || '';
    
    let response = [
      `SIP/2.0 ${code} ${reason}`,
      `Via: ${via}`,
      `From: ${from}`,
      `To: ${to}`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq}`,
      `Contact: <sip:proxy@${this.getPublicIP()}:${this.port}>`,
      `Content-Length: ${body ? body.length : 0}`
    ];

    if (body) {
      response.push('Content-Type: application/sdp');
      response.push('');
      response.push(body);
    } else {
      response.push('');
    }

    return response.join('\r\n');
  }

  private sendResponse(response: string, rinfo: dgram.RemoteInfo): void {
    this.server.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
      if (err) {
        console.error('[SIP Proxy] Error al enviar respuesta:', err);
      } else {
        console.log(`[SIP Proxy] 📤 Respuesta enviada a ${rinfo.address}:${rinfo.port}`);
      }
    });
  }

  private generateSDP(): string {
    const publicIP = this.getPublicIP();
    
    return [
      'v=0',
      `o=proxy 123456 654321 IN IP4 ${publicIP}`,
      's=Voice Call Session',
      `c=IN IP4 ${publicIP}`,
      't=0 0',
      'm=audio 8000 RTP/AVP 0 8 101',
      'a=rtpmap:0 PCMU/8000',
      'a=rtpmap:8 PCMA/8000',
      'a=rtpmap:101 telephone-event/8000',
      'a=fmtp:101 0-16',
      'a=sendrecv'
    ].join('\r\n');
  }

  private getPublicIP(): string {
    // En producción, esto debería obtener la IP pública real
    // Por ahora retornamos la IP del servidor
    return process.env.PUBLIC_IP || '127.0.0.1';
  }

  /**
   * Obtener estadísticas del servidor
   */
  getStatus(): any {
    return {
      running: true,
      port: this.port,
      host: this.host,
      registeredClients: this.registeredClients.size,
      zadarmaEndpoint: this.zadarmaEndpoint
    };
  }
}