import { useToast } from "@/hooks/use-toast";
import { useCallback } from "react";

export interface ApiError {
  message: string;
  status?: number;
  errors?: any;
}

export const useErrorHandler = () => {
  const { toast } = useToast();

  const handleError = useCallback((error: any, defaultMessage = "Ha ocurrido un error inesperado") => {
    console.error("Error capturado:", error);
    
    let message = defaultMessage;
    let title = "Error";
    
    if (error?.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    // Manejo específico para errores de API
    if (error?.status) {
      switch (error.status) {
        case 400:
          title = "Datos inválidos";
          message = error.message || "Los datos proporcionados no son válidos";
          break;
        case 401:
          title = "No autorizado";
          message = "Tu sesión ha expirado. Por favor, inicia sesión nuevamente";
          break;
        case 403:
          title = "Acceso denegado";
          message = "No tienes permisos para realizar esta acción";
          break;
        case 404:
          title = "No encontrado";
          message = "El recurso solicitado no fue encontrado";
          break;
        case 409:
          title = "Conflicto";
          message = error.message || "Ya existe un registro con estos datos";
          break;
        case 500:
          title = "Error del servidor";
          message = "Error interno del servidor. Por favor, intenta más tarde";
          break;
      }
    }

    toast({
      title,
      description: message,
      variant: "destructive",
    });

    return { title, message };
  }, [toast]);

  const handleSuccess = useCallback((message: string, title = "Éxito") => {
    toast({
      title,
      description: message,
    });
  }, [toast]);

  const handleApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    successMessage?: string,
    errorMessage?: string
  ): Promise<T | null> => {
    try {
      const result = await apiCall();
      if (successMessage) {
        handleSuccess(successMessage);
      }
      return result;
    } catch (error) {
      handleError(error, errorMessage);
      return null;
    }
  }, [handleError, handleSuccess]);

  return {
    handleError,
    handleSuccess,
    handleApiCall
  };
};
