import {
  Bookmark,
  BookmarkCheck,
  Bot,
  ChevronDown,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Image,
  LoaderCircle,
  MessageSquare,
  MonitorPlay,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import type { RefObject } from 'react';
import type { NotebookFilePreview } from '../../types';
import type { NotebookColorTone } from '../../lib/notebookColors';
import { ChatMarkdown } from '../ChatMarkdown';
import FileNotesPanel from '../FileNotesPanel';
import HlsVideoPlayer from '../HlsVideoPlayer';
import { LabeledProgressBar } from '../ProgressBar';
import type { ChatMessage, FileDetailTab, FileItem, LatestSaveableFileReply, Notebook, SaveChatReplyInput } from './types';
import { getFileIcon } from './notebookHelpers';

function VideoPlayerBlock({
  activePreview,
  selectedMaterial,
  selectedViewerUrl,
}: {
  activePreview: NotebookFilePreview;
  selectedMaterial: FileItem;
  selectedViewerUrl: string;
}) {
  return (
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
  );
}

function VideoIngestionNotice({
  ingestionError,
  isVideoIngestionError,
  videoIngestionProgress,
  videoIngestionStatus,
}: {
  ingestionError?: string;
  isVideoIngestionError: boolean;
  videoIngestionProgress: number;
  videoIngestionStatus: string;
}) {
  return (
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
  );
}

export function FilePreviewDrawer({
  activeFileChatMessages,
  activePreview,
  colorTone,
  fileChatInput,
  fileChatScrollRef,
  fileDetailTab,
  fileNoteApi,
  handleFileChatSubmit,
  handleOpenRename,
  handleRetrySummary,
  ingestionError,
  isDeleting,
  isFileChatTyping,
  isImagePreview,
  isRetryingSummary,
  isSummaryOpen,
  isVideoIngestionError,
  isVideoIngestionUnavailable,
  latestSaveableFileReply,
  notebook,
  onRenameFile,
  onRetryFileSummary,
  onSaveChatReply,
  previewError,
  previewLoading,
  savedChatReplyKeys,
  savingReplyKey,
  selectedMaterial,
  selectedViewerUrl,
  setFileChatInput,
  setFileDetailTab,
  setIsSummaryOpen,
  setPendingDeleteFile,
  setSelectedMaterial,
  summaryDisplayText,
  summaryRetryError,
  summaryStatus,
  videoIngestionProgress,
  videoIngestionStatus,
}: {
  activeFileChatMessages: ChatMessage[];
  activePreview?: NotebookFilePreview;
  colorTone: NotebookColorTone | null;
  fileChatInput: string;
  fileChatScrollRef: RefObject<HTMLDivElement | null>;
  fileDetailTab: FileDetailTab;
  fileNoteApi: ReturnType<typeof import('../../hooks/useFileNotes').useFileNotes>;
  handleFileChatSubmit: (question: string) => Promise<void>;
  handleOpenRename: (file: FileItem) => void;
  handleRetrySummary: () => Promise<void>;
  ingestionError?: string;
  isDeleting: boolean;
  isFileChatTyping: boolean;
  isImagePreview: boolean;
  isRetryingSummary: boolean;
  isSummaryOpen: boolean;
  isVideoIngestionError: boolean;
  isVideoIngestionUnavailable: boolean;
  latestSaveableFileReply: LatestSaveableFileReply | null;
  notebook: Notebook;
  onRenameFile?: (notebookId: string, fileId: string, name: string) => Promise<void> | void;
  onRetryFileSummary?: (notebookId: string, fileId: string) => Promise<void> | void;
  onSaveChatReply: (input: SaveChatReplyInput) => Promise<void>;
  previewError: string;
  previewLoading: boolean;
  savedChatReplyKeys: string[];
  savingReplyKey: string | null;
  selectedMaterial: FileItem;
  selectedViewerUrl?: string;
  setFileChatInput: (input: string) => void;
  setFileDetailTab: (tab: FileDetailTab) => void;
  setIsSummaryOpen: (update: (previous: boolean) => boolean) => void;
  setPendingDeleteFile: (file: FileItem | null) => void;
  setSelectedMaterial: (file: FileItem | null) => void;
  summaryDisplayText: string;
  summaryRetryError: string;
  summaryStatus: NotebookFilePreview['summaryStatus'] | FileItem['summaryStatus'];
  videoIngestionProgress: number;
  videoIngestionStatus: string;
}) {
  const isAudioPreview = selectedMaterial.type === 'audio';
  const isVideoPreview = selectedMaterial.type === 'video';
  const isLinkPreview = selectedMaterial.type === 'link';

  return (
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
              {onRenameFile ? (
                <button
                  type="button"
                  onClick={() => handleOpenRename(selectedMaterial)}
                  aria-label={`Rename ${selectedMaterial.name}`}
                  title="Rename material"
                  className={`ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              ) : null}
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

            {activePreview?.previewFormat === 'pdf' && selectedViewerUrl ? (
              <iframe
                title={activePreview.name}
                src={selectedViewerUrl}
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
                <VideoPlayerBlock
                  activePreview={activePreview}
                  selectedMaterial={selectedMaterial}
                  selectedViewerUrl={selectedViewerUrl}
                />
                {isVideoIngestionUnavailable ? (
                  <VideoIngestionNotice
                    ingestionError={ingestionError}
                    isVideoIngestionError={isVideoIngestionError}
                    videoIngestionProgress={videoIngestionProgress}
                    videoIngestionStatus={videoIngestionStatus}
                  />
                ) : null}
              </div>
            ) : null}

            {activePreview?.previewFormat === 'text' ? (
              <div className="space-y-4">
                {isVideoPreview && selectedViewerUrl ? (
                  <VideoPlayerBlock
                    activePreview={activePreview}
                    selectedMaterial={selectedMaterial}
                    selectedViewerUrl={selectedViewerUrl}
                  />
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
                  ) : activeFileChatMessages.map((message) => {
                    const canSaveReply = latestSaveableFileReply?.replyId === message.id;
                    const replyKey = `file:${selectedMaterial.id}:${message.id}`;
                    const isSavingReply = savingReplyKey === replyKey;
                    const isSavedReply = savedChatReplyKeys.includes(replyKey);

                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[88%] rounded-2xl border p-3 text-xs leading-relaxed ${
                          message.role === 'user'
                            ? 'rounded-tr-sm border-accent bg-accent text-white'
                            : 'rounded-tl-sm border-border-subtle bg-bg-elevated/60 text-text-primary'
                        }`}>
                          {canSaveReply && latestSaveableFileReply ? (
                            <div className="mb-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => void onSaveChatReply({
                                  answer: latestSaveableFileReply.answer,
                                  citations: latestSaveableFileReply.citations,
                                  fileId: selectedMaterial.id,
                                  fileName: selectedMaterial.name,
                                  question: latestSaveableFileReply.question,
                                  replyKey,
                                  scopeType: 'file',
                                })}
                                disabled={isSavingReply || isSavedReply}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border-subtle bg-bg-base/60 text-text-muted transition hover:border-accent/35 hover:text-accent-hover disabled:cursor-wait disabled:opacity-60"
                                title={isSavedReply ? 'Saved answer' : 'Save latest answer'}
                                aria-label={isSavedReply ? 'Saved answer' : 'Save latest answer'}
                              >
                                {isSavingReply ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : isSavedReply ? (
                                  <BookmarkCheck className="h-3.5 w-3.5 text-success" />
                                ) : (
                                  <Bookmark className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </div>
                          ) : null}

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
                    );
                  })}

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
                notebookColor={notebook.color}
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
  );
}
