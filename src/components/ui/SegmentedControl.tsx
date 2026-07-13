'use client';

import React from 'react';

export interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  /** Optional leading label inside the track */
  leading?: string;
}

/**
 * Apple-style liquid glass segmented control (capsule track + active pill).
 */
export default function SegmentedControl({
  options,
  value,
  onChange,
  size = 'sm',
  className = '',
  leading,
}: SegmentedControlProps) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-[10px]' : 'px-3.5 py-1.5 text-xs';

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-1 rounded-full bg-white/[0.04] border border-white/10 backdrop-blur-xl ${className}`}
      role="tablist"
    >
      {leading && (
        <span className="text-[10px] font-semibold text-dark-text-muted uppercase tracking-wider px-2">
          {leading}
        </span>
      )}
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`${pad} rounded-full font-semibold transition-all duration-300 ease-[cubic-bezier(.22,.61,.36,1)] pressable ${
              active
                ? 'bg-gradient-to-r from-neon-cyan/90 to-neon-purple/85 text-dark-bg shadow-[0_0_20px_rgba(76,201,255,0.2)]'
                : 'text-dark-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
