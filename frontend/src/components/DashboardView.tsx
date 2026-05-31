import React, { useEffect, useRef, useState } from 'react';
import { Notebook } from '../types';
import { 
  ArrowUpRight,
  Plus, 
  FolderLock, 
  UploadCloud, 
  BookMarked, 
  Clock, 
  Sparkles, 
  ArrowRight,
  FileText,
  Check,
  Edit3,
  Trash2,
  Flame,
  Lightbulb
} from 'lucide-react';

import { StudyStreak } from '../types';
import { isSupportedNotebookExtension, validateNotebookUpload } from '../lib/notebookUpload';
import type { SupportedNotebookExtension } from '../lib/notebookUpload';
import { getNotebookColorTone } from '../lib/notebookColors';

interface DashboardViewProps {
  notebooks: Notebook[];
  onOpenNotebook: (notebookId: string) => void;
  onUploadFile: (notebookId: string, file: File) => Promise<void> | void;
  onEditNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onCreateNotebookRequested?: () => void;
  streak?: StudyStreak;
  notebookError?: string;
}

export default function DashboardView({ 
  notebooks, 
  onOpenNotebook, 
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
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const executeUpload = async (file: File) => {
    if (!selectedNotebookId) {
      return;
    }

    const extension = file.name.split('.').pop()?.toLowerCase();
    const validationError = validateNotebookUpload(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    if (!extension || !isSupportedNotebookExtension(extension)) {
      setUploadError('Only PDF, DOCX, PPTX, TXT, and common audio files are supported.');
      return;
    }

    setUploadError('');
    setSelectedFileName(file.name);
    setSelectedFileType(extension);
    setUploadPhase('validating');

    try {
      await Promise.resolve();
      setUploadPhase('uploading');
      await Promise.resolve();
      setUploadPhase('extracting');
      await Promise.resolve(onUploadFile(selectedNotebookId, file));
      setUploadPhase('success');
    } catch (error) {
      setUploadPhase('idle');
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void executeUpload(e.dataTransfer.files[0]);
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
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

  const uploadStatus = uploadPhase === 'validating'
    ? 'Validating file before upload...'
    : uploadPhase === 'uploading'
      ? 'Uploading file to notebook storage...'
      : uploadPhase === 'extracting'
        ? 'Extracting preview and refreshing notebook...'
        : uploadPhase === 'success'
          ? 'Upload completed successfully.'
          : '';

  return (
      <div className="space-y-6 text-left">
      {notebookError && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-200">
          Notebook API error: {notebookError}
        </div>
      )}
      {uploadError && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs font-semibold text-amber-100">
          {uploadError}
        </div>
      )}

      {/* Welcome Greetings Bar - Premium Frosted Design */}
      <div className="rounded-3xl bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-15 blur-2xl pointer-events-none">
          <div className="h-64 w-64 rounded-full bg-indigo-500"></div>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-300">
                Lumiere Workspace
              </span>
              <span className="text-xs text-slate-300 font-bold">Sem 2 Semester Student Portal</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight font-display bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
              Welcome, Yi Kang
            </h1>
            <p className="max-w-xl text-xs font-medium text-slate-400 leading-relaxed">
              {notebooks.length === 0 ? (
                <>Start by creating your first notebook, then upload lecture materials so Lumiere can build summaries and study aids.</>
              ) : (
                <>Your materials are linked. You have <span className="text-indigo-300 font-extrabold">{notebooks.length} notebooks</span> ready across your active course library. Ready to score that 4.00 flat?</>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl bg-white/5 border border-white/5 p-3 flex flex-col leading-none shadow-xs">
              <span className="text-[9px] text-slate-400 font-extrabold tracking-wide uppercase font-mono">MATERIALS</span>
              <span className="text-lg font-black text-white mt-1">14 Files</span>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/5 p-3 flex flex-col leading-none shadow-xs">
              <span className="text-[9px] text-slate-400 font-extrabold tracking-wide uppercase font-mono">CONCEPT SPLITS</span>
              <span className="text-lg font-black text-emerald-400 mt-1 text-glow-emerald">26 Linked</span>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/5 p-3 flex flex-col leading-none shadow-xs">
              <span className="text-[9px] text-slate-400 font-extrabold tracking-wide uppercase font-mono">STUDIED TODAY</span>
              <span className="text-lg font-black text-indigo-300 mt-1 text-glow-indigo">45 mins</span>
            </div>
          </div>
        </div>
      </div>

      {notebooks.length === 0 && (
        <div className="rounded-3xl border border-dashed border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 via-slate-950/50 to-emerald-500/10 p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <span className="inline-flex rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                Get Started
              </span>
              <h2 className="text-2xl font-black text-white font-display">No notebooks yet</h2>
              <p className="text-sm leading-relaxed text-slate-300">
                Create a course notebook first. After that, you can drop in PDFs, slides, notes, and transcripts so Lumiere can organize previews, concepts, and grounded AI help.
              </p>
            </div>

            <button
              onClick={onCreateNotebookRequested}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-indigo-400/20 bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" />
              Create First Notebook
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-indigo-300">1. Create</div>
              <p className="mt-2 text-sm font-semibold text-white">Add a notebook for one subject or course.</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Name it clearly and pick the matching course code so you can find it fast later.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-300">2. Upload</div>
              <p className="mt-2 text-sm font-semibold text-white">Drop in lecture files and notes.</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">Use PDF, DOCX, PPTX, TXT, or audio files. Upload becomes available as soon as your first notebook exists.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300">3. Review</div>
              <p className="mt-2 text-sm font-semibold text-white">Open the notebook and study from there.</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">You’ll get inline previews, extracted summaries, and notebook-grounded AI prompts once materials are indexed.</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs leading-relaxed text-slate-300">
            Upload controls are disabled until at least one notebook exists.
            <button
              onClick={onCreateNotebookRequested}
              className="ml-2 inline-flex items-center gap-1 font-bold text-indigo-300 transition hover:text-indigo-200"
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
        <div className="lg:col-span-2 rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between">
          <div className="space-y-1 pb-4">
            <h2 className="text-sm font-extrabold text-slate-100 flex items-center gap-1.5 font-display">
              <UploadCloud className="h-4.5 w-4.5 text-indigo-400" />
              Upload Materials & Audio Recordings
            </h2>
            <p className="text-xs text-slate-400">
              Drag PDF, DOCX, PPTX, TXT, or audio files directly into a notebook.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3 pb-4">
            <div className="md:col-span-2">
              <label htmlFor="upload-nb-select" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Pin upload into active Notebook:
              </label>
              <select
                id="upload-nb-select"
                value={selectedNotebookId}
                onChange={(e) => setSelectedNotebookId(e.target.value)}
                disabled={notebooks.length === 0}
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 p-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-400 focus:bg-slate-900/80 cursor-pointer"
              >
                {notebooks.length === 0 ? (
                  <option value="" className="bg-[#0f172a] text-slate-100">
                    Create a notebook first
                  </option>
                ) : null}
                {notebooks.map(nb => (
                  <option key={nb.id} value={nb.id} className="bg-[#0f172a] text-slate-100">
                    ({nb.courseCode}) {nb.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="simulate-file-btn" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 font-mono">
                Virtual Device:
              </label>
              <button
                id="simulate-file-btn"
                onClick={triggerUploadClick}
                disabled={uploadPhase !== 'idle' || notebooks.length === 0}
                className="w-full rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 p-2 text-xs font-extrabold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-400" />
                Select File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.pptx,.txt,.mp3,.wav,.m4a,.ogg,.flac,.aac"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void executeUpload(file);
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
                ? 'border-indigo-500 bg-indigo-500/10' 
                : 'border-white/10 bg-white/[0.01] hover:bg-white/[0.03]'
            }`}
          >
            {uploadProgress === -1 ? (
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-md">
                  <UploadCloud className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  {notebooks.length === 0 ? 'Create a notebook to unlock uploads' : 'Drag your lecture material here, or click to pick'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {notebooks.length === 0 ? 'Your first upload target will appear after notebook setup.' : 'Supports PDF, DOCX, PPTX, TXT, and audio up to 100MB'}
                </div>
              </div>
            ) : uploadProgress <= 100 ? (
              <div className="w-full max-w-sm space-y-3 col-span-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-black text-slate-200">
                    {selectedFileType === 'pdf' ? (
                      <FileText className="h-4 w-4 text-rose-400 animate-bounce" />
                    ) : (
                      <BookMarked className="h-4 w-4 text-blue-400 animate-bounce" />
                    )}
                    <span className="truncate max-w-[200px]">{selectedFileName}</span>
                  </span>
                  <span className="font-extrabold text-[#34d399] text-glow-emerald">
                    {uploadProgress < 100 ? `${uploadProgress}%` : 'Ready'}
                  </span>
                </div>
                
                {/* Progress Bar Container */}
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-[#34d399] transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 justify-center">
                  <Sparkles className="h-3 w-3 text-amber-400 animate-pulse" />
                  <span>{uploadStatus}</span>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-2 flex flex-col items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 animate-pulse border border-emerald-500/30">
                  <Check className="h-5 w-5" />
                </div>
                <span className="text-xs font-black text-emerald-400 text-glow-emerald">Processed & Indexed!</span>
                <span className="text-[10px] text-slate-400">Concept linkages, summaries and flashcards populated successfully.</span>
              </div>
            )}
          </div>
        </div>

        {/* Bento Stats Side Column - Glass Cards with Streak Details */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase font-mono">Student Statistics</h3>
            <h2 className="text-sm font-extrabold text-slate-200 font-display">Learning Productivity & Streaks</h2>
          </div>

          {/* Core Study Streak Counter Widget */}
          <div className="rounded-2xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-rose-500/10 border border-orange-500/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 p-1 px-2 rounded-lg bg-orange-500/25 border border-orange-400/30 text-orange-400 font-extrabold animate-bounce font-mono text-xs">
                  <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
                  {streak?.currentStreak || 12} Days
                </span>
                <span className="text-[9px] font-bold text-slate-200 uppercase font-mono tracking-wider">
                  Streak Active!
                </span>
              </div>
              <span className="text-[9px] font-black tracking-wider text-amber-500 uppercase font-mono">
                {streak?.malaysianTier || "Dean's Runner"}
              </span>
            </div>

            {/* 7-Day progress calendar status bubble */}
            <div className="flex justify-between gap-1 pb-1">
              {(streak?.weeklyProgress || [
                { day: 'Mon', active: true, minutes: 45 },
                { day: 'Tue', active: true, minutes: 30 },
                { day: 'Wed', active: true, minutes: 60 },
                { day: 'Thu', active: true, minutes: 0 },
                { day: 'Fri', active: true, minutes: 50 },
                { day: 'Sat', active: true, minutes: 20 },
                { day: 'Sun', active: true, minutes: 15 }
              ]).map((dayProgress, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[8px] text-slate-500 font-bold font-mono uppercase">{dayProgress.day}</span>
                  <div 
                    className={`h-6 w-full rounded-md flex items-center justify-center text-[9px] font-black transition-all ${
                      dayProgress.active 
                        ? 'bg-orange-600/35 border border-orange-500/50 text-orange-200 scale-105 shadow-xs shadow-orange-500/10' 
                        : 'bg-white/5 border border-white/5 text-slate-600'
                    }`} 
                    title={dayProgress.active ? `${dayProgress.minutes} mins study duration` : 'Inactive'}
                  >
                    {dayProgress.active ? <Check className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[8px] text-slate-400">
              <span>Personal Peak: <strong className="text-slate-200">{streak?.bestStreak || 24} Days</strong></span>
              <span>Last active: <strong className="text-orange-400 font-mono">Today</strong></span>
            </div>
          </div>

          {/* Mini secondary stats metrics row */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-2.5 text-left">
              <Clock className="h-4 w-4 text-emerald-400 mb-0.5" />
              <div className="text-[9px] text-slate-400 font-semibold uppercase leading-none">Focus duration</div>
              <div className="text-sm font-black text-white mt-1">470 min</div>
            </div>

            <div className="rounded-xl bg-white/[0.02] border border-white/5 p-2.5 text-left">
              <FolderLock className="h-4 w-4 text-fuchsia-400 mb-0.5" />
              <div className="text-[9px] text-slate-400 font-semibold uppercase leading-none">CGPA target</div>
              <div className="text-sm font-black text-white mt-1">3.91 A-</div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.01] px-3 py-2 text-[10px] leading-relaxed text-slate-400">
            <Lightbulb className="mr-1 inline h-3.5 w-3.5 text-amber-500" />
            <span className="font-extrabold text-slate-200">Lumiere Study Tip:</span> Your conceptual check between <span className="font-semibold text-indigo-300">Discrete Math</span> and <span className="font-semibold text-[#818cf8]">Database Systems</span> displays active progress. Revise Set Theory quizzes tonight.
          </div>
        </div>
      </div>

      {/* Grid of Course Notebooks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-2 font-display">
          <div className="space-y-1">
            <h2 className="text-base font-black text-slate-100">Personal Course Notebooks</h2>
            <p className="text-xs text-slate-400">Each notebook links lecture videos, transcript files, and OCR-extracted summaries.</p>
          </div>
          <button 
            id="add-notebook"
            onClick={onCreateNotebookRequested}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all flex items-center gap-1 cursor-pointer shadow-lg shadow-indigo-600/25 border border-indigo-400/20"
          >
            <Plus className="h-3.5 w-3.5" />
            New Notebook
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.length === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
              <BookMarked className="mx-auto h-10 w-10 text-slate-500" />
              <h3 className="mt-4 text-lg font-black text-white font-display">Your notebook shelf is empty</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
                Create your first notebook to organize one course at a time, then upload lecture files so this section starts filling with study material.
              </p>
              <button
                onClick={onCreateNotebookRequested}
                className="mt-5 inline-flex items-center gap-2 rounded-xl border border-indigo-400/20 bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-indigo-500"
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
                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 cursor-pointer shadow-md transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-0.5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${colorTone.borderGlow} ${colorTone.strip}`}
              >
                <div className="flex items-start justify-between">
                  <div className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider border font-mono ${colorTone.badge}`}>
                    {nb.courseCode}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span className="font-extrabold text-slate-200 font-mono">{nb.fileCount}</span> files
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditNotebook?.(nb);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
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
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-200 transition hover:bg-rose-500/20"
                        title={`Delete ${nb.name}`}
                        aria-label={`Delete ${nb.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-100 mt-3 truncate font-display">{nb.name}</h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {nb.description || "No description set yet. Click to view files."}
                </p>

                <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3">
                  <div className={`flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border font-mono ${colorTone.subtleBlock}`}>
                    <Sparkles className="h-3 w-3" />
                    <span>{nb.conceptCount} Semantic Concepts</span>
                  </div>
                  <div className="flex items-center text-xs font-extrabold text-slate-200 hover:text-indigo-400 gap-0.5 transition-colors">
                    <span>Enter</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
