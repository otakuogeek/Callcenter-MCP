import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// Base path para la documentación
const DOCS_BASE_PATH = path.join(__dirname, '../../../..');

// Mapeo de rutas de documentación
const WIKI_DOCS: Record<string, string> = {
  'manual-uso': 'docs/MANUAL_DE_USO.md',
  'resumen-proyecto': 'RESUMEN_PROYECTO_COMPLETO.md',
  'guia-mantenimiento': 'GUIA_MANTENIMIENTO.md',
  'indice-documentacion': 'INDICE_DOCUMENTACION.md',
  'readme': 'README.md',
  'sistema-sms': 'SISTEMA_SMS_RESUMEN.md',
  'sistema-llamadas': 'SISTEMA_LLAMADAS_BD_RESUMEN.md',
  'doctor-portal': 'DOCTOR_LOGIN_PORTAL.md',
  'sistema-historias': 'docs/SISTEMA_HISTORIAS_CLINICAS.md',
  'sistema-dictado': 'docs/SISTEMA_DICTADO_VOZ_IA.md',
  'sistema-pausas': 'docs/SISTEMA_PAUSAR_REANUDAR_AGENDAS.md',
  'doctor-auth': 'backend/docs/DOCTOR_AUTHENTICATION_SYSTEM.md',
  'elevenlabs-sync': 'backend/docs/ELEVENLABS_SYNC_SYSTEM.md',
};

/**
 * GET /api/wiki
 * Lista todos los documentos disponibles en la wiki
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const docs = Object.keys(WIKI_DOCS).map(slug => {
      const filePath = path.join(DOCS_BASE_PATH, WIKI_DOCS[slug]);
      const exists = fs.existsSync(filePath);
      
      // Extraer título del archivo (primera línea que empiece con #)
      let title = slug;
      if (exists) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const match = content.match(/^#\s+(.+)$/m);
          if (match) {
            title = match[1];
          }
        } catch (err) {
          console.warn(`Error reading title from ${slug}:`, err);
        }
      }

      return {
        slug,
        title,
        path: WIKI_DOCS[slug],
        available: exists,
      };
    });

    res.json({
      success: true,
      data: docs,
    });
  } catch (error: any) {
    console.error('Error listing wiki docs:', error);
    res.status(500).json({
      success: false,
      error: 'Error al listar documentos de la wiki',
    });
  }
});

/**
 * GET /api/wiki/:slug
 * Obtiene el contenido de un documento específico
 */
router.get('/:slug', (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    if (!WIKI_DOCS[slug]) {
      return res.status(404).json({
        success: false,
        error: 'Documento no encontrado',
      });
    }

    const filePath = path.join(DOCS_BASE_PATH, WIKI_DOCS[slug]);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Archivo no encontrado en el sistema',
      });
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    // Procesar imágenes relativas para que apunten a la ruta correcta
    const processedContent = content.replace(
      /!\[([^\]]*)\]\(\.\/([^)]+)\)/g,
      (match, alt, imagePath) => {
        // Convertir rutas relativas a absolutas desde el backend
        return `![${alt}](/api/wiki/images/${slug}/${imagePath})`;
      }
    );

    res.json({
      success: true,
      data: {
        slug,
        title: extractTitle(content),
        content: processedContent,
        path: WIKI_DOCS[slug],
      },
    });
  } catch (error: any) {
    console.error('Error reading wiki doc:', error);
    res.status(500).json({
      success: false,
      error: 'Error al leer el documento',
    });
  }
});

/**
 * GET /api/wiki/images/:slug/:imagePath
 * Sirve imágenes de la documentación
 */
router.get('/images/:slug/:imagePath(*)', (req: Request, res: Response) => {
  try {
    const { slug, imagePath } = req.params;

    if (!WIKI_DOCS[slug]) {
      return res.status(404).send('Documento no encontrado');
    }

    // Obtener directorio del documento
    const docPath = WIKI_DOCS[slug];
    const docDir = path.dirname(path.join(DOCS_BASE_PATH, docPath));
    
    // Construir ruta de la imagen
    const imageFullPath = path.join(docDir, imagePath);

    // Verificar que la imagen existe y está dentro del directorio permitido
    if (!imageFullPath.startsWith(DOCS_BASE_PATH)) {
      return res.status(403).send('Acceso denegado');
    }

    if (!fs.existsSync(imageFullPath)) {
      return res.status(404).send('Imagen no encontrada');
    }

    // Servir la imagen
    res.sendFile(imageFullPath);
  } catch (error: any) {
    console.error('Error serving image:', error);
    res.status(500).send('Error al servir la imagen');
  }
});

/**
 * GET /api/wiki/search
 * Búsqueda en la documentación
 */
router.get('/search/:query', (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    const searchTerm = query.toLowerCase();

    const results: any[] = [];

    Object.keys(WIKI_DOCS).forEach(slug => {
      const filePath = path.join(DOCS_BASE_PATH, WIKI_DOCS[slug]);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lowerContent = content.toLowerCase();

        if (lowerContent.includes(searchTerm)) {
          const title = extractTitle(content);
          
          // Encontrar contexto (líneas que contienen la búsqueda)
          const lines = content.split('\n');
          const matches = lines
            .map((line, index) => ({ line, index }))
            .filter(({ line }) => line.toLowerCase().includes(searchTerm))
            .slice(0, 3) // Máximo 3 coincidencias por documento
            .map(({ line, index }) => ({
              lineNumber: index + 1,
              content: line.trim(),
            }));

          results.push({
            slug,
            title,
            path: WIKI_DOCS[slug],
            matches,
          });
        }
      }
    });

    res.json({
      success: true,
      data: {
        query: searchTerm,
        results,
        count: results.length,
      },
    });
  } catch (error: any) {
    console.error('Error searching wiki:', error);
    res.status(500).json({
      success: false,
      error: 'Error en la búsqueda',
    });
  }
});

// Helper function para extraer título
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1] : 'Sin título';
}

export default router;
