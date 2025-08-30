import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, HelpCircle, Info, CheckCircle, XCircle } from 'lucide-react';
import { AnimatedButton } from './animated-button';

export type ConfirmationType = 'danger' | 'warning' | 'info' | 'success' | 'question';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: ConfirmationType;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  icon?: React.ReactNode;
}

const typeConfig = {
  danger: {
    icon: XCircle,
    iconColor: 'text-red-500',
    confirmVariant: 'destructive' as const,
    borderColor: 'border-red-200',
    bgColor: 'bg-red-50'
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    confirmVariant: 'default' as const,
    borderColor: 'border-yellow-200',
    bgColor: 'bg-yellow-50'
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    confirmVariant: 'default' as const,
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50'
  },
  success: {
    icon: CheckCircle,
    iconColor: 'text-green-500',
    confirmVariant: 'default' as const,
    borderColor: 'border-green-200',
    bgColor: 'bg-green-50'
  },
  question: {
    icon: HelpCircle,
    iconColor: 'text-blue-500',
    confirmVariant: 'default' as const,
    borderColor: 'border-blue-200',
    bgColor: 'bg-blue-50'
  }
};

export const AnimatedConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'question',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  loading = false,
  icon
}) => {
  const config = typeConfig[type];
  const Icon = icon ? () => icon : config.icon;

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };

  const modalVariants = {
    hidden: { 
      opacity: 0, 
      scale: 0.8, 
      y: 50,
      rotateX: -15
    },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      rotateX: 0,
      transition: {
        type: "spring",
        duration: 0.5,
        bounce: 0.3
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8, 
      y: 50,
      rotateX: 15,
      transition: {
        duration: 0.2
      }
    }
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: { 
      scale: 1, 
      rotate: 0,
      transition: {
        type: "spring",
        delay: 0.2,
        duration: 0.6,
        bounce: 0.6
      }
    }
  };

  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        delay: 0.3,
        duration: 0.3
      }
    }
  };

  const buttonVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: 0.4 + (i * 0.1),
        duration: 0.3,
        type: "spring",
        stiffness: 300
      }
    })
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className={cn(
              "relative bg-white rounded-xl shadow-2xl max-w-md w-full border-2",
              config.borderColor
            )}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            style={{ perspective: 1000 }}
          >
            {/* Header with icon */}
            <motion.div
              className={cn(
                "flex flex-col items-center px-6 pt-6 pb-4 border-b",
                config.bgColor,
                config.borderColor
              )}
              variants={contentVariants}
            >
              <motion.div
                variants={iconVariants}
                className={cn(
                  "w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center mb-4",
                  "border-2",
                  config.borderColor
                )}
              >
                <Icon className={cn("w-8 h-8", config.iconColor)} />
              </motion.div>

              <motion.h3
                variants={contentVariants}
                className="text-lg font-semibold text-gray-900 text-center"
              >
                {title}
              </motion.h3>
            </motion.div>

            {/* Content */}
            <motion.div
              className="px-6 py-4"
              variants={contentVariants}
            >
              <p className="text-sm text-gray-600 text-center leading-relaxed">
                {message}
              </p>
            </motion.div>

            {/* Actions */}
            <motion.div
              className="flex gap-3 px-6 pb-6"
              variants={contentVariants}
            >
              <motion.div
                className="flex-1"
                variants={buttonVariants}
                initial="hidden"
                animate="visible"
                custom={0}
              >
                <AnimatedButton
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                  animation="scale"
                  className="w-full"
                >
                  {cancelText}
                </AnimatedButton>
              </motion.div>

              <motion.div
                className="flex-1"
                variants={buttonVariants}
                initial="hidden"
                animate="visible"
                custom={1}
              >
                <AnimatedButton
                  variant={config.confirmVariant}
                  onClick={onConfirm}
                  loading={loading}
                  animation="bounce"
                  className="w-full"
                >
                  {confirmText}
                </AnimatedButton>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook para manejar confirmaciones
export const useConfirmation = () => {
  const [confirmationState, setConfirmationState] = React.useState<{
    isOpen: boolean;
    props: Omit<ConfirmationModalProps, 'isOpen' | 'onClose' | 'onConfirm'>;
    onConfirm: () => void;
  } | null>(null);

  const confirm = React.useCallback((
    props: Omit<ConfirmationModalProps, 'isOpen' | 'onClose' | 'onConfirm'>
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmationState({
        isOpen: true,
        props,
        onConfirm: () => {
          setConfirmationState(null);
          resolve(true);
        }
      });
    });
  }, []);

  const closeConfirmation = React.useCallback(() => {
    setConfirmationState(null);
  }, []);

  const ConfirmationModal = React.useMemo(() => {
    if (!confirmationState) return null;

    return (
      <AnimatedConfirmationModal
        {...confirmationState.props}
        isOpen={confirmationState.isOpen}
        onClose={closeConfirmation}
        onConfirm={confirmationState.onConfirm}
      />
    );
  }, [confirmationState, closeConfirmation]);

  return {
    confirm,
    ConfirmationModal
  };
};

// Componentes de conveniencia
export const confirmDanger = (title: string, message: string) => ({
  title,
  message,
  type: 'danger' as const,
  confirmText: 'Eliminar',
  cancelText: 'Cancelar'
});

export const confirmWarning = (title: string, message: string) => ({
  title,
  message,
  type: 'warning' as const,
  confirmText: 'Continuar',
  cancelText: 'Cancelar'
});

export const confirmInfo = (title: string, message: string) => ({
  title,
  message,
  type: 'info' as const,
  confirmText: 'Entendido',
  cancelText: 'Cerrar'
});
