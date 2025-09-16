// Tipos para el servicio de llamadas de voz

export interface ZadarmaCallEvent {
  event: 'NOTIFY_START' | 'NOTIFY_END' | 'NOTIFY_RECORD' | 'NOTIFY_ANSWER';
  call_start: string;
  pbx_call_id: string;
  caller_id: string;
  called_did: string;
  duration?: number;
  disposition?: string;
  call_id_with_rec?: string;
  is_recorded?: number;
}

export interface CallRecord {
  id?: number;
  call_id: string;
  caller_number: string;
  called_number: string;
  start_time: Date;
  end_time?: Date;
  duration?: number;
  recording_url?: string;
  transcript?: string;
  agent_response?: string;
  audio_response_url?: string;
  patient_id?: number;
  appointment_created?: boolean;
  status: 'incoming' | 'processing' | 'completed' | 'failed';
  created_at?: Date;
}

export interface STTResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface TTSResult {
  audioUrl: string;
  duration?: number;
  voiceId?: string;
  size?: number;
}

export interface VoiceProcessingResult {
  success: boolean;
  transcript?: string;
  response?: string;
  audioUrl?: string;
  patientRegistered?: boolean;
  appointmentCreated?: boolean;
  error?: string;
}

export interface WhatsAppAgentResponse {
  message: string;
  followUpQuestions?: string[];
  suggestedActions?: string[];
  requiresHumanIntervention?: boolean;
  mcpToolsUsed?: string[];
  confidence: number;
}

export interface PatientData {
  name?: string;
  document?: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  specialty?: string;
  appointmentDate?: string;
}

export interface CallSession {
  callId: string;
  callerId: string;
  startTime: Date;
  context: {
    conversationHistory: string[];
    patientData?: Partial<PatientData>;
    currentIntent?: string;
    step?: string;
  };
  lastActivity: Date;
}

export interface ZadarmaWebhookPayload {
  [key: string]: any;
  signature?: string;
}

export interface AudioFile {
  url: string;
  localPath?: string;
  duration?: number;
  size?: number;
  format: 'mp3' | 'wav' | 'ogg';
}