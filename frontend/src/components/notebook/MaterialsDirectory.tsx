import { Edit3, FolderOpen, Link as LinkIcon, LoaderCircle, ShieldCheck, Trash2, Upload, X, Youtube } from 'lucide-react';
import type { RefObject } from 'react';
import { NOTEBOOK_UPLOAD_ACCEPT } from '../../lib/notebookUpload';
import type { NotebookColorTone } from '../../lib/notebookColors';
import { NotebookUploadFileIcon } from '../NotebookUploadFileIcon';
import { ProgressBar } from '../ProgressBar';
import type { FileItem, PendingLink, UploadPhase, UploadQueueItem } from './types';
import { getFileIcon } from './notebookHelpers';

export function MaterialsDirectory({
  colorTone,
  fileInputRef,
  filteredFiles,
  handleOpenRename,
  handleUpload,
  isDeleting,
  isPendingLinkActive,
  isSearchActive,
  isWebLinkActive,
  isYoutubeLinkActive,
  onAddLink,
  onAddYoutubeLink,
  onRenameFile,
  pendingLink,
  pendingLinkStatusLabel,
  searchQuery,
  setIsAddLinkModalOpen,
  setIsAddYoutubeLinkModalOpen,
  setPendingDeleteFile,
  setSelectedMaterial,
  shouldShowUploadQueue,
  uploadPhase,
  uploadProgress,
  uploadQueue,
  uploadStatusLabel,
  uploadSummaryLabel,
  hasUploadFailure,
  isUploadActive,
}: {
  colorTone: NotebookColorTone | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  filteredFiles: FileItem[];
  handleOpenRename: (file: FileItem) => void;
  handleUpload: (files: File[]) => Promise<void>;
  hasUploadFailure: boolean;
  isDeleting: boolean;
  isPendingLinkActive: boolean;
  isSearchActive: boolean;
  isUploadActive: boolean;
  isWebLinkActive: boolean;
  isYoutubeLinkActive: boolean;
  onAddLink?: (notebookId: string, url: string) => Promise<void> | void;
  onAddYoutubeLink?: (notebookId: string, url: string) => Promise<void> | void;
  onRenameFile?: (notebookId: string, fileId: string, name: string) => Promise<void> | void;
  pendingLink: PendingLink | null;
  pendingLinkStatusLabel: string;
  searchQuery: string;
  setIsAddLinkModalOpen: (isOpen: boolean) => void;
  setIsAddYoutubeLinkModalOpen: (isOpen: boolean) => void;
  setPendingDeleteFile: (file: FileItem | null) => void;
  setSelectedMaterial: (file: FileItem | null) => void;
  shouldShowUploadQueue: boolean;
  uploadPhase: UploadPhase;
  uploadProgress: number;
  uploadQueue: UploadQueueItem[];
  uploadStatusLabel: string;
  uploadSummaryLabel: string;
}) {
  return (
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
                {onRenameFile ? (
                  <button
                    type="button"
                    aria-label={`Rename ${file.name}`}
                    title="Rename material"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleOpenRename(file);
                    }}
                    className={`rounded-xl border p-2.5 transition ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                ) : null}
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
        <div className="group relative">
          <button
            type="button"
            onClick={() => setIsAddLinkModalOpen(true)}
            disabled={uploadPhase !== 'idle' || isPendingLinkActive || !onAddLink}
            aria-label={isWebLinkActive ? 'Adding web link' : 'Add web link'}
            title={isWebLinkActive ? 'Adding web link' : 'Add web link'}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
          >
            {isWebLinkActive ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
          </button>
          <div className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {isWebLinkActive ? 'Adding web link' : 'Add web link'}
          </div>
        </div>
        <div className="group relative">
          <button
            type="button"
            onClick={() => setIsAddYoutubeLinkModalOpen(true)}
            disabled={uploadPhase !== 'idle' || isPendingLinkActive || !onAddYoutubeLink}
            aria-label={isYoutubeLinkActive ? 'Adding YouTube link' : 'Add YouTube link'}
            title={isYoutubeLinkActive ? 'Adding YouTube link' : 'Add YouTube link'}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-cta/20 bg-cta-subtle text-cta transition hover:bg-cta/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isYoutubeLinkActive ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
          </button>
          <div className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {isYoutubeLinkActive ? 'Adding YouTube link' : 'Add YouTube link'}
          </div>
        </div>
        <div className="group relative">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPhase !== 'idle'}
            aria-label={uploadPhase !== 'idle' ? 'Uploading files' : 'Upload files'}
            title={uploadPhase !== 'idle' ? 'Uploading files' : 'Upload files'}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
          >
            {uploadPhase !== 'idle' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </button>
          <div className="pointer-events-none absolute left-1/2 bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
            {uploadPhase !== 'idle' ? 'Uploading files' : 'Upload files'}
          </div>
        </div>
      </div>
    </div>
  );
}
