import { BookmarkCheck, MessageSquare, StickyNote } from 'lucide-react';
import type { RefObject } from 'react';
import FileNotesPanel from '../FileNotesPanel';
import NotebookChatPanel from '../NotebookChatPanel';
import { SavedAnswerPanel } from './SavedAnswerPanel';
import type {
  Notebook,
  NotebookPanelTab,
  SaveChatReplyInput,
  SavedChatReply,
} from './types';
import type { NotebookChatController } from './useNotebookChat';

export function NotebookStudyPanel({
  chat,
  fileInputRef,
  notebook,
  notebookPanelTab,
  onAddLink,
  onClearSavedChatReply,
  onDeleteSavedChatReply,
  onOpenCitationSource,
  onOpenFullscreenChat,
  onSaveReply,
  onUploadFile,
  notebookNotesApi,
  deletingSavedChatReplyId,
  savedChatReplies,
  savedChatReplyClearing,
  savedChatReplyError,
  savedChatReplyKeys,
  savedChatReplyLoading,
  savingReplyKey,
  setIsAddLinkModalOpen,
  setNotebookPanelTab,
}: {
  chat: NotebookChatController;
  fileInputRef: RefObject<HTMLInputElement | null>;
  notebook: Notebook;
  notebookPanelTab: NotebookPanelTab;
  onAddLink?: (notebookId: string, url: string) => Promise<void> | void;
  onClearSavedChatReply: () => void;
  onDeleteSavedChatReply: (replyId: string) => void;
  onOpenCitationSource?: (fileId: string) => void;
  onOpenFullscreenChat: () => void;
  onSaveReply: (input: SaveChatReplyInput) => Promise<void>;
  onUploadFile?: (notebookId: string, files: File[]) => Promise<void> | void;
  notebookNotesApi: ReturnType<typeof import('../../hooks/useNotebookNotes').useNotebookNotes>;
  deletingSavedChatReplyId: string | null;
  savedChatReplies: SavedChatReply[];
  savedChatReplyClearing: boolean;
  savedChatReplyError: string;
  savedChatReplyKeys: string[];
  savedChatReplyLoading: boolean;
  savingReplyKey: string | null;
  setIsAddLinkModalOpen: (isOpen: boolean) => void;
  setNotebookPanelTab: (tab: NotebookPanelTab) => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-bg-elevated/40 p-1">
        <button
          type="button"
          onClick={() => setNotebookPanelTab('chat')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${notebookPanelTab === 'chat' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary'}`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setNotebookPanelTab('saved')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${notebookPanelTab === 'saved' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary'}`}
        >
          <BookmarkCheck className="h-3.5 w-3.5" />
          Saved
        </button>
        <button
          type="button"
          onClick={() => setNotebookPanelTab('notes')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition ${notebookPanelTab === 'notes' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary'}`}
        >
          <StickyNote className="h-3.5 w-3.5" />
          Notes
        </button>
      </div>

      {notebookPanelTab === 'chat' ? (
        <NotebookChatPanel
          chat={chat}
          notebookName={notebook.name}
          color={notebook.color}
          hasFiles={notebook.files.length > 0}
          savedReplyKeys={savedChatReplyKeys}
          savingReplyKey={savingReplyKey}
          onAddLink={onAddLink ? () => setIsAddLinkModalOpen(true) : undefined}
          onExpand={onOpenFullscreenChat}
          onOpenCitationSource={onOpenCitationSource}
          onSaveReply={onSaveReply}
          onUploadFile={onUploadFile ? () => fileInputRef.current?.click() : undefined}
        />
      ) : notebookPanelTab === 'saved' ? (
        <div className="space-y-3">
          <SavedAnswerPanel
            deletingReplyId={deletingSavedChatReplyId}
            isClearing={savedChatReplyClearing}
            isLoading={savedChatReplyLoading}
            onClear={onClearSavedChatReply}
            onDelete={onDeleteSavedChatReply}
            onOpenCitationSource={onOpenCitationSource}
            savedChatReplies={savedChatReplies}
          />
          {savedChatReplyError ? (
            <div className="rounded-2xl border border-error/20 bg-error-subtle px-4 py-3 text-xs font-semibold text-error">
              {savedChatReplyError}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="surface-card flex min-h-[34rem] rounded-3xl p-0">
          <FileNotesPanel
            scopeId={notebook.id}
            scopeName={notebook.name}
            notes={notebookNotesApi.notes}
            isLoading={notebookNotesApi.isLoading}
            isMutating={notebookNotesApi.isMutating}
            error={notebookNotesApi.error}
            onRetry={() => {
              void notebookNotesApi.reloadNotes();
            }}
            notebookColor={notebook.color}
            title="Notebook Notes"
            countLabel={`${notebookNotesApi.notes.length} notebook note${notebookNotesApi.notes.length === 1 ? '' : 's'}`}
            emptyLabel="No notebook notes yet."
            onAdd={notebookNotesApi.addNote}
            onUpdate={notebookNotesApi.updateNote}
            onDelete={notebookNotesApi.deleteNote}
          />
        </div>
      )}
    </div>
  );
}
