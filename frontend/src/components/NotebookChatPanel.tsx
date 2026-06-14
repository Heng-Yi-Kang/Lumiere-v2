import React, { useEffect, useRef } from 'react';
import { Bookmark, BookmarkCheck, Link as LinkIcon, LoaderCircle, Maximize2, Send, Sparkles, StickyNote, Trash2, Upload } from 'lucide-react';
import { Citation } from '../types';
import { ChatMarkdown } from './ChatMarkdown';
import { CitationEvidenceList } from './CitationEvidenceList';
import { getNotebookColorTone } from '../lib/notebookColors';
import type { NotebookChatController } from './notebook/useNotebookChat';

interface NotebookChatPanelProps {
  chat: NotebookChatController;
  notebookName: string;
  color?: string;
  hasFiles?: boolean;
  isFullscreen?: boolean;
  savedReplyKeys?: string[];
  savingReplyKey?: string | null;
  onAddLink?: () => void;
  onExpand?: () => void;
  onSaveReply?: (input: {
    answer: string;
    citations: Citation[];
    question: string;
    replyKey: string;
    scopeType: 'notebook';
  }) => Promise<void> | void;
  onOpenCitationSource?: (fileId: string) => void;
  onUploadFile?: () => void;
}

export default function NotebookChatPanel({
  chat,
  notebookName,
  color,
  hasFiles = false,
  isFullscreen = false,
  savedReplyKeys = [],
  savingReplyKey,
  onAddLink,
  onExpand,
  onOpenCitationSource,
  onSaveReply,
  onUploadFile,
}: NotebookChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const colorTone = color ? getNotebookColorTone(color) : null;
  const {
    clearHistory,
    handleSend,
    input,
    isTyping,
    latestSaveableReply,
    messages,
    setInput,
  } = chat;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div className={`surface-card flex min-h-0 flex-col ${isFullscreen ? 'h-full rounded-none border-0 p-4 shadow-none md:p-6' : `h-[38rem] rounded-3xl p-5 md:p-6 ${colorTone?.borderGlow || ''}`}`}>
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${colorTone?.subtleBlock || 'border-cta/25 bg-cta-subtle text-cta'}`}>
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-text-primary font-display">Notebook Chat</h2>
            <p className="text-[10px] text-text-muted">Grounded on all notebook files</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {onExpand ? (
            <button
              onClick={onExpand}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              title="Expand chat"
              aria-label="Expand chat"
              type="button"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            onClick={clearHistory}
            disabled={!hasFiles}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
            title="Clear history"
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="my-3 min-h-0 flex-1 space-y-3 overflow-y-scroll rounded-2xl border border-border-default bg-bg-base/35 p-3"
      >
        {!hasFiles ? (
          <div className="flex min-h-full items-center justify-center">
            <div className={`w-full max-w-2xl rounded-[2rem] border p-6 md:p-7 ${colorTone?.subtleBlock || 'border-border-default bg-bg-elevated/40 text-text-primary'}`}>
              <div className="flex items-start gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover'}`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-text-primary font-display">This notebook is empty</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-secondary font-serif">
                    Add study material to <span className="font-bold text-text-primary">{notebookName}</span> before starting grounded chat. Upload a file or paste a web link to build the notebook context Lumiere can reference.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border-subtle bg-bg-elevated/40 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-text-primary font-mono">
                    <Upload className="h-4 w-4 text-accent-hover" />
                    Upload files
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                    Drop in PDFs, slides, documents, recordings, images, or plain text notes.
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-bg-elevated/40 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-text-primary font-mono">
                    <LinkIcon className="h-4 w-4 text-accent-hover" />
                    Paste web links
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                    Copy article or reference page URLs into the notebook to scrape and index them.
                  </p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-bg-elevated/40 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-text-primary font-mono">
                    <StickyNote className="h-4 w-4 text-accent-hover" />
                    Use notes
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                    After you add a file, open it and use the Notes tab to keep your own study notes beside the source.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onUploadFile}
                  disabled={!onUploadFile}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
                >
                  <Upload className="h-4 w-4" />
                  Upload file
                </button>
                <button
                  type="button"
                  onClick={onAddLink}
                  disabled={!onAddLink}
                  className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated/60 px-4 py-2.5 text-xs font-bold text-text-primary transition hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LinkIcon className="h-4 w-4" />
                  Add web link
                </button>
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const canSaveReply = latestSaveableReply?.replyId === msg.id && Boolean(onSaveReply);
            const replyKey = `notebook:${msg.id}`;
            const isSavingReply = savingReplyKey === replyKey;
            const isSavedReply = savedReplyKeys.includes(replyKey);

            return (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl border p-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'rounded-tr-sm border-accent bg-accent text-white'
                    : 'rounded-tl-sm border-border-subtle bg-bg-elevated/60 text-text-primary'
                }`}
              >
                {canSaveReply && latestSaveableReply ? (
                  <div className="mb-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void onSaveReply?.({
                        answer: latestSaveableReply.answer,
                        citations: latestSaveableReply.citations,
                        question: latestSaveableReply.question,
                        replyKey,
                        scopeType: 'notebook',
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

                {msg.role === 'assistant' ? (
                  <ChatMarkdown content={msg.text} />
                ) : (
                  <div className="whitespace-pre-wrap font-semibold leading-relaxed">{msg.text}</div>
                )}

                {msg.role === 'assistant' && msg.grounded === false ? (
                  <div className="mt-2 rounded-lg border border-cta/20 bg-cta-subtle px-2 py-1.5 text-[9px] font-bold text-cta">
                    No grounded notebook context was found.
                  </div>
                ) : null}

                {msg.citations && msg.citations.length > 0 ? (
                  <CitationEvidenceList citations={msg.citations} onOpenSource={onOpenCitationSource} />
                ) : null}

                {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-2">
                    {msg.suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void handleSend(prompt)}
                        disabled={isTyping}
                        className="w-full rounded-lg border border-border-subtle bg-bg-elevated/40 px-2 py-1.5 text-left text-[9.5px] font-bold text-text-secondary transition hover:border-accent/30 hover:bg-bg-elevated/70 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
          })
        )}
        {isTyping && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-border-subtle bg-bg-elevated/60 px-3 py-2 text-[9px] font-extrabold uppercase tracking-wide text-text-muted font-mono">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent-hover" />
              Retrieving grounded context
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend(input);
        }}
        className="flex items-center gap-2 border-t border-border-subtle bg-bg-elevated/35 p-3 rounded-2xl"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={hasFiles ? 'Ask across this notebook...' : 'Add files or web links to enable grounded chat'}
          disabled={!hasFiles}
          className="min-w-0 flex-1 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-semibold text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!hasFiles || !input.trim() || isTyping}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
