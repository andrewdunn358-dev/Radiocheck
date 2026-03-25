'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Trash2, Edit2, Save, X, Eye, EyeOff, RefreshCw, Search, Lock, Globe, ChevronLeft, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote, Heading1, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Undo, Redo, ChevronUp, ChevronDown, GripVertical, Type, MessageSquare, AlertTriangle, Minus, Phone, ExternalLink, LayoutList } from 'lucide-react';
import { api } from '@/lib/admin-api';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapUnderline from '@tiptap/extension-underline';
import { VisualPageEditor } from '../VisualPageEditor';

interface PagesManagerProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

interface CMSPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  blocks?: any[];
  status: string;
  is_system_page: boolean;
  is_migrated_from_tsx: boolean;
  linked_persona?: string;
  meta_title?: string;
  meta_description?: string;
  created_at?: string;
  updated_at?: string;
}

export default function PagesManager({ token, onSuccess, onError }: PagesManagerProps) {
  const [pages, setPages] = useState<CMSPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPage, setEditingPage] = useState<CMSPage | null>(null);
  const [showNewPage, setShowNewPage] = useState(false);

  const loadPages = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getCMSPages(token);
      setPages(Array.isArray(data?.pages) ? data.pages : []);
    } catch (err: any) {
      console.error('Failed to load pages:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadPages(); }, [loadPages]);

  const handleToggleStatus = async (slug: string) => {
    try {
      const res = await api.toggleCMSPageStatus(token, slug);
      onSuccess(`Page ${res.status}`);
      loadPages();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeletePage = async (slug: string, title: string, isSystem: boolean) => {
    if (isSystem) return onError('System pages cannot be deleted');
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteCMSPage(token, slug);
      onSuccess('Page deleted');
      loadPages();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const openEditor = async (slug: string) => {
    try {
      const data = await api.getCMSPage(token, slug);
      if (data?.page) setEditingPage(data.page);
    } catch (err: any) {
      onError(err.message);
    }
  };

  const openNewPage = () => {
    setEditingPage({
      id: '',
      title: 'New Page',
      slug: 'new-page',
      content: '',
      blocks: [
        { type: 'heading', props: { text: 'New Page' } },
        { type: 'paragraph', props: { text: 'Start adding content here.' } },
      ],
      status: 'draft',
      is_system_page: false,
      is_migrated_from_tsx: false,
      linked_persona: '',
      meta_title: '',
      meta_description: '',
    });
    setShowNewPage(true);
  };

  const filteredPages = pages.filter(p =>
    !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // If editing a page, show the appropriate editor
  if (editingPage) {
    // Block-based pages get the visual inline editor
    if (editingPage.blocks && editingPage.blocks.length > 0) {
      return (
        <VisualPageEditor
          token={token}
          page={editingPage}
          isNew={showNewPage}
          onSave={() => { setEditingPage(null); setShowNewPage(false); loadPages(); }}
          onCancel={() => { setEditingPage(null); setShowNewPage(false); }}
          onSuccess={onSuccess}
          onError={onError}
        />
      );
    }
    // HTML pages get the TipTap editor
    return (
      <PageEditor
        token={token}
        page={editingPage}
        isNew={showNewPage}
        onSave={() => { setEditingPage(null); setShowNewPage(false); loadPages(); }}
        onCancel={() => { setEditingPage(null); setShowNewPage(false); }}
        onSuccess={onSuccess}
        onError={onError}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-400" />Pages ({pages.length})
        </h2>
        <div className="flex gap-2">
          <button onClick={openNewPage} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-1" data-testid="add-page-btn">
            <Plus className="w-3 h-3" />New Page
          </button>
          <button onClick={loadPages} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded" data-testid="refresh-pages-btn">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-4">
        <Search className="w-4 h-4 text-gray-400" />
        <input className="bg-transparent flex-1 text-sm outline-none" placeholder="Search pages by title or slug..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} data-testid="search-pages-input" />
      </div>

      {/* Page List */}
      <div className="space-y-2">
        {filteredPages.map(page => (
          <div key={page.id} className={`bg-gray-800 rounded-lg border ${page.status === 'published' ? 'border-gray-700' : 'border-yellow-900/50'}`} data-testid={`page-item-${page.slug}`}>
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {page.is_system_page && <span title="System page — cannot be deleted"><Lock className="w-3 h-3 text-amber-400" /></span>}
                  <p className="font-medium text-sm truncate">{page.title}</p>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500 font-mono">/{page.slug}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${page.status === 'published' ? 'bg-green-900/30 text-green-400' : 'bg-yellow-900/30 text-yellow-400'}`}>
                    {page.status}
                  </span>
                  {page.is_migrated_from_tsx && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900/30 text-blue-400">migrated</span>}
                  {page.linked_persona && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-400">{page.linked_persona}</span>}
                  {page.updated_at && <span className="text-xs text-gray-500">{new Date(page.updated_at).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleToggleStatus(page.slug)} className="p-1.5 hover:bg-gray-700 rounded" title={page.status === 'published' ? 'Unpublish' : 'Publish'}>
                  {page.status === 'published' ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-yellow-400" />}
                </button>
                <button onClick={() => openEditor(page.slug)} className="p-1.5 hover:bg-gray-700 rounded" data-testid={`edit-page-${page.slug}`}>
                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                </button>
                <button
                  onClick={() => handleDeletePage(page.slug, page.title, page.is_system_page)}
                  className={`p-1.5 hover:bg-gray-700 rounded ${page.is_system_page ? 'opacity-30 cursor-not-allowed' : ''}`}
                  disabled={page.is_system_page}
                  title={page.is_system_page ? 'System pages cannot be deleted' : 'Delete page'}
                  data-testid={`delete-page-${page.slug}`}
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pages.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No pages yet. Create a new page to get started.</p>
        </div>
      )}
    </div>
  );
}


// ==================== PAGE EDITOR with TipTap ====================

function PageEditor({ token, page, isNew, onSave, onCancel, onSuccess, onError }: {
  token: string;
  page: CMSPage;
  isNew: boolean;
  onSave: () => void;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [status, setStatus] = useState(page.status);
  const [linkedPersona, setLinkedPersona] = useState(page.linked_persona || '');
  const [metaTitle, setMetaTitle] = useState(page.meta_title || '');
  const [metaDescription, setMetaDescription] = useState(page.meta_description || '');
  const [isSystemPage, setIsSystemPage] = useState(page.is_system_page);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      TiptapUnderline,
      Placeholder.configure({ placeholder: 'Start writing your page content...' }),
    ],
    content: page.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[400px] focus:outline-none p-4',
      },
    },
  });

  const autoSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (isNew) setSlug(autoSlug(val));
  };

  const handleSave = async (saveStatus?: string) => {
    if (!title || !slug) return onError('Title and slug are required');
    setSaving(true);
    try {
      const data: any = {
        title,
        slug,
        content: editor?.getHTML() || '',
        status: saveStatus || status,
        linked_persona: linkedPersona || null,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
      };

      if (isNew) {
        data.is_system_page = isSystemPage;
        await api.createCMSPage(token, data);
        onSuccess('Page created');
      } else {
        await api.updateCMSPage(token, page.slug, data);
        onSuccess('Page saved');
      }
      onSave();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor?.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="space-y-4" data-testid="page-editor">
      {/* Editor Header */}
      <div className="flex items-center justify-between">
        <button onClick={onCancel} className="flex items-center gap-1 text-sm text-gray-400 hover:text-white">
          <ChevronLeft className="w-4 h-4" />Back to pages
        </button>
        <div className="flex gap-2">
          <button onClick={() => setShowPreview(!showPreview)} className={`px-3 py-1.5 rounded text-sm ${showPreview ? 'bg-blue-600' : 'bg-gray-700'}`}>
            {showPreview ? 'Edit' : 'Preview'}
          </button>
          <button onClick={() => handleSave('draft')} disabled={saving} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm" data-testid="save-draft-btn">
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave('published')} disabled={saving} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm flex items-center gap-1" data-testid="publish-page-btn">
            <Globe className="w-3 h-3" />{saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Main Editor (2/3) */}
        <div className="col-span-2 space-y-3">
          <input
            className="w-full bg-gray-800 rounded-lg px-4 py-3 text-lg font-bold border border-gray-700 focus:border-blue-500 outline-none"
            placeholder="Page Title"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            data-testid="page-title-input"
          />

          {showPreview ? (
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 min-h-[500px]">
              <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }} />
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              {/* Toolbar */}
              <div className="flex flex-wrap gap-0.5 p-2 border-b border-gray-700 bg-gray-850">
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold')} title="Bold"><Bold className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic')} title="Italic"><Italic className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive('underline')} title="Underline"><UnderlineIcon className="w-4 h-4" /></ToolbarBtn>
                <div className="w-px bg-gray-600 mx-1" />
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} active={editor?.isActive('heading', { level: 1 })} title="H1"><Heading1 className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive('heading', { level: 2 })} title="H2"><Heading2 className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} active={editor?.isActive('heading', { level: 3 })} title="H3"><Heading3 className="w-4 h-4" /></ToolbarBtn>
                <div className="w-px bg-gray-600 mx-1" />
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList')} title="Bullet List"><List className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList')} title="Numbered List"><ListOrdered className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive('blockquote')} title="Blockquote"><Quote className="w-4 h-4" /></ToolbarBtn>
                <div className="w-px bg-gray-600 mx-1" />
                <ToolbarBtn onClick={addLink} active={editor?.isActive('link')} title="Link"><LinkIcon className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={addImage} title="Image"><ImageIcon className="w-4 h-4" /></ToolbarBtn>
                <div className="w-px bg-gray-600 mx-1" />
                <ToolbarBtn onClick={() => editor?.chain().focus().undo().run()} title="Undo"><Undo className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn onClick={() => editor?.chain().focus().redo().run()} title="Redo"><Redo className="w-4 h-4" /></ToolbarBtn>
              </div>
              {/* Editor */}
              <EditorContent editor={editor} className="min-h-[400px] text-sm" />
            </div>
          )}
        </div>

        {/* Settings Sidebar (1/3) */}
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-300">Page Settings</h3>
            
            <div>
              <label className="text-xs text-gray-400 mb-1 block">URL Slug</label>
              <div className="flex items-center gap-1 bg-gray-700 rounded px-2 py-1.5">
                <span className="text-xs text-gray-500">/</span>
                <input className="bg-transparent text-sm flex-1 outline-none font-mono" value={slug} onChange={e => setSlug(autoSlug(e.target.value))} data-testid="page-slug-input" />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Linked AI Persona</label>
              <input className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" placeholder="e.g. rachel, tommy" value={linkedPersona} onChange={e => setLinkedPersona(e.target.value)} />
            </div>

            {isNew && (
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={isSystemPage} onChange={e => setIsSystemPage(e.target.checked)} />
                System page (cannot be deleted)
              </label>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-300">SEO</h3>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Meta Title</label>
              <input className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" placeholder="Page title for search engines" value={metaTitle} onChange={e => setMetaTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Meta Description</label>
              <textarea className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" rows={3} placeholder="Brief description for search results" value={metaDescription} onChange={e => setMetaDescription(e.target.value)} />
            </div>
          </div>

          {page.updated_at && (
            <p className="text-xs text-gray-500 text-center">Last edited: {new Date(page.updated_at).toLocaleString()}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-gray-600 transition-colors ${active ? 'bg-gray-600 text-blue-400' : 'text-gray-400'}`}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}


// ==================== BLOCK EDITOR for block-based pages ====================

const BLOCK_TYPES = [
  { type: 'paragraph', label: 'Paragraph', icon: Type },
  { type: 'heading', label: 'Heading', icon: Heading2 },
  { type: 'callout', label: 'Callout', icon: AlertTriangle },
  { type: 'bullet_list', label: 'Bullet List', icon: List },
  { type: 'support_card', label: 'Support Card', icon: LayoutList },
  { type: 'chat_banner', label: 'Chat Banner', icon: MessageSquare },
  { type: 'crisis_footer', label: 'Crisis Footer', icon: Phone },
  { type: 'divider', label: 'Divider', icon: Minus },
];

const PERSONAS = ['helen', 'tommy', 'rachel', 'mo', 'reg', 'dave', 'baz', 'frankie', 'doris', 'leanne'];
const TAGS = ['Carer Support', 'Financial', 'Practical', 'Mental Health', 'Respite'];

function newBlockProps(type: string) {
  switch (type) {
    case 'paragraph': return { text: '' };
    case 'heading': return { text: '' };
    case 'callout': return { text: '' };
    case 'bullet_list': return { items: [''] };
    case 'support_card': return { title: '', description: '', phone: '', url: '', tag: '' };
    case 'chat_banner': return { persona: 'helen' };
    case 'crisis_footer': return {};
    case 'divider': return {};
    default: return {};
  }
}

// Tag color mapping for preview
const TAG_BG: Record<string, string> = {
  'Carer Support': 'bg-blue-900/30 text-blue-400',
  'Financial': 'bg-green-900/30 text-green-400',
  'Practical': 'bg-emerald-900/30 text-emerald-400',
  'Mental Health': 'bg-purple-900/30 text-purple-400',
  'Respite': 'bg-yellow-900/30 text-yellow-400',
};

function BlockEditor({ token, page, onSave, onCancel, onSuccess, onError }: {
  token: string;
  page: CMSPage;
  onSave: () => void;
  onCancel: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [blocks, setBlocks] = useState<any[]>(page.blocks || []);
  const [saving, setSaving] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    setBlocks(next);
    if (editingIdx === idx) setEditingIdx(target);
    else if (editingIdx === target) setEditingIdx(idx);
  };

  const deleteBlock = (idx: number) => {
    if (!confirm('Delete this block?')) return;
    setBlocks(blocks.filter((_, i) => i !== idx));
    setEditingIdx(null);
  };

  const addBlock = (type: string) => {
    const block = { type, props: newBlockProps(type) };
    setBlocks([...blocks, block]);
    setEditingIdx(blocks.length);
    setShowAddMenu(false);
  };

  const updateBlockProps = (idx: number, newProps: any) => {
    const next = [...blocks];
    next[idx] = { ...next[idx], props: { ...next[idx].props, ...newProps } };
    setBlocks(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateCMSPage(token, page.slug, { blocks });
      onSuccess('Page blocks saved');
      onSave();
    } catch (err: any) {
      onError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="block-editor">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onCancel} className="p-1.5 hover:bg-gray-700 rounded"><ChevronLeft className="w-5 h-5" /></button>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{page.title}</h2>
          <span className="text-xs text-gray-500 font-mono">/{page.slug} &middot; Block Editor &middot; {blocks.length} blocks</span>
        </div>
        <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded text-sm font-medium flex items-center gap-2" data-testid="save-blocks-btn">
          <Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Block List — Left */}
        <div className="lg:col-span-3 space-y-2">
          {blocks.map((block, idx) => (
            <div
              key={idx}
              className={`bg-gray-800 rounded-lg border p-3 ${editingIdx === idx ? 'border-emerald-500' : 'border-gray-700'} cursor-pointer`}
              onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
              data-testid={`block-item-${idx}`}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-gray-600 shrink-0" />
                <span className="text-xs font-mono bg-gray-700 px-2 py-0.5 rounded text-gray-400">{block.type}</span>
                <span className="text-sm text-gray-300 truncate flex-1">{blockSummary(block)}</span>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button onClick={() => moveBlock(idx, -1)} className="p-1 hover:bg-gray-700 rounded" disabled={idx === 0}><ChevronUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveBlock(idx, 1)} className="p-1 hover:bg-gray-700 rounded" disabled={idx === blocks.length - 1}><ChevronDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteBlock(idx)} className="p-1 hover:bg-gray-700 rounded text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Inline edit form when selected */}
              {editingIdx === idx && (
                <div className="mt-3 pt-3 border-t border-gray-700 space-y-2" onClick={e => e.stopPropagation()}>
                  <BlockForm block={block} onChange={(props) => updateBlockProps(idx, props)} />
                </div>
              )}
            </div>
          ))}

          {/* Add Block */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full py-3 border-2 border-dashed border-gray-700 rounded-lg text-gray-500 hover:border-emerald-600 hover:text-emerald-400 flex items-center justify-center gap-2 text-sm"
              data-testid="add-block-btn"
            >
              <Plus className="w-4 h-4" />Add Block
            </button>
            {showAddMenu && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-gray-800 border border-gray-700 rounded-lg p-2 grid grid-cols-2 gap-1 z-10">
                {BLOCK_TYPES.map(bt => (
                  <button
                    key={bt.type}
                    onClick={() => addBlock(bt.type)}
                    className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-700 text-sm text-gray-300"
                    data-testid={`add-${bt.type}-btn`}
                  >
                    <bt.icon className="w-4 h-4 text-gray-500" />{bt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview — Right */}
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 sticky top-4">
            <h3 className="text-sm font-bold text-gray-400 mb-3 flex items-center gap-2"><Eye className="w-4 h-4" />Preview</h3>
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {blocks.map((block, idx) => (
                <BlockPreview key={idx} block={block} />
              ))}
              {blocks.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No blocks yet</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function blockSummary(block: any): string {
  const p = block.props || {};
  switch (block.type) {
    case 'paragraph': case 'heading': case 'callout': return p.text?.slice(0, 60) || '(empty)';
    case 'support_card': return p.title || '(untitled card)';
    case 'chat_banner': return `Talk to ${p.persona || '?'}`;
    case 'bullet_list': return `${(p.items || []).length} items`;
    case 'crisis_footer': return 'Crisis support numbers';
    case 'divider': return '---';
    default: return block.type;
  }
}

function BlockForm({ block, onChange }: { block: any; onChange: (props: any) => void }) {
  const p = block.props || {};
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return <textarea className="w-full bg-gray-700 rounded px-3 py-2 text-sm" rows={2} placeholder="Text content..." value={p.text || ''} onChange={e => onChange({ text: e.target.value })} data-testid="block-text-input" />;
    case 'callout':
      return (
        <div>
          <p className="text-xs text-gray-500 mb-1">Format: &quot;Title &mdash; Description&quot; for titled callouts</p>
          <textarea className="w-full bg-gray-700 rounded px-3 py-2 text-sm" rows={3} placeholder="Callout text..." value={p.text || ''} onChange={e => onChange({ text: e.target.value })} data-testid="block-callout-input" />
        </div>
      );
    case 'bullet_list':
      return <BulletListForm items={p.items || ['']} onChange={(items: string[]) => onChange({ items })} />;
    case 'support_card':
      return (
        <div className="space-y-2">
          <input className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" placeholder="Title" value={p.title || ''} onChange={e => onChange({ title: e.target.value })} data-testid="card-title-input" />
          <textarea className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" rows={2} placeholder="Description" value={p.description || ''} onChange={e => onChange({ description: e.target.value })} data-testid="card-desc-input" />
          <div className="grid grid-cols-2 gap-2">
            <input className="bg-gray-700 rounded px-3 py-1.5 text-sm" placeholder="Phone (optional)" value={p.phone || ''} onChange={e => onChange({ phone: e.target.value })} data-testid="card-phone-input" />
            <input className="bg-gray-700 rounded px-3 py-1.5 text-sm" placeholder="URL (optional)" value={p.url || ''} onChange={e => onChange({ url: e.target.value })} data-testid="card-url-input" />
          </div>
          <select className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" value={p.tag || ''} onChange={e => onChange({ tag: e.target.value })} data-testid="card-tag-select">
            <option value="">No tag</option>
            {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      );
    case 'chat_banner':
      return (
        <select className="w-full bg-gray-700 rounded px-3 py-1.5 text-sm" value={p.persona || 'helen'} onChange={e => onChange({ persona: e.target.value })} data-testid="persona-select">
          {PERSONAS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      );
    case 'crisis_footer':
    case 'divider':
      return <p className="text-xs text-gray-500 italic">No editable properties</p>;
    default:
      return <p className="text-xs text-gray-500">Unknown block type</p>;
  }
}

function BulletListForm({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const update = (idx: number, val: string) => { const next = [...items]; next[idx] = val; onChange(next); };
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, '']);

  return (
    <div className="space-y-1">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-1">
          <span className="text-gray-500 py-1.5 px-1">&bull;</span>
          <input className="flex-1 bg-gray-700 rounded px-2 py-1.5 text-sm" value={item} onChange={e => update(idx, e.target.value)} placeholder={`Item ${idx + 1}`} />
          <button onClick={() => remove(idx)} className="p-1 text-red-400 hover:bg-gray-700 rounded"><X className="w-3 h-3" /></button>
        </div>
      ))}
      <button onClick={add} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-1"><Plus className="w-3 h-3" />Add item</button>
    </div>
  );
}

function BlockPreview({ block }: { block: any }) {
  const p = block.props || {};
  switch (block.type) {
    case 'heading':
      return <h3 className="text-base font-bold text-white">{p.text || 'Heading'}</h3>;
    case 'paragraph':
      return <p className="text-sm text-gray-400">{p.text || 'Paragraph text...'}</p>;
    case 'callout': {
      const parts = (p.text || '').split(' \u2014 ');
      return (
        <div className="border-l-4 border-teal-500 bg-teal-900/20 rounded-r px-3 py-2">
          {parts.length > 1 ? (<><p className="text-sm font-bold text-teal-300">{parts[0]}</p><p className="text-xs text-gray-400">{parts.slice(1).join(' \u2014 ')}</p></>) : <p className="text-xs text-gray-400">{p.text}</p>}
        </div>
      );
    }
    case 'bullet_list':
      return (
        <ul className="space-y-0.5 pl-3">
          {(p.items || []).map((item: string, i: number) => <li key={i} className="text-xs text-gray-400 flex gap-1"><span className="text-teal-400">&bull;</span>{item || '...'}</li>)}
        </ul>
      );
    case 'support_card':
      return (
        <div className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white">{p.title || 'Card'}</span>
            {p.tag && <span className={`text-[10px] px-1.5 py-0.5 rounded ${TAG_BG[p.tag] || 'bg-gray-600 text-gray-300'}`}>{p.tag}</span>}
          </div>
          <p className="text-xs text-gray-400 mb-1">{p.description?.slice(0, 80) || '...'}{p.description?.length > 80 ? '...' : ''}</p>
          <div className="flex gap-3">
            {p.phone && <span className="text-[10px] text-green-400 flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{p.phone}</span>}
            {p.url && <span className="text-[10px] text-blue-400 flex items-center gap-1"><ExternalLink className="w-2.5 h-2.5" />Link</span>}
          </div>
        </div>
      );
    case 'chat_banner':
      return (
        <div className="bg-teal-900/30 border border-teal-700 rounded-lg p-3 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-teal-400" />
          <div>
            <p className="text-sm font-bold text-teal-300">Talk to {(p.persona || 'helen').charAt(0).toUpperCase() + (p.persona || 'helen').slice(1)}</p>
            <p className="text-[10px] text-gray-400">AI Support Companion &middot; 24/7</p>
          </div>
        </div>
      );
    case 'crisis_footer':
      return (
        <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-2">
          <p className="text-xs font-bold text-red-400">In Crisis?</p>
          <p className="text-[10px] text-gray-500">999 &middot; 116 123 &middot; 0800 138 1111</p>
        </div>
      );
    case 'divider':
      return <hr className="border-gray-700" />;
    default:
      return <div className="text-xs text-gray-600 italic">Unknown: {block.type}</div>;
  }
}
