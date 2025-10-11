import { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Shield,
  Eye,
  Edit,
  Trash2,
  FileText,
  MoreVertical,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { 
  Patient, 
  getInitials, 
  getAvatarColor, 
  calculateAge,
  getGenderBadgeColor,
  getAffiliationBadgeColor
} from '@/types/patient';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PatientCardProps {
  patient: Patient;
  onView: (patient: Patient) => void;
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  onGeneratePDF: (patient: Patient) => void;
}

export const PatientCard = ({
  patient,
  onView,
  onEdit,
  onDelete,
  onGeneratePDF
}: PatientCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const initials = getInitials(patient.name);
  const avatarColor = getAvatarColor(patient.id);
  const age = patient.birth_date ? calculateAge(patient.birth_date) : null;
  const formattedDate = patient.created_at 
    ? format(new Date(patient.created_at), "d 'de' MMM, yyyy", { locale: es })
    : 'N/A';

  return (
    <Card 
      className={`
        relative overflow-hidden transition-all duration-300 hover:shadow-xl
        ${isHovered ? 'scale-105 shadow-2xl' : 'shadow-md'}
        ${patient.status === 'Inactivo' ? 'opacity-75' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badge de estado en esquina superior derecha */}
      <div className="absolute top-2 right-2 z-10">
        {patient.status === 'Activo' ? (
          <Badge variant="default" className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="w-3 h-3 mr-1" />
            Activo
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-gray-400">
            <XCircle className="w-3 h-3 mr-1" />
            Inactivo
          </Badge>
        )}
      </div>

      <CardContent className="pt-6 pb-4">
        {/* Avatar y nombre */}
        <div className="flex items-start gap-4 mb-4">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg text-gray-900 truncate mb-1">
              {patient.name}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <User className="w-4 h-4" />
              <span className="font-mono">{patient.document}</span>
              {age && (
                <>
                  <span className="text-gray-400">•</span>
                  <span>{age} años</span>
                </>
              )}
            </div>
            
            {/* Badges de género y tipo de afiliación */}
            <div className="flex flex-wrap gap-2">
              <Badge className={`text-xs ${getGenderBadgeColor(patient.gender)}`}>
                {patient.gender}
              </Badge>
              
              {patient.insurance_affiliation_type && (
                <Badge className={`text-xs ${getAffiliationBadgeColor(patient.insurance_affiliation_type)}`}>
                  {patient.insurance_affiliation_type}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="space-y-2 mb-4">
          {patient.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Phone className="w-4 h-4 text-blue-500" />
              <span>{patient.phone}</span>
            </div>
          )}
          
          {patient.email && (
            <div className="flex items-center gap-2 text-sm text-gray-700 truncate">
              <Mail className="w-4 h-4 text-purple-500" />
              <span className="truncate">{patient.email}</span>
            </div>
          )}
          
          {patient.municipality_name && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <MapPin className="w-4 h-4 text-red-500" />
              <span className="truncate">{patient.municipality_name}</span>
            </div>
          )}
        </div>

        {/* EPS */}
        {patient.eps_name && (
          <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
            <Shield className="w-4 h-4 text-blue-600" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 mb-0.5">EPS</p>
              <p className="text-sm font-semibold text-blue-900 truncate">
                {patient.eps_name}
              </p>
            </div>
          </div>
        )}

        {/* Fecha de registro */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mt-3 pt-3 border-t">
          <Calendar className="w-3 h-3" />
          <span>Registrado: {formattedDate}</span>
        </div>
      </CardContent>

      <CardFooter className="bg-gray-50 border-t flex gap-2 p-3">
        {/* Botones principales */}
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onView(patient)}
          aria-label={`Ver detalles de ${patient.name}`}
        >
          <Eye className="w-4 h-4 mr-1" />
          Ver
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onEdit(patient)}
          aria-label={`Editar información de ${patient.name}`}
        >
          <Edit className="w-4 h-4 mr-1" />
          Editar
        </Button>

        {/* Menú de más opciones */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              aria-label={`Más opciones para ${patient.name}`}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onGeneratePDF(patient)}>
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(patient)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardFooter>
    </Card>
  );
};
