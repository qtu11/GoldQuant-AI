'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, FileSpreadsheet, Globe, File, Sparkles } from 'lucide-react';
import { useTradingStore } from '../store/useTradingStore';
import { detectFileType, getAcceptedFileTypes, getFileTypeLabel, parseFile, type SupportedFileType } from '../utils/fileParser';

interface FileUploadProps {
  accountId: string;
}

export default function FileUpload({ accountId }: FileUploadProps) {
  const { uploadHistory } = useTradingStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<SupportedFileType>('csv');
  const [tradeCount, setTradeCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const processFile = useCallback(async (file: File) => {
    if (!file) return;

    const detectedType = detectFileType(file);
    setFileType(detectedType);
    setFileName(file.name);
    setStatus('loading');
    setErrorMessage('');
    setTradeCount(0);

    try {
      let content: string | ArrayBuffer;

      if (detectedType === 'excel') {
        content = await readFileAsArrayBuffer(file);
      } else {
        content = await readFileAsText(file);
      }

      const trades = await parseFile(content, detectedType);

      if (trades.length === 0) {
        setStatus('error');
        setErrorMessage(
          detectedType === 'unknown'
            ? `Không nhận diện được định dạng file "${file.name}". Hỗ trợ: CSV, HTML, Excel (.xlsx/.xls), TXT.`
            : `Không tìm thấy dữ liệu giao dịch hợp lệ trong file ${getFileTypeLabel(detectedType)}. Hãy kiểm tra định dạng cột (cần có: Ticket, Time, Type, Profit...).`
        );
        return;
      }

      uploadHistory(accountId, trades);
      setTradeCount(trades.length);
      setStatus('success');

      setTimeout(() => {
        setStatus('idle');
        setFileName('');
        setTradeCount(0);
      }, 5000);

    } catch (err) {
      console.error('Lỗi khi xử lý file:', err);
      setStatus('error');
      setErrorMessage(`Lỗi khi đọc file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [accountId, uploadHistory]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
      e.target.value = '';
    }
  }, [processFile]);

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const getFileIcon = () => {
    switch (fileType) {
      case 'excel': return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'html': return <Globe className="w-5 h-5 text-blue-400" />;
      case 'csv':
      case 'txt': return <FileText className="w-5 h-5 text-amber-400" />;
      default: return <File className="w-5 h-5 text-dark-text-muted" />;
    }
  };

  return (
    <div className="space-y-3">
      <div 
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 flex flex-col items-center justify-center min-h-[170px] cursor-pointer ${
          isDragActive 
            ? 'border-gold bg-gold/5 scale-[1.01] shadow-[0_0_20px_rgba(245,182,27,0.1)]' 
            : status === 'success'
              ? 'border-emerald-500 bg-emerald-500/5'
              : status === 'error'
                ? 'border-red-500 bg-red-500/5'
                : 'border-white/10 hover:border-gold/50 bg-white/2 hover:bg-white/4 shadow-inner'
        }`}
        onClick={handleButtonClick}
      >
        <input 
          ref={fileInputRef}
          type="file"
          accept={getAcceptedFileTypes()}
          className="hidden"
          onChange={handleChange}
        />

        {status === 'idle' && (
          <>
            <div className="p-3 bg-gold/10 rounded-full text-gold mb-3 ring-2 ring-gold/10 pulse-glow-gold">
              <Upload className="w-5.5 h-5.5" />
            </div>
            <p className="text-sm font-extrabold text-white">Upload History</p>
            <p className="text-xs text-dark-text-muted mt-1.5 px-4 leading-normal">
              Kéo thả hoặc nhấp chọn file lịch sử MT5
            </p>
            {/* Badges */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">
              {[
                { label: 'CSV', icon: '📊' },
                { label: 'HTML', icon: '🌐' },
                { label: 'Excel', icon: '📗' },
                { label: 'TXT', icon: '📄' },
              ].map(ft => (
                <span key={ft.label} className="px-2 py-0.5 rounded bg-white/5 border border-white/5 text-[9px] font-black text-dark-text-light uppercase tracking-wider flex items-center gap-1">
                  <span>{ft.icon}</span>
                  {ft.label}
                </span>
              ))}
            </div>
          </>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center">
            <div className="relative mb-3 flex items-center justify-center">
              <div className="w-11 h-11 border-4 border-gold border-t-transparent rounded-full animate-spin pulse-glow-gold"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {getFileIcon()}
              </div>
            </div>
            <p className="text-sm font-bold text-white animate-pulse">Đang phân tích dữ liệu...</p>
            <p className="text-xs text-dark-text-muted mt-1.5 font-mono flex items-center gap-1.5 bg-white/3 border border-white/5 px-2 py-0.5 rounded">
              {fileName}
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3 ring-2 ring-emerald-500/10">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-extrabold text-emerald-400">Phân tích thành công!</p>
            <p className="text-xs text-dark-text-muted mt-1.5 max-w-xs">
              Nạp thành công <span className="text-emerald-400 font-bold font-mono bg-emerald-500/5 border border-emerald-500/10 px-1.5 py-0.2 rounded">{tradeCount}</span> lệnh giao dịch.
            </p>
            <p className="text-[10px] text-dark-text-muted mt-1 font-mono">{fileName}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3 bg-red-500/10 rounded-full text-red-400 mb-3 ring-2 ring-red-500/10">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-red-400">Phân tích thất bại!</p>
            <p className="text-xs text-dark-text-muted mt-1.5 px-4 text-center leading-normal max-w-xs">
              {errorMessage || 'Vui lòng kiểm tra file và thử lại.'}
            </p>
            <button 
              onClick={(e) => { e.stopPropagation(); setStatus('idle'); setErrorMessage(''); }}
              className="mt-3.5 px-3.5 py-1 text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/5 rounded-md transition-all active:scale-95 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file, 'utf-8');
  });
}

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as ArrayBuffer'));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsArrayBuffer(file);
  });
}
