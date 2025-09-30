import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  animation?: 'bounce' | 'pulse' | 'shake' | 'glow' | 'scale';
  loading?: boolean;
  success?: boolean;
  children: React.ReactNode;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  variant = 'default',
  size = 'default',
  animation = 'scale',
  loading = false,
  success = false,
  className,
  children,
  disabled,
  ...props
}) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
    >
      <Button
        variant={variant}
        size={size}
        className={cn(
          "relative overflow-hidden",
          loading && "cursor-not-allowed",
          success && "bg-green-500 hover:bg-green-600",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          </motion.div>
        )}
        <span className={cn("flex items-center gap-2", loading && "opacity-0")}>
          {success && (
            <motion.svg
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </motion.svg>
          )}
          {children}
        </span>
      </Button>
    </motion.div>
  );
};

// Botón flotante de acción con animaciones
interface FloatingActionButtonProps {
  onClick?: () => void;
  icon: React.ReactNode;
  label?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onClick,
  icon,
  label,
  position = 'bottom-right',
  variant = 'primary',
  size = 'md'
}) => {
  const positions = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };

  const variants = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-500 hover:bg-gray-600 text-white',
    success: 'bg-green-500 hover:bg-green-600 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    danger: 'bg-red-500 hover:bg-red-600 text-white'
  };

  const sizes = {
    sm: 'w-12 h-12',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  };

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.1, y: -2 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      onClick={onClick}
      className={cn(
        "fixed z-50 rounded-full shadow-lg",
        "flex items-center justify-center",
        "transition-all duration-200",
        positions[position],
        variants[variant],
        sizes[size]
      )}
      title={label}
    >
      {icon}
    </motion.button>
  );
};

// Grupo de botones con animaciones stagger
interface AnimatedButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'tight' | 'normal' | 'loose';
  className?: string;
}

export const AnimatedButtonGroup: React.FC<AnimatedButtonGroupProps> = ({
  children,
  orientation = 'horizontal',
  spacing = 'normal',
  className
}) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const orientationClasses = {
    horizontal: 'flex-row',
    vertical: 'flex-col'
  };

  const spacingClasses = {
    tight: 'gap-1',
    normal: 'gap-2',
    loose: 'gap-4'
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "flex",
        orientationClasses[orientation],
        spacingClasses[spacing],
        className
      )}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div key={index} variants={itemVariants}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
};

// Toggle switch animado
interface AnimatedToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md'
}) => {
  const sizes = {
    sm: { track: 'w-8 h-4', thumb: 'w-3 h-3', offset: 16 },
    md: { track: 'w-10 h-5', thumb: 'w-4 h-4', offset: 20 },
    lg: { track: 'w-12 h-6', thumb: 'w-5 h-5', offset: 24 }
  };

  const currentSize = sizes[size];

  return (
    <div className="flex items-center gap-3">
      {label && (
        <span className={cn(
          "text-sm font-medium",
          disabled && "text-gray-400"
        )}>
          {label}
        </span>
      )}
      <motion.button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex items-center rounded-full transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          currentSize.track,
          checked ? "bg-blue-500" : "bg-gray-200",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        whileTap={!disabled ? { scale: 0.95 } : {}}
      >
        <motion.span
          className={cn(
            "inline-block rounded-full bg-white shadow-md",
            currentSize.thumb
          )}
          animate={{
            x: checked ? currentSize.offset : 2
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.button>
    </div>
  );
};
