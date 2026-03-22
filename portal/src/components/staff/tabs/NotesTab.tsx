'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Edit2, Trash2, Share2, X
} from 'lucide-react';
import { staffApi, StaffNote, TeamMember } from '@/lib/api';

interface NotesTabProps {
  token: string;
  user: any;
}

export default function NotesTab({
  token,
  user,
}: NotesTabProps) {
  // Sub-tab state
  const [notesTab, setNotesTab] = useState<'my' | 'shared'>('my');
  
  // Data state
  const [notes, setNotes] = useState<StaffNote[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  
  // Add note modal state
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteShared, setNewNoteShared] = useState(false);
  
  // Edit note modal state
  const [editingNote, setEditingNote] = useState<StaffNote | null>(null);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState<string | null>(null);
  const [selectedShareUsers, setSelectedShareUsers] = useState<string[]>([]);

  // Load notes
  const loadNotes = useCallback(async () => {
    if (!token) return;
    try {
      const response = await staffApi.getNotes(token);
      setNotes(response.notes || []);
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  }, [token]);

  // Load team members (for sharing)
  const loadTeam = useCallback(async () => {
    if (!token) return;
    try {
      const data = await staffApi.getTeamOnDuty(token);
      setTeamMembers(data);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (token) {
      loadNotes();
      loadTeam();
    }
  }, [token, loadNotes, loadTeam]);

  // Handler functions
  const handleAddNote = async () => {
    if (!token || !newNoteTitle.trim() || !newNoteContent.trim()) return;
    try {
      await staffApi.createNote(token, {
        title: newNoteTitle,
        content: newNoteContent,
        is_shared: newNoteShared,
      });
      setShowAddNote(false);
      setNewNoteTitle('');
      setNewNoteContent('');
      setNewNoteShared(false);
      loadNotes();
    } catch (err) {
      console.error('Failed to add note:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    if (!token || !confirm('Delete this note?')) return;
    try {
      await staffApi.deleteNote(token, id);
      loadNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleUpdateNote = async () => {
    if (!token || !editingNote) return;
    try {
      await staffApi.updateNote(token, editingNote.id || editingNote._id || '', {
        title: editingNote.title,
        content: editingNote.content,
        is_shared: editingNote.is_shared,
        tags: editingNote.tags,
      });
      setEditingNote(null);
      loadNotes();
    } catch (err) {
      console.error('Failed to update note:', err);
    }
  };

  const handleShareNote = async () => {
    if (!token || !showShareModal || selectedShareUsers.length === 0) return;
    try {
      await staffApi.shareNote(token, showShareModal, selectedShareUsers);
      setShowShareModal(null);
      setSelectedShareUsers([]);
      loadNotes();
    } catch (err) {
      console.error('Failed to share note:', err);
    }
  };

  // Helper function
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-secondary" />
          Notes
        </h1>
        <button
          onClick={() => setShowAddNote(true)}
          className="flex items-center gap-2 px-4 py-2 bg-secondary text-primary-dark rounded-lg hover:bg-secondary-light"
        >
          <Plus className="w-4 h-4" />
          New Note
        </button>
      </div>

      {/* Notes Tabs */}
      <div className="flex gap-4 mb-6 border-b border-border">
        <button
          onClick={() => setNotesTab('my')}
          className={`px-4 py-3 border-b-2 transition-colors ${
            notesTab === 'my' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          My Notes
        </button>
        <button
          onClick={() => setNotesTab('shared')}
          className={`px-4 py-3 border-b-2 transition-colors ${
            notesTab === 'shared' ? 'border-secondary text-secondary' : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Shared Notes
        </button>
      </div>

      {/* Notes Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(notes || [])
          .filter(note => notesTab === 'my' ? !note.is_shared : note.is_shared)
          .map(note => {
            const noteId = note.id || note._id || '';
            const isAuthor = note.author_id === user?.id;
            return (
            <div key={noteId} className="bg-card border border-border rounded-xl p-6">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold">{note.title}</h3>
                <div className="flex gap-1">
                  {isAuthor && (
                    <>
                      <button 
                        onClick={() => setEditingNote(note)} 
                        className="p-1 hover:bg-blue-500/20 rounded text-blue-400"
                        title="Edit note"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          setShowShareModal(noteId);
                          setSelectedShareUsers(note.share_with || []);
                        }} 
                        className="p-1 hover:bg-green-500/20 rounded text-green-400"
                        title="Share note"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteNote(noteId)} 
                        className="p-1 hover:bg-red-500/20 rounded text-red-400"
                        title="Delete note"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-400 line-clamp-3 mb-3">{note.content}</p>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{formatTimeAgo(note.created_at)}</span>
                <div className="flex gap-2">
                  {note.is_shared && <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">Shared</span>}
                  {!isAuthor && <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 rounded">From: {note.author_name}</span>}
                </div>
              </div>
            </div>
            );
          })}
        {(notes || []).filter(note => notesTab === 'my' ? !note.is_shared : note.is_shared).length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No notes yet</p>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showAddNote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowAddNote(false)}>
          <div className="bg-card border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-secondary" />
                New Note
              </h2>
              <button onClick={() => setShowAddNote(false)} className="text-gray-400 hover:text-white text-2xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Title</label>
                <input
                  type="text"
                  value={newNoteTitle}
                  onChange={(e) => setNewNoteTitle(e.target.value)}
                  placeholder="Note title..."
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Content</label>
                <textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Write your note..."
                  rows={5}
                  className="w-full px-4 py-3 bg-primary-dark border border-border rounded-lg focus:border-secondary outline-none resize-none"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newNoteShared}
                  onChange={(e) => setNewNoteShared(e.target.checked)}
                  className="w-4 h-4 accent-secondary"
                />
                <span className="text-sm">Share with team</span>
              </label>
              <button
                onClick={handleAddNote}
                disabled={!newNoteTitle.trim() || !newNoteContent.trim()}
                className="w-full py-3 bg-secondary text-primary-dark font-semibold rounded-lg disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Note</h2>
              <button onClick={() => setEditingNote(null)} className="p-1 hover:bg-primary-dark rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input
                  type="text"
                  value={editingNote.title}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Content</label>
                <textarea
                  value={editingNote.content}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-2 bg-primary-dark border border-border rounded-lg resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editNoteShared"
                  checked={editingNote.is_shared}
                  onChange={(e) => setEditingNote({ ...editingNote, is_shared: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="editNoteShared" className="text-sm">Share with team</label>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditingNote(null)}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateNote}
                className="flex-1 px-4 py-2 rounded-lg bg-secondary text-white hover:bg-secondary/80 transition"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Note Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Share Note</h2>
              <button onClick={() => { setShowShareModal(null); setSelectedShareUsers([]); }} className="p-1 hover:bg-primary-dark rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">Select staff members to share this note with:</p>
            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
              {teamMembers.filter(m => m.id !== user?.id).map(member => {
                const memberId = member.id || member.user_id || '';
                return (
                <label key={memberId} className="flex items-center gap-3 p-3 bg-primary-dark rounded-lg cursor-pointer hover:bg-primary-dark/70">
                  <input
                    type="checkbox"
                    checked={selectedShareUsers.includes(memberId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedShareUsers([...selectedShareUsers, memberId]);
                      } else {
                        setSelectedShareUsers(selectedShareUsers.filter(id => id !== memberId));
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <p className="font-medium">{member.name}</p>
                    <p className="text-xs text-gray-500 capitalize">{member.role}</p>
                  </div>
                </label>
                );
              })}
              {teamMembers.filter(m => m.id !== user?.id).length === 0 && (
                <p className="text-gray-500 text-center py-4">No other team members available</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowShareModal(null); setSelectedShareUsers([]); }}
                className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-primary-dark transition"
              >
                Cancel
              </button>
              <button
                onClick={handleShareNote}
                disabled={selectedShareUsers.length === 0}
                className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Share with {selectedShareUsers.length} member{selectedShareUsers.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
