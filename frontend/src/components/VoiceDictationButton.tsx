import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VoiceDictationButtonProps {
  onTranscription: (text: string) => void;
  transcribeAudio: (audioBlob: Blob) => Promise<string>;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscription,
  transcribeAudio,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      // Solicitar permiso para el micrófono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Crear MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // Manejar datos de audio
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Manejar fin de grabación
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        
        // Detener todas las pistas del stream
        stream.getTracks().forEach(track => track.stop());
        
        // Transcribir el audio
        await transcribeRecording(audioBlob);
      };

      // Iniciar grabación
      mediaRecorder.start();
      setIsRecording(true);

      toast({
        title: "Grabando...",
        description: "Hable claramente cerca del micrófono",
      });

    } catch (error: any) {
      console.error('Error al iniciar grabación:', error);
      
      let errorMessage = 'No se pudo acceder al micrófono';
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = 'Permiso de micrófono denegado. Por favor, habilite el acceso en la configuración del navegador.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No se encontró ningún micrófono conectado';
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeRecording = async (audioBlob: Blob) => {
    setIsTranscribing(true);

    try {
      const transcription = await transcribeAudio(audioBlob);
      
      if (transcription && transcription.trim()) {
        onTranscription(transcription);
        
        toast({
          title: "Transcripción completada",
          description: `${transcription.substring(0, 50)}${transcription.length > 50 ? '...' : ''}`,
        });
      } else {
        toast({
          title: "Sin transcripción",
          description: "No se detectó voz. Intente hablar más cerca del micrófono.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error en transcripción:', error);
      
      toast({
        title: "Error en transcripción",
        description: error.message || 'No se pudo transcribir el audio. Verifique su configuración de OpenAI.',
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isTranscribing}
      className={`${className} ${isRecording ? 'bg-red-500 hover:bg-red-600 text-white' : ''}`}
      title={isRecording ? 'Detener grabación' : 'Iniciar dictado por voz'}
    >
      {isTranscribing ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Transcribiendo...
        </>
      ) : isRecording ? (
        <>
          <MicOff className="h-4 w-4 mr-2 animate-pulse" />
          Detener
        </>
      ) : (
        <>
          <Mic className="h-4 w-4 mr-2" />
          Dictar
        </>
      )}
    </Button>
  );
};

export default VoiceDictationButton;
