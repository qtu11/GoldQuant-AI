'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

const ease = [0.22, 0.61, 0.36, 1] as const;

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Soft fade + blur page transition (Liquid Glass motion language).
 */
export default function PageTransition({ children, className = '' }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        // Không dùng filter/blur — tránh tạo stacking context che modal fixed
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3, ease }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
