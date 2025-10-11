import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, Archive, Trash2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import type { Patient } from '@/types/patient';

interface DeletePatientDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (hardDelete: boolean) => void;
  patient: Patient | null;
  isLoading?: boolean;
}

export const DeletePatientDialog: React.FC<DeletePatientDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  patient,
  isLoading = false,
}) => {
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');

  if (!patient) return null;

  const handleConfirm = () => {
    onConfirm(deleteMode === 'hard');
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-xl">
                Gestionar Paciente
              </AlertDialogTitle>
            </div>
          </div>
          <AlertDialogDescription className="pt-4 space-y-4">
            <p className="text-base">
              Seleccione qué acción desea realizar con el paciente:
            </p>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p className="font-semibold text-gray-900">{patient.name}</p>
              <p className="text-sm text-gray-600">
                Documento: {patient.document}
              </p>
              {patient.phone && (
                <p className="text-sm text-gray-600">
                  Teléfono: {patient.phone}
                </p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                Estado actual: <span className="font-medium">{patient.status}</span>
              </p>
            </div>

            <RadioGroup value={deleteMode} onValueChange={(value) => setDeleteMode(value as 'soft' | 'hard')}>
              {/* Opción 1: Inactivar */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-blue-200 bg-blue-50 cursor-pointer hover:bg-blue-100">
                <RadioGroupItem value="soft" id="soft" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="soft" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Archive className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-900">Inactivar Paciente</span>
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                      El paciente quedará marcado como "Inactivo" pero sus datos permanecerán en el sistema.
                      Puede reactivarse posteriormente.
                    </p>
                  </Label>
                </div>
              </div>

              {/* Opción 2: Eliminar permanentemente */}
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-red-200 bg-red-50 cursor-pointer hover:bg-red-100">
                <RadioGroupItem value="hard" id="hard" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="hard" className="cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-900">Eliminar Permanentemente</span>
                    </div>
                    <p className="text-xs text-red-700 mt-1">
                      ⚠️ Se eliminará PERMANENTEMENTE de la base de datos junto con todo su historial,
                      citas y documentos. <strong>Esta acción NO se puede deshacer.</strong>
                    </p>
                  </Label>
                </div>
              </div>
            </RadioGroup>

            {deleteMode === 'hard' && (
              <div className="bg-red-100 p-3 rounded-lg border-2 border-red-300">
                <p className="text-sm text-red-900 font-bold">
                  🚨 ADVERTENCIA FINAL
                </p>
                <p className="text-xs text-red-800 mt-1">
                  La eliminación permanente borrará TODOS los registros asociados sin posibilidad de recuperación.
                  Use esta opción solo si está completamente seguro.
                </p>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className={
              deleteMode === 'hard'
                ? 'bg-red-600 hover:bg-red-700 focus:ring-red-600'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-600'
            }
          >
            {isLoading 
              ? 'Procesando...' 
              : deleteMode === 'hard' 
                ? 'Eliminar Permanentemente' 
                : 'Inactivar'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
