'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Trash2, GripVertical, Plus } from 'lucide-react';

interface InlineEditableBlockProps {
  block: { type: string; props: Record<string, any> };
  index: number;
  total: number;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (props: Record<string, any>) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onInsertBefore: () => void;
  children: React.ReactNode;
}

export function InlineEditableBlock({
  block, index, total, selected, onSelect, onUpdate, onMove, onDelete, onInsertBefore, children
}: InlineEditableBlockProps) {
  const [hovered, setHovered] = useState(false);
  const showControls = hovered || selected;

  return (
    <div className="relative group" data-testid={`visual-block-${index}`}>
      {/* Insert-before button */}
      <div className="relative h-0 flex justify-center -mt-1 mb-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onInsertBefore(); }}
          className="w-7 h-7 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg text-xs"
          title="Insert block above"
          data-testid={`insert-before-${index}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className={`relative rounded-xl transition-all cursor-pointer ${
          selected ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-gray-900' : ''
        } ${hovered && !selected ? 'ring-1 ring-gray-600 ring-offset-1 ring-offset-gray-900' : ''}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onSelect}
      >
        {/* Hover toolbar */}
        {showControls && (
          <div
            className="absolute -top-3 right-2 flex items-center gap-0.5 bg-gray-800 border border-gray-600 rounded-lg px-1 py-0.5 shadow-xl z-30"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-[10px] text-gray-500 font-mono px-1.5">{block.type}</span>
            <div className="w-px h-4 bg-gray-600" />
            <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1 hover:bg-gray-700 rounded disabled:opacity-30" title="Move up">
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 hover:bg-gray-700 rounded disabled:opacity-30" title="Move down">
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <div className="w-px h-4 bg-gray-600" />
            <button onClick={onDelete} className="p-1 hover:bg-red-900/50 rounded" title="Delete block">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

// Inline contenteditable text component
interface EditableTextProps {
  value: string;
  onChange: (val: string) => void;
  className?: string;
  tag?: 'p' | 'h2' | 'h3' | 'span';
  placeholder?: string;
}

export function EditableText({ value, onChange, className = '', tag = 'p', placeholder = 'Click to edit...' }: EditableTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (ref.current && !focused && ref.current.innerText !== value) {
      ref.current.innerText = value || '';
    }
  }, [value, focused]);

  const Tag = tag as any;

  return (
    <Tag
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`outline-none ${className} ${!value && !focused ? 'text-gray-600' : ''}`}
      data-placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        setFocused(false);
        const text = e.currentTarget.innerText?.trim() || '';
        if (text !== value) onChange(text);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tag !== 'p') {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    />
  );
}
