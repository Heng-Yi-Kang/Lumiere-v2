import {
  BookOpen,
  FileText,
  Image,
  Link as LinkIcon,
  MonitorPlay,
  Volume2,
} from 'lucide-react';
import type { ChatMessage, FileItem, LatestSaveableFileReply, Notebook } from './types';
import type { NotebookFilePreview } from '../../types';
import { buildNotebookApiUrl } from '../../lib/notebooksApi';

export const SELECTED_FILE_REFRESH_INTERVAL_MS = 3000;
export const MAX_NOTEBOOK_FILE_NAME_LENGTH = 120;

export function getFileIcon(type: FileItem['type']) {
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

export function getViewerUrl(sourceUrl?: string) {
  if (!sourceUrl) {
    return undefined;
  }

  return buildNotebookApiUrl(sourceUrl);
}

export function normalizeSearchValue(value: string | undefined) {
  return value?.trim().toLowerCase() || '';
}

function fieldMatchesSearch(searchQuery: string, fields: Array<string | undefined>) {
  if (!searchQuery) {
    return true;
  }

  return fields.some((field) => field?.toLowerCase().includes(searchQuery));
}

export function fileMatchesSearch(file: FileItem, searchQuery: string) {
  return fieldMatchesSearch(searchQuery, [
    file.name,
    file.type,
    file.siteName,
    file.sourceUrl,
    file.summary,
  ]);
}

export function notebookMatchesSearch(notebook: Notebook, searchQuery: string) {
  return fieldMatchesSearch(searchQuery, [
    notebook.name,
    notebook.courseCode,
    notebook.courseLabel,
    notebook.description,
  ]);
}

export function countMatchingFiles(notebook: Notebook, searchQuery: string) {
  if (!searchQuery) {
    return notebook.files.length;
  }

  return notebook.files.filter((file) => fileMatchesSearch(file, searchQuery)).length;
}

export function hasPendingFileWork(file: Pick<FileItem | NotebookFilePreview, 'status' | 'summaryStatus'> | null | undefined) {
  return file?.status === 'processing' || file?.summaryStatus === 'in-progress';
}

export function createFileChatInitialMessage(fileName: string): ChatMessage {
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

export function formatSavedReplyDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Saved';
  }

  return date.toLocaleString([], {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

export function getLatestSaveableFileReply(
  messages: ChatMessage[],
  isTyping: boolean,
): LatestSaveableFileReply | null {
  if (isTyping) {
    return null;
  }

  for (let index = messages.length - 1; index >= 1; index -= 1) {
    const message = messages[index];
    const previousMessage = messages[index - 1];

    if (
      message.role === 'assistant' &&
      previousMessage?.role === 'user' &&
      !message.id.startsWith('file-chat-init-') &&
      !message.suggestedPrompts?.length &&
      message.grounded !== false &&
      message.text.trim()
    ) {
      return {
        answer: message.text,
        citations: message.citations || [],
        question: previousMessage.text,
        replyId: message.id,
      };
    }
  }

  return null;
}
