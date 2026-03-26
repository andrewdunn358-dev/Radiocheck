'use client';

import React, { useState, useCallback } from 'react';
import { api, API_URL } from '@/lib/admin-api';
import { InlineEditableBlock, EditableText } from './InlineEditableBlock';
import { PersonaPicker } from './PersonaPicker';
import { ImageUpload } from './ImageUpload';
import {
  Save, X, ChevronLeft, Plus, Type, Heading2, AlertTriangle, List, LayoutList,
  MessageSquare, Phone, Minus, Image as ImageIcon,
  // Icons for callout icon picker
  MessageCircle, Activity, Heart, Shield, Home, Users, BookOpen, Brain,
  Wallet, Scale, Stethoscope, Star, Zap, Flame, Eye, Clock, Flag, Target,
  Compass, Globe, Leaf, Award, HeartPulse, Swords, Anchor, Coffee,
} from 'lucide-react';

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

// ---- App Theme (matches mobile dark theme exactly) ----
const APP = {
  bg: '#1a2332',
  surface: '#2d3748',
  text: '#ffffff',
  textSecondary: '#b0c4de',
  textMuted: '#9ca3af',
  border: '#4a5568',
  primary: '#4a90e2',
  teal: '#0d9488',
};

const BLOCK_TYPES = [
  { type: 'heading', label: 'Heading', icon: Heading2 },
  { type: 'paragraph', label: 'Paragraph', icon: Type },
  { type: 'callout', label: 'Topic Card', icon: AlertTriangle },
  { type: 'bullet_list', label: 'Bullet List', icon: List },
  { type: 'support_card', label: 'Support Card', icon: LayoutList },
  { type: 'chat_banner', label: 'Chat Banner', icon: MessageSquare },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'crisis_footer', label: 'Crisis Footer', icon: Phone },
  { type: 'divider', label: 'Divider', icon: Minus },
];

// ---- Callout Icon Set ----
const CALLOUT_ICONS = [
  { name: 'message-circle', component: MessageCircle, label: 'Chat' },
  { name: 'activity', component: Activity, label: 'Pulse' },
  { name: 'heart', component: Heart, label: 'Heart' },
  { name: 'heart-pulse', component: HeartPulse, label: 'Health' },
  { name: 'shield', component: Shield, label: 'Shield' },
  { name: 'home', component: Home, label: 'Home' },
  { name: 'users', component: Users, label: 'People' },
  { name: 'book-open', component: BookOpen, label: 'Book' },
  { name: 'brain', component: Brain, label: 'Brain' },
  { name: 'wallet', component: Wallet, label: 'Financial' },
  { name: 'scale', component: Scale, label: 'Justice' },
  { name: 'stethoscope', component: Stethoscope, label: 'Medical' },
  { name: 'star', component: Star, label: 'Star' },
  { name: 'zap', component: Zap, label: 'Energy' },
  { name: 'flame', component: Flame, label: 'Fire' },
  { name: 'eye', component: Eye, label: 'Awareness' },
  { name: 'clock', component: Clock, label: 'Time' },
  { name: 'flag', component: Flag, label: 'Flag' },
  { name: 'target', component: Target, label: 'Target' },
  { name: 'compass', component: Compass, label: 'Compass' },
  { name: 'globe', component: Globe, label: 'Globe' },
  { name: 'leaf', component: Leaf, label: 'Nature' },
  { name: 'phone', component: Phone, label: 'Phone' },
  { name: 'alert-triangle', component: AlertTriangle, label: 'Warning' },
  { name: 'award', component: Award, label: 'Award' },
  { name: 'swords', component: Swords, label: 'Military' },
  { name: 'anchor', component: Anchor, label: 'Anchor' },
  { name: 'coffee', component: Coffee, label: 'Coffee' },
];

const ICON_COLORS = [
  '#0d9488', '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#22c55e',
  '#ec4899', '#f97316', '#6366f1', '#dc2626', '#2563eb', '#059669',
];

function getIconComponent(name: string) {
  const found = CALLOUT_ICONS.find(i => i.name === name);
  return found?.component || MessageCircle;
}

function newBlockProps(type: string) {
  switch (type) {
    case 'heading': return { text: 'New Heading' };
    case 'paragraph': return { text: 'New paragraph text...' };
    case 'callout': return { text: 'Topic Title \u2014 Description text here.', icon: 'message-circle', iconColor: '#0d9488' };
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
const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Carer Support': { bg: 'rgba(59,130,246,0.15)', text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  'Financial': { bg: 'rgba(34,197,94,0.15)', text: '#86efac', border: 'rgba(34,197,94,0.3)' },
  'Practical': { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', border: 'rgba(16,185,129,0.3)' },
  'Mental Health': { bg: 'rgba(139,92,246,0.15)', text: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
  'Respite': { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
};

const PERSONA_DATA: Record<string, { name: string; color: string; desc: string }> = {
  helen: { name: 'Helen', color: '#0d9488', desc: 'Army wife for 20 years, cared for her husband with PTSD.' },
  tommy: { name: 'Tommy', color: '#3b82f6', desc: 'Lead Battle Buddy \u2014 general veteran support.' },
  doris: { name: 'Rachel', color: '#f59e0b', desc: 'Criminal justice specialist.' },
  rachel: { name: 'Rachel', color: '#f59e0b', desc: 'Criminal justice specialist.' },
  mo: { name: 'Mo', color: '#8b5cf6', desc: 'Recovery support \u2014 prosthetics, rehab, chronic pain.' },
  reg: { name: 'Reg', color: '#ef4444', desc: 'Serious illness \u2014 cancer, palliative care.' },
  dave: { name: 'Dave', color: '#059669', desc: "Men's health \u2014 andropause, MST." },
  baz: { name: 'Baz', color: '#059669', desc: 'Veteran peer support.' },
  frankie: { name: 'Frankie', color: '#22c55e', desc: 'Podcast host, veteran stories.' },
  bob: { name: 'Bob', color: '#8b5cf6', desc: 'General support companion.' },
  rita: { name: 'Rita', color: '#7c3aed', desc: 'Female veteran support.' },
  jack: { name: 'Jack', color: '#1e40af', desc: 'Housing & benefits specialist.' },
  margie: { name: 'Margie', color: '#f59e0b', desc: 'Older veteran support.' },
  megan: { name: 'Megan', color: '#8b5cf6', desc: 'Young veteran support.' },
  penny: { name: 'Penny', color: '#22c55e', desc: 'Family support specialist.' },
  alex: { name: 'Alex', color: '#ec4899', desc: 'LGBTQ+ veteran support.' },
  sam: { name: 'Sam', color: '#f97316', desc: 'Substance misuse support.' },
  kofi: { name: 'Kofi', color: '#14b8a6', desc: 'Commonwealth veteran support.' },
  james: { name: 'James', color: '#8b5cf6', desc: 'Historical investigations support.' },
  catherine: { name: 'Catherine', color: '#0891b2', desc: 'Faith & spirituality support.' },
  sentry: { name: 'Finch', color: '#6366f1', desc: 'App safeguarding AI.' },
};

// ---- Main Component ----
export function VisualPageEditor({ token, page, isNew, onSave, onCancel, onSuccess, onError }: VisualPageEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(page.blocks || []);
  const [originalBlocks] = useState<Block[]>(JSON.parse(JSON.stringify(page.blocks || [])));
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [saving, setSaving] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState<number | null>(null);
  const [showPersonaPicker, setShowPersonaPicker] = useState<number | null>(null);
  const [showImageUpload, setShowImageUpload] = useState<number | null>(null);
  const [showIconPicker, setShowIconPicker] = useState<number | null>(null);

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
    <div className="min-h-screen" style={{ backgroundColor: APP.bg }} data-testid="visual-page-editor">
      {/* Fixed top bar */}
      <div className="sticky top-0 z-40 border-b px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'rgba(13,27,42,0.95)', borderColor: APP.border, backdropFilter: 'blur(12px)' }}>
        <button onClick={handleDiscard} className="p-1.5 rounded-lg transition-colors" style={{ color: APP.textMuted }} data-testid="visual-editor-back">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {isNew ? (
            <div className="flex items-center gap-2">
              <input value={title} onChange={e => { setTitle(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')); }} className="bg-transparent text-base font-bold outline-none border-b w-48" style={{ color: APP.text, borderColor: APP.border }} placeholder="Page title..." data-testid="new-page-title" />
              <span className="text-xs font-mono" style={{ color: APP.textMuted }}>/{slug}</span>
            </div>
          ) : (
            <>
              <h2 className="text-base font-bold truncate" style={{ color: APP.text }}>{page.title}</h2>
              <span className="text-xs font-mono" style={{ color: APP.textMuted }}>/{page.slug} &middot; Visual Editor &middot; {blocks.length} blocks</span>
            </>
          )}
        </div>
        {hasChanges && <span className="text-xs font-medium px-2 py-1 rounded" style={{ color: '#fbbf24', backgroundColor: 'rgba(251,191,36,0.1)' }}>Unsaved changes</span>}
        <button onClick={handleDiscard} className="px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 border transition-colors hover:opacity-80" style={{ color: APP.textMuted, borderColor: APP.border }}>
          <X className="w-3.5 h-3.5" />Discard
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-1.5 rounded-lg text-sm font-medium text-white flex items-center gap-1.5 transition-colors disabled:opacity-40"
          style={{ backgroundColor: '#059669' }}
          data-testid="visual-editor-save"
        >
          <Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Visual canvas — matches app dark background */}
      <div className="max-w-xl mx-auto px-5 py-8" onClick={() => { setSelectedIdx(null); setShowAddMenu(null); }}>
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
                onOpenIconPicker={() => setShowIconPicker(idx)}
                token={token}
              />
            </InlineEditableBlock>

            <AddBlockButton onClick={() => setShowAddMenu(showAddMenu === idx + 1 ? null : idx + 1)} />
            {showAddMenu === idx + 1 && <BlockTypePicker onSelect={(type) => insertBlock(type, idx + 1)} onClose={() => setShowAddMenu(null)} />}
          </React.Fragment>
        ))}

        {blocks.length === 0 && (
          <div className="text-center py-16" style={{ color: APP.textMuted }}>
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
      {showIconPicker !== null && (
        <IconPickerModal
          currentIcon={blocks[showIconPicker]?.props?.icon || ''}
          currentColor={blocks[showIconPicker]?.props?.iconColor || APP.teal}
          onSelectIcon={(icon) => updateBlock(showIconPicker!, { icon })}
          onSelectColor={(iconColor) => updateBlock(showIconPicker!, { iconColor })}
          onClose={() => setShowIconPicker(null)}
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
        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
        style={{ backgroundColor: APP.surface, border: `1px solid ${APP.border}` }}
        data-testid="add-block-between"
      >
        <Plus className="w-4 h-4" style={{ color: APP.textMuted }} />
      </button>
    </div>
  );
}

// ---- Block Type Picker ----
function BlockTypePicker({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) {
  return (
    <div className="rounded-xl p-3 mb-3 grid grid-cols-3 gap-2 shadow-2xl" style={{ backgroundColor: APP.surface, border: `1px solid ${APP.border}` }} onClick={e => e.stopPropagation()}>
      {BLOCK_TYPES.map(bt => (
        <button
          key={bt.type}
          onClick={() => onSelect(bt.type)}
          className="flex flex-col items-center gap-1.5 p-3 rounded-lg transition-colors hover:opacity-80"
          data-testid={`add-type-${bt.type}`}
        >
          <bt.icon className="w-5 h-5" style={{ color: APP.textMuted }} />
          <span className="text-xs" style={{ color: APP.textSecondary }}>{bt.label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Visual Block Renderer ----
function VisualBlock({ block, idx, selected, onUpdate, onOpenPersonaPicker, onOpenImageUpload, onOpenIconPicker, token }: {
  block: Block; idx: number; selected: boolean;
  onUpdate: (props: Record<string, any>) => void;
  onOpenPersonaPicker: () => void;
  onOpenImageUpload: () => void;
  onOpenIconPicker: () => void;
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
            className="text-xl font-bold"
            style={{ color: APP.text }}
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
            className="text-[15px] leading-relaxed text-center"
            style={{ color: APP.textSecondary }}
            placeholder="Paragraph text..."
          />
        </div>
      );

    case 'callout':
      return <CalloutVisual text={p.text || ''} icon={p.icon || ''} iconColor={p.iconColor || APP.teal} onUpdate={onUpdate} onOpenIconPicker={onOpenIconPicker} />;

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
      return <div className="my-5" style={{ height: 1, backgroundColor: APP.border, opacity: 0.3 }} />;

    default:
      return <div className="text-sm italic py-2" style={{ color: APP.textMuted }}>Unknown block: {block.type}</div>;
  }
}

// ---- Callout / Topic Card ----
function CalloutVisual({ text, icon, iconColor, onUpdate, onOpenIconPicker }: {
  text: string; icon: string; iconColor: string;
  onUpdate: (p: any) => void; onOpenIconPicker: () => void;
}) {
  const parts = text.split(' \u2014 ');
  const hasTitle = parts.length > 1;
  const IconComp = getIconComponent(icon);

  return (
    <div className="rounded-2xl p-4 my-2" style={{ backgroundColor: APP.surface, border: `1px solid ${APP.border}` }}>
      <div className="flex items-start gap-3">
        {/* Clickable icon area */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenIconPicker(); }}
          className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-transform hover:scale-110 cursor-pointer"
          style={{ backgroundColor: iconColor + '20' }}
          title="Click to change icon"
          data-testid="callout-icon-btn"
        >
          <IconComp className="w-[22px] h-[22px]" style={{ color: iconColor }} />
        </button>
        <div className="flex-1 min-w-0">
          {hasTitle ? (
            <>
              <EditableText
                value={parts[0]}
                onChange={(v) => onUpdate({ text: `${v} \u2014 ${parts.slice(1).join(' \u2014 ')}` })}
                tag="h3"
                className="text-base font-bold mb-1"
                style={{ color: APP.teal }}
                placeholder="Title"
              />
              <EditableText
                value={parts.slice(1).join(' \u2014 ')}
                onChange={(v) => onUpdate({ text: `${parts[0]} \u2014 ${v}` })}
                tag="p"
                className="text-sm leading-relaxed"
                style={{ color: APP.textSecondary }}
                placeholder="Description"
              />
            </>
          ) : (
            <EditableText
              value={text}
              onChange={(v) => onUpdate({ text: v })}
              tag="p"
              className="text-sm leading-relaxed"
              style={{ color: APP.textSecondary }}
              placeholder="Use Title \u2014 Description format for titled cards"
            />
          )}
        </div>
      </div>
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
        <div key={i} className="flex items-start gap-2 mb-1.5 group/item">
          <span className="mt-0.5 text-lg leading-none" style={{ color: APP.teal }}>&bull;</span>
          <EditableText value={item} onChange={(v) => updateItem(i, v)} tag="span" className="flex-1 text-sm" style={{ color: APP.textSecondary }} placeholder="List item..." />
          <button onClick={(e) => { e.stopPropagation(); removeItem(i); }} className="opacity-0 group-hover/item:opacity-100 p-0.5 text-xs" style={{ color: '#ef4444' }}>&times;</button>
        </div>
      ))}
      <button onClick={(e) => { e.stopPropagation(); addItem(); }} className="text-xs mt-1 flex items-center gap-1" style={{ color: APP.teal }}>
        <Plus className="w-3 h-3" />Add item
      </button>
    </div>
  );
}

// ---- Support Card ----
function SupportCardVisual({ title, description, phone, url, tag, onUpdate }: any) {
  const tagStyle = tag ? TAG_COLORS[tag] : null;

  return (
    <div className="rounded-2xl p-4 my-2" style={{ backgroundColor: APP.surface, border: `1px solid ${APP.border}` }}>
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1">
          <EditableText value={title || ''} onChange={(v) => onUpdate({ title: v })} tag="h3" className="text-[15px] font-bold mb-0.5" style={{ color: APP.text }} placeholder="Organisation name" />
        </div>
        <select
          value={tag || ''}
          onChange={(e) => { e.stopPropagation(); onUpdate({ tag: e.target.value }); }}
          onClick={e => e.stopPropagation()}
          className="text-xs px-2.5 py-1 rounded-lg border cursor-pointer outline-none"
          style={{
            backgroundColor: tagStyle?.bg || APP.surface,
            color: tagStyle?.text || APP.textMuted,
            borderColor: tagStyle?.border || APP.border,
          }}
          data-testid="support-card-tag"
        >
          <option value="">No tag</option>
          {TAG_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <EditableText value={description || ''} onChange={(v) => onUpdate({ description: v })} tag="p" className="text-[13px] leading-relaxed mb-3" style={{ color: APP.textSecondary }} placeholder="Description..." />
      <div className="flex flex-wrap gap-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" style={{ color: '#059669' }} />
          <input
            value={phone || ''}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            className="bg-transparent border-b text-sm font-semibold w-32 outline-none placeholder:opacity-40"
            style={{ color: APP.teal, borderColor: APP.border }}
            placeholder="Phone"
            data-testid="support-card-phone"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" style={{ color: APP.primary }} />
          <input
            value={url || ''}
            onChange={(e) => onUpdate({ url: e.target.value })}
            className="bg-transparent border-b text-sm w-52 outline-none placeholder:opacity-40"
            style={{ color: APP.primary, borderColor: APP.border }}
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
  const data = PERSONA_DATA[persona] || { name: persona, color: '#3b82f6', desc: 'AI Support Companion' };
  const avatarUrl = `${API_URL}/images/${persona}.png`;

  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-4 my-2 cursor-pointer transition-opacity hover:opacity-90"
      style={{ backgroundColor: APP.surface, border: `2px solid ${data.color}` }}
      onClick={(e) => { e.stopPropagation(); onClickSwap(); }}
      data-testid="chat-banner-visual"
    >
      <img
        src={avatarUrl}
        alt={data.name}
        className="w-[52px] h-[52px] rounded-full flex-shrink-0"
        style={{ border: `2px solid ${data.color}` }}
        onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${data.name}&background=${data.color.slice(1)}&color=fff&size=56`; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold" style={{ color: APP.text }}>Talk to {data.name}</p>
        <p className="text-[13px]" style={{ color: APP.textSecondary }}>{data.desc}</p>
      </div>
      <div className="px-2.5 py-1 rounded-xl text-xs font-bold text-white flex-shrink-0" style={{ backgroundColor: data.color }}>24/7</div>
      <span className="text-[10px] ml-1 flex-shrink-0 hidden sm:block" style={{ color: APP.textMuted }}>Click to swap</span>
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
            <button onClick={(e) => { e.stopPropagation(); onUpload(); }} className="px-3 py-1.5 rounded-lg text-sm text-white" style={{ backgroundColor: APP.surface, border: `1px solid ${APP.border}` }}>Replace</button>
          </div>
          <div className="mt-2" onClick={e => e.stopPropagation()}>
            <input
              value={alt}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              className="w-full bg-transparent border-b text-xs outline-none placeholder:opacity-40"
              style={{ color: APP.textMuted, borderColor: APP.border }}
              placeholder="Alt text..."
            />
          </div>
        </div>
      ) : (
        <div
          onClick={(e) => { e.stopPropagation(); onUpload(); }}
          className="border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-2 cursor-pointer transition-colors"
          style={{ borderColor: APP.border }}
          data-testid="image-block-empty"
        >
          <ImageIcon className="w-10 h-10" style={{ color: APP.textMuted }} />
          <p className="text-sm" style={{ color: APP.textMuted }}>Click to upload an image</p>
        </div>
      )}
    </div>
  );
}

// ---- Crisis Footer ----
function CrisisFooterVisual() {
  return (
    <div className="rounded-2xl p-5 my-3" style={{ backgroundColor: '#1c1917', border: '1px solid #7f1d1d' }}>
      <h3 className="text-lg font-bold mb-2" style={{ color: '#fca5a5' }}>In Crisis?</h3>
      <p className="text-sm mb-3" style={{ color: APP.textSecondary }}>If you or someone you know is in immediate danger, please contact emergency services.</p>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}><Phone className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#dc2626' }} />999 (Emergency)</p>
        <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}><Phone className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#dc2626' }} />116 123 (Samaritans)</p>
        <p className="text-sm font-semibold" style={{ color: '#fca5a5' }}><Phone className="w-3.5 h-3.5 inline mr-1.5" style={{ color: '#dc2626' }} />0800 138 1111 (Combat Stress)</p>
      </div>
      <p className="text-xs mt-3 italic" style={{ color: APP.textMuted }}>Crisis numbers are fixed for safety and not editable.</p>
    </div>
  );
}

// ---- Icon Picker Modal ----
function IconPickerModal({ currentIcon, currentColor, onSelectIcon, onSelectColor, onClose }: {
  currentIcon: string; currentColor: string;
  onSelectIcon: (icon: string) => void;
  onSelectColor: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose} data-testid="icon-picker-overlay">
      <div className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl" style={{ backgroundColor: '#1e293b', border: `1px solid ${APP.border}` }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${APP.border}` }}>
          <h3 className="text-lg font-bold" style={{ color: APP.text }}>Choose Icon</h3>
          <button onClick={onClose} className="text-xl" style={{ color: APP.textMuted }}>&times;</button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[65vh]">
          {/* Icon Grid */}
          <div className="grid grid-cols-7 gap-1.5 mb-6">
            {CALLOUT_ICONS.map(ic => {
              const isActive = ic.name === currentIcon;
              return (
                <button
                  key={ic.name}
                  onClick={() => onSelectIcon(ic.name)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all"
                  style={{
                    backgroundColor: isActive ? currentColor + '15' : 'transparent',
                    border: isActive ? `2px solid ${currentColor}` : '2px solid transparent',
                  }}
                  data-testid={`icon-option-${ic.name}`}
                >
                  <ic.component className="w-5 h-5" style={{ color: isActive ? currentColor : APP.textMuted }} />
                  <span className="text-[9px] leading-tight text-center" style={{ color: APP.textMuted }}>{ic.label}</span>
                </button>
              );
            })}
          </div>

          {/* Color Palette */}
          <p className="text-sm font-semibold mb-3" style={{ color: APP.text }}>Icon Color</p>
          <div className="flex flex-wrap gap-2.5">
            {ICON_COLORS.map(color => (
              <button
                key={color}
                onClick={() => onSelectColor(color)}
                className="w-8 h-8 rounded-full transition-transform"
                style={{
                  backgroundColor: color,
                  border: currentColor === color ? '3px solid white' : '3px solid transparent',
                  transform: currentColor === color ? 'scale(1.15)' : 'scale(1)',
                }}
                data-testid={`icon-color-${color}`}
              />
            ))}
          </div>

          {/* Preview */}
          <div className="mt-6 rounded-xl p-4 flex items-center gap-3" style={{ backgroundColor: APP.surface }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: currentColor + '20' }}>
              {(() => { const Ic = getIconComponent(currentIcon); return <Ic className="w-[22px] h-[22px]" style={{ color: currentColor }} />; })()}
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: APP.text }}>Preview</p>
              <p className="text-xs" style={{ color: APP.textMuted }}>{currentIcon || 'No icon selected'} &middot; {currentColor}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 flex justify-end" style={{ borderTop: `1px solid ${APP.border}` }}>
          <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#059669' }}>Done</button>
        </div>
      </div>
    </div>
  );
}
