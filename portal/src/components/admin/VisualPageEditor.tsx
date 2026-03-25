'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { api, API_URL } from '@/lib/admin-api';
import { InlineEditableBlock, EditableText } from './InlineEditableBlock';
import { PersonaPicker } from './PersonaPicker';
import { ImageUpload } from './ImageUpload';
import { Save, X, ChevronLeft, Plus, Type, Heading2, AlertTriangle, List, LayoutList, MessageSquare, Phone, Minus, Image as ImageIcon, Eye, Undo2 } from 'lucide-react';

// ---- Types ----
interface Block {
  type: string;
  props: Record<string, any>;
}

interface VisualPageEditorProps {
  token: string;
  page: { title: string; slug: string; blocks?: Block[]; status: string };
  isNew?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: Heading2 },
  { type: 'paragraph', label: 'Paragraph', icon: Type },
  { type: 'callout', label: 'Callout', icon: AlertTriangle },
  { type: 'bullet_list', label: 'Bullet List', icon: List },
  { type: 'support_card', label: 'Support Card', icon: LayoutList },
  { type: 'chat_banner', label: 'Chat Banner', icon: MessageSquare },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'crisis_footer', label: 'Crisis Footer', icon: Phone },
  { type: 'divider', label: 'Divider', icon: Minus },
];

function newBlockProps(type: string) {
  switch (type) {
    case 'heading': return { text: 'New Heading' };
    case 'paragraph': return { text: 'New paragraph text...' };
    case 'callout': return { text: 'Callout Title \u2014 Callout description text here.' };
    case 'bullet_list': return { items: ['Item 1'] };
    case 'support_card': return { title: 'Organisation Name', description: 'Description of this service.', phone: '', url: '', tag: '' };
    case 'chat_banner': return { persona: 'helen' };
    case 'image': return { url: '', alt: '' };
    case 'crisis_footer': return {};
    case 'divider': return {};
    default: return {};
  }
}

const TAG_OPTS = ['Carer Support', 'Financial', 'Practical', 'Mental Health', 'Respite'];
const TAG_COLORS: Record<string, string> = {
  'Carer Support': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'Financial': 'bg-green-500/20 text-green-300 border-green-500/30',
  'Practical': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Mental Health': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'Respite': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
};

const PERSONA_DATA: Record<string, { name: string; color: string }> = {
  helen: { name: 'Helen', color: '#0d9488' },
  tommy: { name: 'Tommy', color: '#3b82f6' },
  doris: { name: 'Rachel', color: '#ec4899' },
  rachel: { name: 'Rachel', color: '#ec4899' },
  mo: { name: 'Mo', color: '#dc2626' },
  reg: { name: 'Reg', color: '#9333ea' },
  dave: { name: 'Dave', color: '#2563eb' },
  baz: { name: 'Baz', color: '#059669' },
  frankie: { name: 'Frankie', color: '#22c55e' },
  bob: { name: 'Bob', color: '#8b5cf6' },
  rita: { name: 'Rita', color: '#7c3aed' },
  jack: { name: 'Jack', color: '#1e40af' },
  margie: { name: 'Margie', color: '#f59e0b' },
  megan: { name: 'Megan', color: '#8b5cf6' },
  penny: { name: 'Penny', color: '#22c55e' },
  alex: { name: 'Alex', color: '#ec4899' },
  sam: { name: 'Sam', color: '#f97316' },
  kofi: { name: 'Kofi', color: '#14b8a6' },
  james: { name: 'James', color: '#8b5cf6' },
  catherine: { name: 'Catherine', color: '#0891b2' },
  sentry: { name: 'Finch', color: '#6366f1' },
};

// ---- Main Component ----
export function VisualPageEditor({ token, page, isNew, onSave, onCancel, onSuccess, onError }: VisualPageEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(page.blocks || []);
  const [originalBlocks] = useState<Block[]>(JSON.parse(JSON.stringify(page.blocks || [])));
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [saving, setSaving] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<number | null>(null); // index to insert at, or -1 for end
  const [showPersonaPicker, setShowPersonaPicker] = useState<number | null>(null);
  const [showImageUpload, setShowImageUpload] = useState<number | null>(null);

  const hasChanges = JSON.stringify(blocks) !== JSON.stringify(originalBlocks);

  const updateBlock = useCallback((idx: number, newProps: Record<string, any>) => {
    setBlocks(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], props: { ...next[idx].props, ...newProps } };
      return next;
    });
  }, []);

  const moveBlock = useCallback((idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    setBlocks(prev => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setSelectedIdx(target);
  }, [blocks.length]);

  const deleteBlock = useCallback((idx: number) => {
    if (!confirm('Delete this block?')) return;
    setBlocks(prev => prev.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  }, []);

  const insertBlock = useCallback((type: string, atIndex: number) => {
    const block: Block = { type, props: newBlockProps(type) };
    setBlocks(prev => {
      const next = [...prev];
      next.splice(atIndex, 0, block);
      return next;
    });
    setSelectedIdx(atIndex);
    setShowAddMenu(null);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await api.createCMSPage(token, { title, slug, blocks, status: 'draft' });
        onSuccess('Page created');
      } else {
        await api.updateCMSPage(token, page.slug, { blocks });
        onSuccess('Page saved');
      }
      onSave();
    } catch (err: any) {
      onError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!hasChanges || confirm('Discard all unsaved changes?')) {
      onCancel();
    }
  };

  return (
    <div className="min-h-screen" data-testid="visual-page-editor">
      {/* Fixed top bar */}
      <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-md border-b border-gray-700 px-4 py-3 flex items-center gap-3">
        <button onClick={handleDiscard} className="p-1.5 hover:bg-gray-700 rounded-lg" data-testid="visual-editor-back">
          <ChevronLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          {isNew ? (
            <div className="flex items-center gap-2">
              <input value={title} onChange={e => { setTitle(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} className="bg-transparent text-base font-bold text-white outline-none border-b border-gray-600 focus:border-emerald-500 w-48" placeholder="Page title..." data-testid="new-page-title" />
              <span className="text-xs text-gray-500 font-mono">/{slug}</span>
            </div>
          ) : (
            <>
              <h2 className="text-base font-bold text-white truncate">{page.title}</h2>
              <span className="text-xs text-gray-500 font-mono">/{page.slug} &middot; Visual Editor &middot; {blocks.length} blocks</span>
            </>
          )}
        </div>
        {hasChanges && <span className="text-xs text-amber-400 font-medium px-2 py-1 bg-amber-400/10 rounded">Unsaved changes</span>}
        <button onClick={handleDiscard} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-600 rounded-lg flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" />Discard
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-sm font-medium text-white flex items-center gap-1.5"
          data-testid="visual-editor-save"
        >
          <Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Visual canvas */}
      <div className="max-w-2xl mx-auto px-4 py-8" onClick={() => { setSelectedIdx(null); setShowAddMenu(null); }}>
        {/* Top add button */}
        <AddBlockButton onClick={() => setShowAddMenu(showAddMenu === 0 ? null : 0)} />
        {showAddMenu === 0 && <BlockTypePicker onSelect={(type) => insertBlock(type, 0)} onClose={() => setShowAddMenu(null)} />}

        {blocks.map((block, idx) => (
          <React.Fragment key={idx}>
            <InlineEditableBlock
              block={block}
              index={idx}
              total={blocks.length}
              selected={selectedIdx === idx}
              onSelect={() => setSelectedIdx(selectedIdx === idx ? null : idx)}
              onUpdate={(props) => updateBlock(idx, props)}
              onMove={(dir) => moveBlock(idx, dir)}
              onDelete={() => deleteBlock(idx)}
              onInsertBefore={() => setShowAddMenu(showAddMenu === idx ? null : idx)}
            >
              <VisualBlock
                block={block}
                idx={idx}
                selected={selectedIdx === idx}
                onUpdate={(props) => updateBlock(idx, props)}
                onOpenPersonaPicker={() => setShowPersonaPicker(idx)}
                onOpenImageUpload={() => setShowImageUpload(idx)}
                token={token}
              />
            </InlineEditableBlock>

            {/* Add button between blocks */}
            <AddBlockButton onClick={() => setShowAddMenu(showAddMenu === idx + 1 ? null : idx + 1)} />
            {showAddMenu === idx + 1 && <BlockTypePicker onSelect={(type) => insertBlock(type, idx + 1)} onClose={() => setShowAddMenu(null)} />}
          </React.Fragment>
        ))}

        {blocks.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg mb-2">No blocks yet</p>
            <p className="text-sm">Click the + button above to add your first block</p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showPersonaPicker !== null && (
        <PersonaPicker
          current={blocks[showPersonaPicker]?.props?.persona || 'helen'}
          onSelect={(id) => updateBlock(showPersonaPicker!, { persona: id })}
          onClose={() => setShowPersonaPicker(null)}
        />
      )}
      {showImageUpload !== null && (
        <ImageUpload
          token={token}
          onUploaded={(url) => updateBlock(showImageUpload!, { url })}
          onClose={() => setShowImageUpload(null)}
        />
      )}
    </div>
  );
}

// ---- Add Block Button ----
function AddBlockButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center py-1 opacity-0 hover:opacity-100 transition-opacity">
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="w-8 h-8 rounded-full bg-gray-800 border border-gray-600 hover:border-emerald-500 hover:bg-emerald-500/10 text-gray-500 hover:text-emerald-400 flex items-center justify-center transition-colors"
        data-testid="add-block-between"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// ---- Block Type Picker (appears after + button click) ----
function BlockTypePicker({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 mb-3 grid grid-cols-3 gap-2 shadow-2xl" onClick={e => e.stopPropagation()}>
      {BLOCK_TYPES.map(bt => (
        <button
          key={bt.type}
          onClick={() => onSelect(bt.type)}
          className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-700 transition-colors"
          data-testid={`add-type-${bt.type}`}
        >
          <bt.icon className="w-5 h-5 text-gray-400" />
          <span className="text-xs text-gray-300">{bt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Visual Block Renderer (inline, editable) ----
function VisualBlock({ block, idx, selected, onUpdate, onOpenPersonaPicker, onOpenImageUpload, token }: {
  block: Block; idx: number; selected: boolean;
  onUpdate: (props: Record<string, any>) => void;
  onOpenPersonaPicker: () => void;
  onOpenImageUpload: () => void;
  token: string;
}) {
  const p = block.props || {};

  switch (block.type) {
    case 'heading':
      return (
        <div className="py-2">
          <EditableText
            value={p.text || ''}
            onChange={(text) => onUpdate({ text })}
            tag="h2"
            className="text-xl font-bold text-white"
            placeholder="Heading text..."
          />
        </div>
      );

    case 'paragraph':
      return (
        <div className="py-2">
          <EditableText
            value={p.text || ''}
            onChange={(text) => onUpdate({ text })}
            tag="p"
            className="text-sm text-gray-300 leading-relaxed"
            placeholder="Paragraph text..."
          />
        </div>
      );

    case 'callout':
      return <CalloutVisual text={p.text || ''} onUpdate={onUpdate} />;

    case 'bullet_list':
      return <BulletListVisual items={p.items || []} onUpdate={onUpdate} />;

    case 'support_card':
      return <SupportCardVisual {...p} onUpdate={onUpdate} />;

    case 'chat_banner':
      return <ChatBannerVisual persona={p.persona || 'helen'} onClickSwap={onOpenPersonaPicker} />;

    case 'image':
      return <ImageBlockVisual url={p.url || ''} alt={p.alt || ''} onUpdate={onUpdate} onUpload={onOpenImageUpload} />;

    case 'crisis_footer':
      return <CrisisFooterVisual />;

    case 'divider':
      return <hr className="border-gray-700 my-4" />;

    default:
      return <div className="text-gray-500 text-sm italic py-2">Unknown block: {block.type}</div>;
  }
}

// ---- Callout ----
function CalloutVisual({ text, onUpdate }: { text: string; onUpdate: (p: any) => void }) {
  const parts = text.split(' \u2014 ');
  const hasTitle = parts.length > 1;

  return (
    <div className="border-l-4 border-teal-500 bg-teal-500/10 rounded-r-xl px-5 py-4 my-2">
      {hasTitle ? (
        <>
          <EditableText value={parts[0]} onChange={(v) => onUpdate({ text: `${v} \u2014 ${parts.slice(1).join(' \u2014 ')}` })} tag="h3" className="text-base font-bold text-teal-300 mb-1" placeholder="Title" />
          <EditableText value={parts.slice(1).join(' \u2014 ')} onChange={(v) => onUpdate({ text: `${parts[0]} \u2014 ${v}` })} tag="p" className="text-sm text-gray-300 leading-relaxed" placeholder="Description" />
        </>
      ) : (
        <EditableText value={text} onChange={(v) => onUpdate({ text: v })} tag="p" className="text-sm text-gray-300 leading-relaxed" placeholder="Callout text (use Title — Description for titled callouts)" />
      )}
    </div>
  );
}

// ---- Bullet List ----
function BulletListVisual({ items, onUpdate }: { items: string[]; onUpdate: (p: any) => void }) {
  const updateItem = (idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    onUpdate({ items: next });
  };
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    onUpdate({ items: items.filter((_, i) => i !== idx) });
  };
  const addItem = () => onUpdate({ items: [...items, ''] });

  return (
    <div className="py-2 pl-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 mb-1 group/item">
          <span className="text-teal-400 mt-0.5 text-lg leading-none">&bull;</span>
          <EditableText value={item} onChange={(v) => updateItem(i, v)} tag="span" className="flex-1 text-sm text-gray-300" placeholder="List item..." />
          <button onClick={(e) => { e.stopPropagation(); removeItem(i); }} className="opacity-0 group-hover/item:opacity-100 p-0.5 text-red-400 hover:text-red-300 text-xs">&times;</button>
        </div>
      ))}
      <button onClick={(e) => { e.stopPropagation(); addItem(); }} className="text-xs text-emerald-400 hover:text-emerald-300 mt-1 flex items-center gap-1">
        <Plus className="w-3 h-3" />Add item
      </button>
    </div>
  );
}

// ---- Support Card ----
function SupportCardVisual({ title, description, phone, url, tag, onUpdate }: any) {
  const tagClass = tag ? TAG_COLORS[tag] || 'bg-gray-700 text-gray-300 border-gray-600' : '';

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-2xl p-5 my-2">
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1">
          <EditableText value={title || ''} onChange={(v) => onUpdate({ title: v })} tag="h3" className="text-base font-bold text-white mb-0.5" placeholder="Organisation name" />
        </div>
        {/* Tag selector */}
        <select
          value={tag || ''}
          onChange={(e) => { e.stopPropagation(); onUpdate({ tag: e.target.value }); }}
          onClick={e => e.stopPropagation()}
          className={`text-xs px-2 py-1 rounded-lg border cursor-pointer bg-gray-700 ${tagClass}`}
          data-testid="support-card-tag"
        >
          <option value="">No tag</option>
          {TAG_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <EditableText value={description || ''} onChange={(v) => onUpdate({ description: v })} tag="p" className="text-sm text-gray-400 leading-relaxed mb-3" placeholder="Description..." />
      <div className="flex flex-wrap gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-green-400" />
          <input
            value={phone || ''}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            className="bg-transparent border-b border-gray-600 text-sm text-green-400 font-medium w-32 outline-none focus:border-green-400 placeholder:text-gray-600"
            placeholder="Phone"
            data-testid="support-card-phone"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-blue-400 text-sm">&#128279;</span>
          <input
            value={url || ''}
            onChange={(e) => onUpdate({ url: e.target.value })}
            className="bg-transparent border-b border-gray-600 text-sm text-blue-400 w-52 outline-none focus:border-blue-400 placeholder:text-gray-600"
            placeholder="https://..."
            data-testid="support-card-url"
          />
        </div>
      </div>
    </div>
  );
}

// ---- Chat Banner ----
function ChatBannerVisual({ persona, onClickSwap }: { persona: string; onClickSwap: () => void }) {
  const data = PERSONA_DATA[persona] || { name: persona, color: '#3b82f6' };
  const avatarUrl = `${API_URL}/api/avatars/${persona}.png`;

  return (
    <div
      className="flex items-center gap-4 rounded-2xl p-5 my-2 border-2 cursor-pointer hover:opacity-90 transition-opacity"
      style={{ borderColor: data.color, backgroundColor: `${data.color}10` }}
      onClick={(e) => { e.stopPropagation(); onClickSwap(); }}
      data-testid="chat-banner-visual"
    >
      <img
        src={avatarUrl}
        alt={data.name}
        className="w-14 h-14 rounded-full border-2"
        style={{ borderColor: data.color }}
        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${data.name}&background=${data.color.slice(1)}&color=fff&size=56`; }}
      />
      <div className="flex-1">
        <p className="text-lg font-bold text-white">Talk to {data.name}</p>
        <p className="text-sm text-gray-400">AI Support Companion</p>
      </div>
      <div className="px-3 py-1.5 rounded-xl text-xs font-bold text-white" style={{ backgroundColor: data.color }}>24/7</div>
      <span className="text-xs text-gray-500 ml-2">Click to change persona</span>
    </div>
  );
}

// ---- Image Block ----
function ImageBlockVisual({ url, alt, onUpdate, onUpload }: { url: string; alt: string; onUpdate: (p: any) => void; onUpload: () => void }) {
  const fullUrl = url && !url.startsWith('http') ? `${API_URL}${url}` : url;

  return (
    <div className="my-2">
      {url ? (
        <div className="relative group/img">
          <img src={fullUrl} alt={alt} className="w-full rounded-xl max-h-80 object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-3">
            <button onClick={(e) => { e.stopPropagation(); onUpload(); }} className="px-3 py-1.5 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white hover:bg-gray-700">Replace</button>
          </div>
          <div className="mt-2" onClick={e => e.stopPropagation()}>
            <input
              value={alt}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              className="w-full bg-transparent border-b border-gray-700 text-xs text-gray-500 outline-none focus:border-gray-400 placeholder:text-gray-700"
              placeholder="Alt text..."
            />
          </div>
        </div>
      ) : (
        <div
          onClick={(e) => { e.stopPropagation(); onUpload(); }}
          className="border-2 border-dashed border-gray-600 rounded-xl p-10 flex flex-col items-center gap-2 cursor-pointer hover:border-emerald-500 transition-colors"
          data-testid="image-block-empty"
        >
          <ImageIcon className="w-10 h-10 text-gray-600" />
          <p className="text-sm text-gray-500">Click to upload an image</p>
        </div>
      )}
    </div>
  );
}

// ---- Crisis Footer ----
function CrisisFooterVisual() {
  return (
    <div className="bg-red-500/10 border border-red-800/40 rounded-2xl p-5 my-3">
      <h3 className="text-lg font-bold text-red-400 mb-2">In Crisis?</h3>
      <p className="text-sm text-gray-400 mb-3">If you or someone you know is in immediate danger, please contact emergency services.</p>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-red-400">&#128222; 999 (Emergency)</p>
        <p className="text-sm font-semibold text-red-400">&#128222; 116 123 (Samaritans)</p>
        <p className="text-sm font-semibold text-red-400">&#128222; 0800 138 1111 (Combat Stress)</p>
      </div>
      <p className="text-xs text-gray-600 mt-3 italic">This block is not editable — crisis numbers are fixed for safety.</p>
    </div>
  );
}
