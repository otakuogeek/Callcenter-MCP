import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from "@/lib/utils";

// Configuraciones de animación predefinidas mejoradas
const animationVariants = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  },
  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
  },
  slideDown: {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.3 } }
  },
  slideLeft: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
  },
  slideRight: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, x: 20, transition: { duration: 0.3 } }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
  },
  bounce: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      transition: { 
        duration: 0.6, 
        ease: "easeOut",
        type: "spring",
        stiffness: 100,
        damping: 10
      } 
    },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } }
  },
  stagger: {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    },
    exit: { 
      opacity: 0,
      transition: {
        staggerChildren: 0.05,
        staggerDirection: -1
      }
    }
  },
  staggerChild: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  }
};

// Animaciones de hover para elementos interactivos
const hoverAnimations = {
  lift: { scale: 1.02, y: -2, transition: { duration: 0.2 } },
  scale: { scale: 1.05, transition: { duration: 0.2 } },
  glow: { 
    boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)", 
    transition: { duration: 0.2 } 
  },
  subtle: { scale: 1.01, transition: { duration: 0.2 } }
};

interface EnhancedAnimatedContainerProps {
  children: React.ReactNode;
  animation?: keyof typeof animationVariants;
  hover?: keyof typeof hoverAnimations | boolean;
  delay?: number;
  duration?: number;
  className?: string;
  layout?: boolean;
  layoutId?: string;
  onClick?: () => void;
  disabled?: boolean;
  as?: keyof JSX.IntrinsicElements;
}

export const EnhancedAnimatedContainer: React.FC<EnhancedAnimatedContainerProps> = ({
  children,
  animation = 'fadeIn',
  hover = false,
  delay = 0,
  duration,
  className = '',
  layout = false,
  layoutId,
  onClick,
  disabled = false,
  as = 'div'
}) => {
  const MotionComponent = motion[as] as any;
  
  const variants = animationVariants[animation];
  
  // Customizar duración si se proporciona
  const customVariants = duration ? {
    ...variants,
    visible: {
      ...variants.visible,
      transition: { ...variants.visible.transition, duration }
    }
  } : variants;

  // Configurar animación de hover
  const hoverAnimation = hover === true ? hoverAnimations.subtle : 
                        hover && typeof hover === 'string' ? hoverAnimations[hover] : 
                        undefined;

  return (
    <MotionComponent
      variants={customVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout={layout}
      layoutId={layoutId}
      whileHover={!disabled && hoverAnimation ? hoverAnimation : undefined}
      whileTap={!disabled && onClick ? { scale: 0.98 } : undefined}
      className={cn(className)}
      onClick={onClick}
      style={{ 
        transitionDelay: delay ? `${delay}ms` : undefined,
        cursor: onClick ? 'pointer' : undefined
      }}
    >
      {children}
    </MotionComponent>
  );
};

// Componente específico para cards interactivas con efectos visuales mejorados
interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'elevated' | 'interactive';
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  onClick,
  disabled = false,
  variant = 'default'
}) => {
  const baseClassName = "rounded-lg border bg-card text-card-foreground shadow-sm";
  
  const variantClasses = {
    default: "",
    elevated: "shadow-md",
    interactive: "cursor-pointer hover:shadow-lg transition-shadow"
  };

  return (
    <EnhancedAnimatedContainer
      animation="slideUp"
      hover={onClick ? "lift" : false}
      className={cn(baseClassName, variantClasses[variant], className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </EnhancedAnimatedContainer>
  );
};

// Componente para listas con animación stagger mejorada
interface EnhancedStaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  staggerDelay?: number;
}

export const EnhancedStaggerContainer: React.FC<EnhancedStaggerContainerProps> = ({ 
  children, 
  className = '',
  delay = 0,
  staggerDelay = 0.1
}) => {
  const customStaggerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.2
      }
    },
    exit: { 
      opacity: 0,
      transition: {
        staggerChildren: staggerDelay / 2,
        staggerDirection: -1
      }
    }
  };

  return (
    <motion.div
      variants={customStaggerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={cn(className)}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </motion.div>
  );
};

// Componente hijo mejorado para usar en StaggerContainer
interface EnhancedStaggerChildProps {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  hover?: boolean;
  onClick?: () => void;
}

export const EnhancedStaggerChild: React.FC<EnhancedStaggerChildProps> = ({ 
  children, 
  className = '',
  as = 'div',
  hover = false,
  onClick
}) => {
  const MotionComponent = motion[as] as any;
  
  return (
    <MotionComponent
      variants={animationVariants.staggerChild}
      whileHover={hover ? hoverAnimations.subtle : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      className={cn(className)}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {children}
    </MotionComponent>
  );
};

// Wrapper mejorado para AnimatePresence
interface EnhancedAnimatedPresenceWrapperProps {
  children: React.ReactNode;
  mode?: "wait" | "sync" | "popLayout";
  initial?: boolean;
}

export const EnhancedAnimatedPresenceWrapper: React.FC<EnhancedAnimatedPresenceWrapperProps> = ({ 
  children, 
  mode = "wait",
  initial = true 
}) => {
  return (
    <AnimatePresence mode={mode} initial={initial}>
      {children}
    </AnimatePresence>
  );
};

// Componente específico para modales con animaciones suaves
interface AnimatedModalProps {
  children: React.ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  className?: string;
}

export const AnimatedModal: React.FC<AnimatedModalProps> = ({
  children,
  isOpen,
  onClose,
  className = ''
}) => {
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.2 } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0, 
      transition: { 
        duration: 0.3, 
        ease: "easeOut",
        type: "spring",
        stiffness: 300,
        damping: 30
      } 
    },
    exit: { 
      opacity: 0, 
      scale: 0.95, 
      y: 20, 
      transition: { duration: 0.2 } 
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            variants={modalVariants}
            className={cn(
              "bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-auto",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
