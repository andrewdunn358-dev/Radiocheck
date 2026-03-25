'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Trash2, Edit2, Save, X, Eye, EyeOff, RefreshCw, Search, Lock, Globe, ChevronLeft, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote, Heading1, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Undo, Redo } from 'lucide-react';
import { api } from '@/lib/admin-api';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapUnderline from '@tiptap/extension-underline';

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

  const handleSeedPages = async () => {
    try {
      const res = await api.seedCMSPages(token);
      onSuccess(res.message);
      loadPages();
    } catch (err: any) {
      onError(err.message);
    }
  };

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
      title: '',
      slug: '',
      content: '',
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

  // If editing a page, show the editor
  if (editingPage) {
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
          {pages.length === 0 && (
            <button onClick={handleSeedPages} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm" data-testid="seed-pages-btn">Seed Defaults</button>
          )}
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
          <p>No pages yet. Click &quot;Seed Defaults&quot; to load the proof-of-concept pages, or create a new page.</p>
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
