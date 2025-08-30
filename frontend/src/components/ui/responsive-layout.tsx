import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Breakpoints responsive
const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px'
};

// Grid system mejorado
interface ResponsiveGridProps {
  children: React.ReactNode;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  gap?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  className?: string;
  animated?: boolean;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  cols = { default: 1, md: 2, lg: 3 },
  gap = { default: 4 },
  className,
  animated = true
}) => {
  const getGridClasses = () => {
    const classes = ['grid'];
    
    // Columns
    if (cols.default) classes.push(`grid-cols-${cols.default}`);
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    if (cols['2xl']) classes.push(`2xl:grid-cols-${cols['2xl']}`);
    
    // Gap
    if (gap.default) classes.push(`gap-${gap.default}`);
    if (gap.sm) classes.push(`sm:gap-${gap.sm}`);
    if (gap.md) classes.push(`md:gap-${gap.md}`);
    if (gap.lg) classes.push(`lg:gap-${gap.lg}`);
    if (gap.xl) classes.push(`xl:gap-${gap.xl}`);
    
    return classes.join(' ');
  };

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

  if (animated) {
    return (
      <motion.div
        className={cn(getGridClasses(), className)}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {React.Children.map(children, (child, index) => (
          <motion.div key={index} variants={itemVariants}>
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div className={cn(getGridClasses(), className)}>
      {children}
    </div>
  );
};

// Container responsivo con padding inteligente
interface ResponsiveContainerProps {
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  padding?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  className?: string;
  animated?: boolean;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  children,
  size = 'lg',
  padding = { default: 4, md: 6, lg: 8 },
  className,
  animated = true
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return 'max-w-screen-sm';
      case 'md': return 'max-w-screen-md';
      case 'lg': return 'max-w-screen-lg';
      case 'xl': return 'max-w-screen-xl';
      case 'full': return 'max-w-full';
      default: return 'max-w-screen-lg';
    }
  };

  const getPaddingClasses = () => {
    const classes = [];
    if (padding.default) classes.push(`p-${padding.default}`);
    if (padding.sm) classes.push(`sm:p-${padding.sm}`);
    if (padding.md) classes.push(`md:p-${padding.md}`);
    if (padding.lg) classes.push(`lg:p-${padding.lg}`);
    return classes.join(' ');
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" }
    }
  };

  if (animated) {
    return (
      <motion.div
        className={cn(
          'mx-auto w-full',
          getSizeClasses(),
          getPaddingClasses(),
          className
        )}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {children}
      </motion.div>
    );
  }

  return (
    <div className={cn(
      'mx-auto w-full',
      getSizeClasses(),
      getPaddingClasses(),
      className
    )}>
      {children}
    </div>
  );
};

// Stack layout para elementos verticales
interface StackProps {
  children: React.ReactNode;
  space?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  align?: 'start' | 'center' | 'end' | 'stretch';
  direction?: 'column' | 'row';
  wrap?: boolean;
  className?: string;
  animated?: boolean;
}

export const Stack: React.FC<StackProps> = ({
  children,
  space = { default: 4 },
  align = 'stretch',
  direction = 'column',
  wrap = false,
  className,
  animated = true
}) => {
  const getSpaceClasses = () => {
    const classes = [];
    const property = direction === 'column' ? 'space-y' : 'space-x';
    
    if (space.default) classes.push(`${property}-${space.default}`);
    if (space.sm) classes.push(`sm:${property}-${space.sm}`);
    if (space.md) classes.push(`md:${property}-${space.md}`);
    if (space.lg) classes.push(`lg:${property}-${space.lg}`);
    
    return classes.join(' ');
  };

  const getAlignClasses = () => {
    if (direction === 'column') {
      switch (align) {
        case 'start': return 'items-start';
        case 'center': return 'items-center';
        case 'end': return 'items-end';
        case 'stretch': return 'items-stretch';
        default: return 'items-stretch';
      }
    } else {
      switch (align) {
        case 'start': return 'items-start';
        case 'center': return 'items-center';
        case 'end': return 'items-end';
        case 'stretch': return 'items-stretch';
        default: return 'items-center';
      }
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: direction === 'column' ? 10 : 0, x: direction === 'row' ? 10 : 0 },
    visible: { opacity: 1, y: 0, x: 0 }
  };

  if (animated) {
    return (
      <motion.div
        className={cn(
          'flex',
          direction === 'column' ? 'flex-col' : 'flex-row',
          wrap && 'flex-wrap',
          getAlignClasses(),
          getSpaceClasses(),
          className
        )}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {React.Children.map(children, (child, index) => (
          <motion.div key={index} variants={itemVariants}>
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div className={cn(
      'flex',
      direction === 'column' ? 'flex-col' : 'flex-row',
      wrap && 'flex-wrap',
      getAlignClasses(),
      getSpaceClasses(),
      className
    )}>
      {children}
    </div>
  );
};

// Flex layout mejorado
interface FlexProps {
  children: React.ReactNode;
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  wrap?: boolean;
  gap?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  className?: string;
  animated?: boolean;
}

export const Flex: React.FC<FlexProps> = ({
  children,
  direction = 'row',
  justify = 'start',
  align = 'center',
  wrap = false,
  gap = { default: 4 },
  className,
  animated = true
}) => {
  const getDirectionClasses = () => {
    switch (direction) {
      case 'row': return 'flex-row';
      case 'col': return 'flex-col';
      case 'row-reverse': return 'flex-row-reverse';
      case 'col-reverse': return 'flex-col-reverse';
      default: return 'flex-row';
    }
  };

  const getJustifyClasses = () => {
    switch (justify) {
      case 'start': return 'justify-start';
      case 'end': return 'justify-end';
      case 'center': return 'justify-center';
      case 'between': return 'justify-between';
      case 'around': return 'justify-around';
      case 'evenly': return 'justify-evenly';
      default: return 'justify-start';
    }
  };

  const getAlignClasses = () => {
    switch (align) {
      case 'start': return 'items-start';
      case 'end': return 'items-end';
      case 'center': return 'items-center';
      case 'baseline': return 'items-baseline';
      case 'stretch': return 'items-stretch';
      default: return 'items-center';
    }
  };

  const getGapClasses = () => {
    const classes = [];
    if (gap.default) classes.push(`gap-${gap.default}`);
    if (gap.sm) classes.push(`sm:gap-${gap.sm}`);
    if (gap.md) classes.push(`md:gap-${gap.md}`);
    if (gap.lg) classes.push(`lg:gap-${gap.lg}`);
    return classes.join(' ');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
  };

  if (animated) {
    return (
      <motion.div
        className={cn(
          'flex',
          getDirectionClasses(),
          getJustifyClasses(),
          getAlignClasses(),
          wrap && 'flex-wrap',
          getGapClasses(),
          className
        )}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {React.Children.map(children, (child, index) => (
          <motion.div key={index} variants={itemVariants}>
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div className={cn(
      'flex',
      getDirectionClasses(),
      getJustifyClasses(),
      getAlignClasses(),
      wrap && 'flex-wrap',
      getGapClasses(),
      className
    )}>
      {children}
    </div>
  );
};

// Hook para detectar breakpoints
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = React.useState<string>('default');

  React.useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      
      if (width >= 1536) setBreakpoint('2xl');
      else if (width >= 1280) setBreakpoint('xl');
      else if (width >= 1024) setBreakpoint('lg');
      else if (width >= 768) setBreakpoint('md');
      else if (width >= 640) setBreakpoint('sm');
      else setBreakpoint('default');
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  const isBreakpoint = (bp: string) => {
    const sizes = ['default', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = sizes.indexOf(breakpoint);
    const targetIndex = sizes.indexOf(bp);
    return currentIndex >= targetIndex;
  };

  return {
    breakpoint,
    isBreakpoint,
    isMobile: breakpoint === 'default' || breakpoint === 'sm',
    isTablet: breakpoint === 'md',
    isDesktop: ['lg', 'xl', '2xl'].includes(breakpoint)
  };
};
