// ==============================================
// COMPONENTE DE DOCUMENTOS MÉDICOS
// ==============================================

import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Eye, 
  Plus, 
  Filter,
  Calendar,
  User,
  FileImage,
  FileVideo,
  File
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface PatientDocument {
  id: number;
  patient_id: number;
  filename: string;
  original_filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  category: string;
  description?: string;
  uploaded_by: number;
  uploaded_at: string;
  patient_name?: string;
  uploaded_by_name?: string;
}

const DOCUMENT_CATEGORIES = [
  'Historia Clínica',
  'Resultados de Laboratorio',
  'Imágenes Médicas',
  'Prescripciones',
  'Informes Médicos',
  'Consentimientos',
  'Facturas',
  'Otros'
];

interface DocumentManagerProps {
  patientId?: number;
  showPatientFilter?: boolean;
  compact?: boolean;
}

export function DocumentManager({ patientId, showPatientFilter = false, compact = false }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [categories, setCategories] = useState<string[]>(DOCUMENT_CATEGORIES);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadData, setUploadData] = useState({
    patient_id: patientId || 0,
    category: '',
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Cargar documentos
  const loadDocuments = async () => {
    if (!patientId && !showPatientFilter) return;
    
    try {
      setLoading(true);
      let response;
      
      if (patientId) {
        response = await api.documents.getPatientDocuments(patientId, selectedCategory || undefined);
      } else {
        // Implementar endpoint para obtener todos los documentos con filtros
        response = await api.documents.getPatientDocuments(0); // Placeholder
      }
      
      if (response.success) {
        setDocuments(response.data);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los documentos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cargar categorías
  const loadCategories = async () => {
    try {
      const response = await api.documents.getCategories();
      if (response.success) {
        setCategories(response.data);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Subir documento
  const handleUpload = async () => {
    if (!selectedFile || !uploadData.patient_id || !uploadData.category) {
      toast({
        title: "Error",
        description: "Completa todos los campos requeridos",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await api.documents.upload(selectedFile, uploadData);
      
      if (response.success) {
        toast({
          title: "Documento subido",
          description: "El documento se ha subido correctamente",
        });
        setUploadDialogOpen(false);
        setSelectedFile(null);
        setUploadData({
          patient_id: patientId || 0,
          category: '',
          description: '',
        });
        loadDocuments();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: "Error",
        description: "No se pudo subir el documento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Eliminar documento
  const handleDelete = async (id: number) => {
    try {
      const response = await api.documents.delete(id);
      if (response.success) {
        toast({
          title: "Documento eliminado",
          description: "El documento se ha eliminado correctamente",
        });
        loadDocuments();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el documento",
        variant: "destructive",
      });
    }
  };

  // Obtener icono según el tipo de archivo
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <FileImage className="h-4 w-4" />;
    } else if (mimeType.startsWith('video/')) {
      return <FileVideo className="h-4 w-4" />;
    } else if (mimeType.includes('pdf') || mimeType.includes('document')) {
      return <FileText className="h-4 w-4" />;
    }
    return <File className="h-4 w-4" />;
  };

  // Formatear tamaño de archivo
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Formatear fecha
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
    loadDocuments();
    loadCategories();
  }, [patientId, selectedCategory]);

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Documentos</CardTitle>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Subir
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Subir Documento</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="file">Archivo</Label>
                    <Input
                      id="file"
                      type="file"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Categoría</Label>
                    <Select value={uploadData.category} onValueChange={(value) => setUploadData(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="description">Descripción (opcional)</Label>
                    <Textarea
                      id="description"
                      value={uploadData.description}
                      onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descripción del documento..."
                    />
                  </div>
                  <Button onClick={handleUpload} disabled={loading} className="w-full">
                    {loading ? 'Subiendo...' : 'Subir Documento'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-60">
            {documents.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No hay documentos disponibles
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      {getFileIcon(doc.mime_type)}
                      <div>
                        <p className="text-sm font-medium">{doc.original_filename}</p>
                        <p className="text-xs text-muted-foreground">{doc.category}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => api.documents.download(doc.id)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. El documento será eliminado permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(doc.id)}>
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros y acciones */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-semibold">Documentos Médicos</h2>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="h-4 w-4 mr-2" />
              Subir Documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Subir Documento Médico</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {!patientId && (
                <div>
                  <Label htmlFor="patient">Paciente</Label>
                  <Input
                    id="patient"
                    type="number"
                    value={uploadData.patient_id}
                    onChange={(e) => setUploadData(prev => ({ ...prev, patient_id: parseInt(e.target.value) || 0 }))}
                    placeholder="ID del paciente"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="file">Archivo</Label>
                <Input
                  id="file"
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xls,.xlsx"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="category">Categoría</Label>
                <Select value={uploadData.category} onValueChange={(value) => setUploadData(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Descripción (opcional)</Label>
                <Textarea
                  id="description"
                  value={uploadData.description}
                  onChange={(e) => setUploadData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción del documento..."
                  rows={3}
                />
              </div>
              <Button onClick={handleUpload} disabled={loading} className="w-full">
                {loading ? 'Subiendo...' : 'Subir Documento'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de documentos */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Cargando documentos...</p>
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No hay documentos</h3>
              <p className="text-muted-foreground mb-4">
                {selectedCategory 
                  ? `No hay documentos en la categoría "${selectedCategory}"`
                  : "No se han subido documentos aún"
                }
              </p>
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Subir primer documento
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    {getFileIcon(doc.mime_type)}
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-sm truncate">{doc.original_filename}</h4>
                      <Badge variant="secondary" className="text-xs mt-1">
                        {doc.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {doc.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {doc.description}
                  </p>
                )}
                
                <div className="space-y-2 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDate(doc.uploaded_at)}</span>
                  </div>
                  {doc.uploaded_by_name && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{doc.uploaded_by_name}</span>
                    </div>
                  )}
                  <div>
                    <span>{formatFileSize(doc.file_size)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => api.documents.download(doc.id)}
                    className="flex-1"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Descargar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. El documento "{doc.original_filename}" será eliminado permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(doc.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default DocumentManager;
