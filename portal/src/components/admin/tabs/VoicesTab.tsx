'use client';

/**
 * Veteran Voices — admin portal tab (PR #B2).
 *
 * Single-page layout (per PR #B2 Q2a):
 *   ┌─────────────────────────────────────────────┐
 *   │ Upload form (file + metadata) – top         │
 *   ├─────────────────────────────────────────────┤
 *   │ Clip list (any status) – middle              │
 *   ├─────────────────────────────────────────────┤
 *   │ Detail editor for `selectedId` – bottom     │
 *   │   (transcript + captions table + publish/   │
 *   │    archive / retranscribe / delete)         │
 *   └─────────────────────────────────────────────┘
 *
 * Consumes the endpoints shipped in PR #B1
 * (`backend/routers/clips_admin.py`). No safety/safeguarding code is
 * touched on the portal side either.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Loader2,
  Mic,
  RefreshCw,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';

import { API_URL, api } from '@/lib/admin-api';
import {
  CLIP_CATEGORIES,
  SENSITIVITY_FLAGS,
  type CaptionSegment,
  type ClipAdminListItem,
  type ClipAdminResponse,
  type ClipCategory,
  type SensitivityFlag,
} from '@/types/voices';

interface VoicesTabProps {
  token: string;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-yellow-700 text-yellow-100',
  published: 'bg-green-700 text-green-100',
  archived: 'bg-gray-600 text-gray-200',
};

const PROCESSING_BADGE: Record<string, string> = {
  pending: 'bg-blue-700 text-blue-100',
  transcoding: 'bg-blue-700 text-blue-100',
  transcribing: 'bg-blue-700 text-blue-100',
  ready: 'bg-green-700 text-green-100',
  failed: 'bg-red-700 text-red-100',
};

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '–';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildAudioUrl(clip: ClipAdminResponse | null): string {
  if (!clip) return '';
  return `${API_URL}/api/clips/audio/${clip.id}`;
}

// ---------------------------------------------------------------------------
// Upload form
// ---------------------------------------------------------------------------

interface UploadFormState {
  file: File | null;
  contributorName: string;
  contributorBio: string;
  contributorPhoto: File | null;
  recordingDate: string;
  categories: ClipCategory[];
  sensitivityFlags: SensitivityFlag[];
  consentConfirmed: boolean;
  adminNotes: string;
  internalNotes: string;
}

const EMPTY_UPLOAD: UploadFormState = {
  file: null,
  contributorName: '',
  contributorBio: '',
  contributorPhoto: null,
  recordingDate: '',
  categories: [],
  sensitivityFlags: ['none'],
  consentConfirmed: false,
  adminNotes: '',
  internalNotes: '',
};

function toggleArrayItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

// ---------------------------------------------------------------------------
// Main tab component
// ---------------------------------------------------------------------------

export default function VoicesTab({ token, onSuccess, onError }: VoicesTabProps) {
  const [list, setList] = useState<ClipAdminListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClipAdminResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadFormState>(EMPTY_UPLOAD);
  const [uploading, setUploading] = useState(false);

  // ---- list load
  const loadList = useCallback(async () => {
    if (!token) return;
    setListLoading(true);
    try {
      const rows = await api.listClipsAdmin(token);
      setList(rows);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load clips');
    } finally {
      setListLoading(false);
    }
  }, [token, onError]);

  // ---- detail load (called on row select + after every mutation)
  const loadDetail = useCallback(
    async (clipId: string) => {
      if (!token) return;
      setDetailLoading(true);
      try {
        const d = await api.getClipAdmin(token, clipId);
        setDetail(d);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Failed to load clip');
      } finally {
        setDetailLoading(false);
      }
    },
    [token, onError],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  // ---- upload submit
  const submitUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.file) {
      onError('Choose an audio file first.');
      return;
    }
    if (!uploadForm.contributorName.trim() || !uploadForm.contributorBio.trim()) {
      onError('Contributor name and bio are required.');
      return;
    }
    setUploading(true);
    try {
      const created = await api.createClipAdmin(token, {
        audio: uploadForm.file,
        contributorName: uploadForm.contributorName.trim(),
        contributorBio: uploadForm.contributorBio.trim(),
        categories: uploadForm.categories.join(','),
        sensitivityFlags: (uploadForm.sensitivityFlags.length
          ? uploadForm.sensitivityFlags
          : ['none']
        ).join(','),
        contributorPhoto: uploadForm.contributorPhoto,
        recordingDate: uploadForm.recordingDate || undefined,
        consentConfirmed: uploadForm.consentConfirmed,
        adminNotes: uploadForm.adminNotes.trim() || undefined,
        internalNotes: uploadForm.internalNotes.trim() || undefined,
      });
      onSuccess(
        created.processingStatus === 'ready'
          ? `Created "${created.contributorName}" — pipeline ready. Open the detail editor below to review captions before publishing.`
          : `Created "${created.contributorName}" — pipeline ${created.processingStatus}. ${created.processingError ?? ''}`,
      );
      setUploadForm(EMPTY_UPLOAD);
      // Reset the file input by remount; the form key trick is overkill here,
      // we just clear via state.
      await loadList();
      setSelectedId(created.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ---- detail mutations
  const saveDetail = async (patch: Partial<ClipAdminResponse>) => {
    if (!detail) return;
    try {
      const updated = await api.updateClipAdmin(token, detail.id, {
        contributorName: patch.contributorName,
        contributorBio: patch.contributorBio,
        contributorPhotoUrl: patch.contributorPhotoUrl ?? undefined,
        transcript: patch.transcript,
        captions: patch.captions,
        categories: patch.categories,
        sensitivityFlags: patch.sensitivityFlags,
        recordingDate: patch.recordingDate ?? undefined,
        consentConfirmed: patch.consentConfirmed,
        adminNotes: patch.adminNotes ?? undefined,
        internalNotes: patch.internalNotes ?? undefined,
      });
      setDetail(updated);
      onSuccess('Saved.');
      await loadList();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const doPublish = async () => {
    if (!detail) return;
    try {
      const updated = await api.publishClipAdmin(token, detail.id);
      setDetail(updated);
      onSuccess('Published — clip is now in the veteran random feed.');
      await loadList();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Publish failed');
    }
  };

  const doArchive = async () => {
    if (!detail) return;
    try {
      const updated = await api.archiveClipAdmin(token, detail.id);
      setDetail(updated);
      onSuccess('Archived — clip removed from the veteran feed.');
      await loadList();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Archive failed');
    }
  };

  const doRetranscribe = async () => {
    if (!detail) return;
    try {
      const updated = await api.retranscribeClipAdmin(token, detail.id);
      setDetail(updated);
      onSuccess(
        updated.processingStatus === 'ready'
          ? 'Re-transcribed. Review the new captions below.'
          : `Retranscribe finished with status ${updated.processingStatus}.`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Retranscribe failed');
    }
  };

  const doDelete = async () => {
    if (!detail) return;
    if (
      !window.confirm(
        `Permanently delete "${detail.contributorName}"? This removes the audio file from disk and cannot be undone.\n\nPrefer Archive unless the contributor has withdrawn consent.`,
      )
    ) {
      return;
    }
    try {
      await api.deleteClipAdmin(token, detail.id);
      onSuccess('Deleted.');
      setSelectedId(null);
      setDetail(null);
      await loadList();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6" data-testid="voices-tab">
      <header className="flex items-center gap-3">
        <Mic className="h-6 w-6 text-blue-400" />
        <div>
          <h2 className="text-2xl font-semibold text-white">Veteran Voices</h2>
          <p className="text-sm text-gray-400">
            Upload peer audio clips. Transcoding + Whisper transcription run on submit.
            Clips ALWAYS start as draft; publish only after consent is confirmed and captions are reviewed.
          </p>
        </div>
      </header>

      <UploadFormCard
        form={uploadForm}
        setForm={setUploadForm}
        uploading={uploading}
        onSubmit={submitUpload}
      />

      <ListCard
        rows={list}
        loading={listLoading}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onReload={loadList}
      />

      {selectedId && (
        <DetailCard
          loading={detailLoading}
          clip={detail}
          audioUrl={buildAudioUrl(detail)}
          onSave={saveDetail}
          onPublish={doPublish}
          onArchive={doArchive}
          onRetranscribe={doRetranscribe}
          onDelete={doDelete}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload form card
// ---------------------------------------------------------------------------

function UploadFormCard({
  form,
  setForm,
  uploading,
  onSubmit,
}: {
  form: UploadFormState;
  setForm: React.Dispatch<React.SetStateAction<UploadFormState>>;
  uploading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <section
      className="rounded-lg border border-gray-700 bg-gray-800 p-5"
      data-testid="voices-upload-card"
    >
      <h3 className="mb-4 flex items-center gap-2 text-lg font-medium text-white">
        <Upload className="h-5 w-5" /> Upload new clip
      </h3>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormField label="Audio or Video file *">
          <input
            type="file"
            accept="audio/*,video/*,.mp4,.mov,.mkv,.avi,.webm,.wav,.mp3,.m4a,.ogg,.flac"
            data-testid="voices-upload-file"
            onChange={(e) =>
              setForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))
            }
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
          <p className="mt-1 text-xs text-gray-500">
            Audio (wav / mp3 / m4a / ogg / flac) up to 100 MB → re-encoded
            to mono 96 kbps mp3.<br />
            Video (mp4 / mov / mkv / avi / webm) up to 500 MB → re-encoded
            to 720p H.264 + AAC. All metadata stripped on ingest.
          </p>
        </FormField>

        <FormField label="Contributor name *">
          <input
            type="text"
            data-testid="voices-upload-name"
            value={form.contributorName}
            onChange={(e) =>
              setForm((f) => ({ ...f, contributorName: e.target.value }))
            }
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
            placeholder="Alias or first name (per consent)"
          />
        </FormField>

        <FormField label="Bio (≤80 chars) *">
          <input
            type="text"
            data-testid="voices-upload-bio"
            value={form.contributorBio}
            maxLength={80}
            onChange={(e) =>
              setForm((f) => ({ ...f, contributorBio: e.target.value }))
            }
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
            placeholder="e.g. Royal Marines, 1998–2010"
          />
        </FormField>

        <FormField label="Contributor photo (optional, PNG/JPG ≤5 MB)">
          <input
            type="file"
            accept="image/png,image/jpeg"
            data-testid="voices-upload-photo"
            onChange={(e) =>
              setForm((f) => ({ ...f, contributorPhoto: e.target.files?.[0] ?? null }))
            }
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
          <p className="mt-1 text-xs text-gray-500">
            Clips without a photo fall back to a text-only card for veterans.
          </p>
        </FormField>

        <FormField label="Recording date (optional)">
          <input
            type="date"
            value={form.recordingDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, recordingDate: e.target.value }))
            }
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>

        <FormField label="Categories">
          <CheckboxGrid
            testIdPrefix="voices-upload-cat"
            options={CLIP_CATEGORIES}
            selected={form.categories}
            onToggle={(cat) =>
              setForm((f) => ({
                ...f,
                categories: toggleArrayItem(f.categories, cat),
              }))
            }
          />
        </FormField>

        <FormField label="Sensitivity flags">
          <CheckboxGrid
            testIdPrefix="voices-upload-flag"
            options={SENSITIVITY_FLAGS}
            selected={form.sensitivityFlags}
            onToggle={(flag) =>
              setForm((f) => ({
                ...f,
                sensitivityFlags: toggleArrayItem(f.sensitivityFlags, flag),
              }))
            }
          />
        </FormField>

        <FormField label="Admin notes (visible in admin only)">
          <textarea
            value={form.adminNotes}
            rows={2}
            onChange={(e) =>
              setForm((f) => ({ ...f, adminNotes: e.target.value }))
            }
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>

        <FormField label="Internal notes (admin only)">
          <textarea
            value={form.internalNotes}
            rows={2}
            onChange={(e) =>
              setForm((f) => ({ ...f, internalNotes: e.target.value }))
            }
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>

        <div className="lg:col-span-2">
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              data-testid="voices-upload-consent"
              checked={form.consentConfirmed}
              onChange={(e) =>
                setForm((f) => ({ ...f, consentConfirmed: e.target.checked }))
              }
              className="mt-1"
            />
            <span>
              I confirm the contributor has given consent for this recording to be
              published in the Veteran Voices feed under the supplied alias and bio.
              Required before publishing.
            </span>
          </label>
        </div>

        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={uploading}
            data-testid="voices-upload-submit"
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Uploading + transcribing…' : 'Upload + ingest'}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// List card
// ---------------------------------------------------------------------------

function ListCard({
  rows,
  loading,
  selectedId,
  onSelect,
  onReload,
}: {
  rows: ClipAdminListItem[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReload: () => void;
}) {
  return (
    <section
      className="rounded-lg border border-gray-700 bg-gray-800 p-5"
      data-testid="voices-list-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">All clips ({rows.length})</h3>
        <button
          type="button"
          onClick={onReload}
          data-testid="voices-list-reload"
          className="flex items-center gap-1 rounded border border-gray-600 px-3 py-1 text-sm text-gray-200 hover:bg-gray-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-gray-200">
          <thead className="text-xs uppercase text-gray-400">
            <tr>
              <th className="px-2 py-2">Contributor</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Pipeline</th>
              <th className="px-2 py-2">Duration</th>
              <th className="px-2 py-2">Categories</th>
              <th className="px-2 py-2">Flags</th>
              <th className="px-2 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-2 py-6 text-center text-gray-500">
                  No clips yet — upload one above to get started.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr
                key={r.id}
                onClick={() => onSelect(r.id)}
                data-testid={`voices-list-row-${r.id}`}
                className={`cursor-pointer border-t border-gray-700 hover:bg-gray-700/50 ${
                  selectedId === r.id ? 'bg-gray-700/70' : ''
                }`}
              >
                <td className="px-2 py-2 font-medium">{r.contributorName || '—'}</td>
                <td className="px-2 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${STATUS_BADGE[r.status] ?? ''}`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-2 py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${PROCESSING_BADGE[r.processingStatus] ?? ''}`}
                  >
                    {r.processingStatus}
                  </span>
                </td>
                <td className="px-2 py-2">{formatDuration(r.durationSeconds)}</td>
                <td className="px-2 py-2 text-xs text-gray-400">
                  {r.categories.join(', ') || '—'}
                </td>
                <td className="px-2 py-2 text-xs text-gray-400">
                  {(r.sensitivityFlags || []).filter((f) => f !== 'none').join(', ') || '—'}
                </td>
                <td className="px-2 py-2 text-xs text-gray-500">
                  {new Date(r.updatedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Detail / edit card (transcript + captions table, publish/archive/etc)
// ---------------------------------------------------------------------------

function DetailCard({
  clip,
  loading,
  audioUrl,
  onSave,
  onPublish,
  onArchive,
  onRetranscribe,
  onDelete,
  onClose,
}: {
  clip: ClipAdminResponse | null;
  loading: boolean;
  audioUrl: string;
  onSave: (patch: Partial<ClipAdminResponse>) => Promise<void>;
  onPublish: () => Promise<void>;
  onArchive: () => Promise<void>;
  onRetranscribe: () => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  // Local editable copy — copied from the loaded clip whenever it changes.
  // We don't auto-save: each Save button is explicit so the editor doesn't
  // accidentally clobber a half-typed transcript.
  const [draft, setDraft] = useState<ClipAdminResponse | null>(clip);

  useEffect(() => {
    setDraft(clip);
  }, [clip]);

  const captionsDirty = useMemo(() => {
    if (!clip || !draft) return false;
    return JSON.stringify(clip.captions) !== JSON.stringify(draft.captions);
  }, [clip, draft]);

  if (loading) {
    return (
      <section className="rounded-lg border border-gray-700 bg-gray-800 p-5">
        <p className="flex items-center gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      </section>
    );
  }
  if (!clip || !draft) return null;

  const updateDraft = <K extends keyof ClipAdminResponse>(key: K, value: ClipAdminResponse[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  const updateCaption = (idx: number, patch: Partial<CaptionSegment>) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            captions: d.captions.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
          }
        : d,
    );

  const addCaption = () => {
    const last = draft.captions[draft.captions.length - 1];
    const start = last ? last.end : 0;
    setDraft((d) =>
      d ? { ...d, captions: [...d.captions, { start, end: start + 5, text: '' }] } : d,
    );
  };

  const removeCaption = (idx: number) =>
    setDraft((d) =>
      d ? { ...d, captions: d.captions.filter((_, i) => i !== idx) } : d,
    );

  const canPublish =
    draft.consentConfirmed &&
    draft.audioFilename &&
    draft.processingStatus === 'ready' &&
    draft.status !== 'published';

  return (
    <section
      className="rounded-lg border border-gray-700 bg-gray-800 p-5"
      data-testid="voices-detail-card"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-white">
            Editing: {clip.contributorName || '(no name)'}
          </h3>
          <p className="text-xs text-gray-500">
            id: {clip.id} · created {new Date(clip.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          data-testid="voices-detail-close"
          className="rounded border border-gray-600 px-3 py-1 text-sm text-gray-300 hover:bg-gray-700"
        >
          Close
        </button>
      </div>

      {clip.processingStatus === 'failed' && clip.processingError && (
        <div
          className="mb-4 flex items-start gap-2 rounded border border-red-700 bg-red-900/40 p-3 text-sm text-red-100"
          data-testid="voices-detail-pipeline-error"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          <div>
            <p className="font-medium">Pipeline failed</p>
            <p className="text-xs">{clip.processingError}</p>
          </div>
        </div>
      )}

      {/* Player — video if mediaType==='video', audio otherwise */}
      {clip.audioFilename && (
        <div className="mb-4">
          {clip.mediaType === 'video' ? (
            <video
              controls
              src={audioUrl}
              data-testid="voices-detail-video"
              className="w-full rounded bg-black"
              style={{ maxHeight: 360 }}
            />
          ) : (
            <audio
              controls
              src={audioUrl}
              data-testid="voices-detail-audio"
              className="w-full"
            />
          )}
        </div>
      )}

      {/* Contributor photo preview + admin actions to replace/remove */}
      {(clip.contributorPhotoFilename || clip.contributorPhotoUrl) && (
        <div className="mb-4 flex items-center gap-3" data-testid="voices-detail-photo-preview">
          {clip.contributorPhotoFilename ? (
            <img
              src={`${API_URL}/api/clips/photo/${clip.id}?cb=${encodeURIComponent(clip.updatedAt)}`}
              alt={clip.contributorName}
              className="h-20 w-20 rounded object-cover ring-1 ring-gray-700"
            />
          ) : (
            <img
              src={clip.contributorPhotoUrl ?? ''}
              alt={clip.contributorName}
              className="h-20 w-20 rounded object-cover ring-1 ring-gray-700"
            />
          )}
          <span className="text-xs text-gray-400">
            {clip.contributorPhotoFilename
              ? 'Uploaded photo (served via /api/clips/photo/:id).'
              : 'External photo URL.'}
          </span>
        </div>
      )}

      {/* Identity panel */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormField label="Contributor name">
          <input
            type="text"
            value={draft.contributorName}
            onChange={(e) => updateDraft('contributorName', e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>
        <FormField label="Bio (≤80 chars)">
          <input
            type="text"
            value={draft.contributorBio}
            maxLength={80}
            onChange={(e) => updateDraft('contributorBio', e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>
        <FormField label="Photo URL">
          <input
            type="url"
            value={draft.contributorPhotoUrl ?? ''}
            onChange={(e) => updateDraft('contributorPhotoUrl', e.target.value || null)}
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>
        <FormField label="Recording date">
          <input
            type="date"
            value={draft.recordingDate ?? ''}
            onChange={(e) => updateDraft('recordingDate', e.target.value || null)}
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>
        <FormField label="Categories">
          <CheckboxGrid
            testIdPrefix="voices-detail-cat"
            options={CLIP_CATEGORIES}
            selected={draft.categories as ClipCategory[]}
            onToggle={(cat) =>
              updateDraft('categories', toggleArrayItem(draft.categories, cat))
            }
          />
        </FormField>
        <FormField label="Sensitivity flags">
          <CheckboxGrid
            testIdPrefix="voices-detail-flag"
            options={SENSITIVITY_FLAGS}
            selected={draft.sensitivityFlags as SensitivityFlag[]}
            onToggle={(flag) =>
              updateDraft(
                'sensitivityFlags',
                toggleArrayItem(draft.sensitivityFlags, flag),
              )
            }
          />
        </FormField>
      </div>

      {/* Transcript */}
      <div className="mt-4">
        <FormField label="Transcript (internal only, never shown to veterans)">
          <textarea
            data-testid="voices-detail-transcript"
            rows={6}
            value={draft.transcript}
            onChange={(e) => updateDraft('transcript', e.target.value)}
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 font-mono text-sm text-gray-200"
          />
        </FormField>
      </div>

      {/* Captions table */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-200">
            Captions ({draft.captions.length})
            {captionsDirty && (
              <span className="ml-2 text-xs text-yellow-400">(unsaved changes)</span>
            )}
          </h4>
          <button
            type="button"
            onClick={addCaption}
            data-testid="voices-detail-caption-add"
            className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700"
          >
            + Add row
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm text-gray-200">
            <thead className="text-xs uppercase text-gray-400">
              <tr>
                <th className="w-20 px-2 py-1">Start</th>
                <th className="w-20 px-2 py-1">End</th>
                <th className="px-2 py-1">Text</th>
                <th className="w-12 px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {draft.captions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-xs text-gray-500">
                    No captions yet. Click &quot;Re-transcribe&quot; to run Whisper again,
                    or add rows manually.
                  </td>
                </tr>
              )}
              {draft.captions.map((c, idx) => (
                <tr key={idx} className="border-t border-gray-700">
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.1"
                      data-testid={`voices-detail-caption-start-${idx}`}
                      value={c.start}
                      onChange={(e) =>
                        updateCaption(idx, { start: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-gray-600 bg-gray-900 p-1 text-xs text-gray-200"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="number"
                      step="0.1"
                      data-testid={`voices-detail-caption-end-${idx}`}
                      value={c.end}
                      onChange={(e) =>
                        updateCaption(idx, { end: parseFloat(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-gray-600 bg-gray-900 p-1 text-xs text-gray-200"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      data-testid={`voices-detail-caption-text-${idx}`}
                      value={c.text}
                      onChange={(e) => updateCaption(idx, { text: e.target.value })}
                      className="w-full rounded border border-gray-600 bg-gray-900 p-1 text-xs text-gray-200"
                    />
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => removeCaption(idx)}
                      data-testid={`voices-detail-caption-remove-${idx}`}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes + consent */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormField label="Admin notes">
          <textarea
            value={draft.adminNotes ?? ''}
            rows={2}
            onChange={(e) => updateDraft('adminNotes', e.target.value || null)}
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>
        <FormField label="Internal notes">
          <textarea
            value={draft.internalNotes ?? ''}
            rows={2}
            onChange={(e) => updateDraft('internalNotes', e.target.value || null)}
            className="w-full rounded border border-gray-600 bg-gray-900 p-2 text-sm text-gray-200"
          />
        </FormField>

        <div className="lg:col-span-2">
          <label className="flex items-start gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              data-testid="voices-detail-consent"
              checked={draft.consentConfirmed}
              onChange={(e) => updateDraft('consentConfirmed', e.target.checked)}
              className="mt-1"
            />
            <span>
              Consent confirmed (required to publish). Save the form below after
              ticking this; the publish button activates only when consent is saved.
            </span>
          </label>
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-gray-700 pt-4">
        <button
          type="button"
          onClick={() =>
            onSave({
              contributorName: draft.contributorName,
              contributorBio: draft.contributorBio,
              contributorPhotoUrl: draft.contributorPhotoUrl,
              transcript: draft.transcript,
              captions: draft.captions,
              categories: draft.categories,
              sensitivityFlags: draft.sensitivityFlags,
              recordingDate: draft.recordingDate,
              consentConfirmed: draft.consentConfirmed,
              adminNotes: draft.adminNotes,
              internalNotes: draft.internalNotes,
            })
          }
          data-testid="voices-detail-save"
          className="rounded bg-gray-600 px-4 py-2 text-sm text-white hover:bg-gray-500"
        >
          Save changes
        </button>

        <button
          type="button"
          onClick={onRetranscribe}
          disabled={!clip.audioFilename || clip.processingStatus === 'transcribing'}
          data-testid="voices-detail-retranscribe"
          className="flex items-center gap-1 rounded border border-gray-600 px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${clip.processingStatus === 'transcribing' ? 'animate-spin' : ''}`} />
          Re-transcribe
        </button>

        {clip.status !== 'archived' ? (
          <button
            type="button"
            onClick={onArchive}
            data-testid="voices-detail-archive"
            className="flex items-center gap-1 rounded border border-yellow-700 px-3 py-2 text-sm text-yellow-100 hover:bg-yellow-800/40"
          >
            <Archive className="h-4 w-4" /> Archive
          </button>
        ) : (
          <span className="text-xs text-gray-400">Already archived</span>
        )}

        <button
          type="button"
          onClick={onPublish}
          disabled={!canPublish}
          data-testid="voices-detail-publish"
          title={
            !canPublish
              ? 'Publish requires: consent confirmed (saved), audio on disk, pipeline=ready, and current status ≠ published.'
              : 'Publish to the veteran random feed.'
          }
          className="flex items-center gap-1 rounded bg-green-700 px-3 py-2 text-sm text-white hover:bg-green-600 disabled:opacity-50"
        >
          {clip.status === 'published' ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Published
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Publish
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onDelete}
          data-testid="voices-detail-delete"
          className="flex items-center gap-1 rounded border border-red-700 px-3 py-2 text-sm text-red-100 hover:bg-red-900/40"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Reusable bits
// ---------------------------------------------------------------------------

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function CheckboxGrid<T extends string>({
  options,
  selected,
  onToggle,
  testIdPrefix,
}: {
  options: readonly T[];
  selected: T[];
  onToggle: (item: T) => void;
  testIdPrefix: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded border border-gray-700 bg-gray-900 p-2 md:grid-cols-3">
      {options.map((opt) => {
        const checked = selected.includes(opt);
        return (
          <label
            key={opt}
            className="flex cursor-pointer items-center gap-1 text-xs text-gray-200"
          >
            <input
              type="checkbox"
              checked={checked}
              data-testid={`${testIdPrefix}-${opt}`}
              onChange={() => onToggle(opt)}
            />
            <span>{opt}</span>
          </label>
        );
      })}
    </div>
  );
}
