'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { api, resolveAvatarUrl } from '@/lib/admin-api';
import type { AICharacter } from '@/types/admin';

interface AIPersonasTabProps {
  token: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export default function AIPersonasTab({ token, onSuccess, onError }: AIPersonasTabProps) {
  // AI Characters state
  const [aiCharacters, setAICharacters] = useState<AICharacter[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<AICharacter | null>(null);
  const [showCharacterModal, setShowCharacterModal] = useState(false);

  // Load AI characters
  const loadAICharacters = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getAICharacters(token);
      setAICharacters(Array.isArray(data?.characters) ? data.characters : []);
    } catch (err: any) {
      // Fallback to public endpoint
      try {
        const data = await api.fetch<{ characters: AICharacter[] }>('/ai-characters', {});
        setAICharacters(Array.isArray(data?.characters) ? data.characters : []);
      } catch {
        setAICharacters([]);
      }
    }
  }, [token]);

  useEffect(() => {
    loadAICharacters();
  }, [loadAICharacters]);

  const handleUpdateCharacter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !editingCharacter) return;
    try {
      await api.updateAICharacter(token, editingCharacter.id, editingCharacter);
      onSuccess('Character updated successfully');
      setShowCharacterModal(false);
      setEditingCharacter(null);
      loadAICharacters();
    } catch (err: any) {
      onError('Failed to update character: ' + err.message);
    }
  };

  return (
    <div data-testid="ai-personas-tab">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">AI Chat Personas</h2>
        <div className="flex gap-2">
          <button 
            onClick={async () => {
              if (!token) return;
              try {
                await api.seedAICharacters(token);
                onSuccess('Default AI characters imported');
                loadAICharacters();
              } catch (err: any) {
                onError('Failed to import defaults: ' + err.message);
              }
            }}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Import Defaults
          </button>
          <button onClick={loadAICharacters} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Edit Character Modal */}
      {showCharacterModal && editingCharacter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Edit AI Character</h3>
              <button onClick={() => { setShowCharacterModal(false); setEditingCharacter(null); }} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateCharacter}>
              <div className="space-y-4">
                {/* Row 1: Name and Character ID */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Character Name *</label>
                    <input
                      type="text"
                      value={editingCharacter.name}
                      onChange={(e) => setEditingCharacter({ ...editingCharacter, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Character ID</label>
                    <input
                      type="text"
                      value={editingCharacter.id}
                      disabled
                      className="w-full px-3 py-2 bg-gray-600 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Cannot be changed after creation</p>
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Short Description</label>
                  <input
                    type="text"
                    value={editingCharacter.description || ''}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    placeholder="Brief description shown in character list"
                  />
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Bio (Optional)</label>
                  <textarea
                    value={editingCharacter.bio || ''}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, bio: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white h-20"
                    placeholder="Longer biography shown in character detail view"
                  />
                </div>

                {/* Row 2: Category, Order, Enabled */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Category</label>
                    <select
                      value={editingCharacter.category || 'general'}
                      onChange={(e) => setEditingCharacter({ ...editingCharacter, category: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    >
                      <option value="general">General</option>
                      <option value="legal">Legal</option>
                      <option value="wellbeing">Wellbeing</option>
                      <option value="addiction">Addiction</option>
                      <option value="family">Family</option>
                      <option value="fitness">Fitness</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Display Order</label>
                    <input
                      type="number"
                      value={editingCharacter.order || 0}
                      onChange={(e) => setEditingCharacter({ ...editingCharacter, order: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                      min="0"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="char-enabled"
                      checked={editingCharacter.is_enabled}
                      onChange={(e) => setEditingCharacter({ ...editingCharacter, is_enabled: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <label htmlFor="char-enabled" className="text-sm">Enabled (visible to users)</label>
                  </div>
                </div>

                {/* Avatar Section */}
                <div className="border border-gray-600 rounded-lg p-4">
                  <label className="block text-sm text-gray-400 mb-2">Avatar</label>
                  <div className="flex items-start gap-4">
                    {editingCharacter.avatar && (
                      <img 
                        src={editingCharacter.avatar} 
                        alt={editingCharacter.name}
                        className="w-20 h-20 rounded-full object-cover border-2 border-gray-600"
                      />
                    )}
                    <div className="flex-1">
                      <input
                        type="text"
                        value={editingCharacter.avatar || ''}
                        onChange={(e) => setEditingCharacter({ ...editingCharacter, avatar: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                        placeholder="Enter avatar URL (e.g., /static/avatars/character.png)"
                      />
                      <p className="text-xs text-gray-500 mt-1">Enter URL or use /static/avatars/ path</p>
                    </div>
                  </div>
                </div>

                {/* System Prompt */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">System Prompt *</label>
                  <textarea
                    value={editingCharacter.prompt || ''}
                    onChange={(e) => setEditingCharacter({ ...editingCharacter, prompt: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                    rows={12}
                    placeholder="Enter the system prompt that defines this character's personality, behavior, and responses..."
                  />
                  <p className="text-xs text-gray-500 mt-1">This defines how the AI character responds to users</p>
                </div>

                {editingCharacter.is_hardcoded && (
                  <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-3">
                    <p className="text-yellow-300 text-sm">
                      ⚠️ This is a hardcoded character. Changes will create a database override.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowCharacterModal(false); setEditingCharacter(null); }}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {aiCharacters.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-400">
            <p>No AI characters configured</p>
            <p className="text-sm mt-2">Click "Import Defaults" to add default characters</p>
          </div>
        ) : (
          aiCharacters.map((char) => {
            const avatarUrl = resolveAvatarUrl(char.avatar);
            return (
              <div key={char.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                <div className="flex items-start gap-4">
                  {avatarUrl ? (
                    <img 
                      src={avatarUrl} 
                      alt={char.name} 
                      className="w-16 h-16 rounded-full object-cover bg-gray-700" 
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const fallback = (e.target as HTMLImageElement).nextElementSibling;
                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold ${avatarUrl ? 'hidden' : ''}`}
                  >
                    {(char.name || 'A')[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{char.name}</h3>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{char.description || 'No description'}</p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {/* Enable/Disable Toggle */}
                      <button
                        onClick={async () => {
                          if (!token) return;
                          try {
                            await api.toggleAICharacterStatus(token, char.id, !char.is_enabled);
                            onSuccess(`${char.name} ${!char.is_enabled ? 'enabled' : 'disabled'}`);
                            loadAICharacters();
                          } catch (err: any) {
                            onError('Failed to update status: ' + err.message);
                          }
                        }}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          char.is_enabled 
                            ? 'bg-green-500 hover:bg-green-600 text-white' 
                            : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                        }`}
                      >
                        {char.is_enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      {char.order !== undefined && (
                        <span className="text-xs text-gray-500">Order: {char.order}</span>
                      )}
                    </div>
                    {/* Edit Button */}
                    <button
                      onClick={async () => {
                        try {
                          // Fetch full character details including prompt
                          const fullChar = await api.getAICharacter(token!, char.id);
                          setEditingCharacter(fullChar);
                          setShowCharacterModal(true);
                        } catch (err) {
                          // Fallback to current data if fetch fails
                          setEditingCharacter({ ...char });
                          setShowCharacterModal(true);
                        }
                      }}
                      className="mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
