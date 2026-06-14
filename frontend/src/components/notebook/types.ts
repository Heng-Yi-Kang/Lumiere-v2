import type { Citation, ChatMessage, FileItem, Notebook, SavedChatReply } from '../../types';
import type { SupportedNotebookExtension } from '../../lib/notebookUpload';

export interface NotebookViewProps {
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
  onRenameFile?: (notebookId: string, fileId: string, name: string) => Promise<void> | void;
  onEditNotebook?: (notebook: Notebook) => void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onCreateNotebookRequested?: () => void;
}

export type UploadPhase = 'idle' | 'validating' | 'uploading' | 'extracting' | 'success';

export interface UploadQueueItem {
  id: string;
  name: string;
  extension: SupportedNotebookExtension;
  progress: number;
  status: 'queued' | 'validating' | 'uploading' | 'extracting' | 'done' | 'failed';
}

export interface PendingLink {
  id: string;
  kind: 'web' | 'youtube';
  progress: number;
  status: 'scraping' | 'done' | 'failed';
  url: string;
}

export interface SaveChatReplyInput {
  answer: string;
  citations: Citation[];
  fileId?: string;
  fileName?: string;
  question: string;
  replyKey: string;
  scopeType: 'notebook' | 'file';
}

export interface LatestSaveableFileReply {
  answer: string;
  citations: Citation[];
  question: string;
  replyId: string;
}

export type NotebookPanelTab = 'chat' | 'saved' | 'notes';
export type FileDetailTab = 'chat' | 'saved' | 'notes';

export type { ChatMessage, FileItem, Notebook, SavedChatReply };
