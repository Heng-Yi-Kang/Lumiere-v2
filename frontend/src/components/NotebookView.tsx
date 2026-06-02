import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  ChevronDown,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FolderOpen,
  Image,
  Link as LinkIcon,
  ListChecks,
  LoaderCircle,
  MessageSquare,
  MonitorPlay,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { ChatMessage, FileItem, Notebook, NotebookFilePreview } from '../types';
import { askGroundedNotebookChat, buildNotebookApiUrl, fetchNotebookFilePreview } from '../lib/notebooksApi';
import { getGroundedChatErrorMessage } from '../lib/apiErrors';
import { NOTEBOOK_UPLOAD_ACCEPT, validateNotebookUpload } from '../lib/notebookUpload';
import { getNotebookColorTone } from '../lib/notebookColors';
import { ChatMarkdown } from './ChatMarkdown';
import { useFileNotes } from '../hooks/useFileNotes';
import FileNotesPanel from './FileNotesPanel';
import NotebookChatPanel from './NotebookChatPanel';
import AddLinkModal from './AddLinkModal';

interface NotebookViewProps {
  notebook: Notebook | null;
  allNotebooks: Notebook[];
  onSelectNotebook: (id: string | null) => void;
  onBackToDashboard: () => void;
  onAddLink?: (notebookId: string, url: string) => Promise<void> | void;
  onUploadFile?: (notebookId: string, file: File) => Promise<void> | void;
  onDeleteFile?: (notebookId: string, fileId: string) => Promise<void> | void;
  onEditNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onCreateNotebookRequested?: () => void;
}

function getFileIcon(type: FileItem['type']) {
  switch (type) {
    case 'pdf':
      return <FileText className="h-5 w-5 text-error" />;
    case 'docx':
      return <BookOpen className="h-5 w-5 text-accent-hover" />;
    case 'pptx':
      return <MonitorPlay className="h-5 w-5 text-cta" />;
    case 'txt':
      return <FileText className="h-5 w-5 text-success" />;
    case 'audio':
      return <Volume2 className="h-5 w-5 text-accent-hover" />;
    case 'video':
      return <MonitorPlay className="h-5 w-5 text-cta" />;
    case 'image':
      return <Image className="h-5 w-5 text-success" />;
    case 'link':
      return <LinkIcon className="h-5 w-5 text-accent-hover" />;
    default:
      return <FileText className="h-5 w-5 text-text-muted" />;
  }
}

function getViewerUrl(sourceUrl?: string) {
  if (!sourceUrl) {
    return undefined;
  }

  return buildNotebookApiUrl(sourceUrl);
}

function createFileChatInitialMessage(fileName: string): ChatMessage {
  return {
    id: `file-chat-init-${fileName}`,
    role: 'assistant',
    text: `Ask questions about "${fileName}". Answers are limited to the indexed material from this file and will show grounded references when context is found.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    grounded: true,
    suggestedPrompts: [
      'Summarize the key ideas in this material',
      'What should I focus on for exams?',
      'Make five revision questions from this file',
    ],
  };
}

export default function NotebookView({
  notebook,
  allNotebooks,
  onSelectNotebook,
  onBackToDashboard,
  onAddLink,
  onUploadFile,
  onDeleteFile,
  onEditNotebook,
  onDeleteNotebook,
  onCreateNotebookRequested,
}: NotebookViewProps) {
  type UploadPhase = 'idle' | 'validating' | 'uploading' | 'extracting' | 'success';
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
  const [fileChatMessagesById, setFileChatMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [fileChatInput, setFileChatInput] = useState('');
  const [isFileChatTyping, setIsFileChatTyping] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [fileDetailTab, setFileDetailTab] = useState<'chat' | 'notes'>('chat');
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileChatScrollRef = useRef<HTMLDivElement | null>(null);

  const fileNoteApi = useFileNotes(notebook?.id, selectedMaterial?.id);

  useEffect(() => {
    setSelectedMaterial(null);
    setPreviewError('');
    setUploadError('');
    setFileChatInput('');
  }, [notebook?.id]);

  useEffect(() => {
    setFileDetailTab('chat');
  }, [selectedMaterial?.id]);

  useEffect(() => {
    if (!selectedMaterial) {
      setFileChatInput('');
      return;
    }

    setFileChatMessagesById((current) => {
      if (current[selectedMaterial.id]) {
        return current;
      }

      return {
        ...current,
        [selectedMaterial.id]: [createFileChatInitialMessage(selectedMaterial.name)],
      };
    });
    setFileChatInput('');
  }, [selectedMaterial]);

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

    return notebook.files;
  }, [notebook]);

  const activePreview = selectedMaterial ? previewCache[selectedMaterial.id] : undefined;
  const activeFileChatMessages = selectedMaterial ? fileChatMessagesById[selectedMaterial.id] || [] : [];
  const colorTone = notebook ? getNotebookColorTone(notebook.color) : null;
  const viewerUrl = getViewerUrl(activePreview?.sourceUrl);
  const selectedViewerUrl = getViewerUrl(activePreview?.sourceUrl);
  const isAudioPreview = selectedMaterial?.type === 'audio';
  const isVideoPreview = selectedMaterial?.type === 'video';
  const isImagePreview = selectedMaterial?.type === 'image';
  const isLinkPreview = selectedMaterial?.type === 'link';
  const summaryStatus = activePreview?.summaryStatus || selectedMaterial?.summaryStatus || 'idle';
  const summaryError = activePreview?.summaryError || selectedMaterial?.summaryError;
  const summaryText = activePreview?.summary || selectedMaterial?.summary;
  const summaryDisplayText = summaryStatus === 'in-progress'
    ? 'Generating description...'
    : summaryStatus === 'error'
      ? summaryError || 'Description generation failed.'
      : summaryText || 'No generated description is available for this file.';
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

  useEffect(() => {
    if (!fileChatScrollRef.current) {
      return;
    }

    fileChatScrollRef.current.scrollTop = fileChatScrollRef.current.scrollHeight;
  }, [activeFileChatMessages, isFileChatTyping]);

  useEffect(() => {
    if (!notebook || !selectedMaterial) {
      return;
    }

    const refreshedFile = notebook.files.find((file) => file.id === selectedMaterial.id);
    if (refreshedFile && refreshedFile !== selectedMaterial) {
      setSelectedMaterial(refreshedFile);
    }
  }, [notebook, selectedMaterial]);

  const updateFileChatMessages = (fileId: string, update: (messages: ChatMessage[]) => ChatMessage[]) => {
    setFileChatMessagesById((current) => {
      const existingMessages = current[fileId] || [];
      return {
        ...current,
        [fileId]: update(existingMessages),
      };
    });
  };

  const handleFileChatSubmit = async (question: string) => {
    if (!notebook || !selectedMaterial || !question.trim() || isFileChatTyping) {
      return;
    }

    const file = selectedMaterial;
    const submittedQuestion = question.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: ChatMessage = {
      id: `file-chat-user-${Date.now()}`,
      role: 'user',
      text: submittedQuestion,
      timestamp,
    };

    updateFileChatMessages(file.id, (messages) => [...messages, userMessage]);
    setFileChatInput('');
    setIsFileChatTyping(true);

    try {
      const response = await askGroundedNotebookChat({
        fileId: file.id,
        notebookId: notebook.id,
        question: submittedQuestion,
      });

      const assistantMessage: ChatMessage = {
        id: `file-chat-assistant-${Date.now()}`,
        role: 'assistant',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: response.citations,
        grounded: response.grounded,
      };

      updateFileChatMessages(file.id, (messages) => [...messages, assistantMessage]);
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: `file-chat-error-${Date.now()}`,
        role: 'assistant',
        text: getGroundedChatErrorMessage(error),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: [],
      };

      updateFileChatMessages(file.id, (messages) => [...messages, assistantMessage]);
    } finally {
      setIsFileChatTyping(false);
    }
  };

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

  const handleAddLink = async (url: string) => {
    if (!notebook || !onAddLink) {
      return;
    }

    setUploadError('');
    await Promise.resolve(onAddLink(notebook.id, url));
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
    const hasNotebooks = allNotebooks.length > 0;

    return (
      <div className="space-y-8 text-left relative z-10" id="all-notebooks-tab">
        <div className="surface-card rounded-3xl p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <span className="rounded-full border border-accent-border bg-accent-subtle px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-accent-hover">
                Notebook Workspace
              </span>
              <h2 className="text-2xl font-black text-text-primary font-display">My Academic Course Notebooks</h2>
              <p className="max-w-2xl text-sm leading-relaxed text-text-secondary font-serif">
                {hasNotebooks
                  ? 'Upload lecture materials and open previews inline without leaving the notebook.'
                  : 'Set up your first notebook to start collecting course files, previews, and study context.'}
              </p>
            </div>
            <button
              onClick={onCreateNotebookRequested}
              className="rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white transition hover:bg-accent-hover shadow-lg shadow-indigo-500/20 shrink-0"
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                New Notebook
              </span>
            </button>
          </div>
        </div>

        {!hasNotebooks ? (
          <div className="surface-elevated rounded-3xl p-6 md:p-8">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-elevated/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-text-primary">
                  <ListChecks className="h-3.5 w-3.5 text-accent-hover" />
                  First-Time Setup
                </div>
                <h3 className="text-2xl font-black text-text-primary font-display">No notebooks available yet</h3>
                <p className="max-w-2xl text-base leading-relaxed text-text-secondary font-serif">
                  Lumiere organizes each course inside its own notebook. Create one first, then upload lecture slides, readings, or plain text notes to unlock previews and grounded AI study help.
                </p>
                <button
                  onClick={onCreateNotebookRequested}
                  className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-black text-white transition hover:bg-accent-hover shadow-lg shadow-indigo-500/20"
                >
                  <Plus className="h-4 w-4" />
                  Create First Notebook
                </button>
              </div>

              <div className="rounded-3xl border border-border-default bg-bg-elevated/40 p-6">
                <h4 className="text-sm font-black text-text-primary font-display">Get started in 3 steps</h4>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="rounded-2xl border border-border-default bg-bg-elevated/30 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-accent-hover font-mono">1. Create a course notebook</div>
                    <div className="mt-1 text-sm leading-relaxed text-text-secondary font-serif">Use a subject name and course code so your materials stay grouped cleanly.</div>
                  </div>
                  <div className="rounded-2xl border border-border-default bg-bg-elevated/30 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-success font-mono">2. Upload your first files</div>
                    <div className="mt-1 text-sm leading-relaxed text-text-secondary font-serif">Add PDFs, DOCX, PPTX, TXT notes, images, or lecture audio from classes and revision packs.</div>
                  </div>
                  <div className="rounded-2xl border border-border-default bg-bg-elevated/30 p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.14em] text-cta font-mono">3. Study from one place</div>
                    <div className="mt-1 text-sm leading-relaxed text-text-secondary font-serif">Open the notebook to preview files, review descriptions, and ask notebook-grounded questions.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {allNotebooks.map((entry) => {
            const entryTone = getNotebookColorTone(entry.color);

            return (
            <button
              key={entry.id}
              onClick={() => onSelectNotebook(entry.id)}
              className={`rounded-2xl border border-border-default bg-bg-elevated/40 p-5 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-bg-elevated/60 ${entryTone.borderGlow}`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border font-mono ${entryTone.badge}`}>
                  {entry.courseLabel || entry.courseCode}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-text-muted">{entry.fileCount} files</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditNotebook?.(entry);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-bg-elevated/60 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
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
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-error/20 bg-error-subtle text-error transition hover:bg-error/20"
                      title={`Delete ${entry.name}`}
                      aria-label={`Delete ${entry.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <h3 className="mt-4 text-base font-black text-text-primary font-display">{entry.name}</h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary font-serif">
                {entry.description || 'No description set yet.'}
              </p>
            </button>
            );
          })}
        </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left relative z-10" id={`notebook-workspace-${notebook.id}`}>
      <div className="surface-card rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSelectNotebook(null)}
                className="rounded-xl border border-border-default bg-bg-elevated/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
              >
                <span className="inline-flex items-center gap-1">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  All Notebooks
                </span>
              </button>
              <button
                onClick={onBackToDashboard}
                className="rounded-xl border border-border-default bg-bg-elevated/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
              >
                Dashboard
              </button>
            </div>
            <div className="space-y-1">
              <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${colorTone?.text || 'text-accent-hover'}`}>{notebook.courseLabel || notebook.courseCode}</p>
              <h1 className="text-2xl font-black text-text-primary font-display">{notebook.name}</h1>
              <p className="max-w-3xl text-sm leading-relaxed text-text-secondary font-serif">
                {notebook.description || 'No description set yet.'}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border font-mono ${colorTone?.badge || 'border-accent-border bg-accent-subtle text-accent-hover'}`}>
                  {notebook.fileCount} files
                </span>
                <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border font-mono ${colorTone?.badge || 'border-accent-border bg-accent-subtle text-accent-hover'}`}>
                  {notebook.conceptCount} concepts
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="group relative">
              <button
                type="button"
                onClick={() => onEditNotebook?.(notebook)}
                title={`Edit ${notebook.name}`}
                aria-label={`Edit ${notebook.name}`}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                Edit notebook
              </div>
            </div>
            <div className="group relative">
              <button
                type="button"
                onClick={() => setIsDeleteNotebookModalOpen(true)}
                title={`Delete ${notebook.name}`}
                aria-label={`Delete ${notebook.name}`}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-error/20 bg-error-subtle text-error transition hover:bg-error/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                Delete notebook
              </div>
            </div>
          </div>
        </div>
      </div>

      {(uploadError || previewError) && (
        <div className="rounded-2xl border border-cta/20 bg-cta-subtle px-4 py-3 text-sm font-semibold text-cta">
          {uploadError || previewError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className={`surface-card rounded-3xl p-5 md:p-6 ${colorTone?.borderGlow}`}>
          <div className="flex flex-col gap-3 border-b border-border-subtle pb-4">
            <div>
              <h2 className="text-sm font-black text-text-primary font-display">Materials Directory</h2>
              <p className="text-[11px] text-text-muted">Open inline previews or delete files directly from this notebook.</p>
            </div>
          </div>

          {uploadPhase !== 'idle' && (
            <div className={`mt-4 rounded-2xl border bg-bg-elevated/50 p-4 ${colorTone?.subtleBlock || 'border-border-default'}`}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-bold text-text-primary">{uploadFileName}</span>
                <span className={`font-black ${colorTone?.text || 'text-accent-hover'}`}>{uploadProgressValue}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-bg-elevated">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 transition-all duration-200"
                  style={{ width: `${uploadProgressValue}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-text-secondary">{uploadStatusLabel}</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={NOTEBOOK_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleUpload(file);
              }
            }}
          />

          <div className="mt-4 space-y-3">
            {filteredFiles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-default px-4 py-12 text-center text-sm text-text-muted">
                <FolderOpen className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                No files matched this notebook filter.
              </div>
            ) : (
              filteredFiles.map((file) => (
                <div
                  key={file.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedMaterial(file)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedMaterial(file);
                    }
                  }}
                  className={`flex cursor-pointer flex-col gap-3 rounded-2xl border border-border-subtle bg-bg-elevated/30 p-4 text-left transition hover:bg-bg-elevated/50 focus:outline-none focus:ring-2 focus:ring-accent/40 sm:flex-row sm:items-center sm:justify-between ${colorTone?.borderGlow || ''}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-xl border border-border-default bg-bg-elevated/60 p-2.5 shrink-0">{getFileIcon(file.type)}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-text-primary">{file.name}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-widest text-text-muted">
                        <span>{file.type}</span>
                        <span>{file.size}</span>
                        <span>{file.uploadDate}</span>
                        {file.siteName ? <span>{file.siteName}</span> : null}
                        {file.totalPages ? <span>{file.totalPages} pages</span> : null}
                        {file.summaryStatus === 'in-progress' ? <span>Generating description</span> : null}
                        {file.summaryStatus === 'error' ? <span>Description failed</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={`Delete ${file.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingDeleteFile(file);
                      }}
                      disabled={isDeleting}
                      className="rounded-xl border border-error/20 bg-error-subtle p-2.5 text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              onClick={() => setIsAddLinkModalOpen(true)}
              disabled={uploadPhase !== 'idle' || !onAddLink}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
            >
              <LinkIcon className="h-4 w-4" />
              Add Link
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhase !== 'idle'}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
            >
              {uploadPhase !== 'idle' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadPhase !== 'idle' ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </div>

        <NotebookChatPanel
          key={notebook.id}
          notebookId={notebook.id}
          notebookName={notebook.name}
          color={notebook.color}
        />
      </div>

      {selectedMaterial && (
        <div
          className="fixed inset-y-0 right-0 left-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md md:left-24"
          onClick={() => setSelectedMaterial(null)}
        >
          <div
            className="relative flex h-[90vh] w-full max-w-[92vw] flex-col overflow-hidden rounded-3xl border border-border-default bg-bg-overlay shadow-2xl xl:flex-row"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMaterial(null)}
              className="absolute right-4 top-4 z-10 rounded-full border border-border-default bg-bg-elevated/80 p-2 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex w-full flex-col border-b border-border-default bg-bg-elevated/50 p-5 xl:w-[45%] xl:border-b-0 xl:border-r">
              <div className="space-y-2 border-b border-border-subtle pb-4">
                <div className="flex items-center gap-2.5">
                  <div className={`rounded-lg border p-2 ${colorTone?.subtleBlock || 'border-border-default bg-bg-elevated'}`}>
                    {getFileIcon(selectedMaterial.type)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-extrabold text-text-primary font-display">{selectedMaterial.name}</h3>
                    <p className="text-[10px] text-text-muted">
                      {selectedMaterial.size} - Uploaded {selectedMaterial.uploadDate}
                    </p>
                    {selectedMaterial.sourceUrl ? (
                      <a
                        href={selectedMaterial.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[10px] font-bold text-accent-hover transition hover:text-accent"
                      >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{selectedMaterial.siteName || selectedMaterial.sourceUrl}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex-1 min-h-0 overflow-auto rounded-2xl border border-border-subtle bg-bg-base/60 p-4">
                {previewLoading && !activePreview ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center gap-2 text-sm text-text-muted">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Loading inline preview...
                  </div>
                ) : null}

                {!previewLoading && !activePreview && !previewError ? (
                  <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-text-muted">
                    Preview is not available for this file.
                  </div>
                ) : null}

                {activePreview?.previewFormat === 'pdf' && viewerUrl ? (
                  <iframe
                    title={activePreview.name}
                    src={viewerUrl}
                    className="h-full min-h-[320px] w-full rounded-xl border border-border-subtle bg-bg-base"
                  />
                ) : null}

                {activePreview?.previewFormat === 'html' ? (
                  <div
                    className="prose prose-invert max-w-none text-sm"
                    dangerouslySetInnerHTML={{ __html: activePreview.previewContent || '' }}
                  />
                ) : null}

                {activePreview?.previewFormat === 'text' ? (
                  <div className="space-y-4">
                    {isVideoPreview && selectedViewerUrl ? (
                      <div className="rounded-xl border border-border-subtle bg-bg-elevated/70 p-4">
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted font-mono">
                          <MonitorPlay className="h-4 w-4" />
                          Video Player
                        </div>
                        <video
                          controls
                          preload="metadata"
                          src={selectedViewerUrl}
                          className="max-h-[360px] w-full rounded-lg bg-black"
                        >
                          <a href={selectedViewerUrl}>Download video</a>
                        </video>
                      </div>
                    ) : null}

                    {isAudioPreview && selectedViewerUrl ? (
                      <div className="rounded-xl border border-border-subtle bg-bg-elevated/70 p-4">
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted font-mono">
                          <Volume2 className="h-4 w-4" />
                          Audio Player
                        </div>
                        <audio
                          controls
                          preload="metadata"
                          src={selectedViewerUrl}
                          className="w-full"
                        >
                          <a href={selectedViewerUrl}>Download audio</a>
                        </audio>
                      </div>
                    ) : null}

                    {isAudioPreview || isVideoPreview ? (
                      <div className="text-[11px] font-black uppercase tracking-widest text-text-muted font-mono">
                        {isVideoPreview ? 'Timestamped transcript' : 'Transcript'}
                      </div>
                    ) : null}

                    {isLinkPreview && activePreview.sourceUrl ? (
                      <a
                        href={activePreview.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated/50 px-3 py-2 text-xs font-bold text-accent-hover transition hover:bg-bg-elevated/70"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open original page
                      </a>
                    ) : null}

                    {isImagePreview && selectedViewerUrl ? (
                      <div className="rounded-xl border border-border-subtle bg-bg-elevated/70 p-4">
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted font-mono">
                          <Image className="h-4 w-4" />
                          Image Preview
                        </div>
                        <img
                          src={selectedViewerUrl}
                          alt={selectedMaterial.name}
                          className="max-h-[420px] w-full rounded-lg object-contain"
                        />
                      </div>
                    ) : null}

                    <pre className="whitespace-pre-wrap break-words text-base leading-6 text-text-primary font-serif">
                      {activePreview.previewContent || ''}
                    </pre>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 w-full flex-col p-5 xl:w-[55%]">
              <button
                type="button"
                onClick={() => setIsSummaryOpen((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-2xl border border-border-default bg-bg-elevated/40 px-4 py-2.5 text-left transition hover:bg-bg-elevated/60"
              >
                <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-secondary font-mono">
                  <Sparkles className="h-4 w-4 text-accent-hover" />
                  Description & Details
                </span>
                <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${isSummaryOpen ? 'rotate-180' : ''}`} />
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isSummaryOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div className="overflow-hidden">
                  <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-1">
                    <div className={`rounded-2xl border p-4 ${colorTone?.subtleBlock || 'border-border-default bg-bg-elevated/40'}`}>
                      <div className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${colorTone?.text || 'text-accent-hover'}`}>
                        <Sparkles className="h-4 w-4" />
                        Description
                      </div>
                      <p className="mt-3 text-base leading-relaxed text-text-primary font-serif">
                        {summaryDisplayText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-elevated/40 p-1">
                <button
                  type="button"
                  onClick={() => setFileDetailTab('chat')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${fileDetailTab === 'chat' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary'}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </button>
                <button
                  type="button"
                  onClick={() => setFileDetailTab('notes')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${fileDetailTab === 'notes' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary'}`}
                >
                  <StickyNote className="h-3.5 w-3.5" />
                  Notes
                </button>
              </div>

              <div className="mt-3 flex h-[28rem] flex-none flex-col overflow-hidden rounded-2xl border border-border-default bg-bg-base/35 xl:h-[32rem]">
                {fileDetailTab === 'chat' ? (
                  <>
                    <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-elevated/40 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-primary font-mono">
                          <Bot className="h-4 w-4 text-accent-hover" />
                          Ask This File
                        </div>
                        <p className="mt-1 truncate text-[10px] text-text-muted">
                          Grounded on {selectedMaterial.name}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-success/25 bg-success-subtle px-2 py-1 text-[9px] font-black uppercase tracking-wider text-success">
                        File scope
                      </span>
                    </div>

                    <div
                      ref={fileChatScrollRef}
                      className="min-h-0 flex-1 space-y-3 overflow-y-scroll p-3"
                    >
                      {activeFileChatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[88%] rounded-2xl border p-3 text-xs leading-relaxed ${
                            message.role === 'user'
                              ? 'rounded-tr-sm border-accent bg-accent text-white'
                              : 'rounded-tl-sm border-border-subtle bg-bg-elevated/60 text-text-primary'
                          }`}>
                            {message.role === 'assistant' ? (
                              <ChatMarkdown content={message.text} />
                            ) : (
                              <div className="whitespace-pre-wrap font-semibold leading-relaxed">
                                {message.text}
                              </div>
                            )}

                            {message.role === 'assistant' && message.grounded === false ? (
                              <div className="mt-2 rounded-lg border border-cta/20 bg-cta-subtle px-2 py-1.5 text-[9px] font-bold text-cta">
                                No grounded context was found for this file.
                              </div>
                            ) : null}

                            {message.citations && message.citations.length > 0 ? (
                              <div className="mt-2.5 border-t border-border-subtle pt-2">
                                <div className="mb-1.5 flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-success font-mono">
                                  <ShieldCheck className="h-3 w-3" />
                                  Grounded references
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {message.citations.map((citation, index) => (
                                    <span
                                      key={`${citation.fileId}-${citation.position}-${index}`}
                                      className="inline-flex max-w-full items-center gap-1 rounded border border-success/20 bg-success-subtle px-1.5 py-0.5 text-[9px] font-extrabold text-success"
                                    >
                                      <FileText className="h-2.5 w-2.5 shrink-0" />
                                      <span className="max-w-[120px] truncate">{citation.fileName}</span>
                                      <span className="rounded-sm bg-success/10 px-0.5 font-mono text-[8px]">
                                        {citation.position}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {message.suggestedPrompts && message.suggestedPrompts.length > 0 ? (
                              <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-2">
                                {message.suggestedPrompts.map((prompt) => (
                                  <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => void handleFileChatSubmit(prompt)}
                                    disabled={isFileChatTyping}
                                    className="w-full rounded-lg border border-border-subtle bg-bg-elevated/40 px-2 py-1.5 text-left text-[9.5px] font-bold text-text-secondary transition hover:border-accent/30 hover:bg-bg-elevated/70 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    {prompt}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      {isFileChatTyping ? (
                        <div className="flex justify-start">
                          <div className="inline-flex items-center gap-2 rounded-2xl border border-border-subtle bg-bg-elevated/60 px-3 py-2 text-[9px] font-extrabold uppercase tracking-wide text-text-muted font-mono">
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent-hover" />
                            Retrieving grounded context
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void handleFileChatSubmit(fileChatInput);
                      }}
                      className="flex items-center gap-2 border-t border-border-subtle bg-bg-elevated/35 p-3"
                    >
                      <input
                        type="text"
                        value={fileChatInput}
                        onChange={(event) => setFileChatInput(event.target.value)}
                        placeholder="Ask a grounded question..."
                        className="min-w-0 flex-1 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-semibold text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
                      />
                      <button
                        type="submit"
                        disabled={!fileChatInput.trim() || isFileChatTyping}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Send grounded file question"
                        title="Send grounded file question"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </>
                ) : (
                  <FileNotesPanel
                    fileId={selectedMaterial.id}
                    fileName={selectedMaterial.name}
                    notes={fileNoteApi.getNotesForFile(selectedMaterial.id)}
                    isLoading={fileNoteApi.isLoadingFile(selectedMaterial.id)}
                    isMutating={fileNoteApi.isMutatingFile(selectedMaterial.id)}
                    error={fileNoteApi.getErrorForFile(selectedMaterial.id)}
                    onRetry={() => {
                      void fileNoteApi.reloadFileNotes(selectedMaterial.id);
                    }}
                    notebookColor={notebook?.color}
                    onAdd={fileNoteApi.addNote}
                    onUpdate={fileNoteApi.updateNote}
                    onDelete={fileNoteApi.deleteNote}
                  />
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2.5 border-t border-border-subtle pt-4">
                {selectedViewerUrl ? (
                  <>
                    <div className="group relative">
                      <a
                        href={selectedViewerUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open file"
                        title="Open file"
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <div className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        Open file
                      </div>
                    </div>
                    <div className="group relative">
                      <a
                        href={selectedViewerUrl}
                        download={selectedMaterial.name}
                        aria-label="Download file"
                        title="Download file"
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <div className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        Download file
                      </div>
                    </div>
                  </>
                ) : null}
                <div className="group relative">
                  <button
                    onClick={() => setPendingDeleteFile(selectedMaterial)}
                    disabled={isDeleting}
                    aria-label="Delete file"
                    title="Delete file"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-error/20 bg-error-subtle text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <div className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    Delete file
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteFile && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setPendingDeleteFile(null)}
        >
          <div
            className="surface-glass w-full max-w-md rounded-3xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-black text-text-primary font-display">Delete material?</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary font-serif">
              This removes <span className="font-semibold text-text-primary">{pendingDeleteFile.name}</span> from the notebook and deletes the stored file immediately.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setPendingDeleteFile(null)}
                className="rounded-xl border border-border-default bg-bg-elevated/60 px-4 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(pendingDeleteFile)}
                disabled={isDeleting}
                className="rounded-xl border border-error/20 bg-error-subtle px-4 py-2 text-xs font-bold text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeleting ? 'Deleting...' : 'Delete file'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteNotebookModalOpen && notebook && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setIsDeleteNotebookModalOpen(false)}
        >
          <div
            className="surface-glass w-full max-w-md rounded-3xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-black text-text-primary font-display">Delete notebook?</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-secondary font-serif">
              This removes <span className="font-semibold text-text-primary">{notebook.name}</span>, all notebook records, and all stored files immediately.
            </p>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                onClick={() => setIsDeleteNotebookModalOpen(false)}
                className="rounded-xl border border-border-default bg-bg-elevated/60 px-4 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDeleteCurrentNotebook()}
                disabled={isDeletingNotebook}
                className="rounded-xl border border-error/20 bg-error-subtle px-4 py-2 text-xs font-bold text-error transition hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeletingNotebook ? 'Deleting...' : 'Delete notebook'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddLinkModalOpen && notebook ? (
        <AddLinkModal
          notebookName={notebook.name}
          onClose={() => setIsAddLinkModalOpen(false)}
          onSubmit={handleAddLink}
        />
      ) : null}
    </div>
  );
}
