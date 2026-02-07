// ============================================
// VISTA DE PACIENTES DUPLICADOS
// ============================================

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  AlertTriangle,
  FileText,
  Phone,
  User,
  Calendar,
  Mail,
  Building,
  Copy,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface DuplicatePatient {
  id: number;
  document: string;
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  gender: string;
  status: string;
  created_at: string;
  eps_name: string;
}

interface DuplicateGroup {
  duplicate_value: string;
  duplicate_type: string;
  count: number;
  patients: DuplicatePatient[];
}

interface DuplicatesData {
  type: string;
  total_groups: number;
  total_duplicates: number;
  groups: DuplicateGroup[];
}

export const DuplicatesView = () => {
  const { toast } = useToast();
  const [duplicateType, setDuplicateType] = useState<'document' | 'name' | 'phone'>('document');

  // Consultar duplicados
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['patients-duplicates', duplicateType],
    queryFn: async () => {
      const response = await fetch(`/api/patients-v2/duplicates?type=${duplicateType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Error al cargar duplicados');
      
      const result = await response.json();
      return result.data as DuplicatesData;
    },
  });

  const getTypeLabel = () => {
    switch (duplicateType) {
      case 'document': return 'Documento';
      case 'name': return 'Nombre';
      case 'phone': return 'Teléfono';
    }
  };

  const getTypeIcon = () => {
    switch (duplicateType) {
      case 'document': return <FileText className="w-4 h-4" />;
      case 'name': return <User className="w-4 h-4" />;
      case 'phone': return <Phone className="w-4 h-4" />;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'No registrada';
    try {
      return format(new Date(dateStr), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "dd/MM/yyyy", { locale: es });
    } catch {
      return dateStr;
    }
  };

  const handleOpenPatient = (patientId: number) => {
    // Abrir en nueva pestaña
    window.open(`/admin/patients?view=${patientId}`, '_blank');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copiado',
      description: 'Valor copiado al portapapeles',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Pacientes Duplicados
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Identifica y gestiona registros duplicados en el sistema
          </p>
        </div>
        
        <div className="flex gap-2 items-center">
          <Select
            value={duplicateType}
            onValueChange={(value) => setDuplicateType(value as 'document' | 'name' | 'phone')}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tipo de duplicado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="document">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Mismo Documento
                </div>
              </SelectItem>
              <SelectItem value="name">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Mismo Nombre
                </div>
              </SelectItem>
              <SelectItem value="phone">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Mismo Teléfono
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-700">Grupos con duplicados</p>
                  <p className="text-2xl font-bold text-amber-800">{data.total_groups}</p>
                </div>
                <Users className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-700">Total registros duplicados</p>
                  <p className="text-2xl font-bold text-red-800">{data.total_duplicates}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700">Filtrando por</p>
                  <p className="text-2xl font-bold text-blue-800 flex items-center gap-2">
                    {getTypeIcon()}
                    {getTypeLabel()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lista de duplicados */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-600" />
            <p className="text-gray-600">Analizando duplicados...</p>
          </CardContent>
        </Card>
      ) : !data || data.total_groups === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="w-16 h-16 mx-auto mb-4 text-green-400" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              ¡Sin duplicados!
            </h3>
            <p className="text-gray-600">
              No se encontraron pacientes duplicados por {getTypeLabel().toLowerCase()}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Accordion type="multiple" className="space-y-3">
            {data.groups.map((group, index) => (
              <AccordionItem 
                key={`${group.duplicate_type}-${group.duplicate_value}-${index}`} 
                value={`group-${index}`}
                className="border rounded-lg bg-white shadow-sm"
              >
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      {getTypeIcon()}
                      <div className="text-left">
                        <div className="font-medium text-gray-900 flex items-center gap-2">
                          {group.duplicate_value}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(group.duplicate_value);
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500">
                          {group.count} registros duplicados
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="ml-4">
                      {group.count} duplicados
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {group.patients.map((patient, pIndex) => (
                      <Card 
                        key={patient.id} 
                        className={`relative ${pIndex === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}
                      >
                        {pIndex === 0 && (
                          <Badge className="absolute -top-2 -right-2 bg-green-500">
                            Original
                          </Badge>
                        )}
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center justify-between">
                            <span className="truncate">{patient.name}</span>
                            <Badge variant={patient.status === 'Activo' ? 'default' : 'secondary'}>
                              {patient.status}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <FileText className="w-4 h-4" />
                            <span>{patient.document || 'Sin documento'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="w-4 h-4" />
                            <span>{patient.phone || 'Sin teléfono'}</span>
                          </div>
                          {patient.email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4" />
                              <span className="truncate">{patient.email}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>{formatShortDate(patient.birth_date)}</span>
                          </div>
                          {patient.eps_name && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Building className="w-4 h-4" />
                              <span className="truncate">{patient.eps_name}</span>
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-2">
                            Registrado: {formatDate(patient.created_at)}
                          </div>
                          
                          <div className="pt-2 border-t mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => handleOpenPatient(patient.id)}
                            >
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Ver Paciente #{patient.id}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}
    </div>
  );
};

export default DuplicatesView;
