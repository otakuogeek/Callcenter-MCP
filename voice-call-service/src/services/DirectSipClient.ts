import { EventEmitter } from 'events';
import WebSocket from 'ws';

interface SipConfig {
  server: string;
  port: number;
  username: string;
  password: string;
  realm: string;
  autoRegister?: boolean;
}

interface CallSession {
  callId: string;
  sessionId: string;
  status: 'ringing' | 'connected' | 'ended' | 'incoming';
  remoteAddress?: string;
  localAddress?: string;
  startTime?: Date;
  endTime?: Date;
  audio?: any; // MediaStream not available in Node.js context
  from?: string;
  to?: string;
}

export class DirectSipClient extends EventEmitter {
  private config: SipConfig;
  private ws: WebSocket | null = null;
  private isRegistered: boolean = false;
  private activeCalls: Map<string, CallSession> = new Map();
  private registrationSequence = 1;
  private callSequence = 1;
  private sequences: number = 1;

  constructor(config: SipConfig) {
    super();
    this.config = config;
  }

  /**
   * Conectar al servidor SIP
   */
  async connect(): Promise<void> {
    try {
      const wsUrl = `wss://${this.config.server}:${this.config.port}/ws`;
      console.log(`[SIP] Conectando a ${wsUrl}`);

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('[SIP] Conexión WebSocket establecida');
        if (this.config.autoRegister !== false) {
          this.register();
        }
      });

      this.ws.on('message', (data: any) => {
        this.handleSipMessage(data.toString());
      });

      this.ws.on('error', (error: any) => {
        console.error('[SIP] Error WebSocket:', error);
        this.emit('error', error);
      });

      this.ws.on('close', () => {
        console.log('[SIP] Conexión cerrada');
        this.isRegistered = false;
        this.emit('disconnected');
      });

    } catch (error) {
      console.error('[SIP] Error conectando:', error);
      throw error;
    }
  }

  /**
   * Registrar extensión SIP
   */
  private sendMessage(message: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[SIP] WebSocket no está conectado');
      return false;
    }
    this.ws.send(message);
    return true;
  }

  private register(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[SIP] WebSocket no está conectado');
      return;
    }

    const callId = this.generateCallId();
    const cseq = this.sequences++;
    
    const registerMessage = [
      `REGISTER sip:${this.config.realm} SIP/2.0`,
      `Via: SIP/2.0/WSS ${this.config.server};branch=z9hG4bK${this.generateBranch()}`,
      `Max-Forwards: 70`,
      `To: <sip:${this.config.username}@${this.config.realm}>`,
      `From: <sip:${this.config.username}@${this.config.realm}>;tag=${this.generateTag()}`,
      `Call-ID: ${callId}`,
      `CSeq: ${cseq} REGISTER`,
      `Contact: <sip:${this.config.username}@${this.config.server}:${this.config.port};transport=ws>`,
      `Authorization: Digest username="${this.config.username}", realm="${this.config.realm}", nonce="", uri="sip:${this.config.realm}", response=""`,
      `Expires: 3600`,
      `Content-Length: 0`,
      ``,
      ``
    ].join('\r\n');

    console.log('[SIP] Enviando REGISTER');
    this.ws.send(registerMessage);
  }

  /**
   * Manejar mensajes SIP entrantes
   */
  private handleSipMessage(message: string): void {
    console.log('[SIP] Mensaje recibido:', message.substring(0, 200) + '...');

    const lines = message.split('\r\n');
    const firstLine = lines[0];

    if (firstLine.startsWith('SIP/2.0 200 OK')) {
      this.handleRegisterSuccess(message);
    } else if (firstLine.startsWith('INVITE')) {
      this.handleIncomingCall(message);
    } else if (firstLine.startsWith('BYE')) {
      this.handleCallEnd(message);
    } else if (firstLine.startsWith('ACK')) {
      this.handleAck(message);
    }
  }

  /**
   * Manejar registro exitoso
   */
  private handleRegisterSuccess(message: string): void {
    console.log('[SIP] ✅ Registro exitoso');
    this.isRegistered = true;
    this.emit('registered');
  }

  /**
   * Manejar llamada entrante
   */
  private handleIncomingCall(message: string): void {
    try {
      const callId = this.extractHeader(message, 'Call-ID');
      const from = this.extractHeader(message, 'From');
      const to = this.extractHeader(message, 'To');

      console.log(`[SIP] 📞 Llamada entrante: ${from} -> ${to}`);

      const session: CallSession = {
        callId: callId,
        sessionId: callId,
        from: this.extractSipUri(from),
        to: this.extractSipUri(to),
        status: 'incoming',
        startTime: new Date()
      };

      this.activeCalls.set(callId, session);

      // Responder automáticamente después de 1 segundo
      setTimeout(() => {
        this.answerCall(callId, message);
      }, 1000);

      this.emit('incomingCall', session);

    } catch (error) {
      console.error('[SIP] Error procesando llamada entrante:', error);
    }
  }

  /**
   * Responder llamada
   */
  private answerCall(callId: string, originalInvite: string): void {
    try {
      const session = this.activeCalls.get(callId);
      if (!session) {
        console.error('[SIP] Sesión no encontrada:', callId);
        return;
      }

      // Enviar 200 OK con SDP
      const cseq = this.extractHeader(originalInvite, 'CSeq');
      const from = this.extractHeader(originalInvite, 'From');
      const to = this.extractHeader(originalInvite, 'To');
      const via = this.extractHeader(originalInvite, 'Via');

      const sdp = this.generateSDP();

      const okResponse = [
        `SIP/2.0 200 OK`,
        `Via: ${via}`,
        `To: ${to};tag=${this.generateTag()}`,
        `From: ${from}`,
        `Call-ID: ${callId}`,
        `CSeq: ${cseq}`,
        `Contact: <sip:${this.config.username}@${this.config.server}:${this.config.port};transport=ws>`,
        `Content-Type: application/sdp`,
        `Content-Length: ${sdp.length}`,
        ``,
        sdp
      ].join('\r\n');

      console.log('[SIP] 📞 Respondiendo con 200 OK');
      this.sendMessage(okResponse);

      session.status = 'connected';
      this.emit('callConnected', session);

    } catch (error) {
      console.error('[SIP] Error respondiendo llamada:', error);
    }
  }

  /**
   * Colgar llamada
   */
  hangupCall(callId: string): void {
    try {
      const session = this.activeCalls.get(callId);
      if (!session) {
        console.error('[SIP] Sesión no encontrada para colgar:', callId);
        return;
      }

      const byeMessage = [
        `BYE sip:${session.from} SIP/2.0`,
        `Via: SIP/2.0/WSS ${this.config.server};branch=z9hG4bK${this.generateBranch()}`,
        `Max-Forwards: 70`,
        `To: <sip:${session.from}>`,
        `From: <sip:${this.config.username}@${this.config.realm}>;tag=${this.generateTag()}`,
        `Call-ID: ${callId}`,
        `CSeq: ${this.sequences++} BYE`,
        `Content-Length: 0`,
        ``,
        ``
      ].join('\r\n');

      console.log('[SIP] 📴 Colgando llamada');
      this.sendMessage(byeMessage);

      session.status = 'ended';
      this.activeCalls.delete(callId);
      this.emit('callEnded', session);

    } catch (error) {
      console.error('[SIP] Error colgando llamada:', error);
    }
  }

  /**
   * Manejar final de llamada
   */
  private handleCallEnd(message: string): void {
    const callId = this.extractHeader(message, 'Call-ID');
    const session = this.activeCalls.get(callId);
    
    if (session) {
      console.log('[SIP] 📴 Llamada terminada por el otro extremo');
      session.status = 'ended';
      this.activeCalls.delete(callId);
      this.emit('callEnded', session);

      // Responder con 200 OK al BYE
      const okResponse = [
        `SIP/2.0 200 OK`,
        `Call-ID: ${callId}`,
        `Content-Length: 0`,
        ``,
        ``
      ].join('\r\n');

      this.sendMessage(okResponse);
    }
  }

  /**
   * Manejar ACK
   */
  private handleAck(message: string): void {
    const callId = this.extractHeader(message, 'Call-ID');
    console.log('[SIP] ACK recibido para:', callId);
  }

  /**
   * Generar SDP para audio
   */
  private generateSDP(): string {
    const localIP = '127.0.0.1'; // En producción, usar IP real
    const rtpPort = 8000;

    return [
      'v=0',
      `o=biosanarcall ${Date.now()} ${Date.now()} IN IP4 ${localIP}`,
      's=Biosanarcall Voice Assistant',
      `c=IN IP4 ${localIP}`,
      't=0 0',
      `m=audio ${rtpPort} RTP/AVP 8 0 101`,
      'a=rtpmap:8 PCMA/8000',
      'a=rtpmap:0 PCMU/8000', 
      'a=rtpmap:101 telephone-event/8000',
      'a=sendrecv'
    ].join('\r\n');
  }

  /**
   * Utilidades para parsing SIP
   */
  private extractHeader(message: string, headerName: string): string {
    const lines = message.split('\r\n');
    for (const line of lines) {
      if (line.toLowerCase().startsWith(headerName.toLowerCase() + ':')) {
        return line.substring(headerName.length + 1).trim();
      }
    }
    return '';
  }

  private extractSipUri(header: string): string {
    const match = header.match(/<sip:([^>]+)>/);
    return match ? match[1] : header;
  }

  private generateCallId(): string {
    return Math.random().toString(36).substring(2) + '@' + this.config.server;
  }

  private generateBranch(): string {
    return Math.random().toString(36).substring(2);
  }

  private generateTag(): string {
    return Math.random().toString(36).substring(2);
  }

  /**
   * Obtener llamadas activas
   */
  getActiveCalls(): CallSession[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Verificar si está registrado
   */
  getRegistrationStatus(): boolean {
    return this.isRegistered;
  }

  /**
   * Desconectar
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isRegistered = false;
    this.activeCalls.clear();
  }
}