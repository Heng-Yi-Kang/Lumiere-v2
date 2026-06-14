import { RefObject, useEffect, useState } from 'react';
import {
  clearSavedChatReply,
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
      handleSaveChatReply,
      resetSavedReplies,
      setSavedChatReplyError,
    },
    state: {
      isSaveToastVisible,
      savedChatReplies,
      savedChatReplyClearing,
      savedChatReplyError,
      savedChatReplyKeys,
      savedChatReplyLoading,
      savingReplyKey,
    },
  };
}
