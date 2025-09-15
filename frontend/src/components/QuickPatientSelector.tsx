import { useState, useEffect } from 'react';
import { Search, User, Phone, Mail, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/api';

interface Patient {
  id: number;
  name: string;
  document: string;
  document_number?: string;
  phone?: string;
  email?: string;
  birth_date?: string;
  gender?: string;
  eps?: string;
}

interface QuickPatientSelectorProps {
  onPatientSelect: (patient: Patient) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

export const QuickPatientSelector = ({ 
  onPatientSelect, 
  placeholder = "Buscar paciente por nombre o documento...",
  className = "",
  autoFocus = true
}: QuickPatientSelectorProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Buscar pacientes cuando cambie la consulta
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setPatients([]);
      setSelectedIndex(-1);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const result = await api.getPatients(searchQuery);
        const formattedPatients = (result || []).map((p: any) => ({
          id: Number(p.id),
          name: p.name || '',
          document: p.document || p.document_number || '',
          document_number: p.document_number || p.document || '',
          phone: p.phone || '',
          email: p.email || '',
          birth_date: p.birth_date || '',
          gender: p.gender || '',
          eps: p.eps || ''
        }));
        setPatients(formattedPatients);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Error buscando pacientes:', error);
        setPatients([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Manejar navegación con teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (patients.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < patients.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : patients.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < patients.length) {
          handlePatientSelect(patients[selectedIndex]);
        }
        break;
      case 'Escape':
        setPatients([]);
        setSelectedIndex(-1);
        break;
    }
  };

  const handlePatientSelect = (patient: Patient) => {
    onPatientSelect(patient);
    setSearchQuery(patient.name);
    setPatients([]);
    setSelectedIndex(-1);
  };

  const getPatientAge = (birthDate: string) => {
    if (!birthDate) return '';
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age > 0 ? `${age} años` : '';
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === query.toLowerCase() ? 
        <mark key={index} className="bg-yellow-200 px-1 rounded">{part}</mark> : 
        part
    );
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-4 py-2 w-full"
          autoFocus={autoFocus}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {patients.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 z-50 mt-1"
          >
            <Card className="shadow-lg border border-gray-200">
              <CardContent className="p-0">
                <ScrollArea className="max-h-80">
                  <div className="p-2">
                    {patients.map((patient, index) => (
                      <motion.div
                        key={patient.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Button
                          variant="ghost"
                          className={`w-full p-4 h-auto justify-start text-left hover:bg-blue-50 ${
                            selectedIndex === index ? 'bg-blue-100 border-blue-300' : ''
                          }`}
                          onClick={() => handlePatientSelect(patient)}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <User className="w-5 h-5 text-blue-600" />
                              </div>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-900 truncate">
                                    {highlightText(patient.name, searchQuery)}
                                  </h4>
                                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                    <div className="flex items-center gap-1">
                                      <FileText className="w-3 h-3" />
                                      <span>{highlightText(patient.document, searchQuery)}</span>
                                    </div>
                                    {patient.phone && (
                                      <div className="flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        <span>{patient.phone}</span>
                                      </div>
                                    )}
                                    {patient.email && (
                                      <div className="flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        <span className="truncate">{patient.email}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex flex-col gap-1 ml-2">
                                  {patient.gender && (
                                    <Badge variant="outline" className="text-xs">
                                      {patient.gender}
                                    </Badge>
                                  )}
                                  {patient.birth_date && (
                                    <Badge variant="outline" className="text-xs">
                                      {getPatientAge(patient.birth_date)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              
                              {patient.eps && (
                                <div className="mt-2">
                                  <Badge className="text-xs bg-green-100 text-green-800">
                                    EPS: {patient.eps}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </Button>
                        
                        {index < patients.length - 1 && (
                          <Separator className="my-1" />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {searchQuery.length >= 2 && !loading && patients.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 z-50 mt-1"
        >
          <Card className="shadow-lg border border-gray-200">
            <CardContent className="p-4 text-center text-gray-500">
              <User className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No se encontraron pacientes</p>
              <p className="text-sm">Intenta con otro nombre o documento</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default QuickPatientSelector;