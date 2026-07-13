'use client';

import React, { useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore';
import {
  detectFileType,
  getAcceptedFileTypes,
  getFileTypeLabel,
  parseFile,
  type SupportedFileType,
} from '../utils/fileParser';
import InfoTip from './InfoTip';

interface FileUploadProps {
  accountId: string;
  /** compact = 1 hàng (mặc định). full = dropzone lớn (hiếm dùng) */
  variant?: 'compact' | 'full';
}

export type FileUploadHandle = {
  openPicker: () => void;
};

const FileUpload = forwardRef<FileUploadHandle, FileUploadProps>(function FileUpload(
  { accountId, variant = 'compact' },
  ref
) {
  const { uploadHistory } = useTradingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<SupportedFileType>('csv');
  const [tradeCount, setTradeCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useImperativeHandle(ref, () => ({
    openPicker: () => {
      const el = fileInputRef.current;
      if (!el) {
        console.warn('[FileUpload] input ref missing');
        return;
      }
      // Reset value để chọn lại cùng file vẫn fire onChange
      el.value = '';
      el.click();
    },
  }));

  const processFile = useCallback(
    async (file: File) => {
      if (!file) return;

      const detectedType = detectFileType(file);
      setFileType(detectedType);
      setFileName(file.name);
      setStatus('loading');
      setErrorMessage('');
      setTradeCount(0);

      try {
        // Luôn đọc ArrayBuffer — HTML MT5 thường UTF-16; Excel cần binary
        const buffer = await file.arrayBuffer();
        let type = detectedType;
        if (type === 'unknown') {
          // đoán theo magic/content
          const u8 = new Uint8Array(buffer);
          if (u8[0] === 0x50 && u8[1] === 0x4b) type = 'excel'; // zip/xlsx
          else type = 'html';
        }

        const trades = await parseFile(buffer, type);

        if (trades.length === 0) {
          setStatus('error');
          setErrorMessage(
            `Không tìm thấy lệnh đóng hợp lệ trong "${file.name}" (${getFileTypeLabel(type)}). ` +
              `Dùng Report History đầy đủ (Positions) từ MT5: History → Report → Excel/HTML.`
          );
          return;
        }

        // Upload full report → thay thế history (parseFile đã gộp đúng)
        await uploadHistory(accountId, trades);
        setTradeCount(trades.length);
        setStatus('success');

        setTimeout(() => {
          setStatus('idle');
          setFileName('');
          setTradeCount(0);
        }, 4000);
      } catch (err) {
        console.error('Lỗi khi xử lý file:', err);
        setStatus('error');
        setErrorMessage(
          `Lỗi khi đọc file: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    },
    [accountId, uploadHistory]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);
      if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      if (e.target.files?.[0]) {
        processFile(e.target.files[0]);
        e.target.value = '';
      }
    },
    [processFile]
  );

  const openPicker = () => {
    const el = fileInputRef.current;
    if (!el) return;
    el.value = '';
    el.click();
  };

  const inputEl = (
    <input
      ref={fileInputRef}
      type="file"
      accept={getAcceptedFileTypes()}
      className="sr-only"
      tabIndex={-1}
      onChange={handleChange}
    />
  );

  if (variant === 'compact') {
    return (
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`neon-card-premium neon-card-static flex flex-wrap items-center gap-3 px-4 py-3 border transition-all duration-300 ${
          isDragActive
            ? 'border-neon-cyan/50 bg-neon-cyan/10 shadow-[0_0_28px_rgba(76,201,255,0.12)]'
            : status === 'success'
              ? 'border-neon-green/35'
              : status === 'error'
                ? 'border-neon-pink/40'
                : 'border-white/10'
        }`}
      >
        {inputEl}

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="icon-tile icon-tile-cyan !w-9 !h-9 flex-shrink-0">
            {status === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin stroke-[1.75]" />
            ) : status === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-neon-green stroke-[1.75]" />
            ) : status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-neon-pink stroke-[1.75]" />
            ) : (
              <Upload className="w-4 h-4 stroke-[1.75]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Upload History
              </span>
              <InfoTip title="Cách tải lịch sử MT5" align="left">
                <p>
                  <strong className="text-white">1.</strong> MT5 → History → Report → Save as
                  Excel / HTML / CSV.
                </p>
                <p>
                  <strong className="text-white">2.</strong> Kéo thả file vào đây hoặc bấm «Chọn
                  file».
                </p>
                <p>
                  <strong className="text-white">3.</strong> Hệ thống parse lệnh, cập nhật stats +
                  equity (kèm nạp/rút nếu có).
                </p>
                <p className="text-neon-cyan/90">Hỗ trợ: CSV · HTML · Excel (.xlsx) · TXT</p>
              </InfoTip>
            </div>
            <p className="text-[10px] text-dark-text-muted truncate mt-0.5">
              {status === 'loading' && `Đang phân tích ${fileName}…`}
              {status === 'success' && `✓ ${tradeCount} lệnh · ${fileName}`}
              {status === 'error' && (errorMessage || 'Lỗi — thử lại')}
              {status === 'idle' &&
                (isDragActive
                  ? 'Thả file vào đây…'
                  : 'Kéo thả file MT5 hoặc chọn · CSV / HTML / Excel / TXT')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex gap-1">
            {['CSV', 'HTML', 'XLSX', 'TXT'].map((t) => (
              <span
                key={t}
                className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-dark-border text-dark-text-muted"
              >
                {t}
              </span>
            ))}
          </div>
          {status === 'error' ? (
            <button
              type="button"
              onClick={() => {
                setStatus('idle');
                setErrorMessage('');
              }}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
            >
              Thử lại
            </button>
          ) : (
            <button
              type="button"
              onClick={openPicker}
              disabled={status === 'loading'}
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg border border-neon-purple/40 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-40"
            >
              Chọn file
            </button>
          )}
        </div>
      </div>
    );
  }

  // full dropzone (ít dùng)
  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer min-h-[140px] flex flex-col items-center justify-center ${
          isDragActive
            ? 'border-neon-cyan bg-neon-cyan/10'
            : 'border-dark-border hover:border-neon-purple/50 bg-dark-card'
        }`}
        onClick={openPicker}
      >
        {inputEl}
        <Upload className="w-6 h-6 text-neon-cyan mb-2" />
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-extrabold text-white">Upload History</p>
          <InfoTip title="Cách tải lịch sử MT5">
            <p>MT5 → History → Report → Excel/HTML/CSV. Kéo thả hoặc chọn file.</p>
          </InfoTip>
        </div>
        <p className="text-xs text-dark-text-muted mt-1">CSV · HTML · Excel · TXT</p>
      </div>
    </div>
  );
});

export default FileUpload;

