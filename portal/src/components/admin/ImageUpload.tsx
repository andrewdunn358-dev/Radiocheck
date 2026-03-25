'use client';

import React, { useCallback, useState, useRef } from 'react';
import { api } from '@/lib/admin-api';
import { Upload, X, Loader2 } from 'lucide-react';

interface ImageUploadProps {
  token: string;
  onUploaded: (url: string) => void;
  onClose: () => void;
}

export function ImageUpload({ token, onUploaded, onClose }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setError('Only JPG, PNG, and WebP images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const result = await api.uploadCMSImage(token, file);
      onUploaded(result.url);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [token, onUploaded, onClose]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="image-upload-overlay">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white">Upload Image</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
              dragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-600 hover:border-gray-500'
            }`}
            data-testid="image-drop-zone"
          >
            {uploading ? (
              <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
            ) : (
              <Upload className="w-10 h-10 text-gray-500" />
            )}
            <p className="text-sm text-gray-400 text-center">
              {uploading ? 'Uploading...' : 'Drag & drop an image here, or click to browse'}
            </p>
            <p className="text-xs text-gray-600">JPG, PNG, WebP &middot; Max 5MB</p>
          </div>

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            data-testid="image-file-input"
          />
        </div>
      </div>
    </div>
  );
}
