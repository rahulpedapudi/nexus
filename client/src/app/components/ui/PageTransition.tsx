import { motion } from 'motion/react';
import { ReactNode } from 'react';

export const PageTransition = ({ children, className = '' }: { children: ReactNode; className?: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
