import { RefObject, useEffect, useState } from 'react';
import {
  clearSavedChatReply,
  deleteSavedChatReply,
  fetchSavedChatReply,
  saveChatReply,
} from '../../lib/notebooksApi';
import type { Notebook, SaveChatReplyInput, SavedChatReply } from './types';

export function useSavedNotebookReplies({
  notebook,
  saveToastTimeoutRef,
}: {
  notebook: Notebook | null;
  saveToastTimeoutRef: RefObject<number | null>;
}) {
  const [savedChatReplies, setSavedChatReplies] = useState<SavedChatReply[]>([]);
  const [savedChatReplyKeys, setSavedChatReplyKeys] = useState<string[]>([]);
  const [savingReplyKey, setSavingReplyKey] = useState<string | null>(null);
  const [savedChatReplyLoading, setSavedChatReplyLoading] = useState(false);
  const [savedChatReplyClearing, setSavedChatReplyClearing] = useState(false);
  const [deletingSavedChatReplyId, setDeletingSavedChatReplyId] = useState<string | null>(null);
  const [savedChatReplyError, setSavedChatReplyError] = useState('');
  const [isSaveToastVisible, setIsSaveToastVisible] = useState(false);

  useEffect(() => {
    return () => {
      if (saveToastTimeoutRef.current !== null) {
        window.clearTimeout(saveToastTimeoutRef.current);
      }
    };
  }, [saveToastTimeoutRef]);

  useEffect(() => {
    if (!notebook) {
      setSavedChatReplies([]);
      setSavedChatReplyLoading(false);
      return;
    }

    let isActive = true;
    setSavedChatReplyLoading(true);
    setSavedChatReplyError('');

    void fetchSavedChatReply(notebook.id)
      .then((reply) => {
        if (!isActive) {
          return;
        }

        setSavedChatReplies(reply);
        setSavedChatReplyKeys([]);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setSavedChatReplyError(error instanceof Error ? error.message : 'Failed to load saved answer.');
      })
      .finally(() => {
        if (isActive) {
          setSavedChatReplyLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [notebook?.id]);

  const resetSavedReplies = () => {
    setSavedChatReplies([]);
    setSavedChatReplyKeys([]);
    setSavedChatReplyError('');
  };

  const handleSaveChatReply = async (input: SaveChatReplyInput) => {
    if (!notebook || savingReplyKey) {
      return;
    }

    setSavingReplyKey(input.replyKey);
    setSavedChatReplyError('');

    try {
      const nextSavedChatReply = await saveChatReply(notebook.id, {
        answer: input.answer,
        citations: input.citations,
        fileId: input.fileId,
        fileName: input.fileName,
        question: input.question,
        scopeType: input.scopeType,
      });

      setSavedChatReplies((replies) => [nextSavedChatReply, ...replies]);
      setSavedChatReplyKeys((replyKeys) => Array.from(new Set([...replyKeys, input.replyKey])));
      setIsSaveToastVisible(true);
      if (saveToastTimeoutRef.current !== null) {
        window.clearTimeout(saveToastTimeoutRef.current);
      }
      saveToastTimeoutRef.current = window.setTimeout(() => {
        setIsSaveToastVisible(false);
        saveToastTimeoutRef.current = null;
      }, 2500);
    } catch (error) {
      setSavedChatReplyError(error instanceof Error ? error.message : 'Failed to save answer.');
    } finally {
      setSavingReplyKey(null);
    }
  };

  const handleClearSavedChatReply = async () => {
    if (!notebook || savedChatReplyClearing) {
      return;
    }

    setSavedChatReplyClearing(true);
    setSavedChatReplyError('');

    try {
      await clearSavedChatReply(notebook.id);
      setSavedChatReplies([]);
      setSavedChatReplyKeys([]);
    } catch (error) {
      setSavedChatReplyError(error instanceof Error ? error.message : 'Failed to clear saved answer.');
    } finally {
      setSavedChatReplyClearing(false);
    }
  };

  const handleDeleteSavedChatReply = async (replyId: string) => {
    if (!notebook || deletingSavedChatReplyId) {
      return;
    }

    setDeletingSavedChatReplyId(replyId);
    setSavedChatReplyError('');

    try {
      const deletedReply = savedChatReplies.find((reply) => reply.id === replyId);
      await deleteSavedChatReply(notebook.id, replyId);
      setSavedChatReplies((replies) => replies.filter((reply) => reply.id !== replyId));
      if (deletedReply?.scopeType === 'file' && deletedReply.fileId) {
        setSavedChatReplyKeys((replyKeys) => replyKeys.filter((replyKey) => !replyKey.startsWith(`file:${deletedReply.fileId}:`)));
      } else if (deletedReply?.scopeType === 'notebook') {
        setSavedChatReplyKeys((replyKeys) => replyKeys.filter((replyKey) => !replyKey.startsWith('notebook:')));
      }
    } catch (error) {
      setSavedChatReplyError(error instanceof Error ? error.message : 'Failed to delete saved answer.');
    } finally {
      setDeletingSavedChatReplyId(null);
    }
  };

  const dismissSaveToast = () => {
    setIsSaveToastVisible(false);
    if (saveToastTimeoutRef.current !== null) {
      window.clearTimeout(saveToastTimeoutRef.current);
      saveToastTimeoutRef.current = null;
    }
  };

  return {
    actions: {
      dismissSaveToast,
      handleClearSavedChatReply,
      handleDeleteSavedChatReply,
      handleSaveChatReply,
      resetSavedReplies,
      setSavedChatReplyError,
    },
    state: {
      isSaveToastVisible,
      deletingSavedChatReplyId,
      savedChatReplies,
      savedChatReplyClearing,
      savedChatReplyError,
      savedChatReplyKeys,
      savedChatReplyLoading,
      savingReplyKey,
    },
  };
}
