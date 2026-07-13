'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, X } from 'lucide-react';

interface Props {
  title?: string;
  children: React.ReactNode;
  /** side hint for panel placement */
  align?: 'left' | 'right';
  className?: string;
  size?: 'sm' | 'md';
}

/**
 * Nút (i) tròn — bấm mở hướng dẫn / giải thích.
 */
export default function InfoTip({
  title = 'Hướng dẫn',
  children,
  align = 'left',
  className = '',
  size = 'sm',
}: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const place = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const panelW = 280;
    let left = align === 'right' ? r.right - panelW : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - panelW - 8));
    let top = r.bottom + 8;
    if (top + 200 > window.innerHeight) {
      top = Math.max(8, r.top - 8 - 180);
    }
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    place();
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onScroll = () => place();
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, align]);

  const dim = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const icon = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={uid}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`${dim} rounded-full border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 hover:border-neon-cyan inline-flex items-center justify-center flex-shrink-0 transition-colors ${className}`}
      >
        <Info className={icon} strokeWidth={2.5} />
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-labelledby={`${uid}-title`}
            className="fixed z-[10000] w-[min(280px,calc(100vw-16px))] rounded-xl border border-neon-cyan/30 bg-[#12121a] shadow-2xl p-3.5 animate-in fade-in zoom-in-95 duration-150"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h5
                id={`${uid}-title`}
                className="text-[11px] font-black text-white uppercase tracking-wider"
              >
                {title}
              </h5>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-0.5 text-dark-text-muted hover:text-white"
                aria-label="Đóng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-[11px] text-dark-text-muted leading-relaxed space-y-1.5">
              {children}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
