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
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Upload,
  Volume2,
  X,
  Youtube,
} from 'lucide-react';
import { ChatMessage, FileItem, Notebook, NotebookFilePreview } from '../types';
import { askGroundedNotebookChatStream, buildNotebookApiUrl, fetchNotebookFilePreview } from '../lib/notebooksApi';
import { getGenericUploadErrorMessage, getGroundedChatErrorMessage } from '../lib/apiErrors';
import {
  NOTEBOOK_UPLOAD_ACCEPT,
  isVideoNotebookExtension,
  validateNotebookUploadBatch,
} from '../lib/notebookUpload';
import type { SupportedNotebookExtension } from '../lib/notebookUpload';
import { getNotebookColorTone } from '../lib/notebookColors';
import { ChatMarkdown } from './ChatMarkdown';
import { useFileNotes } from '../hooks/useFileNotes';
import FileNotesPanel from './FileNotesPanel';
import HlsVideoPlayer from './HlsVideoPlayer';
import NotebookChatPanel from './NotebookChatPanel';
import AddLinkModal from './AddLinkModal';
import AddYoutubeLinkModal from './AddYoutubeLinkModal';
import { NotebookUploadFileIcon } from './NotebookUploadFileIcon';
import { LabeledProgressBar, ProgressBar } from './ProgressBar';

interface NotebookViewProps {
  notebook: Notebook | null;
  allNotebooks: Notebook[];
  searchQuery?: string;
  onSelectNotebook: (id: string | null) => void;
  onBackToDashboard: () => void;
  onAddLink?: (notebookId: string, url: string) => Promise<void> | void;
  onAddYoutubeLink?: (notebookId: string, url: string) => Promise<void> | void;
  onUploadFile?: (notebookId: string, files: File[]) => Promise<void> | void;
  onDeleteFile?: (notebookId: string, fileId: string) => Promise<void> | void;
  onRetryFileSummary?: (notebookId: string, fileId: string) => Promise<void> | void;
  onEditNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onCreateNotebookRequested?: () => void;
}

const SELECTED_FILE_REFRESH_INTERVAL_MS = 3000;

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

function normalizeSearchValue(value: string | undefined) {
  return value?.trim().toLowerCase() || '';
}

function fieldMatchesSearch(searchQuery: string, fields: Array<string | undefined>) {
  if (!searchQuery) {
    return true;
  }

  return fields.some((field) => field?.toLowerCase().includes(searchQuery));
}

function fileMatchesSearch(file: FileItem, searchQuery: string) {
  return fieldMatchesSearch(searchQuery, [
    file.name,
    file.type,
    file.siteName,
    file.sourceUrl,
    file.summary,
  ]);
}

function notebookMatchesSearch(notebook: Notebook, searchQuery: string) {
  return fieldMatchesSearch(searchQuery, [
    notebook.name,
    notebook.courseCode,
    notebook.courseLabel,
    notebook.description,
  ]);
}

function countMatchingFiles(notebook: Notebook, searchQuery: string) {
  if (!searchQuery) {
    return notebook.files.length;
  }

  return notebook.files.filter((file) => fileMatchesSearch(file, searchQuery)).length;
}

function hasPendingFileWork(file: Pick<FileItem | NotebookFilePreview, 'status' | 'summaryStatus'> | null | undefined) {
  return file?.status === 'processing' || file?.summaryStatus === 'in-progress';
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
  searchQuery = '',
  onSelectNotebook,
  onBackToDashboard,
  onAddLink,
  onAddYoutubeLink,
  onUploadFile,
  onDeleteFile,
  onRetryFileSummary,
  onEditNotebook,
  onDeleteNotebook,
  onCreateNotebookRequested,
}: NotebookViewProps) {
  type UploadPhase = 'idle' | 'validating' | 'uploading' | 'extracting' | 'success';
  type PendingLink = {
    id: string;
    kind: 'web' | 'youtube';
    progress: number;
    status: 'scraping' | 'done' | 'failed';
    url: string;
  };
  const [selectedMaterial, setSelectedMaterial] = useState<FileItem | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<string, NotebookFilePreview>>({});
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileCount, setUploadFileCount] = useState(0);
  const [completedUploadCount, setCompletedUploadCount] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<Array<{
    id: string;
    name: string;
    extension: SupportedNotebookExtension;
    progress: number;
    status: 'queued' | 'validating' | 'uploading' | 'extracting' | 'done' | 'failed';
  }>>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<FileItem | null>(null);
  const [isDeleteNotebookModalOpen, setIsDeleteNotebookModalOpen] = useState(false);
  const [fileChatMessagesById, setFileChatMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [fileChatInput, setFileChatInput] = useState('');
  const [isFileChatTyping, setIsFileChatTyping] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [summaryRetryError, setSummaryRetryError] = useState('');
  const [retryingSummaryFileId, setRetryingSummaryFileId] = useState<string | null>(null);
  const [fileDetailTab, setFileDetailTab] = useState<'chat' | 'notes'>('chat');
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [isAddYoutubeLinkModalOpen, setIsAddYoutubeLinkModalOpen] = useState(false);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [videoIngestionProgress, setVideoIngestionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileChatScrollRef = useRef<HTMLDivElement | null>(null);

  const fileNoteApi = useFileNotes(notebook?.id, selectedMaterial?.id);
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const isSearchActive = Boolean(normalizedSearchQuery);

  useEffect(() => {
    setSelectedMaterial(null);
    setPreviewError('');
    setUploadError('');
    setFileChatInput('');
    setPendingLink(null);
  }, [notebook?.id]);

  useEffect(() => {
    setFileDetailTab('chat');
    setSummaryRetryError('');
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
      setUploadFileCount(0);
      setCompletedUploadCount(0);
      setUploadQueue([]);
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

  useEffect(() => {
    if (!selectedMaterial) {
      return;
    }

    setPreviewCache((current) => {
      const preview = current[selectedMaterial.id];

      if (!preview) {
        return current;
      }

      const nextPreview = {
        ...preview,
        hlsGeneratedAt: selectedMaterial.hlsGeneratedAt,
        hlsMasterPlaylistUrl: selectedMaterial.hlsMasterPlaylistUrl,
        hlsStatus: selectedMaterial.hlsStatus,
        ingestionError: selectedMaterial.ingestionError,
        summary: selectedMaterial.summary,
        summaryError: selectedMaterial.summaryError,
        summaryGeneratedAt: selectedMaterial.summaryGeneratedAt,
        summaryStatus: selectedMaterial.summaryStatus,
        status: selectedMaterial.status,
        videoDurationSeconds: selectedMaterial.videoDurationSeconds,
        videoResolution: selectedMaterial.videoResolution,
      };

      const didChange =
        preview.hlsGeneratedAt !== nextPreview.hlsGeneratedAt ||
        preview.hlsMasterPlaylistUrl !== nextPreview.hlsMasterPlaylistUrl ||
        preview.hlsStatus !== nextPreview.hlsStatus ||
        preview.ingestionError !== nextPreview.ingestionError ||
        preview.summary !== nextPreview.summary ||
        preview.summaryError !== nextPreview.summaryError ||
        preview.summaryGeneratedAt !== nextPreview.summaryGeneratedAt ||
        preview.summaryStatus !== nextPreview.summaryStatus ||
        preview.status !== nextPreview.status ||
        preview.videoDurationSeconds !== nextPreview.videoDurationSeconds ||
        preview.videoResolution !== nextPreview.videoResolution;

      if (!didChange) {
        return current;
      }

      return {
        ...current,
        [selectedMaterial.id]: nextPreview,
      };
    });
  }, [selectedMaterial]);

  useEffect(() => {
    if (!notebook || !selectedMaterial) {
      return;
    }

    const cachedPreview = previewCache[selectedMaterial.id];
    const shouldRefreshSelectedFile = hasPendingFileWork(cachedPreview) || hasPendingFileWork(selectedMaterial);

    if (!shouldRefreshSelectedFile) {
      return;
    }

    let isActive = true;
    let timeoutId: number | undefined;

    const refreshSelectedFile = () => {
      void fetchNotebookFilePreview(notebook.id, selectedMaterial.id)
        .then((preview) => {
          if (!isActive) {
            return;
          }

          setPreviewCache((current) => ({
            ...current,
            [selectedMaterial.id]: preview,
          }));
          setPreviewError('');

          if (hasPendingFileWork(preview)) {
            timeoutId = window.setTimeout(refreshSelectedFile, SELECTED_FILE_REFRESH_INTERVAL_MS);
          }
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          setPreviewError(error instanceof Error ? error.message : 'Failed to refresh file preview.');
          timeoutId = window.setTimeout(refreshSelectedFile, SELECTED_FILE_REFRESH_INTERVAL_MS);
        });
    };

    timeoutId = window.setTimeout(refreshSelectedFile, SELECTED_FILE_REFRESH_INTERVAL_MS);

    return () => {
      isActive = false;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [notebook, previewCache, selectedMaterial]);

  const filteredFiles = useMemo(() => {
    if (!notebook) {
      return [];
    }

    if (normalizedSearchQuery) {
      return notebook.files.filter((file) => fileMatchesSearch(file, normalizedSearchQuery));
    }

    return notebook.files;
  }, [notebook, normalizedSearchQuery]);

  const filteredNotebooks = useMemo(() => {
    if (!normalizedSearchQuery) {
      return allNotebooks;
    }

    return allNotebooks.filter((entry) =>
      notebookMatchesSearch(entry, normalizedSearchQuery) || countMatchingFiles(entry, normalizedSearchQuery) > 0,
    );
  }, [allNotebooks, normalizedSearchQuery]);

  const visibleNotebookCount = filteredNotebooks.length;
  const totalFileMatchCount = isSearchActive
    ? allNotebooks.reduce((total, entry) => total + countMatchingFiles(entry, normalizedSearchQuery), 0)
    : 0;

  const activePreview = selectedMaterial ? previewCache[selectedMaterial.id] : undefined;
  const activeFileChatMessages = selectedMaterial ? fileChatMessagesById[selectedMaterial.id] || [] : [];
  const colorTone = notebook ? getNotebookColorTone(notebook.color) : null;
  const viewerUrl = getViewerUrl(activePreview?.sourceUrl);
  const selectedViewerUrl = getViewerUrl(activePreview?.sourceUrl);
  const isAudioPreview = selectedMaterial?.type === 'audio';
  const isVideoPreview = selectedMaterial?.type === 'video';
  const isImagePreview = selectedMaterial?.type === 'image';
  const isLinkPreview = selectedMaterial?.type === 'link';
  const fileStatus = activePreview?.status || selectedMaterial?.status || 'ready';
  const ingestionError = activePreview?.ingestionError || selectedMaterial?.ingestionError;
  const isVideoIngestionProcessing = isVideoPreview && fileStatus === 'processing';
  const isVideoIngestionError = isVideoPreview && fileStatus === 'error';
  const isVideoIngestionUnavailable = isVideoIngestionProcessing || isVideoIngestionError;
  const summaryStatus = activePreview?.summaryStatus || selectedMaterial?.summaryStatus || 'idle';
  const summaryError = activePreview?.summaryError || selectedMaterial?.summaryError;
  const summaryText = activePreview?.summary || selectedMaterial?.summary;
  const summaryDisplayText = isVideoIngestionError
    ? ingestionError || 'Video ingestion failed. Delete and reupload this file to try again.'
    : summaryStatus === 'in-progress'
      ? summaryText || 'Generating description...'
      : summaryStatus === 'error'
        ? summaryError || 'Description generation failed.'
        : summaryText || 'No generated description is available for this file.';
  const videoIngestionStatus = videoIngestionProgress >= 86
    ? 'Finalizing transcript and search index...'
    : videoIngestionProgress >= 62
      ? 'Indexing transcript for grounded search...'
      : videoIngestionProgress >= 34
        ? 'Extracting timestamped transcript...'
        : 'Preparing video for transcript extraction...';
  const isRetryingSummary = Boolean(selectedMaterial && retryingSummaryFileId === selectedMaterial.id);
  const uploadProgressValue = uploadPhase === 'validating'
    ? 10
    : uploadPhase === 'uploading'
      ? 45
      : uploadPhase === 'extracting'
        ? 82
        : uploadPhase === 'success'
          ? 100
          : 0;
  const uploadProgress = uploadProgressValue;
  const hasVideoUpload = uploadQueue.some((item) => isVideoNotebookExtension(item.extension));
  const uploadStatusLabel = uploadPhase === 'validating'
    ? uploadFileCount > 1
      ? `Validating ${uploadFileCount} files before upload...`
      : 'Validating file before upload...'
    : uploadPhase === 'uploading'
      ? uploadFileCount > 1
        ? `Sending ${uploadFileCount} files to notebook storage...`
        : 'Sending file to notebook storage...'
      : uploadPhase === 'extracting'
        ? hasVideoUpload
          ? 'Video uploaded. Backend transcript extraction and indexing are running; this page will update automatically while open.'
          : uploadFileCount > 1
            ? `Extracting ${uploadFileCount} files and refreshing notebook...`
            : 'Extracting preview content and refreshing notebook...'
        : uploadPhase === 'success'
          ? hasVideoUpload
            ? 'Upload finished. Video processing continues in the background; this page will update automatically while open.'
            : uploadFileCount > 1
              ? `Uploaded ${uploadFileCount} files successfully.`
              : 'Upload finished. Material is ready.'
          : '';
  const isUploadActive = uploadPhase === 'validating' || uploadPhase === 'uploading' || uploadPhase === 'extracting';
  const hasUploadFailure = uploadQueue.some((item) => item.status === 'failed');
  const shouldShowUploadQueue = uploadQueue.length > 0 && (isUploadActive || uploadPhase === 'success' || Boolean(uploadError));
  const uploadSummaryLabel = hasUploadFailure
    ? `${completedUploadCount} of ${uploadFileCount} files uploaded before the batch stopped`
    : uploadFileCount > 1
      ? `${completedUploadCount} of ${uploadFileCount} files complete`
      : uploadFileName;
  const isPendingLinkActive = pendingLink?.status === 'scraping';
  const isWebLinkActive = isPendingLinkActive && pendingLink?.kind === 'web';
  const isYoutubeLinkActive = isPendingLinkActive && pendingLink?.kind === 'youtube';
  const pendingLinkStatusLabel = !pendingLink
    ? ''
    : pendingLink.kind === 'youtube'
      ? pendingLink.status === 'failed'
        ? 'YouTube video failed'
        : pendingLink.progress >= 100
          ? 'YouTube video queued'
          : pendingLink.progress >= 70
            ? 'Adding video to notebook...'
            : pendingLink.progress >= 36
              ? 'Fetching video metadata...'
              : 'Validating YouTube video...'
      : pendingLink.status === 'failed'
        ? 'Web link failed'
        : pendingLink.progress >= 100
          ? 'Web link indexed'
          : pendingLink.progress >= 70
            ? 'Indexing readable study context...'
            : pendingLink.progress >= 36
              ? 'Extracting readable page text...'
              : 'Fetching web page...';

  useEffect(() => {
    if (pendingLink?.status !== 'scraping') {
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const duration = pendingLink.kind === 'youtube' ? 12000 : 10000;
      const nextProgress = Math.min(94, 10 + Math.floor((elapsed / duration) * 84));
      setPendingLink((current) => current && current.status === 'scraping'
        ? { ...current, progress: Math.max(current.progress, nextProgress) }
        : current);
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [pendingLink?.id, pendingLink?.kind, pendingLink?.status]);
  const handleRetrySummary = async () => {
    if (!notebook || !selectedMaterial || !onRetryFileSummary) {
      return;
    }

    setRetryingSummaryFileId(selectedMaterial.id);
    setSummaryRetryError('');

    try {
      await onRetryFileSummary(notebook.id, selectedMaterial.id);
      setPreviewCache((current) => {
        const preview = current[selectedMaterial.id];

        if (!preview) {
          return current;
        }

        return {
          ...current,
          [selectedMaterial.id]: {
            ...preview,
            summaryError: undefined,
            summaryGeneratedAt: undefined,
            summaryStatus: 'in-progress',
          },
        };
      });
    } catch (error) {
      setSummaryRetryError(error instanceof Error ? error.message : 'Failed to retry description generation.');
    } finally {
      setRetryingSummaryFileId(null);
    }
  };

  useEffect(() => {
    if (!isVideoIngestionProcessing || !selectedMaterial) {
      setVideoIngestionProgress(0);
      return;
    }

    setVideoIngestionProgress((currentProgress) => Math.max(currentProgress, 8));
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(94, 8 + Math.floor((elapsed / 90000) * 86));
      setVideoIngestionProgress((currentProgress) => Math.max(currentProgress, nextProgress));
    }, 300);

    return () => window.clearInterval(intervalId);
  }, [isVideoIngestionProcessing, selectedMaterial?.id]);

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

  useEffect(() => {
    if (!selectedMaterial || filteredFiles.some((file) => file.id === selectedMaterial.id)) {
      return;
    }

    setSelectedMaterial(null);
  }, [filteredFiles, selectedMaterial]);

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
    if (!notebook || !selectedMaterial || !question.trim() || isFileChatTyping || isVideoIngestionUnavailable) {
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

    const assistantMessageId = `file-chat-assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      citations: [],
      grounded: true,
    };

    updateFileChatMessages(file.id, (messages) => [...messages, assistantMessage]);

    try {
      const response = await askGroundedNotebookChatStream(
        {
          fileId: file.id,
          notebookId: notebook.id,
          question: submittedQuestion,
        },
        {
          onDelta: (delta) => {
            updateFileChatMessages(file.id, (messages) => messages.map((message) => (
              message.id === assistantMessageId
                ? { ...message, text: `${message.text}${delta}` }
                : message
            )));
          },
        },
      );

      updateFileChatMessages(file.id, (messages) => messages.map((message) => (
        message.id === assistantMessageId
          ? {
              ...message,
              citations: response.citations,
              grounded: response.grounded,
              text: response.answer,
            }
          : message
      )));
    } catch (error) {
      updateFileChatMessages(file.id, (messages) => messages.map((message) => (
        message.id === assistantMessageId
          ? {
              ...message,
              citations: [],
              grounded: false,
              text: getGroundedChatErrorMessage(error),
            }
          : message
      )));
    } finally {
      setIsFileChatTyping(false);
    }
  };

  const handleUpload = async (files: File[]) => {
    if (!notebook || !onUploadFile) {
      return;
    }

    const validationError = validateNotebookUploadBatch(files);
    if (validationError) {
      setUploadError(validationError);
      setUploadPhase('idle');
      return;
    }

    setUploadError('');
    setUploadFileName(files[0].name);
    setUploadFileCount(files.length);
    setCompletedUploadCount(0);
    setUploadQueue(files.map((file, index) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      name: file.name,
      extension: (file.name.split('.').pop()?.toLowerCase() as SupportedNotebookExtension) || 'pdf',
      progress: 0,
      status: 'queued',
    })));
    setUploadPhase('validating');

    try {
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 10, status: 'validating' })));
      await Promise.resolve();
      setUploadPhase('uploading');
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 45, status: 'uploading' })));
      await Promise.resolve();
      setUploadPhase('extracting');
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 82, status: 'extracting' })));
      await Promise.resolve(onUploadFile(notebook.id, files));
      setUploadQueue((current) => current.map((item) => ({ ...item, progress: 100, status: 'done' })));
      setCompletedUploadCount(files.length);
      setUploadPhase('success');
    } catch (error) {
      setUploadError(getGenericUploadErrorMessage(error));
      setUploadPhase('idle');
      setUploadQueue((current) => current.map((item) =>
        item.status === 'done' ? item : { ...item, status: 'failed' },
      ));
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
    setPendingLink({
      id: `web-link-${Date.now()}`,
      kind: 'web',
      progress: 8,
      status: 'scraping',
      url,
    });

    try {
      await Promise.resolve(onAddLink(notebook.id, url));
      setPendingLink((current) => current
        ? { ...current, progress: 100, status: 'done' }
        : current);
      window.setTimeout(() => {
        setPendingLink((current) => current?.status === 'done' ? null : current);
      }, 1200);
    } catch (error) {
      setUploadError(getGenericUploadErrorMessage(error));
      setPendingLink((current) => current
        ? { ...current, status: 'failed' }
        : current);
      throw error;
    }
  };

  const handleAddYoutubeLink = async (url: string) => {
    if (!notebook || !onAddYoutubeLink) {
      return;
    }

    setUploadError('');
    setPendingLink({
      id: `youtube-link-${Date.now()}`,
      kind: 'youtube',
      progress: 8,
      status: 'scraping',
      url,
    });

    try {
      await Promise.resolve(onAddYoutubeLink(notebook.id, url));
      setPendingLink((current) => current
        ? { ...current, progress: 100, status: 'done' }
        : current);
      window.setTimeout(() => {
        setPendingLink((current) => current?.status === 'done' ? null : current);
      }, 1200);
    } catch (error) {
      setUploadError(getGenericUploadErrorMessage(error));
      setPendingLink((current) => current
        ? { ...current, status: 'failed' }
        : current);
      throw error;
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
    const hasNotebooks = allNotebooks.length > 0;
    const hasVisibleNotebooks = filteredNotebooks.length > 0;

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
                {isSearchActive
                  ? `${visibleNotebookCount} notebook${visibleNotebookCount === 1 ? '' : 's'} and ${totalFileMatchCount} file match${totalFileMatchCount === 1 ? '' : 'es'} for "${searchQuery.trim()}".`
                  : hasNotebooks
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
        ) : !hasVisibleNotebooks ? (
          <div className="rounded-2xl border border-dashed border-border-default bg-bg-elevated/20 px-6 py-14 text-center">
            <Search className="mx-auto h-10 w-10 text-text-muted" />
            <h3 className="mt-4 text-lg font-black text-text-primary font-display">No notebook matches found</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-text-secondary font-serif">
              No notebook titles, course details, file names, links, or generated descriptions matched "{searchQuery.trim()}".
            </p>
          </div>
        ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredNotebooks.map((entry) => {
            const entryTone = getNotebookColorTone(entry.color);
            const fileMatchCount = countMatchingFiles(entry, normalizedSearchQuery);

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
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-text-muted">{entry.fileCount} files</span>
                    {isSearchActive && fileMatchCount > 0 ? (
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border font-mono ${entryTone.subtleBlock}`}>
                        {fileMatchCount} match{fileMatchCount === 1 ? '' : 'es'}
                      </span>
                    ) : null}
                  </div>
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
              <p className="text-[11px] text-text-muted">
                {isSearchActive
                  ? `${filteredFiles.length} file${filteredFiles.length === 1 ? '' : 's'} matched "${searchQuery.trim()}".`
                  : 'Open inline previews or delete files directly from this notebook. Videos upload first, then transcript extraction and indexing finish in the background while this page checks for updates.'}
              </p>
            </div>
          </div>

          {shouldShowUploadQueue && (
            <div className={`mt-4 rounded-2xl border bg-bg-elevated/50 p-4 ${colorTone?.subtleBlock || 'border-border-default'}`}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-bold text-text-primary">
                  {isUploadActive ? (
                    <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                  ) : hasUploadFailure ? (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-error" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
                  )}
                  <span className="truncate">{uploadSummaryLabel}</span>
                </span>
                <span className={`font-black ${colorTone?.text || 'text-accent-hover'}`}>{uploadProgress}%</span>
              </div>
              <ProgressBar
                value={uploadProgress}
                ariaLabel="Upload progress"
                className="mt-3 h-2"
                tone="upload"
                trackClassName="bg-bg-elevated"
              />
              <p className="mt-3 text-sm text-text-secondary">
                {hasUploadFailure ? 'Resolve the failed file and retry the remaining upload.' : uploadStatusLabel}
              </p>
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                {uploadQueue.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border-subtle bg-bg-overlay/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="flex min-w-0 items-center gap-2 font-semibold text-text-primary">
                        <NotebookUploadFileIcon extension={item.extension} />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${
                        item.status === 'failed'
                          ? 'text-error'
                          : item.status === 'done'
                            ? 'text-success'
                            : item.status === 'queued'
                              ? 'text-text-muted'
                              : colorTone?.text || 'text-accent-hover'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    {uploadQueue.length > 1 && (
                      <ProgressBar
                        value={item.progress}
                        ariaLabel={`${item.name} upload progress`}
                        className="mt-2 h-1.5"
                        tone={item.status === 'failed' ? 'error' : 'upload'}
                        trackClassName="bg-bg-elevated"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={NOTEBOOK_UPLOAD_ACCEPT}
            className="hidden"
            onChange={(event) => {
              const files = event.target.files ? Array.from(event.target.files) : [];
              if (files.length > 0) {
                void handleUpload(files);
              }
            }}
          />

          <div className="mt-4 space-y-3">
            {pendingLink ? (
              <div className={`flex flex-col gap-3 rounded-2xl border p-4 text-left sm:flex-row sm:items-center sm:justify-between ${
                pendingLink.status === 'failed'
                  ? 'border-error/25 bg-error-subtle/60'
                  : pendingLink.status === 'done'
                    ? 'border-success/25 bg-success-subtle/60'
                    : 'animate-pulse border-accent/30 bg-accent-subtle/40'
              }`}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className="rounded-xl border border-border-default bg-bg-elevated/60 p-2.5 shrink-0">
                    {pendingLink.status === 'failed' ? (
                      <X className="h-5 w-5 text-error" />
                    ) : pendingLink.status === 'done' ? (
                      <ShieldCheck className="h-5 w-5 text-success" />
                    ) : pendingLink.kind === 'youtube' ? (
                      <Youtube className="h-5 w-5 text-cta" />
                    ) : (
                      <LinkIcon className="h-5 w-5 text-accent-hover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-text-primary">{pendingLink.url}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-widest text-text-muted">
                      <span>{pendingLink.kind === 'youtube' ? 'youtube' : 'link'}</span>
                      <span>{pendingLinkStatusLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="w-full shrink-0 sm:w-44">
                  <div className={`mb-1 text-right text-[10px] font-black font-mono ${
                    pendingLink.status === 'failed'
                      ? 'text-error'
                      : pendingLink.status === 'done'
                        ? 'text-success'
                        : colorTone?.text || 'text-accent-hover'
                  }`}>
                    {pendingLink.status === 'failed'
                      ? 'Failed'
                      : pendingLink.progress >= 100
                        ? 'Ready'
                        : `${pendingLink.progress}%`}
                  </div>
                  <ProgressBar
                    value={pendingLink.status === 'failed' ? 100 : pendingLink.progress}
                    ariaLabel={pendingLink.kind === 'youtube' ? 'YouTube video indexing progress' : 'Web link indexing progress'}
                    className="h-1.5"
                    tone={pendingLink.status === 'failed' ? 'error' : pendingLink.status === 'done' ? 'success' : 'upload'}
                    trackClassName="bg-bg-elevated"
                  />
                </div>
              </div>
            ) : null}
            {filteredFiles.length === 0 && !pendingLink ? (
              <div className="rounded-2xl border border-dashed border-border-default px-4 py-12 text-center text-sm text-text-muted">
                <FolderOpen className="mx-auto mb-3 h-8 w-8 text-text-muted" />
                {isSearchActive
                  ? `No files in this notebook matched "${searchQuery.trim()}".`
                  : 'No files matched this notebook filter.'}
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
                  className={`flex cursor-pointer flex-col gap-3 rounded-2xl border border-border-subtle bg-bg-elevated/30 p-4 text-left transition hover:bg-bg-elevated/50 focus:outline-none focus:ring-2 focus:ring-accent/40 sm:flex-row sm:items-center sm:justify-between ${file.type === 'video' && file.status === 'processing' ? 'animate-pulse border-accent/30 bg-accent-subtle/40' : ''} ${colorTone?.borderGlow || ''}`}
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
                        {file.status === 'processing' ? (
                          <span className="inline-flex items-center gap-1 text-accent-hover">
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                            Processing video
                          </span>
                        ) : null}
                        {file.status === 'error' ? <span className="text-error">Ingestion failed</span> : null}
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
              disabled={uploadPhase !== 'idle' || isPendingLinkActive || !onAddLink}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
            >
              {isWebLinkActive ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
              {isWebLinkActive ? 'Adding Link...' : 'Add Link'}
            </button>
            <button
              onClick={() => setIsAddYoutubeLinkModalOpen(true)}
              disabled={uploadPhase !== 'idle' || isPendingLinkActive || !onAddYoutubeLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-cta/20 bg-cta-subtle px-3 py-2 text-xs font-bold text-cta transition hover:bg-cta/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isYoutubeLinkActive ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
              {isYoutubeLinkActive ? 'Adding Video...' : 'YouTube'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadPhase !== 'idle'}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
            >
              {uploadPhase !== 'idle' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadPhase !== 'idle' ? 'Uploading...' : 'Upload Files'}
            </button>
          </div>
        </div>

        <NotebookChatPanel
          key={notebook.id}
          notebookId={notebook.id}
          notebookName={notebook.name}
          color={notebook.color}
          hasFiles={notebook.files.length > 0}
          onAddLink={onAddLink ? () => setIsAddLinkModalOpen(true) : undefined}
          onUploadFile={onUploadFile ? () => fileInputRef.current?.click() : undefined}
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

                {isVideoPreview && selectedViewerUrl && activePreview && activePreview.previewFormat !== 'text' ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border-subtle bg-bg-elevated/70 p-4">
                      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted font-mono">
                        <MonitorPlay className="h-4 w-4" />
                        Video Player
                      </div>
                      <HlsVideoPlayer
                        fileId={selectedMaterial.id}
                        initialHls={{
                          hlsGeneratedAt: activePreview.hlsGeneratedAt || selectedMaterial.hlsGeneratedAt,
                          hlsMasterPlaylistUrl: activePreview.hlsMasterPlaylistUrl || selectedMaterial.hlsMasterPlaylistUrl,
                          hlsStatus: activePreview.hlsStatus || selectedMaterial.hlsStatus || 'PENDING',
                          videoDurationSeconds: activePreview.videoDurationSeconds ?? selectedMaterial.videoDurationSeconds,
                          videoResolution: activePreview.videoResolution || selectedMaterial.videoResolution,
                        }}
                        originalVideoUrl={selectedViewerUrl}
                      />
                    </div>
                    {isVideoIngestionUnavailable ? (
                      <div className={`rounded-xl border p-4 text-sm font-semibold ${isVideoIngestionError ? 'border-error/20 bg-error-subtle text-error' : 'border-accent-border bg-accent-subtle text-accent-hover'}`}>
                        {isVideoIngestionError ? (
                          ingestionError || 'Video ingestion failed. Delete and reupload this file to try again.'
                        ) : (
                          <LabeledProgressBar
                            value={videoIngestionProgress}
                            label={
                              <span className="inline-flex items-center gap-2">
                                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                                {videoIngestionStatus}
                              </span>
                            }
                            ariaLabel="Video transcript extraction progress"
                            className="mt-3 h-2"
                            tone="upload"
                            indicatorClassName="duration-150"
                            valueClassName="text-accent-hover"
                          />
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activePreview?.previewFormat === 'text' ? (
                  <div className="space-y-4">
                    {isVideoPreview && selectedViewerUrl ? (
                      <div className="rounded-xl border border-border-subtle bg-bg-elevated/70 p-4">
                        <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted font-mono">
                          <MonitorPlay className="h-4 w-4" />
                          Video Player
                        </div>
                        <HlsVideoPlayer
                          fileId={selectedMaterial.id}
                          initialHls={{
                            hlsGeneratedAt: activePreview.hlsGeneratedAt || selectedMaterial.hlsGeneratedAt,
                            hlsMasterPlaylistUrl: activePreview.hlsMasterPlaylistUrl || selectedMaterial.hlsMasterPlaylistUrl,
                            hlsStatus: activePreview.hlsStatus || selectedMaterial.hlsStatus || 'PENDING',
                            videoDurationSeconds: activePreview.videoDurationSeconds ?? selectedMaterial.videoDurationSeconds,
                            videoResolution: activePreview.videoResolution || selectedMaterial.videoResolution,
                          }}
                          originalVideoUrl={selectedViewerUrl}
                        />
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
                        <div className="mt-4 border-t border-border-subtle pt-4">
                          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-muted font-mono">
                            <Sparkles className="h-4 w-4 text-accent-hover" />
                            Description
                          </div>
                          <p className="text-base leading-relaxed text-text-primary font-serif">
                            {summaryDisplayText}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    {!isImagePreview ? (
                      <pre className="whitespace-pre-wrap break-words text-base leading-6 text-text-primary font-serif">
                        {activePreview.previewContent || ''}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 w-full flex-col overflow-hidden p-5 xl:w-[55%]">
              {!isImagePreview ? (
                <>
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
                          {summaryStatus === 'error' && !isVideoIngestionUnavailable && onRetryFileSummary ? (
                            <div className="mt-4">
                              <button
                                type="button"
                                onClick={handleRetrySummary}
                                disabled={isRetryingSummary}
                                className="inline-flex items-center gap-2 rounded-lg border border-border-default bg-bg-elevated/60 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-text-secondary transition hover:border-accent/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isRetryingSummary ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                Retry
                              </button>
                              {summaryRetryError ? (
                                <p className="mt-2 text-xs font-semibold text-error">{summaryRetryError}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}

              <div className={`${isImagePreview ? '' : 'mt-4'} flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-elevated/40 p-1`}>
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

              <div className="mt-3 flex min-h-[18rem] flex-1 flex-col overflow-hidden rounded-2xl border border-border-default bg-bg-base/35">
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
                      {isVideoIngestionUnavailable ? (
                        <div className={`rounded-2xl border p-4 text-sm font-semibold ${isVideoIngestionError ? 'border-error/20 bg-error-subtle text-error' : 'border-accent-border bg-accent-subtle text-accent-hover'}`}>
                          {isVideoIngestionError ? (
                            ingestionError || 'Video ingestion failed. Delete and reupload this file to try again.'
                          ) : (
                            <span className="inline-flex items-center gap-2">
                              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                              {videoIngestionStatus}
                            </span>
                          )}
                        </div>
                      ) : activeFileChatMessages.map((message) => (
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
                                    disabled={isFileChatTyping || isVideoIngestionUnavailable}
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
                        placeholder={isVideoIngestionUnavailable ? 'Video is not indexed yet...' : 'Ask a grounded question...'}
                        disabled={isVideoIngestionUnavailable}
                        className="min-w-0 flex-1 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-semibold text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
                      />
                      <button
                        type="submit"
                        disabled={!fileChatInput.trim() || isFileChatTyping || isVideoIngestionUnavailable}
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
      {isAddYoutubeLinkModalOpen && notebook ? (
        <AddYoutubeLinkModal
          notebookName={notebook.name}
          onClose={() => setIsAddYoutubeLinkModalOpen(false)}
          onSubmit={handleAddYoutubeLink}
        />
      ) : null}
    </div>
  );
}
