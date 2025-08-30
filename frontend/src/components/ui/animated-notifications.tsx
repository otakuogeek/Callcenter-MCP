import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface NotificationData {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  actions?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
  }[];
  persistent?: boolean;
}

interface AnimatedNotificationProps {
  notification: NotificationData;
  onDismiss: (id: string) => void;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
};

const colorMap = {
  success: {
    bg: 'bg-green-50 border-green-200',
    icon: 'text-green-500',
    title: 'text-green-800',
    message: 'text-green-700',
    progress: 'bg-green-500'
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
    message: 'text-red-700',
    progress: 'bg-red-500'
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200',
    icon: 'text-yellow-500',
    title: 'text-yellow-800',
    message: 'text-yellow-700',
    progress: 'bg-yellow-500'
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    title: 'text-blue-800',
    message: 'text-blue-700',
    progress: 'bg-blue-500'
  }
};

export const AnimatedNotification: React.FC<AnimatedNotificationProps> = ({
  notification,
  onDismiss,
  position
}) => {
  const Icon = iconMap[notification.type];
  const colors = colorMap[notification.type];
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    if (notification.persistent) return;

    const duration = notification.duration || 5000;
    const interval = 50;
    const step = (interval / duration) * 100;

    const timer = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev - step;
        if (newProgress <= 0) {
          onDismiss(notification.id);
          return 0;
        }
        return newProgress;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [notification, onDismiss]);

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2';
      default:
        return 'top-4 right-4';
    }
  };

  const slideVariants = {
    initial: {
      opacity: 0,
      x: position.includes('right') ? 100 : position.includes('left') ? -100 : 0,
      y: position.includes('top') ? -20 : position.includes('bottom') ? 20 : 0,
      scale: 0.95
    },
    animate: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    exit: {
      opacity: 0,
      x: position.includes('right') ? 100 : position.includes('left') ? -100 : 0,
      y: position.includes('top') ? -20 : position.includes('bottom') ? 20 : 0,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <motion.div
      variants={slideVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={cn(
        "fixed z-50 w-80 max-w-sm pointer-events-auto",
        getPositionClasses()
      )}
      layout
    >
      <div className={cn(
        "rounded-lg border shadow-lg overflow-hidden",
        colors.bg
      )}>
        {/* Progress bar */}
        {!notification.persistent && (
          <div className="h-1 bg-gray-200">
            <motion.div
              className={cn("h-full", colors.progress)}
              initial={{ width: "100%" }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
            >
              <Icon className={cn("w-5 h-5 mt-0.5", colors.icon)} />
            </motion.div>

            <div className="flex-1 min-w-0">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className={cn("text-sm font-medium", colors.title)}
              >
                {notification.title}
              </motion.p>

              {notification.message && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className={cn("mt-1 text-sm", colors.message)}
                >
                  {notification.message}
                </motion.p>
              )}

              {/* Actions */}
              {notification.actions && notification.actions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="mt-3 flex gap-2"
                >
                  {notification.actions.map((action, index) => (
                    <motion.button
                      key={index}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={action.onClick}
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded transition-colors",
                        action.variant === 'primary'
                          ? `bg-${notification.type}-600 text-white hover:bg-${notification.type}-700`
                          : `bg-white text-${notification.type}-600 border border-${notification.type}-300 hover:bg-${notification.type}-50`
                      )}
                    >
                      {action.label}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Close button */}
            <motion.button
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onDismiss(notification.id)}
              className={cn(
                "flex-shrink-0 p-1 rounded-full transition-colors",
                "hover:bg-white/50 focus:outline-none focus:ring-2 focus:ring-offset-2",
                colors.icon
              )}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Container para manejar múltiples notificaciones
interface NotificationContainerProps {
  notifications: NotificationData[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxNotifications?: number;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({
  notifications,
  onDismiss,
  position = 'top-right',
  maxNotifications = 5
}) => {
  const displayedNotifications = notifications.slice(0, maxNotifications);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence mode="popLayout">
        {displayedNotifications.map((notification, index) => (
          <motion.div
            key={notification.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              zIndex: 1000 - index
            }}
          >
            <AnimatedNotification
              notification={notification}
              onDismiss={onDismiss}
              position={position}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// Hook para gestionar notificaciones
export const useNotifications = () => {
  const [notifications, setNotifications] = React.useState<NotificationData[]>([]);

  const addNotification = React.useCallback((notification: Omit<NotificationData, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { ...notification, id }]);
    return id;
  }, []);

  const removeNotification = React.useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = React.useCallback(() => {
    setNotifications([]);
  }, []);

  // Funciones de conveniencia
  const success = React.useCallback((title: string, message?: string, options?: Partial<NotificationData>) => {
    return addNotification({ type: 'success', title, message, ...options });
  }, [addNotification]);

  const error = React.useCallback((title: string, message?: string, options?: Partial<NotificationData>) => {
    return addNotification({ type: 'error', title, message, ...options });
  }, [addNotification]);

  const warning = React.useCallback((title: string, message?: string, options?: Partial<NotificationData>) => {
    return addNotification({ type: 'warning', title, message, ...options });
  }, [addNotification]);

  const info = React.useCallback((title: string, message?: string, options?: Partial<NotificationData>) => {
    return addNotification({ type: 'info', title, message, ...options });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info
  };
};
