import { ChevronDown, FileText, LoaderCircle, Minimize2, X } from 'lucide-react';
import { useState } from 'react';
import NotebookChatPanel from '../NotebookChatPanel';
import { getFileIcon } from './notebookHelpers';
import type { FileItem, Notebook, SaveChatReplyInput } from './types';
import type { NotebookChatController } from './useNotebookChat';

function getStatusLabel(file: FileItem) {
  if (file.status === 'processing') {
    return 'Processing';
  }

  if (file.status === 'error') {
    return 'Ingestion failed';
  }

  if (file.summaryStatus === 'in-progress') {
    return 'Generating description';
  }

  if (file.summaryStatus === 'error') {
    return 'Description failed';
  }

  return 'Ready';
}

function MaterialsList({
  files,
  onOpenMaterial,
}: {
  files: FileItem[];
  onOpenMaterial: (file: FileItem) => void;
}) {
  if (files.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-default px-4 py-8 text-center text-sm text-text-muted">
        <FileText className="mx-auto mb-3 h-7 w-7" />
        No materials yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => {
        const statusLabel = getStatusLabel(file);

        return (
          <button
            key={file.id}
            type="button"
            onClick={() => onOpenMaterial(file)}
            className="flex w-full min-w-0 items-start gap-3 rounded-2xl border border-border-subtle bg-bg-elevated/35 p-3 text-left transition hover:border-accent/35 hover:bg-bg-elevated/65 focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            <span className="mt-0.5 rounded-xl border border-border-default bg-bg-elevated/70 p-2 text-text-secondary">
              {getFileIcon(file.type)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-text-primary">{file.name}</span>
              <span className="mt-1 flex flex-wrap gap-2 text-[10px] font-medium uppercase tracking-widest text-text-muted">
                <span>{file.type}</span>
                <span>{file.size}</span>
                <span>{file.uploadDate}</span>
                {file.siteName ? <span>{file.siteName}</span> : null}
                {file.totalPages ? <span>{file.totalPages} pages</span> : null}
                <span className={file.status === 'error' ? 'text-error' : file.status === 'processing' ? 'text-accent-hover' : ''}>
                  {file.status === 'processing' ? (
                    <span className="inline-flex items-center gap-1">
                      <LoaderCircle className="h-3 w-3 animate-spin" />
                      {statusLabel}
                    </span>
                  ) : statusLabel}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function NotebookChatFullscreenOverlay({
  chat,
  notebook,
  onAddLink,
  onClose,
  onOpenCitationSource,
  onOpenMaterial,
  onSaveReply,
  onUploadFile,
  savedReplyKeys,
  savingReplyKey,
}: {
  chat: NotebookChatController;
  notebook: Notebook;
  onAddLink?: () => void;
  onClose: () => void;
  onOpenCitationSource?: (fileId: string) => void;
  onOpenMaterial: (file: FileItem) => void;
  onSaveReply: (input: SaveChatReplyInput) => Promise<void>;
  onUploadFile?: () => void;
  savedReplyKeys: string[];
  savingReplyKey: string | null;
}) {
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-bg-base text-left text-text-primary">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border-subtle bg-bg-surface/95 px-4 py-3 md:px-6">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-text-primary font-display">{notebook.name}</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Fullscreen notebook chat</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated/70 text-text-secondary transition hover:border-accent/35 hover:text-text-primary"
          title="Close fullscreen chat"
          aria-label="Close fullscreen chat"
        >
          <Minimize2 className="hidden h-4 w-4 sm:block" />
          <X className="h-4 w-4 sm:hidden" />
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="min-h-0 border-b border-border-subtle bg-bg-surface/72 lg:border-b-0 lg:border-r">
          <button
            type="button"
            onClick={() => setIsMaterialsOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left lg:pointer-events-none lg:cursor-default lg:px-5 lg:py-5"
          >
            <span>
              <span className="block text-xs font-black uppercase tracking-widest text-text-primary">Materials</span>
              <span className="mt-1 block text-[11px] text-text-muted">{notebook.files.length} item{notebook.files.length === 1 ? '' : 's'}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-text-muted transition lg:hidden ${isMaterialsOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`${isMaterialsOpen ? 'block' : 'hidden'} max-h-64 overflow-y-auto px-4 pb-4 lg:block lg:max-h-none lg:min-h-0 lg:px-5 lg:pb-5`}>
            <MaterialsList files={notebook.files} onOpenMaterial={onOpenMaterial} />
          </div>
        </aside>

        <main className="min-h-0">
          <NotebookChatPanel
            chat={chat}
            color={notebook.color}
            hasFiles={notebook.files.length > 0}
            isFullscreen
            notebookName={notebook.name}
            onAddLink={onAddLink}
            onOpenCitationSource={onOpenCitationSource}
            onSaveReply={onSaveReply}
            onUploadFile={onUploadFile}
            savedReplyKeys={savedReplyKeys}
            savingReplyKey={savingReplyKey}
          />
        </main>
      </div>
    </div>
  );
}
