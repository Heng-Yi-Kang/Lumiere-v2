import { BookmarkCheck, ChevronRight, FileText, LoaderCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { ChatMarkdown } from '../ChatMarkdown';
import type { SavedChatReply } from './types';
import { formatSavedReplyDate } from './notebookHelpers';

export function SavedAnswerPanel({
  isClearing,
  isLoading,
  onClear,
  savedChatReplies,
}: {
  isClearing: boolean;
  isLoading: boolean;
  onClear: () => void;
  savedChatReplies: SavedChatReply[];
}) {
  return (
    <div className="surface-card rounded-3xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-text-primary font-mono">
            <BookmarkCheck className="h-4 w-4 text-success" />
            Saved answer
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {savedChatReplies.length > 0 ? `${savedChatReplies.length} saved answer${savedChatReplies.length === 1 ? '' : 's'}` : 'Save completed AI answers from notebook or file chat.'}
          </p>
        </div>
        {savedChatReplies.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            disabled={isClearing}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-elevated hover:text-error disabled:cursor-wait disabled:opacity-50"
            title="Clear saved answers"
            aria-label="Clear saved answers"
          >
            {isClearing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border-subtle bg-bg-elevated/40 px-3 py-3 text-xs font-semibold text-text-muted">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading saved answers
        </div>
      ) : savedChatReplies.length > 0 ? (
        <div className="mt-4 space-y-2">
          {savedChatReplies.map((savedChatReply) => (
            <details
              key={savedChatReply.id}
              className="group rounded-2xl border border-border-subtle bg-bg-elevated/35"
            >
              <summary className="flex cursor-pointer list-none items-start gap-3 p-3 marker:hidden">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-bg-base/60 text-text-muted">
                  <ChevronRight className="h-3.5 w-3.5 transition group-open:rotate-90" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold leading-relaxed text-text-primary">
                    {savedChatReply.question}
                  </span>
                  <span className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-text-muted font-mono">
                    <span>{formatSavedReplyDate(savedChatReply.updatedAt)}</span>
                    <span className="h-1 w-1 rounded-full bg-border-default" />
                    <span className="inline-flex min-w-0 items-center gap-1">
                      <FileText className="h-3 w-3 shrink-0 text-accent-hover" />
                      <span className="truncate">
                        {savedChatReply.scopeType === 'file' ? savedChatReply.fileName || 'Unknown file' : 'Notebook-wide'}
                      </span>
                    </span>
                  </span>
                </span>
              </summary>
              <div className="space-y-3 border-t border-border-subtle px-3 pb-3 pt-3">
                <div className="rounded-2xl border border-border-subtle bg-bg-base/35 p-3">
                  <div className="text-[10px] font-black uppercase tracking-wider text-text-muted font-mono">Question</div>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-text-primary">{savedChatReply.question}</p>
                </div>
                <div className="rounded-2xl border border-border-subtle bg-bg-base/45 p-3">
                  <ChatMarkdown content={savedChatReply.answer} />
                </div>
                {savedChatReply.citations.length > 0 ? (
                  <div className="rounded-2xl border border-success/20 bg-success-subtle/40 p-3">
                    <div className="mb-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-success font-mono">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Grounded references
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {savedChatReply.citations.map((citation, index) => (
                        <span
                          key={`${citation.fileId}-${citation.position}-${index}`}
                          className="inline-flex max-w-full items-center gap-1 rounded border border-success/20 bg-bg-base/40 px-1.5 py-0.5 text-[9px] font-extrabold text-success"
                        >
                          <FileText className="h-2.5 w-2.5 shrink-0" />
                          <span className="max-w-[140px] truncate">{citation.fileName}</span>
                          <span className="rounded-sm bg-success/10 px-0.5 font-mono text-[8px]">{citation.position}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border-default bg-bg-elevated/25 p-4 text-sm leading-relaxed text-text-secondary">
          No answers are saved for this notebook yet.
        </div>
      )}
    </div>
  );
}
