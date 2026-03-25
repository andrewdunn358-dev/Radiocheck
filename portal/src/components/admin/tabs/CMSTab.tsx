'use client';

import { useState, useEffect, useCallback } from 'react';
import { Book, Plus, Trash2, Edit2, Save, X, Eye, EyeOff, RefreshCw, Headphones, Users, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { api } from '@/lib/admin-api';

interface CMSTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

type SubTab = 'books' | 'podcasts' | 'personas';

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

export default function CMSTab({ token, onSuccess, onError }: CMSTabProps) {
  const [subTab, setSubTab] = useState<SubTab>('books');
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

  const renderBookForm = (data: Partial<BookItem>, onChange: (d: Partial<BookItem>) => void, onSave: () => void, onCancel: () => void) => (
    <div className="bg-gray-700 rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Title *" value={data.title || ''} onChange={e => onChange({ ...data, title: e.target.value })} />
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" placeholder="Author *" value={data.author || ''} onChange={e => onChange({ ...data, author: e.target.value })} />
      </div>
      <textarea className="w-full bg-gray-600 rounded px-3 py-2 text-sm" rows={2} placeholder="Description" value={data.description || ''} onChange={e => onChange({ ...data, description: e.target.value })} />
      <div className="grid grid-cols-4 gap-3">
        <input className="bg-gray-600 rounded px-3 py-2 text-sm" type="number" step="0.1" placeholder="Rating" value={data.rating || ''} onChange={e => onChange({ ...data, rating: parseFloat(e.target.value) || 0 })} />
        <select className="bg-gray-600 rounded px-3 py-2 text-sm" value={data.category || 'Memoir'} onChange={e => onChange({ ...data, category: e.target.value })}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
        <button onClick={onSave} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-1"><Save className="w-3 h-3" />Save</button>
      </div>
    </div>
  );

  return (
    <div data-testid="cms-tab">
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700 pb-3">
        {[
          { id: 'books' as SubTab, label: 'Books', icon: Book },
          { id: 'podcasts' as SubTab, label: 'Podcasts', icon: Headphones },
          { id: 'personas' as SubTab, label: 'AI Personas', icon: Users },
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

      {/* Books Manager */}
      {subTab === 'books' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><Book className="w-5 h-5 text-amber-400" />Books ({books.length})</h2>
            <div className="flex gap-2">
              {books.length === 0 && (
                <button onClick={handleSeedBooks} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm">Seed Defaults</button>
              )}
              <button onClick={() => setShowAddBook(!showAddBook)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm flex items-center gap-1">
                <Plus className="w-3 h-3" />Add Book
              </button>
              <button onClick={loadBooks} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-4">
            <Search className="w-4 h-4 text-gray-400" />
            <input className="bg-transparent flex-1 text-sm outline-none" placeholder="Search books..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          {/* Add Book Form */}
          {showAddBook && renderBookForm(newBook, setNewBook, handleAddBook, () => setShowAddBook(false))}

          {/* Book List */}
          <div className="space-y-2 mt-4">
            {filteredBooks.map((book, idx) => (
              <div key={book.id} className={`bg-gray-800 rounded-lg border ${book.visible ? 'border-gray-700' : 'border-red-900 opacity-60'}`}>
                {editingBook === book.id ? (
                  renderBookForm(editForm, setEditForm, () => handleUpdateBook(book.id), () => setEditingBook(null))
                ) : (
                  <div className="flex items-center gap-3 p-3">
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => handleMoveBook(idx, 'up')} disabled={idx === 0} className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={() => handleMoveBook(idx, 'down')} disabled={idx === books.length - 1} className="p-0.5 hover:bg-gray-700 rounded disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                    </div>
                    {/* Cover */}
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" className="w-10 h-14 rounded object-cover bg-gray-700" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-gray-700 flex items-center justify-center"><Book className="w-4 h-4 text-gray-500" /></div>
                    )}
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{book.title}</p>
                      <p className="text-xs text-gray-400 truncate">{book.author} · {book.category} · {book.rating > 0 ? `${book.rating}★` : 'Coming soon'}</p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">{book.format}</span>
                      <button onClick={() => handleToggleVisibility(book)} className="p-1.5 hover:bg-gray-700 rounded" title={book.visible ? 'Hide' : 'Show'}>
                        {book.visible ? <Eye className="w-3.5 h-3.5 text-green-400" /> : <EyeOff className="w-3.5 h-3.5 text-red-400" />}
                      </button>
                      <button onClick={() => { setEditingBook(book.id); setEditForm(book); }} className="p-1.5 hover:bg-gray-700 rounded"><Edit2 className="w-3.5 h-3.5 text-blue-400" /></button>
                      <button onClick={() => handleDeleteBook(book.id, book.title)} className="p-1.5 hover:bg-gray-700 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
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
      )}

      {/* Podcasts - placeholder for now */}
      {subTab === 'podcasts' && (
        <div className="text-center py-12 text-gray-400">
          <Headphones className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-2">Podcasts Manager</p>
          <p className="text-sm">Coming soon — same interface as Books. Add, edit, reorder and manage podcast recommendations.</p>
        </div>
      )}

      {/* Personas - placeholder for now */}
      {subTab === 'personas' && (
        <div className="text-center py-12 text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-2">AI Persona Bios</p>
          <p className="text-sm">Coming soon — edit persona descriptions and bios shown in the app and website. Reorder the AI Platoon.</p>
        </div>
      )}
    </div>
  );
}
