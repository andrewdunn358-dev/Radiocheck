'use client';

import { useState, useEffect, useCallback } from 'react';
import { Book, Plus, Trash2, Edit2, Save, X, Eye, EyeOff, RefreshCw, Headphones, ChevronDown, ChevronUp, Search, ExternalLink, FileText } from 'lucide-react';
import { api } from '@/lib/admin-api';
import PagesManager from './PagesManager';

interface CMSTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type SubTab = 'pages' | 'books' | 'podcasts';

interface BookItem {
  id: string;
  title: string;
  author: string;
  description: string;
  rating: number;
  category: string;
  format: string;
  amazonUrl: string;
  coverUrl: string;
  visible: boolean;
  position: number;
}

interface PodcastItem {
  id: string;
  title: string;
  host: string;
  description: string;
  url: string;
  coverUrl: string;
  category: string;
  visible: boolean;
  position: number;
}

export default function CMSTab({ token, onSuccess, onError }: CMSTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('pages');

  return (
    <div data-testid="cms-tab">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-3">
        {[
          { id: 'pages' as SubTab, label: 'Pages', icon: FileText },
          { id: 'books' as SubTab, label: 'Books', icon: Book },
          { id: 'podcasts' as SubTab, label: 'Podcasts', icon: Headphones },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              subTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
            data-testid={`cms-subtab-${tab.id}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === 'pages' && <PagesManager token={token} onSuccess={onSuccess} onError={onError} />}
      {subTab === 'books' && <BooksManager token={token} onSuccess={onSuccess} onError={onError} />}
      {subTab === 'podcasts' && <PodcastsManager token={token} onSuccess={onSuccess} onError={onError} />}
    </div>
  );
}


// ==================== BOOKS MANAGER ====================

function BooksManager({ token, onSuccess, onError }: CMSTabProps) {
  const [books, setBooks] = useState<BookItem[]>([]);
  const [editingBook, setEditingBook] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BookItem>>({});
  const [showAddBook, setShowAddBook] = useState(false);
  const [newBook, setNewBook] = useState<Partial<BookItem>>({ title: '', author: '', description: '', rating: 0, category: 'Memoir', format: 'both', amazonUrl: '', coverUrl: '', visible: true });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const CATEGORIES = ['Memoir', 'Mental Health', 'Military History', 'Practical', 'Inspiration', 'Wellbeing', 'Lighter Reads'];

  const loadBooks = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getCMSBooks(token);
      setBooks(Array.isArray(data?.books) ? data.books : []);
    } catch (err: any) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const handleSeedBooks = async () => {
    try {
      const res = await api.seedCMSBooks(token);
      onSuccess(res.message);
      loadBooks();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleAddBook = async () => {
    if (!newBook.title || !newBook.author) return onError('Title and author are required');
    try {
      await api.createCMSBook(token, newBook);
      onSuccess('Book added');
      setShowAddBook(false);
      setNewBook({ title: '', author: '', description: '', rating: 0, category: 'Memoir', format: 'both', amazonUrl: '', coverUrl: '', visible: true });
      loadBooks();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleUpdateBook = async (id: string) => {
    try {
      await api.updateCMSBook(token, id, editForm);
      onSuccess('Book updated');
      setEditingBook(null);
      loadBooks();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeleteBook = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await api.deleteCMSBook(token, id);
      onSuccess('Book deleted');
      loadBooks();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleToggleVisibility = async (book: BookItem) => {
    try {
      await api.updateCMSBook(token, book.id, { visible: !book.visible });
      loadBooks();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleMoveBook = async (index: number, direction: 'up' | 'down') => {
    const newBooks = [...books];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newBooks.length) return;
    [newBooks[index], newBooks[swapIdx]] = [newBooks[swapIdx], newBooks[index]];
    setBooks(newBooks);
    try {
      await api.reorderCMSBooks(token, newBooks.map(b => b.id));
    } catch (err: any) {
      onError(err.message);
      loadBooks();
    }
  };

  const filteredBooks = books.filter(b =>
    !searchQuery || b.title.toLowerCase().includes(searchQuery.toLowerCase()) || b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Book className="w-5 h-5 text-amber-400" />Books ({books.length})</h2>
        <div className="flex gap-2">
          {books.length === 0 && (
            <button onClick={handleSeedBooks} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm" data-testid="seed-books-btn">Seed Defaults</button>
          )}
          <button onClick={() => setShowAddBook(!showAddBook)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-1" data-testid="add-book-btn">
            <Plus className="w-3 h-3" />Add Book
          </button>
          <button onClick={loadBooks} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded" data-testid="refresh-books-btn">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-4">
        <Search className="w-4 h-4 text-gray-400" />
        <input className="bg-transparent flex-1 text-sm outline-none" placeholder="Search books..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} data-testid="search-books-input" />
      </div>

      {/* Add Book Form */}
      {showAddBook && (
        <BookForm data={newBook} onChange={setNewBook} onSave={handleAddBook} onCancel={() => setShowAddBook(false)} categories={CATEGORIES} />
      )}

      {/* Book List */}
      <div className="space-y-2 mt-4">
        {filteredBooks.map((book, idx) => (
          <div key={book.id} className={`bg-gray-800 rounded-lg border ${book.visible ? 'border-gray-700' : 'border-red-900 opacity-60'}`} data-testid={`book-item-${book.id}`}>
            {editingBook === book.id ? (
              <BookForm data={editForm} onChange={setEditForm} onSave={() => handleUpdateBook(book.id)} onCancel={() => setEditingBook(null)} categories={CATEGORIES} />
            ) : (
              <div className="flex items-center gap-3 p-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => handleMoveBook(idx, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => handleMoveBook(idx, 'down')} disabled={idx === books.length - 1} className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                </div>
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt="" className="w-10 h-14 rounded object-cover bg-gray-700" />
                ) : (
                  <div className="w-10 h-14 rounded bg-gray-700 flex items-center justify-center"><Book className="w-4 h-4 text-gray-500" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{book.title}</p>
                  <p className="text-xs text-gray-400 truncate">{book.author} · {book.category} · {book.rating > 0 ? `${book.rating}★` : 'Coming soon'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{book.format}</span>
                  <button onClick={() => handleToggleVisibility(book)} className="p-1.5 hover:bg-gray-700 rounded" title={book.visible ? 'Hide' : 'Show'}>
                    {book.visible ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                  <button onClick={() => { setEditingBook(book.id); setEditForm(book); }} className="p-1.5 hover:bg-gray-700 rounded" data-testid={`edit-book-${book.id}`}><Edit2 className="w-3.5 h-3.5 text-blue-400" /></button>
                  <button onClick={() => handleDeleteBook(book.id, book.title)} className="p-1.5 hover:bg-gray-700 rounded" data-testid={`delete-book-${book.id}`}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {books.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <Book className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No books yet. Click &quot;Seed Defaults&quot; to load the curated list, or add books manually.</p>
        </div>
      )}
    </div>
  );
}

function BookForm({ data, onChange, onSave, onCancel, categories }: { data: Partial<BookItem>; onChange: (d: Partial<BookItem>) => void; onSave: () => void; onCancel: () => void; categories: string[] }) {
  return (
    <div className="bg-gray-700 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Title *" value={data.title || ''} onChange={e => onChange({ ...data, title: e.target.value })} />
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Author *" value={data.author || ''} onChange={e => onChange({ ...data, author: e.target.value })} />
      </div>
      <textarea className="w-full bg-gray-600 rounded px-3 py-2 text-sm" rows={2} placeholder="Description" value={data.description || ''} onChange={e => onChange({ ...data, description: e.target.value })} />
      <div className="grid grid-cols-4 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" type="number" step="0.1" placeholder="Rating" value={data.rating || ''} onChange={e => onChange({ ...data, rating: parseFloat(e.target.value) || 0 })} />
        <select className="bg-gray-600 rounded px-3 py-2 text-sm" value={data.category || 'Memoir'} onChange={e => onChange({ ...data, category: e.target.value })}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="bg-gray-600 rounded px-3 py-2 text-sm" value={data.format || 'both'} onChange={e => onChange({ ...data, format: e.target.value })}>
          <option value="book">Book</option>
          <option value="audiobook">Audiobook</option>
          <option value="both">Both</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={data.visible !== false} onChange={e => onChange({ ...data, visible: e.target.checked })} />
          Visible
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Amazon URL" value={data.amazonUrl || ''} onChange={e => onChange({ ...data, amazonUrl: e.target.value })} />
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Cover Image URL" value={data.coverUrl || ''} onChange={e => onChange({ ...data, coverUrl: e.target.value })} />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm flex items-center gap-1"><X className="w-3 h-3" />Cancel</button>
        <button onClick={onSave} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-1" data-testid="save-book-btn"><Save className="w-3 h-3" />Save</button>
      </div>
    </div>
  );
}


// ==================== PODCASTS MANAGER ====================

function PodcastsManager({ token, onSuccess, onError }: CMSTabProps) {
  const [podcasts, setPodcasts] = useState<PodcastItem[]>([]);
  const [editingPodcast, setEditingPodcast] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PodcastItem>>({});
  const [showAddPodcast, setShowAddPodcast] = useState(false);
  const [newPodcast, setNewPodcast] = useState<Partial<PodcastItem>>({ title: '', host: '', description: '', url: '', coverUrl: '', category: 'General', visible: true });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const CATEGORIES = ['PTSD & Recovery', 'Military History', 'Special Forces', 'Transition', 'Clinical Support', 'Peer Support', 'Wounded Veterans', 'Mental Health', 'General'];

  const loadPodcasts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.getCMSPodcasts(token);
      setPodcasts(Array.isArray(data?.podcasts) ? data.podcasts : []);
    } catch (err: any) {
      console.error('Failed to load podcasts:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadPodcasts(); }, [loadPodcasts]);

  const handleSeedPodcasts = async () => {
    try {
      const res = await api.seedCMSPodcasts(token);
      onSuccess(res.message);
      loadPodcasts();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleAddPodcast = async () => {
    if (!newPodcast.title) return onError('Title is required');
    try {
      await api.createCMSPodcast(token, newPodcast);
      onSuccess('Podcast added');
      setShowAddPodcast(false);
      setNewPodcast({ title: '', host: '', description: '', url: '', coverUrl: '', category: 'General', visible: true });
      loadPodcasts();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleUpdatePodcast = async (id: string) => {
    try {
      await api.updateCMSPodcast(token, id, editForm);
      onSuccess('Podcast updated');
      setEditingPodcast(null);
      loadPodcasts();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleDeletePodcast = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await api.deleteCMSPodcast(token, id);
      onSuccess('Podcast deleted');
      loadPodcasts();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleToggleVisibility = async (podcast: PodcastItem) => {
    try {
      await api.updateCMSPodcast(token, podcast.id, { visible: !podcast.visible });
      loadPodcasts();
    } catch (err: any) {
      onError(err.message);
    }
  };

  const handleMovePodcast = async (index: number, direction: 'up' | 'down') => {
    const newPodcasts = [...podcasts];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= newPodcasts.length) return;
    [newPodcasts[index], newPodcasts[swapIdx]] = [newPodcasts[swapIdx], newPodcasts[index]];
    setPodcasts(newPodcasts);
    try {
      await api.reorderCMSPodcasts(token, newPodcasts.map(p => p.id));
    } catch (err: any) {
      onError(err.message);
      loadPodcasts();
    }
  };

  const filteredPodcasts = podcasts.filter(p =>
    !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()) || p.host.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Headphones className="w-5 h-5 text-purple-400" />Podcasts ({podcasts.length})</h2>
        <div className="flex gap-2">
          {podcasts.length === 0 && (
            <button onClick={handleSeedPodcasts} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm" data-testid="seed-podcasts-btn">Seed Defaults</button>
          )}
          <button onClick={() => setShowAddPodcast(!showAddPodcast)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-1" data-testid="add-podcast-btn">
            <Plus className="w-3 h-3" />Add Podcast
          </button>
          <button onClick={loadPodcasts} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded" data-testid="refresh-podcasts-btn">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-4">
        <Search className="w-4 h-4 text-gray-400" />
        <input className="bg-transparent flex-1 text-sm outline-none" placeholder="Search podcasts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} data-testid="search-podcasts-input" />
      </div>

      {/* Add Podcast Form */}
      {showAddPodcast && (
        <PodcastForm data={newPodcast} onChange={setNewPodcast} onSave={handleAddPodcast} onCancel={() => setShowAddPodcast(false)} categories={CATEGORIES} />
      )}

      {/* Podcast List */}
      <div className="space-y-2 mt-4">
        {filteredPodcasts.map((podcast, idx) => (
          <div key={podcast.id} className={`bg-gray-800 rounded-lg border ${podcast.visible ? 'border-gray-700' : 'border-red-900 opacity-60'}`} data-testid={`podcast-item-${podcast.id}`}>
            {editingPodcast === podcast.id ? (
              <PodcastForm data={editForm} onChange={setEditForm} onSave={() => handleUpdatePodcast(podcast.id)} onCancel={() => setEditingPodcast(null)} categories={CATEGORIES} />
            ) : (
              <div className="flex items-center gap-3 p-3">
                <div className="flex flex-col gap-0.5">
                  <button onClick={() => handleMovePodcast(idx, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => handleMovePodcast(idx, 'down')} disabled={idx === podcasts.length - 1} className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                </div>
                {podcast.coverUrl ? (
                  <img src={podcast.coverUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-700" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center"><Headphones className="w-5 h-5 text-gray-500" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{podcast.title}</p>
                  <p className="text-xs text-gray-400 truncate">{podcast.host} · {podcast.category}</p>
                  {podcast.url && (
                    <a href={podcast.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5">
                      <ExternalLink className="w-3 h-3" />Listen
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleToggleVisibility(podcast)} className="p-1.5 hover:bg-gray-700 rounded" title={podcast.visible ? 'Hide' : 'Show'}>
                    {podcast.visible ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                  </button>
                  <button onClick={() => { setEditingPodcast(podcast.id); setEditForm(podcast); }} className="p-1.5 hover:bg-gray-700 rounded" data-testid={`edit-podcast-${podcast.id}`}><Edit2 className="w-3.5 h-3.5 text-blue-400" /></button>
                  <button onClick={() => handleDeletePodcast(podcast.id, podcast.title)} className="p-1.5 hover:bg-gray-700 rounded" data-testid={`delete-podcast-${podcast.id}`}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {podcasts.length === 0 && !loading && (
        <div className="text-center py-12 text-gray-400">
          <Headphones className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No podcasts yet. Click &quot;Seed Defaults&quot; to load the curated list, or add podcasts manually.</p>
        </div>
      )}
    </div>
  );
}

function PodcastForm({ data, onChange, onSave, onCancel, categories }: { data: Partial<PodcastItem>; onChange: (d: Partial<PodcastItem>) => void; onSave: () => void; onCancel: () => void; categories: string[] }) {
  return (
    <div className="bg-gray-700 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Podcast Title *" value={data.title || ''} onChange={e => onChange({ ...data, title: e.target.value })} />
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Host" value={data.host || ''} onChange={e => onChange({ ...data, host: e.target.value })} />
      </div>
      <textarea className="w-full bg-gray-600 rounded px-3 py-2 text-sm" rows={2} placeholder="Description" value={data.description || ''} onChange={e => onChange({ ...data, description: e.target.value })} />
      <div className="grid grid-cols-3 gap-3">
        <select className="bg-gray-600 rounded px-3 py-2 text-sm" value={data.category || 'General'} onChange={e => onChange({ ...data, category: e.target.value })}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Focus tags (comma separated)" value={(data as any).focus ? (Array.isArray((data as any).focus) ? (data as any).focus.join(', ') : (data as any).focus) : ''} onChange={e => onChange({ ...data, focus: e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean) } as any)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={data.visible !== false} onChange={e => onChange({ ...data, visible: e.target.checked })} />
          Visible
        </label>
      </div>
      <p className="text-xs text-gray-400 -mb-1">Platform Links (shown as buttons in the app)</p>
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Spotify URL" value={(data as any).spotifyUrl || ''} onChange={e => onChange({ ...data, spotifyUrl: e.target.value } as any)} />
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Apple Podcasts URL" value={(data as any).appleUrl || ''} onChange={e => onChange({ ...data, appleUrl: e.target.value } as any)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="YouTube Channel URL" value={(data as any).youtubeUrl || ''} onChange={e => onChange({ ...data, youtubeUrl: e.target.value } as any)} />
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Website URL" value={(data as any).websiteUrl || ''} onChange={e => onChange({ ...data, websiteUrl: e.target.value } as any)} />
      </div>
      <p className="text-xs text-gray-400 -mb-1">Episode Feeds (for pulling latest episodes)</p>
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="RSS Feed URL" value={(data as any).rssFeedUrl || ''} onChange={e => onChange({ ...data, rssFeedUrl: e.target.value } as any)} />
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="YouTube Feed URL (atom)" value={(data as any).youtubeFeedUrl || ''} onChange={e => onChange({ ...data, youtubeFeedUrl: e.target.value } as any)} />
      </div>
      <input className="w-full bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Cover Image URL" value={data.coverUrl || ''} onChange={e => onChange({ ...data, coverUrl: e.target.value })} />
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm flex items-center gap-1"><X className="w-3 h-3" />Cancel</button>
        <button onClick={onSave} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-1" data-testid="save-podcast-btn"><Save className="w-3 h-3" />Save</button>
      </div>
    </div>
  );
}
