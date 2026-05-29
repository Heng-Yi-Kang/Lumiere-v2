import React, { useState } from 'react';
import { Notebook, FileItem, University } from '../types';
import { 
  Plus, 
  FolderLock, 
  UploadCloud, 
  BookMarked, 
  Network, 
  Clock, 
  Sparkles, 
  ArrowRight,
  FileText,
  Video,
  Music,
  Check,
  AlertCircle
} from 'lucide-react';

import { StudyStreak } from '../types';

interface DashboardViewProps {
  notebooks: Notebook[];
  university: University;
  onOpenNotebook: (notebookId: string) => void;
  onAddNewFile: (notebookId: string, newFile: FileItem) => void;
  onCreateNotebookRequested?: () => void;
  streak?: StudyStreak;
}

export default function DashboardView({ 
  notebooks, 
  university, 
  onOpenNotebook, 
  onAddNewFile,
  onCreateNotebookRequested,
  streak
}: DashboardViewProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedNotebookId, setSelectedNotebookId] = useState(notebooks[0]?.id || '');
  const [uploadProgress, setUploadProgress] = useState(-1); // -1: idle, 0-100: working, 101: done
  const [virtualFileName, setVirtualFileName] = useState('');
  const [virtualFileType, setVirtualFileType] = useState<'pdf' | 'audio' | 'video'>('pdf');

  // Trigger simulated file processing sequences
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const executeSimulatedUpload = (name: string, type: 'pdf' | 'audio' | 'video') => {
    setVirtualFileName(name || `LMS_Slide_Semester2_${type === 'pdf' ? 'Week10.pdf' : 'Recording.mp3'}`);
    setVirtualFileType(type);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          
          // Complete upload and trigger parent file adding logic!
          const generatedFile: FileItem = {
            id: `f-virtual-${Date.now()}`,
            name: name || `Syllabus_Slide_${type === 'pdf' ? 'Week10.pdf' : 'Lecture_Audio.mp3'}`,
            type: type === 'audio' ? 'audio' : type === 'video' ? 'video' : 'pdf',
            size: type === 'pdf' ? '3.5 MB' : '32 MB',
            uploadDate: '28 May 2026',
            status: 'ready',
            summary: 'Lumiere has extracted topics, generated semantic concept maps, and pre-composed quizzes for this file. You can ask grounded questions about it inside AI Study Chat.',
            totalPages: type === 'pdf' ? 14 : undefined,
            transcript: type === 'audio' ? [
              { id: 'vts-1', startTime: 0, endTime: 10, speaker: 'Lecturer', text: 'Today we will start the discussion on a new module' }
            ] : undefined
          };

          onAddNewFile(selectedNotebookId, generatedFile);

          setTimeout(() => {
            setUploadProgress(-1);
          }, 1500);

          return 101; 
        }
        return prev + 10;
      });
    }, 150);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const name = file.name;
      const extension = name.split('.').pop()?.toLowerCase();
      let detectedType: 'pdf' | 'audio' | 'video' = 'pdf';
      if (extension === 'mp3' || extension === 'wav' || extension === 'm4a') {
        detectedType = 'audio';
      } else if (extension === 'mp4' || extension === 'mov' || extension === 'mkv') {
        detectedType = 'video';
      }
      executeSimulatedUpload(name, detectedType);
    }
  };

  const triggerUploadClick = () => {
    const fileOptions = [
      { name: 'WIX1001_Calculus_Notes_Revision.pdf', type: 'pdf' },
      { name: 'Dr_Hafizah_AI_Lab_Explanation_2.mp3', type: 'audio' },
      { name: 'Taylor_Retail_Customs_SST_Guideline.pdf', type: 'pdf' },
      { name: 'Full_Lecture_Software_Engineering_Rec.mp3', type: 'audio' }
    ];
    // Pick based on university or random
    const rand = fileOptions[Math.floor(Math.random() * fileOptions.length)];
    executeSimulatedUpload(rand.name, rand.type as any);
  };

  return (
    <div className="space-y-6 text-left">
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
              Welcome, Yi Kang! 👋
            </h1>
            <p className="max-w-xl text-xs font-medium text-slate-400 leading-relaxed">
              Your materials are linked. You have <span className="text-indigo-300 font-extrabold">{notebooks.length} notebooks</span> active for <span className="underline decoration-indigo-400 font-extrabold text-slate-200">{university.nativeName}</span> course modules. Ready to score that 4.00 flat?
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
              Drag PDFs, PowerPoint slides, lecture video, or WhatsApp/Telegram screenshots.
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
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 p-2 text-xs font-bold text-slate-200 outline-none focus:border-indigo-400 focus:bg-slate-900/80 cursor-pointer"
              >
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
                disabled={uploadProgress >= 0}
                className="w-full rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 p-2 text-xs font-extrabold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5 text-indigo-400" />
                Select File
              </button>
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
                  Drag your LMS slide or recording here, or click to pick
                </div>
                <div className="text-[10px] text-slate-400">
                  Supports PDF, MP3, WAV, Slide Decks, and OCR Images up to 200MB
                </div>
              </div>
            ) : uploadProgress <= 100 ? (
              <div className="w-full max-w-sm space-y-3 col-span-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-black text-slate-200">
                    {virtualFileType === 'pdf' ? (
                      <FileText className="h-4 w-4 text-rose-400 animate-bounce" />
                    ) : (
                      <Music className="h-4 w-4 text-blue-400 animate-bounce" />
                    )}
                    <span className="truncate max-w-[200px]">{virtualFileName}</span>
                  </span>
                  <span className="font-extrabold text-[#34d399] text-glow-emerald">
                    {uploadProgress < 100 ? `${uploadProgress}%` : 'Reading...'}
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
                  <span>
                    {uploadProgress < 30 ? 'Uploading chunk files...' :
                     uploadProgress < 65 ? 'Running OCR & Segment Tree Extraction...' :
                     'Formulating local flashcard & quizzes...'}
                  </span>
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
                <span className="p-1 px-2 rounded-lg bg-orange-500/25 border border-orange-400/30 text-orange-400 font-extrabold animate-bounce font-mono text-xs">
                  🔥 {streak?.currentStreak || 12} Days
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
                    {dayProgress.active ? '✓' : '•'}
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
            💡 <span className="font-extrabold text-slate-200">Lumiere Study Tip:</span> Your conceptual check between <span className="font-semibold text-indigo-300">Discrete Math</span> and <span className="font-semibold text-[#818cf8]">Database Systems</span> displays active progress. Revise Set Theory quizzes tonight!
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
          {notebooks.map((nb) => {
            const glowColors: Record<string, string> = {
              blue: 'hover:border-blue-500/40 hover:shadow-blue-500/5 before:bg-blue-500',
              indigo: 'hover:border-indigo-500/40 hover:shadow-indigo-500/5 before:bg-indigo-500',
              amber: 'hover:border-amber-500/40 hover:shadow-amber-500/5 before:bg-amber-500',
              cyan: 'hover:border-cyan-500/40 hover:shadow-cyan-500/5 before:bg-cyan-500',
              rose: 'hover:border-rose-500/40 hover:shadow-rose-500/5 before:bg-rose-500',
              red: 'hover:border-red-500/40 hover:shadow-red-500/5 before:bg-red-500',
              violet: 'hover:border-violet-500/40 hover:shadow-violet-500/5 before:bg-violet-500',
            };
            const currentGlow = glowColors[nb.color] || 'hover:border-emerald-500/40 hover:shadow-emerald-500/5 before:bg-emerald-500';

            return (
              <div
                key={nb.id}
                onClick={() => onOpenNotebook(nb.id)}
                className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 cursor-pointer shadow-md transition-all duration-300 hover:bg-white/[0.06] hover:-translate-y-0.5 before:absolute before:left-0 before:top-0 before:h-full before:w-1 ${currentGlow}`}
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-white/5 px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider border border-white/5 font-mono">
                    {nb.courseCode}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="font-extrabold text-slate-200 font-mono">{nb.fileCount}</span> files
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-100 mt-3 truncate font-display">{nb.name}</h3>
                <p className="text-xs text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {nb.description || "No description set yet. Click to view files."}
                </p>

                <div className="flex items-center justify-between mt-4 border-t border-white/5 pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-indigo-300 font-extrabold bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/10 font-mono">
                    <Sparkles className="h-3 w-3 text-indigo-400" />
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
