import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Input } from './input';
import { Label } from './label';
import { Textarea } from './textarea';

// Wrapper animado para formularios
interface AnimatedFormProps {
  children: React.ReactNode;
  className?: string;
  onSubmit?: (e: React.FormEvent) => void;
}

export const AnimatedForm: React.FC<AnimatedFormProps> = ({
  children,
  className,
  onSubmit
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

  return (
    <motion.form
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn("space-y-4", className)}
      onSubmit={onSubmit}
    >
      {children}
    </motion.form>
  );
};

// Input field animado con validación visual
interface AnimatedInputFieldProps {
  label?: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export const AnimatedInputField: React.FC<AnimatedInputFieldProps> = ({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  icon,
  className,
  inputProps
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const fieldVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  const errorVariants = {
    hidden: { opacity: 0, height: 0, y: -10 },
    visible: { 
      opacity: 1, 
      height: 'auto', 
      y: 0,
      transition: { duration: 0.2 }
    }
  };

  const iconVariants = {
    normal: { scale: 1, color: '#6b7280' },
    focused: { scale: 1.1, color: '#3b82f6' },
    error: { scale: 1.1, color: '#ef4444' }
  };

  const getIconState = () => {
    if (error && hasInteracted) return 'error';
    if (isFocused) return 'focused';
    return 'normal';
  };

  return (
    <motion.div
      variants={fieldVariants}
      className={cn("space-y-2", className)}
    >
      {label && (
        <Label className={cn(
          "text-sm font-medium transition-colors",
          error && hasInteracted && "text-red-500",
          isFocused && !error && "text-blue-500"
        )}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        {icon && (
          <motion.div
            variants={iconVariants}
            animate={getIconState()}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10"
          >
            {icon}
          </motion.div>
        )}
        
        <motion.div
          animate={{
            scale: isFocused ? 1.01 : 1,
            borderColor: error && hasInteracted ? '#ef4444' : 
                        isFocused ? '#3b82f6' : '#d1d5db'
          }}
          transition={{ duration: 0.2 }}
        >
          <Input
            type={type}
            placeholder={placeholder}
            {...inputProps}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              setHasInteracted(true);
            }}
            disabled={disabled}
            className={cn(
              "transition-all duration-200",
              icon && "pl-10",
              error && hasInteracted && "border-red-500 focus:border-red-500",
              "focus:ring-2 focus:ring-opacity-20",
              isFocused && !error && "ring-blue-500"
            )}
          />
        </motion.div>
      </div>

      <AnimatePresence>
        {error && hasInteracted && (
          <motion.div
            variants={errorVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="flex items-center gap-1 text-red-500 text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Textarea animado
interface AnimatedTextareaFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  rows?: number;
  className?: string;
}

export const AnimatedTextareaField: React.FC<AnimatedTextareaFieldProps> = ({
  label,
  placeholder,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
  rows = 3,
  className
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const fieldVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <motion.div
      variants={fieldVariants}
      className={cn("space-y-2", className)}
    >
      {label && (
        <Label className={cn(
          "text-sm font-medium transition-colors",
          error && hasInteracted && "text-red-500",
          isFocused && !error && "text-blue-500"
        )}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <motion.div
        animate={{
          scale: isFocused ? 1.01 : 1,
          borderColor: error && hasInteracted ? '#ef4444' : 
                      isFocused ? '#3b82f6' : '#d1d5db'
        }}
        transition={{ duration: 0.2 }}
      >
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            setHasInteracted(true);
          }}
          disabled={disabled}
          rows={rows}
          className={cn(
            "transition-all duration-200 resize-none",
            error && hasInteracted && "border-red-500 focus:border-red-500",
            "focus:ring-2 focus:ring-opacity-20",
            isFocused && !error && "ring-blue-500"
          )}
        />
      </motion.div>

      <AnimatePresence>
        {error && hasInteracted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1 text-red-500 text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Select animado
interface Option {
  value: string;
  label: string;
}

interface AnimatedSelectFieldProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const AnimatedSelectField: React.FC<AnimatedSelectFieldProps> = ({
  label,
  placeholder = "Seleccionar opción...",
  value,
  onChange,
  options,
  error,
  required = false,
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const fieldVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  const dropdownVariants = {
    hidden: { opacity: 0, scale: 0.95, y: -10 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { duration: 0.2 }
    }
  };

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <motion.div
      variants={fieldVariants}
      className={cn("space-y-2", className)}
    >
      {label && (
        <Label className={cn(
          "text-sm font-medium transition-colors",
          error && hasInteracted && "text-red-500",
          isOpen && !error && "text-blue-500"
        )}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <motion.button
          type="button"
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              setHasInteracted(true);
            }
          }}
          animate={{
            borderColor: error && hasInteracted ? '#ef4444' : 
                        isOpen ? '#3b82f6' : '#d1d5db'
          }}
          className={cn(
            "w-full px-3 py-2 text-left bg-white border rounded-md shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-opacity-20",
            "flex items-center justify-between",
            disabled && "bg-gray-50 cursor-not-allowed",
            error && hasInteracted && "border-red-500",
            isOpen && !error && "ring-blue-500 border-blue-500"
          )}
        >
          <span className={cn(
            selectedOption ? "text-gray-900" : "text-gray-500"
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <motion.svg
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              variants={dropdownVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto"
            >
              {options.map((option, index) => (
                <motion.button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0,
                    transition: { delay: index * 0.05 }
                  }}
                  whileHover={{ backgroundColor: '#f3f4f6' }}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-gray-50",
                    "transition-colors duration-150",
                    value === option.value && "bg-blue-50 text-blue-600"
                  )}
                >
                  {option.label}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {error && hasInteracted && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1 text-red-500 text-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Progress indicator para formularios multi-paso
interface FormProgressProps {
  steps: string[];
  currentStep: number;
  className?: string;
}

export const FormProgress: React.FC<FormProgressProps> = ({
  steps,
  currentStep,
  className
}) => {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => (
          <div key={index} className="flex items-center">
            <motion.div
              initial={false}
              animate={{
                backgroundColor: index <= currentStep ? '#3b82f6' : '#e5e7eb',
                color: index <= currentStep ? '#ffffff' : '#6b7280',
                scale: index === currentStep ? 1.1 : 1
              }}
              transition={{ duration: 0.3 }}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center",
                "text-sm font-medium border-2 border-transparent"
              )}
            >
              {index < currentStep ? (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </motion.svg>
              ) : (
                index + 1
              )}
            </motion.div>
            {index < steps.length - 1 && (
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: index < currentStep ? '#3b82f6' : '#e5e7eb'
                }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="w-12 h-1 mx-2"
              />
            )}
          </div>
        ))}
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Paso {currentStep + 1} de {steps.length}: {steps[currentStep]}
        </p>
      </div>
    </div>
  );
};
