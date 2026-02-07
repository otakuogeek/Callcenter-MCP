import { BookOpen } from "lucide-react";

export interface WikiDoc {
  slug: string;
  title: string;
  path: string;
  available: boolean;
}

export interface WikiDocContent {
  slug: string;
  title: string;
  content: string;
  path: string;
}

export interface WikiSearchResult {
  slug: string;
  title: string;
  path: string;
  matches: Array<{
    lineNumber: number;
    content: string;
  }>;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const wikiApi = {
  /**
   * Lista todos los documentos disponibles
   */
  async listDocs(): Promise<WikiDoc[]> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/wiki`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Error al cargar lista de documentos');
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Obtiene el contenido de un documento
   */
  async getDoc(slug: string): Promise<WikiDocContent> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/wiki/${slug}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Error al cargar el documento');
    }

    const data = await response.json();
    return data.data;
  },

  /**
   * Busca en la documentación
   */
  async search(query: string): Promise<WikiSearchResult[]> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE}/wiki/search/${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Error en la búsqueda');
    }

    const data = await response.json();
    return data.data.results;
  },
};

// Categorías de documentos para organización
export const WIKI_CATEGORIES: Record<string, string[]> = {
  '🏠 Inicio': [
    'inicio',
    'faq',
  ],
  '👤 Portal del Paciente': [
    'portal-paciente',
  ],
  '📅 Gestión de Agendas': [
    'admin-agendas',
    'admin-cola-espera',
  ],
  '👥 Gestión de Pacientes': [
    'admin-pacientes',
  ],
  '📱 Comunicaciones': [
    'admin-sms',
    'admin-whatsapp',
    'admin-llamadas',
  ],
  '🩺 Portal del Médico': [
    'doctor-portal',
  ],
  '⚙️ Configuración': [
    'admin-configuracion',
  ],
  '📚 Documentación Técnica': [
    'readme',
    'manual-uso',
    'resumen-proyecto',
    'guia-mantenimiento',
  ],
};

// Iconos por categoría
export const getCategoryIcon = (category: string) => {
  const icons: Record<string, typeof BookOpen> = {
    '📚 Documentación Principal': BookOpen,
    '📱 Sistema de Comunicaciones': BookOpen,
    '📞 Sistema de Llamadas': BookOpen,
    '👨‍⚕️ Portal de Doctores': BookOpen,
    '📅 Sistema de Citas': BookOpen,
    '📋 Historias Clínicas': BookOpen,
    '🔬 Sistema CUPS': BookOpen,
    '👤 Portal de Pacientes': BookOpen,
    '💬 WhatsApp Bot': BookOpen,
    '📊 Exportación y Reportes': BookOpen,
    '🏥 Autorizaciones EPS': BookOpen,
    '🔐 Administración': BookOpen,
  };
  return icons[category] || BookOpen;
};
