'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTradingStore } from '../store/useTradingStore';
import { UserPlus, X } from 'lucide-react';

interface CreateOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (ownerName: string, ownerKey: string) => void;
}

export default function CreateOwnerModal({
  isOpen,
  onClose,
  onCreated,
}: CreateOwnerModalProps) {
  const createOwner = useTradingStore((s) => s.createOwner);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const owner = await createOwner({ name, note });
      setName('');
      setNote('');
      onClose();
      onCreated?.(
        owner.name,
        owner.name.trim().toLowerCase().replace(/\s+/g, ' ')
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không tạo được chủ sở hữu.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/65 backdrop-blur-2xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-owner-title"
    >
      <div className="liquid-modal-panel max-w-md w-full relative animate-in fade-in zoom-in-95 duration-300">
        <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent z-10 pointer-events-none" />

        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-neon-purple/35 to-neon-cyan/20 border border-white/15 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-neon-purple stroke-[1.75]" />
              </div>
              <h3
                id="create-owner-title"
                className="font-display text-lg font-semibold text-white tracking-tight"
              >
                Tạo chủ sở hữu
              </h3>
            </div>
            <p className="text-[12px] text-[#8E8E93] pl-[2.85rem] leading-relaxed">
              Bước 1 · Mỗi người có dashboard riêng trước khi gắn MT5.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/8 border border-white/10 text-[#A1A1A6] hover:text-white hover:bg-white/12 flex items-center justify-center pressable flex-shrink-0"
            aria-label="Đóng"
          >
            <X className="w-4 h-4 stroke-[2]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="liquid-modal-body px-6 pb-2 space-y-4">
            <div className="liquid-section space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-[#A1A1A6] mb-1.5">
                  Tên chủ sở hữu
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Tôi, Anh Nam, Chị Lan…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="liquid-field"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#A1A1A6] mb-1.5">
                  Ghi chú <span className="text-[#636366]">(tuỳ chọn)</span>
                </label>
                <input
                  type="text"
                  placeholder="SĐT, vai trò…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="liquid-field"
                />
              </div>
            </div>
          </div>

          <div className="liquid-modal-footer flex items-center justify-end gap-2.5 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-5 rounded-full text-[13px] font-semibold text-[#E5E5EA] bg-white/8 border border-white/12 hover:bg-white/12 pressable"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="h-11 px-6 rounded-full text-[13px] font-semibold text-[#050507] bg-gradient-to-r from-[#4CC9FF] to-[#8A7DFF] hover:brightness-110 pressable disabled:opacity-40 shadow-[0_8px_28px_rgba(76,201,255,0.28)] flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4 stroke-[1.75]" />
              {loading ? 'Đang tạo…' : 'Tạo & mở dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
