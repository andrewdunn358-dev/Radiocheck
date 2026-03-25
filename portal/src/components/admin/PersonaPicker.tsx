'use client';

import React, { useState, useEffect } from 'react';
import { api, API_URL } from '@/lib/admin-api';

interface Persona {
  id: string;
  name: string;
  avatar: string;
  role: string;
  accent_color: string;
}

interface PersonaPickerProps {
  current: string;
  onSelect: (personaId: string) => void;
  onClose: () => void;
}

export function PersonaPicker({ current, onSelect, onClose }: PersonaPickerProps) {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCMSPersonas().then((data: any) => {
      setPersonas(data.personas || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const resolveAvatar = (avatar: string) => {
    if (!avatar) return '';
    if (avatar.startsWith('http')) return avatar;
    return `${API_URL}${avatar}`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="persona-picker-overlay">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h3 className="text-lg font-bold text-white">Choose a Persona</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">&times;</button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[65vh]">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading personas...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {personas.map(p => (
                <button
                  key={p.id}
                  onClick={() => { onSelect(p.id); onClose(); }}
                  className={`relative flex flex-col items-center p-3 rounded-xl border-2 transition-all hover:scale-105 ${
                    p.id === current
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-gray-700 hover:border-gray-500 bg-gray-800/50'
                  }`}
                  data-testid={`persona-option-${p.id}`}
                >
                  {p.id === current && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold">&#10003;</span>
                  )}
                  <img
                    src={resolveAvatar(p.avatar)}
                    alt={p.name}
                    className="w-14 h-14 rounded-full border-2 mb-2"
                    style={{ borderColor: p.accent_color }}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${p.name}&background=${p.accent_color.slice(1)}&color=fff&size=56`; }}
                  />
                  <span className="text-sm font-semibold text-white">{p.name}</span>
                  <span className="text-[10px] text-gray-400 text-center leading-tight mt-0.5">{p.role}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
