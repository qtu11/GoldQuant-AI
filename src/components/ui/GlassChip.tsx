'use client';

import React from 'react';

interface GlassChipProps {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  tone?: 'cyan' | 'purple' | 'yellow' | 'default';
}

const ACTIVE: Record<NonNullable<GlassChipProps['tone']>, string> = {
  cyan: 'bg-neon-cyan/15 border-neon-cyan/35 text-neon-cyan',
  purple: 'bg-neon-purple/15 border-neon-purple/35 text-neon-purple',
  yellow: 'bg-neon-yellow/15 border-neon-yellow/35 text-neon-yellow',
  default: 'bg-white/10 border-white/20 text-white',
};

/**
 * Pill filter chip — liquid glass.
 */
export default function GlassChip({
  children,
  active = false,
  onClick,
  className = '',
  tone = 'cyan',
}: GlassChipProps) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold rounded-full border transition-all duration-300 pressable max-w-[180px] truncate ${
        active
          ? ACTIVE[tone]
          : 'border-white/10 text-dark-text-muted hover:text-white hover:bg-white/5 bg-white/[0.03]'
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
