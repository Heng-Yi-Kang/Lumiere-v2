import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  FileText,
  FolderOpen,
  LoaderCircle,
  MonitorPlay,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { FileItem, Notebook, NotebookFilePreview } from '../types';
import { fetchNotebookFilePreview, NOTEBOOKS_API_BASE_URL } from '../lib/notebooksApi';
import { validateNotebookUpload } from '../lib/notebookUpload';

interface NotebookViewProps {
  notebook: Notebook | null;
  allNotebooks: Notebook[];
  onSelectNotebook: (id: string | null) => void;
  onBackToDashboard: () => void;
  onAskInChat: (question: string) => void;
  onUploadFile?: (notebookId: string, file: File) => Promise<void> | void;
  onDeleteFile?: (notebookId: string, fileId: string) => Promise<void> | void;
  onEditNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onCreateNotebookRequested?: () => void;
}

function getFileIcon(type: FileItem['type']) {
  switch (type) {
    case 'pdf':
      return <FileText className="h-4.5 w-4.5 text-rose-300" />;
    case 'docx':
      return <BookOpen className="h-4.5 w-4.5 text-sky-300" />;
    case 'pptx':
      return <MonitorPlay className="h-4.5 w-4.5 text-amber-300" />;
    case 'txt':
      return <FileText className="h-4.5 w-4.5 text-emerald-300" />;
  }
}

function getViewerUrl(sourceUrl?: string) {
  if (!sourceUrl) {
    return undefined;
  }

  return `${NOTEBOOKS_API_BASE_URL}${sourceUrl}`;
}

export default function NotebookView({
  notebook,
  allNotebooks,
  onSelectNotebook,
  onBackToDashboard,
  onAskInChat,
  onUploadFile,
  onDeleteFile,
  onEditNotebook,
  onDeleteNotebook,
  onCreateNotebookRequested,
}: NotebookViewProps) {
  type UploadPhase = 'idle' | 'validating' | 'uploading' | 'extracting' | 'success';
  const [materialSearchText, setMaterialSearchText] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<FileItem | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<string, NotebookFilePreview>>({});
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadFileName, setUploadFileName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<FileItem | null>(null);
  const [isDeleteNotebookModalOpen, setIsDeleteNotebookModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSelectedMaterial(null);
    setPreviewError('');
    setUploadError('');
  }, [notebook?.id]);

  useEffect(() => {
    if (uploadPhase !== 'success') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUploadPhase('idle');
      setUploadFileName('');
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [uploadPhase]);

  useEffect(() => {
    if (!notebook || !selectedMaterial) {
      return;
    }

    if (previewCache[selectedMaterial.id]) {
      return;
    }

    let isActive = true;
    setPreviewLoading(true);
    setPreviewError('');

    void fetchNotebookFilePreview(notebook.id, selectedMaterial.id)
      .then((preview) => {
        if (!isActive) {
          return;
        }

        setPreviewCache((current) => ({
          ...current,
          [selectedMaterial.id]: preview,
        }));
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setPreviewError(error instanceof Error ? error.message : 'Failed to load file preview.');
      })
      .finally(() => {
        if (isActive) {
          setPreviewLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [notebook, previewCache, selectedMaterial]);

  const filteredFiles = useMemo(() => {
    if (!notebook) {
      return [];
    }

    return notebook.files.filter((file) =>
      file.name.toLowerCase().includes(materialSearchText.toLowerCase()),
    );
  }, [materialSearchText, notebook]);

  const activePreview = selectedMaterial ? previewCache[selectedMaterial.id] : undefined;
  const viewerUrl = getViewerUrl(activePreview?.sourceUrl);
  const selectedViewerUrl = getViewerUrl(activePreview?.sourceUrl);
  const uploadProgressValue = uploadPhase === 'validating'
    ? 10
    : uploadPhase === 'uploading'
      ? 45
      : uploadPhase === 'extracting'
        ? 82
        : uploadPhase === 'success'
          ? 100
          : 0;
  const uploadStatusLabel = uploadPhase === 'validating'
    ? 'Validating file before upload...'
    : uploadPhase === 'uploading'
      ? 'Sending file to notebook storage...'
      : uploadPhase === 'extracting'
        ? 'Extracting preview content and refreshing notebook...'
        : uploadPhase === 'success'
          ? 'Upload finished. Material is ready.'
          : '';

  const handleUpload = async (file: File) => {
    if (!notebook || !onUploadFile) {
      return;
    }

    const validationError = validateNotebookUpload(file);
    if (validationError) {
      setUploadError(validationError);
      setUploadPhase('idle');
      return;
    }

    setUploadError('');
    setUploadFileName(file.name);
    setUploadPhase('validating');

    try {
      await Promise.resolve();
      setUploadPhase('uploading');
      await Promise.resolve();
      setUploadPhase('extracting');
      await Promise.resolve(onUploadFile(notebook.id, file));
      setUploadPhase('success');
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
      setUploadPhase('idle');
      setUploadFileName('');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (file: FileItem) => {
    if (!notebook || !onDeleteFile || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setPreviewError('');

    try {
      await Promise.resolve(onDeleteFile(notebook.id, file.id));
      setPreviewCache((current) => {
        const next = { ...current };
        delete next[file.id];
        return next;
      });

      if (selectedMaterial?.id === file.id) {
        setSelectedMaterial(null);
      }
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setIsDeleting(false);
      setPendingDeleteFile(null);
    }
  };

  const handleDeleteCurrentNotebook = async () => {
    if (!notebook || !onDeleteNotebook || isDeletingNotebook) {
      return;
    }

    setIsDeletingNotebook(true);
    setPreviewError('');

    try {
      await Promise.resolve(onDeleteNotebook(notebook.id));
      setSelectedMaterial(null);
      setPendingDeleteFile(null);
      setIsDeleteNotebookModalOpen(false);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setIsDeletingNotebook(false);
    }
  };

  if (!notebook) {
    return (
      <div className="space-y-8 text-left animate-fade-in relative z-10" id="all-notebooks-tab">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-300">
                Notebook Workspace
              </span>
              <h2 className="text-2xl font-black text-white font-display">My Academic Course Notebooks</h2>
              <p className="max-w-2xl text-xs text-slate-400">
                Upload lecture materials and open previews inline without leaving the notebook.
              </p>
            </div>
            <button
              onClick={onCreateNotebookRequested}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                New Notebook
              </span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {allNotebooks.map((entry) => (
            <button
              key={entry.id}
              onClick={() => onSelectNotebook(entry.id)}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-indigo-500/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                  {entry.courseCode}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400">{entry.fileCount} files</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditNotebook?.(entry);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                      title={`Edit ${entry.name}`}
                      aria-label={`Edit ${entry.name}`}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (window.confirm(`Delete "${entry.name}" and all its files?`)) {
                          void onDeleteNotebook?.(entry.id);
                        }
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                      title={`Delete ${entry.name}`}
                      aria-label={`Delete ${entry.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <h3 className="mt-4 text-base font-black text-white font-display">{entry.name}</h3>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">
                {entry.description || 'No description set yet.'}
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left relative z-10 animate-fade-in" id={`notebook-workspace-${notebook.id}`}>
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectNotebook(null)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-white/10"
              >
                <span className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Notebooks
                </span>
              </button>
              <button
                onClick={onBackToDashboard}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300 transition hover:bg-white/10"
              >
                Dashboard
              </button>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-widest text-indigo-300">{notebook.courseCode}</p>
              <h1 className="text-2xl font-black text-white font-display">{notebook.name}</h1>
              <p className="max-w-3xl text-xs leading-relaxed text-slate-400">
                {notebook.description || 'No description set yet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onEditNotebook?.(notebook)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-slate-100 transition hover:bg-white/10"
            >
              <span className="inline-flex items-center gap-1.5">
                <Edit3 className="h-4 w-4" />
                Edit Notebook
              </span>
            </button>
            <button
              onClick={() => setIsDeleteNotebookModalOpen(true)}
              className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-100 transition hover:bg-rose-500/20"
            >
              <span className="inline-flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" />
                Delete Notebook
              </span>
            </button>
            <button
              onClick={() =>
                onAskInChat(`Explain the main ideas from the files in my "${notebook.name}" notebook.`)
              }
              className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-xs font-bold text-indigo-100 transition hover:bg-indigo-500/20"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                Ask AI About This Notebook
              </span>
            </button>
          </div>
        </div>
      </div>

      {(uploadError || previewError) && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-100">
          {uploadError || previewError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-sm font-black text-white font-display">Upload Material</h2>
              <p className="text-xs leading-relaxed text-slate-400">
                PDF, DOCX, PPTX, and TXT only. Files are saved on the backend filesystem and indexed in the notebook.
              </p>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhase !== 'idle'}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-indigo-400/25 bg-indigo-500/10 px-4 py-6 text-sm font-bold text-indigo-100 transition hover:bg-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploadPhase !== 'idle' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
              {uploadPhase !== 'idle' ? 'Processing upload...' : 'Select File'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.pptx,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                }
              }}
            />

            {uploadPhase !== 'idle' && (
              <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/30 p-4">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-bold text-slate-100">{uploadFileName}</span>
                  <span className="font-black text-indigo-300">{uploadProgressValue}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400 transition-all duration-200"
                    style={{ width: `${uploadProgressValue}%` }}
                  />
                </div>
                <p className="mt-3 text-[11px] text-slate-400">{uploadStatusLabel}</p>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-white/5 bg-slate-950/25 p-4 text-[11px] leading-relaxed text-slate-400">
              <p>Limit: 100MB per file.</p>
              <p>Stored under the backend app for preview and download.</p>
              <p>Delete removes both the database record and the stored file immediately.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-2xl">
            <div className="space-y-2">
              <h2 className="text-sm font-black text-white font-display">Notebook Snapshot</h2>
              <p className="text-xs text-slate-400">Quick counts for the current notebook.</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Files</div>
                <div className="mt-2 text-2xl font-black text-white">{notebook.fileCount}</div>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Concepts</div>
                <div className="mt-2 text-2xl font-black text-white">{notebook.conceptCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-white/5 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black text-white font-display">Materials Directory</h2>
              <p className="text-[11px] text-slate-400">Open inline previews or delete files directly from this notebook.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={materialSearchText}
                onChange={(event) => setMaterialSearchText(event.target.value)}
                placeholder="Search files..."
                className="w-full rounded-xl border border-white/10 bg-slate-950/50 py-2 pl-8 pr-3 text-xs text-slate-100 outline-none transition focus:border-indigo-400 sm:w-56"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {filteredFiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-12 text-center text-sm text-slate-500">
                <FolderOpen className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                No files matched this notebook filter.
              </div>
            ) : (
              filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-950/25 p-4 transition hover:border-indigo-500/20 hover:bg-white/[0.04] sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    onClick={() => setSelectedMaterial(file)}
                    className="flex min-w-0 items-center gap-3 text-left"
                  >
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2.5">{getFileIcon(file.type)}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{file.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-widest text-slate-500">
                        <span>{file.type}</span>
                        <span>{file.size}</span>
                        <span>{file.uploadDate}</span>
                        {file.totalPages ? <span>{file.totalPages} pages</span> : null}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedMaterial(file)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="h-4 w-4" />
                        View
                      </span>
                    </button>
                    <button
                      onClick={() => setPendingDeleteFile(file)}
                      disabled={isDeleting}
                      className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {selectedMaterial && (
        <div
          className="fixed inset-y-0 right-0 left-0 z-50 flex items-center justify-center bg-[#03060b]/85 p-4 backdrop-blur-md md:left-64"
          onClick={() => setSelectedMaterial(null)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b101c] shadow-2xl xl:flex-row"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMaterial(null)}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="w-full border-b border-white/10 bg-[#0e1627] p-5 xl:w-[58%] xl:border-b-0 xl:border-r">
              <div className="space-y-2 border-b border-white/5 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-2">
                    {getFileIcon(selectedMaterial.type)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-extrabold text-white font-display">{selectedMaterial.name}</h3>
                    <p className="text-[10px] text-slate-400">
                      {selectedMaterial.size} • Uploaded {selectedMaterial.uploadDate}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 min-h-[420px] overflow-auto rounded-2xl border border-white/5 bg-slate-950/40 p-4">
                {previewLoading && !activePreview ? (
                  <div className="flex h-[380px] items-center justify-center gap-2 text-sm text-slate-400">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Loading inline preview...
                  </div>
                ) : null}

                {!previewLoading && !activePreview && !previewError ? (
                  <div className="flex h-[380px] items-center justify-center text-sm text-slate-500">
                    Preview is not available for this file.
                  </div>
                ) : null}

                {activePreview?.previewFormat === 'pdf' && viewerUrl ? (
                  <iframe
                    title={activePreview.name}
                    src={viewerUrl}
                    className="h-[70vh] min-h-[380px] w-full rounded-xl border border-white/5 bg-white"
                  />
                ) : null}

                {activePreview?.previewFormat === 'html' ? (
                  <div
                    className="prose prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: activePreview.previewContent || '' }}
                  />
                ) : null}

                {activePreview?.previewFormat === 'text' ? (
                  <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                    {activePreview.previewContent || ''}
                  </pre>
                ) : null}
              </div>
            </div>

            <div className="flex w-full flex-col justify-between p-5 xl:w-[42%]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-300">
                    <Sparkles className="h-4 w-4" />
                    Extracted Summary
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-emerald-100/90">
                    {activePreview?.summary || selectedMaterial.summary || 'No summary was generated for this file.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 text-sm text-slate-300">
                  <div className="text-[11px] font-black uppercase tracking-widest text-slate-500">File Details</div>
                  <div className="mt-2">Inline preview and download are generated from notebook storage on demand.</div>
                  {activePreview?.totalPages ? (
                    <div className="mt-3 text-xs text-slate-400">{activePreview.totalPages} pages detected</div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5 border-t border-white/5 pt-4">
                {selectedViewerUrl ? (
                  <>
                    <a
                      href={selectedViewerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-100 transition hover:bg-white/10"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <ExternalLink className="h-4 w-4" />
                        Open
                      </span>
                    </a>
                    <a
                      href={selectedViewerUrl}
                      download={selectedMaterial.name}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-100 transition hover:bg-white/10"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Download className="h-4 w-4" />
                        Download
                      </span>
                    </a>
                  </>
                ) : null}
                <button
                  onClick={() =>
                    onAskInChat(
                      `I'm reviewing "${selectedMaterial.name}" from notebook "${notebook.name}". Summarize the important concepts and likely exam angles.`,
                    )
                  }
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500"
                >
                  Ask AI About Material
                </button>
                <button
                  onClick={() => setPendingDeleteFile(selectedMaterial)}
                  disabled={isDeleting}
                  className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteFile && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#02050b]/80 p-4 backdrop-blur-sm"
          onClick={() => setPendingDeleteFile(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b101c] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white font-display">Delete material?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              This removes <span className="font-semibold text-slate-200">{pendingDeleteFile.name}</span> from the notebook and deletes the stored file immediately.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setPendingDeleteFile(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(pendingDeleteFile)}
                disabled={isDeleting}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? 'Deleting...' : 'Delete file'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteNotebookModalOpen && notebook && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#02050b]/80 p-4 backdrop-blur-sm"
          onClick={() => setIsDeleteNotebookModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0b101c] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white font-display">Delete notebook?</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-400">
              This removes <span className="font-semibold text-slate-200">{notebook.name}</span>, all notebook records, and all stored files immediately.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setIsDeleteNotebookModalOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteCurrentNotebook()}
                disabled={isDeletingNotebook}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-200 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingNotebook ? 'Deleting...' : 'Delete notebook'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
