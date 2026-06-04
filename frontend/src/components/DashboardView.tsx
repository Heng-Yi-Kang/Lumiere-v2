import React, { useEffect, useRef, useState } from 'react';
import { Notebook } from '../types';
import { 
  ArrowUpRight,
  Plus, 
  UploadCloud, 
  BookMarked, 
  Sparkles, 
  ArrowRight,
  FileText,
  Check,
  Edit3,
  Trash2,
  Flame,
  Lightbulb,
  Link as LinkIcon,
  LoaderCircle
} from 'lucide-react';

import { StudyStreak } from '../types';
import {
  NOTEBOOK_UPLOAD_ACCEPT,
  validateNotebookUploadBatch,
} from '../lib/notebookUpload';
import type { SupportedNotebookExtension } from '../lib/notebookUpload';
import { getNotebookColorTone } from '../lib/notebookColors';
import AddLinkModal from './AddLinkModal';

interface DashboardViewProps {
  currentUserName: string;
  notebooks: Notebook[];
  onOpenNotebook: (notebookId: string) => void;
  onAddLink: (notebookId: string, url: string) => Promise<void> | void;
  onUploadFile: (notebookId: string, files: File[]) => Promise<void> | void;
  onEditNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onCreateNotebookRequested?: () => void;
  streak?: StudyStreak;
  notebookError?: string;
}

export default function DashboardView({ 
  currentUserName,
  notebooks, 
  onOpenNotebook, 
  onAddLink,
  onUploadFile,
  onEditNotebook,
  onDeleteNotebook,
  onCreateNotebookRequested,
  streak,
  notebookError
}: DashboardViewProps) {
  type UploadPhase = 'idle' | 'validating' | 'uploading' | 'extracting' | 'success';
  const [dragActive, setDragActive] = useState(false);
  const [selectedNotebookId, setSelectedNotebookId] = useState(notebooks[0]?.id || '');
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileType, setSelectedFileType] = useState<SupportedNotebookExtension>('pdf');
  const [selectedFileCount, setSelectedFileCount] = useState(0);
  const [completedFileCount, setCompletedFileCount] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<Array<{
    id: string;
    name: string;
    extension: SupportedNotebookExtension;
    progress: number;
    status: 'queued' | 'validating' | 'uploading' | 'extracting' | 'done' | 'failed';
  }>>([]);
  const [uploadError, setUploadError] = useState('');
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const totalFileCount = notebooks.reduce((sum, notebook) => sum + (notebook.fileCount ?? notebook.files.length), 0);

  useEffect(() => {
    if (notebooks.length === 0) {
      setSelectedNotebookId('');
      return;
    }

    if (!selectedNotebookId || !notebooks.some((nb) => nb.id === selectedNotebookId)) {
      setSelectedNotebookId(notebooks[0].id);
    }
  }, [notebooks, selectedNotebookId]);

  useEffect(() => {
    if (uploadPhase !== 'success') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setUploadPhase('idle');
      setSelectedFileName('');
      setSelectedFileCount(0);
      setCompletedFileCount(0);
      setUploadQueue([]);
    }, 1400);

    return () => window.clearTimeout(timeoutId);
  }, [uploadPhase]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const executeUpload = async (files: File[]) => {
    if (!selectedNotebookId) {
      return;
    }

    const validationError = validateNotebookUploadBatch(files);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploadError('');
    setUploadQueue(files.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      extension: (file.name.split('.').pop()?.toLowerCase() as SupportedNotebookExtension) || 'pdf',
      progress: 0,
      status: 'queued',
    })));
    setSelectedFileName(files[0].name);
    setSelectedFileType((files[0].name.split('.').pop()?.toLowerCase() as SupportedNotebookExtension) || 'pdf');
    setSelectedFileCount(files.length);
    setCompletedFileCount(0);
    setUploadPhase('validating');

    try {
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 10, status: 'validating' })));
      await Promise.resolve();
      setUploadPhase('uploading');
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 45, status: 'uploading' })));
      await Promise.resolve();
      setUploadPhase('extracting');
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 82, status: 'extracting' })));
      await Promise.resolve(onUploadFile(selectedNotebookId, files));
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 100, status: 'done' })));
      setCompletedFileCount(files.length);
      setUploadPhase('success');
    } catch (error) {
      setUploadPhase('idle');
      setUploadQueue((current) => current.map((item) =>
        item.status === 'done' ? item : { ...item, status: 'failed' },
      ));
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void executeUpload(Array.from(e.dataTransfer.files));
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const selectedNotebook = notebooks.find((notebook) => notebook.id === selectedNotebookId);

  const executeAddLink = async (url: string) => {
    if (!selectedNotebookId) {
      throw new Error('Select a notebook before adding a web link.');
    }

    setUploadError('');
    await Promise.resolve(onAddLink(selectedNotebookId, url));
  };

  const uploadProgress = uploadPhase === 'validating'
    ? 10
    : uploadPhase === 'uploading'
      ? 45
      : uploadPhase === 'extracting'
        ? 82
        : uploadPhase === 'success'
          ? 101
          : -1;

  const uploadProgressValue = uploadPhase === 'idle'
    ? -1
    : uploadProgress;

  const uploadStatus = uploadPhase === 'validating'
    ? selectedFileCount > 1
      ? `Validating ${selectedFileCount} files before upload...`
      : 'Validating file before upload...'
    : uploadPhase === 'uploading'
      ? selectedFileCount > 1
        ? `Uploading ${selectedFileCount} files to notebook storage...`
        : 'Uploading file to notebook storage...'
      : uploadPhase === 'extracting'
        ? selectedFileCount > 1
          ? `Extracting ${selectedFileCount} files and refreshing notebook...`
          : 'Extracting preview and refreshing notebook...'
        : uploadPhase === 'success'
          ? selectedFileCount > 1
            ? `Uploaded ${selectedFileCount} files successfully.`
            : 'Upload completed successfully.'
          : '';
  const isUploadActive = uploadPhase === 'validating' || uploadPhase === 'uploading' || uploadPhase === 'extracting';
  const hasUploadFailure = uploadQueue.some((item) => item.status === 'failed');
  const shouldShowUploadQueue = uploadQueue.length > 0 && (isUploadActive || uploadPhase === 'success' || Boolean(uploadError));
  const uploadSummaryLabel = hasUploadFailure
    ? `${completedFileCount} of ${selectedFileCount} files uploaded before the batch stopped`
    : selectedFileCount > 1
      ? `${completedFileCount} of ${selectedFileCount} files complete`
      : selectedFileName;

  return (
    <div className="space-y-8 text-left">
      {notebookError && (
        <div className="rounded-2xl border border-error/20 bg-error-subtle px-4 py-3 text-sm font-semibold text-error">
          Notebook API error: {notebookError}
        </div>
      )}
      {uploadError && (
        <div className="rounded-2xl border border-cta/20 bg-cta-subtle px-4 py-3 text-sm font-semibold text-cta">
          {uploadError}
        </div>
      )}

      {/* Welcome Greetings Bar - Premium Frosted Design */}
      <div className="surface-card rounded-3xl p-6 md:p-8 text-text-primary relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-20 blur-3xl pointer-events-none">
          <div className="h-72 w-72 rounded-full bg-accent"></div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="rounded-full border border-accent-border bg-accent-subtle px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-accent-hover">
                Lumiere Workspace
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight font-display text-gradient">
              Welcome, {currentUserName}
            </h1>
            <p className="max-w-xl text-base font-normal leading-relaxed text-text-secondary font-serif">
              {notebooks.length === 0 ? (
                <>Start by creating your first notebook, then upload lecture materials so Lumiere can build descriptions and study aids.</>
              ) : (
                <>Your materials are linked. You have <span className="text-accent-hover font-bold">{notebooks.length} notebooks</span> ready across your active course library. Ready to score that 4.00 flat?</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-border-default bg-bg-elevated/60 p-3.5 flex flex-col leading-none">
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted font-mono">Notebooks</span>
              <span className="text-lg font-black text-text-primary mt-1.5">
                {notebooks.length} {notebooks.length === 1 ? 'Notebook' : 'Notebooks'}
              </span>
            </div>
            <div className="rounded-2xl border border-border-default bg-bg-elevated/60 p-3.5 flex flex-col leading-none">
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-text-muted font-mono">Files</span>
              <span className="text-lg font-black text-success mt-1.5">
                {totalFileCount} {totalFileCount === 1 ? 'File' : 'Files'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {notebooks.length === 0 && (
        <div className="surface-elevated rounded-3xl p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex rounded-full border border-accent-border bg-accent-subtle px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-accent-hover">
                Get Started
              </span>
              <h2 className="text-2xl font-black text-text-primary font-display">No notebooks yet</h2>
              <p className="text-base leading-relaxed text-text-secondary font-serif">
                Create a course notebook first. After that, you can drop in PDFs, slides, notes, and transcripts so Lumiere can organize previews, concepts, and grounded AI help.
              </p>
            </div>

            <button
              onClick={onCreateNotebookRequested}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white transition hover:bg-accent-hover shadow-lg shadow-indigo-500/20 shrink-0"
            >
              <Plus className="h-4 w-4" />
              Create First Notebook
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border-default bg-bg-elevated/40 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-accent-hover font-mono">1. Create</div>
              <p className="mt-2 text-sm font-semibold text-text-primary">Add a notebook for one subject or course.</p>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary font-serif">Name it clearly and pick the matching course code so you can find it fast later.</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-bg-elevated/40 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-success font-mono">2. Upload</div>
              <p className="mt-2 text-sm font-semibold text-text-primary">Drop in lecture files and notes.</p>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary font-serif">Use PDF, DOCX, PPTX, TXT, image, audio, or video files. Upload becomes available as soon as your first notebook exists.</p>
            </div>
            <div className="rounded-2xl border border-border-default bg-bg-elevated/40 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.14em] text-cta font-mono">3. Review</div>
              <p className="mt-2 text-sm font-semibold text-text-primary">Open the notebook and study from there.</p>
              <p className="mt-1.5 text-sm leading-relaxed text-text-secondary font-serif">You&apos;ll get inline previews, generated descriptions, and notebook-grounded AI prompts once materials are indexed.</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border-default bg-bg-elevated/30 px-4 py-3.5 text-sm leading-relaxed text-text-secondary font-serif">
            Upload controls are disabled until at least one notebook exists.
            <button
              onClick={onCreateNotebookRequested}
              className="ml-2 inline-flex items-center gap-1 font-bold text-accent-hover transition hover:text-accent"
            >
              Open notebook setup
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Upload Center + Dynamic Stats */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Multimodal Drag & Drop Area */}
        <div className="lg:col-span-2 surface-card rounded-3xl p-6 md:p-8 flex flex-col justify-between">
          <div className="space-y-1 pb-5">
            <h2 className="text-sm font-extrabold text-text-primary flex items-center gap-2 font-display">
              <UploadCloud className="h-5 w-5 text-accent-hover" />
              Upload Materials & Audio Recordings
            </h2>
            <p className="text-xs text-text-secondary">
              Drag PDF, DOCX, PPTX, TXT, image, audio, or video files directly into a notebook.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 pb-5">
            <div className="md:col-span-2">
              <label htmlFor="upload-nb-select" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
                Pin upload into active Notebook:
              </label>
              <select
                id="upload-nb-select"
                value={selectedNotebookId}
                onChange={(e) => setSelectedNotebookId(e.target.value)}
                disabled={notebooks.length === 0}
                className="w-full rounded-xl border border-border-default bg-bg-elevated/70 p-2.5 text-xs font-bold text-text-primary outline-none focus:border-accent cursor-pointer transition-colors"
              >
                {notebooks.length === 0 ? (
                  <option value="" className="bg-bg-overlay text-text-primary">
                    Create a notebook first
                  </option>
                ) : null}
                {notebooks.map(nb => (
                  <option key={nb.id} value={nb.id} className="bg-bg-overlay text-text-primary">
                    ({nb.courseLabel || nb.courseCode}) {nb.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="simulate-file-btn" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 font-mono">
                Virtual Device:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  id="simulate-file-btn"
                  onClick={triggerUploadClick}
                  disabled={uploadPhase !== 'idle' || notebooks.length === 0}
                  className="w-full rounded-xl bg-bg-elevated/60 hover:bg-bg-elevated border border-border-default p-2.5 text-xs font-bold text-text-primary transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5 text-accent-hover" />
                  Files
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddLinkModalOpen(true)}
                  disabled={uploadPhase !== 'idle' || notebooks.length === 0}
                  className="w-full rounded-xl bg-bg-elevated/60 hover:bg-bg-elevated border border-border-default p-2.5 text-xs font-bold text-text-primary transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <LinkIcon className="h-3.5 w-3.5 text-accent-hover" />
                  Link
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={NOTEBOOK_UPLOAD_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const files = event.target.files ? Array.from(event.target.files) : [];
                  if (files.length > 0) {
                    void executeUpload(files);
                  }
                }}
              />
            </div>
          </div>

          {/* Upload Drop Zone Box with Frosted Layout */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all ${
              dragActive 
                ? 'border-accent bg-accent-subtle' 
                : 'border-border-default bg-bg-base/40 hover:bg-bg-elevated/30'
            }`}
          >
            {shouldShowUploadQueue ? (
              <div className="w-full max-w-xl space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-bold text-text-primary">
                    {isUploadActive ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-accent-hover" />
                    ) : hasUploadFailure ? (
                      <span className="h-2.5 w-2.5 rounded-full bg-error" />
                    ) : (
                      <Check className="h-4 w-4 text-success" />
                    )}
                    <span>{uploadSummaryLabel}</span>
                  </span>
                  <span className="font-extrabold text-success font-mono">
                    {uploadProgressValue < 100 ? `${uploadProgressValue}%` : 'Ready'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 transition-all duration-150"
                    style={{ width: `${uploadProgressValue}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted justify-center">
                  <Sparkles className="h-3 w-3 text-cta" />
                  <span>{hasUploadFailure ? 'Resolve the failed file and retry the remaining upload.' : uploadStatus}</span>
                </div>
                <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                  {uploadQueue.map((item) => (
                    <div key={item.id} className="rounded-xl border border-border-subtle bg-bg-elevated/40 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-semibold text-text-primary">
                          {item.extension === 'pdf' ? (
                            <FileText className="h-3.5 w-3.5 shrink-0 text-error" />
                          ) : (
                            <BookMarked className="h-3.5 w-3.5 shrink-0 text-accent-hover" />
                          )}
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${
                          item.status === 'failed'
                            ? 'text-error'
                            : item.status === 'done'
                              ? 'text-success'
                              : item.status === 'queued'
                                ? 'text-text-muted'
                                : 'text-accent-hover'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-overlay">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${item.status === 'failed' ? 'bg-error' : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400'}`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : uploadProgress === -1 ? (
              <div className="text-center space-y-2.5">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated border border-border-default shadow-md">
                  <UploadCloud className="h-5 w-5 text-accent-hover" />
                </div>
                <div className="text-xs font-semibold text-text-primary">
                  {notebooks.length === 0 ? 'Create a notebook to unlock uploads' : 'Drag your lecture material here, or click to pick'}
                </div>
                <div className="text-[10px] text-text-muted">
                  {notebooks.length === 0
                    ? 'Your first upload target will appear after notebook setup.'
                    : 'Supports PDF, DOCX, PPTX, TXT, image, audio, and video. Select multiple files as long as the total stays under 100MB.'}
                </div>
              </div>
            ) : uploadPhase === 'success' ? (
              <div className="text-center space-y-2 flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-subtle text-success border border-success/20">
                  <Check className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-success">Processed &amp; Indexed!</span>
                <span className="text-[10px] text-text-muted">
                  {selectedFileCount > 1
                    ? `${selectedFileCount} files were processed successfully.`
                    : 'Concept linkages, descriptions and flashcards populated successfully.'}
                </span>
              </div>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-bold text-text-primary">
                    {uploadPhase === 'validating' ? (
                      <LoaderCircle className="h-4 w-4 animate-spin text-accent-hover" />
                    ) : (
                      <BookMarked className="h-4 w-4 text-accent-hover" />
                    )}
                    <span className="truncate max-w-[220px]">{selectedFileCount > 1 ? `${selectedFileCount} files` : selectedFileName}</span>
                  </span>
                  <span className="font-extrabold text-success font-mono">
                    {uploadProgressValue < 100 ? `${uploadProgressValue}%` : 'Ready'}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 transition-all duration-150"
                    style={{ width: `${uploadProgressValue}%` }}
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-text-muted justify-center">
                  <Sparkles className="h-3 w-3 text-cta" />
                  <span>{uploadStatus}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bento Stats Side Column - Glass Cards with Streak Details */}
        <div className="surface-card rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-5">
          <div className="space-y-1">
            <h3 className="text-xs font-black tracking-wider text-text-muted uppercase font-mono">Student Statistics</h3>
            <h2 className="text-sm font-extrabold text-text-primary font-display">Learning Productivity & Streaks</h2>
          </div>

          {/* Core Study Streak Counter Widget */}
          <div className="rounded-2xl bg-gradient-to-r from-cta/10 via-cta/5 to-error/10 border border-cta/20 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cta/20 border border-cta/30 text-cta font-extrabold font-mono text-xs">
                  <Flame className="h-3.5 w-3.5 fill-cta" />
                  {streak?.currentStreak ?? 0} Days
                </span>
                <span className="text-[10px] font-bold text-text-secondary uppercase font-mono tracking-wider">
                  {streak?.currentStreak ? 'Streak Active!' : 'No streak yet'}
                </span>
              </div>
              <span className="text-[10px] font-black tracking-wider text-cta uppercase font-mono">
                {streak?.malaysianTier || 'Faithful Student'}
              </span>
            </div>

            {/* 7-Day progress calendar status bubble */}
            <div className="flex justify-between gap-1.5 pb-1">
              {(streak?.weeklyProgress || [
                { day: 'Mon', active: false },
                { day: 'Tue', active: false },
                { day: 'Wed', active: false },
                { day: 'Thu', active: false },
                { day: 'Fri', active: false },
                { day: 'Sat', active: false },
                { day: 'Sun', active: false }
              ]).map((dayProgress, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[9px] text-text-muted font-bold font-mono uppercase">{dayProgress.day}</span>
                  <div 
                    className={`h-7 w-full rounded-lg flex items-center justify-center text-[9px] font-bold transition-all ${
                      dayProgress.active 
                        ? 'bg-cta/25 border border-cta/40 text-cta shadow-sm' 
                        : 'bg-bg-elevated border border-border-subtle text-text-muted'
                    }`} 
                    title={dayProgress.active ? 'Active' : 'Inactive'}
                  >
                    {dayProgress.active ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border-subtle pt-3 text-[10px] text-text-muted">
              <span>Personal Peak: <strong className="text-text-primary">{streak?.bestStreak ?? 0} Days</strong></span>
              <span>Last active: <strong className="text-cta font-mono">{streak?.lastActive || 'Not yet'}</strong></span>
            </div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-elevated/20 px-4 py-3 text-sm leading-relaxed text-text-secondary font-serif">
            <Lightbulb className="mr-1.5 inline h-4 w-4 text-cta shrink-0" />
            <span className="font-bold text-text-primary">Lumiere Study Tip:</span> Your conceptual check between <span className="font-semibold text-accent-hover">Discrete Math</span> and <span className="font-semibold text-accent-hover">Database Systems</span> displays active progress. Revise Set Theory quizzes tonight.
          </div>
        </div>
      </div>

      {/* Grid of Course Notebooks */}
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-border-default pb-3 font-display">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-text-primary">Personal Course Notebooks</h2>
            <p className="text-xs text-text-secondary">Each notebook links lecture videos, transcript files, images, and generated descriptions.</p>
          </div>
          <button 
            id="add-notebook"
            onClick={onCreateNotebookRequested}
            className="rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white hover:bg-accent-hover transition-all flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 border border-accent-border shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            New Notebook
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-border-default bg-bg-elevated/20 px-6 py-14 text-center">
              <BookMarked className="mx-auto h-10 w-10 text-text-muted" />
              <h3 className="mt-4 text-lg font-black text-text-primary font-display">Your notebook shelf is empty</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-text-secondary font-serif">
                Create your first notebook to organize one course at a time, then upload lecture files so this section starts filling with study material.
              </p>
              <button
                onClick={onCreateNotebookRequested}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-hover shadow-lg shadow-indigo-500/20"
              >
                <Plus className="h-4 w-4" />
                Create First Notebook
              </button>
            </div>
          ) : notebooks.map((nb) => {
            const colorTone = getNotebookColorTone(nb.color);

            return (
              <div
                key={nb.id}
                onClick={() => onOpenNotebook(nb.id)}
                className={`relative overflow-hidden rounded-2xl border border-border-default bg-bg-elevated/40 backdrop-blur-xl p-5 cursor-pointer shadow-sm transition-all duration-200 hover:bg-bg-elevated/60 hover:-translate-y-0.5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${colorTone.borderGlow} ${colorTone.strip}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border font-mono ${colorTone.badge}`}>
                    {nb.courseLabel || nb.courseCode}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <span className="font-extrabold text-text-primary font-mono">{nb.fileCount}</span> files
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditNotebook?.(nb);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-bg-elevated/60 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                        title={`Edit ${nb.name}`}
                        aria-label={`Edit ${nb.name}`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (window.confirm(`Delete "${nb.name}" and all its files?`)) {
                            void onDeleteNotebook?.(nb.id);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-error/20 bg-error-subtle text-error transition hover:bg-error/20"
                        title={`Delete ${nb.name}`}
                        aria-label={`Delete ${nb.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-text-primary mt-3 truncate font-display">{nb.name}</h3>
                <p className="text-xs text-text-secondary mt-1.5 line-clamp-2 leading-relaxed font-serif">
                  {nb.description || "No description set yet. Click to view files."}
                </p>

                <div className="flex items-center justify-between mt-5 border-t border-border-subtle pt-3">
                  <div className={`flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-full border font-mono ${colorTone.subtleBlock}`}>
                    <Sparkles className="h-3 w-3" />
                    <span>{nb.conceptCount} Semantic Concepts</span>
                  </div>
                  <div className="flex items-center text-xs font-bold text-text-secondary hover:text-accent-hover gap-0.5 transition-colors">
                    <span>Enter</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isAddLinkModalOpen ? (
        <AddLinkModal
          disabled={!selectedNotebookId}
          notebookName={selectedNotebook?.name}
          onClose={() => setIsAddLinkModalOpen(false)}
          onSubmit={executeAddLink}
        />
      ) : null}
    </div>
  );
}
