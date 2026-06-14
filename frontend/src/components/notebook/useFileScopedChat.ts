import { RefObject, useEffect, useMemo, useState } from 'react';
import { getGroundedChatErrorMessage } from '../../lib/apiErrors';
import { askGroundedNotebookChatStream } from '../../lib/notebooksApi';
import type { ChatMessage, FileItem, Notebook } from './types';
import {
  createFileChatInitialMessage,
  getLatestSaveableFileReply,
} from './notebookHelpers';

export function useFileScopedChat({
  fileChatScrollRef,
  isVideoIngestionUnavailable,
  notebook,
  selectedMaterial,
}: {
  fileChatScrollRef: RefObject<HTMLDivElement | null>;
  isVideoIngestionUnavailable: boolean;
  notebook: Notebook | null;
  selectedMaterial: FileItem | null;
}) {
  const [fileChatMessagesById, setFileChatMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [fileChatInput, setFileChatInput] = useState('');
  const [isFileChatTyping, setIsFileChatTyping] = useState(false);

  useEffect(() => {
    if (!selectedMaterial) {
      setFileChatInput('');
      return;
    }

    setFileChatMessagesById((current) => {
      if (current[selectedMaterial.id]) {
        return current;
      }

      return {
        ...current,
        [selectedMaterial.id]: [createFileChatInitialMessage(selectedMaterial.name)],
      };
    });
    setFileChatInput('');
  }, [selectedMaterial]);

  useEffect(() => {
    if (!fileChatScrollRef.current) {
      return;
    }

    fileChatScrollRef.current.scrollTop = fileChatScrollRef.current.scrollHeight;
  }, [fileChatScrollRef, fileChatMessagesById, isFileChatTyping, selectedMaterial?.id]);

  const activeFileChatMessages = useMemo(
    () => selectedMaterial ? fileChatMessagesById[selectedMaterial.id] || [] : [],
    [fileChatMessagesById, selectedMaterial],
  );
  const latestSaveableFileReply = getLatestSaveableFileReply(activeFileChatMessages, isFileChatTyping);

  const updateFileChatMessages = (fileId: string, update: (messages: ChatMessage[]) => ChatMessage[]) => {
    setFileChatMessagesById((current) => {
      const existingMessages = current[fileId] || [];
      return {
        ...current,
        [fileId]: update(existingMessages),
      };
    });
  };

  const handleFileChatSubmit = async (question: string) => {
    if (!notebook || !selectedMaterial || !question.trim() || isFileChatTyping || isVideoIngestionUnavailable) {
      return;
    }

    const file = selectedMaterial;
    const submittedQuestion = question.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMessage: ChatMessage = {
      id: `file-chat-user-${Date.now()}`,
      role: 'user',
      text: submittedQuestion,
      timestamp,
    };

    updateFileChatMessages(file.id, (messages) => [...messages, userMessage]);
    setFileChatInput('');
    setIsFileChatTyping(true);

    const assistantMessageId = `file-chat-assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      citations: [],
      grounded: true,
    };

    updateFileChatMessages(file.id, (messages) => [...messages, assistantMessage]);

    try {
      const response = await askGroundedNotebookChatStream(
        {
          fileId: file.id,
          notebookId: notebook.id,
          question: submittedQuestion,
        },
        {
          onDelta: (delta) => {
            updateFileChatMessages(file.id, (messages) => messages.map((message) => (
              message.id === assistantMessageId
                ? { ...message, text: `${message.text}${delta}` }
                : message
            )));
          },
        },
      );

      updateFileChatMessages(file.id, (messages) => messages.map((message) => (
        message.id === assistantMessageId
          ? {
              ...message,
              citations: response.citations,
              grounded: response.grounded,
              text: response.answer,
            }
          : message
      )));
    } catch (error) {
      updateFileChatMessages(file.id, (messages) => messages.map((message) => (
        message.id === assistantMessageId
          ? {
              ...message,
              citations: [],
              grounded: false,
              text: getGroundedChatErrorMessage(error),
            }
          : message
      )));
    } finally {
      setIsFileChatTyping(false);
    }
  };

  const updateRenamedFileChat = (file: FileItem, trimmedName: string) => {
    const previousName = file.name;

    setFileChatMessagesById((current) => {
      const messages = current[file.id];

      if (!messages) {
        return current;
      }

      return {
        ...current,
        [file.id]: messages.map((message) => ({
          ...message,
          id: message.id === `file-chat-init-${previousName}` ? `file-chat-init-${trimmedName}` : message.id,
          text: message.id === `file-chat-init-${previousName}`
            ? createFileChatInitialMessage(trimmedName).text
            : message.text,
          citations: message.citations?.map((citation) => citation.fileId === file.id
            ? { ...citation, fileName: trimmedName }
            : citation),
        })),
      };
    });
  };

  return {
    actions: {
      handleFileChatSubmit,
      setFileChatInput,
      updateRenamedFileChat,
    },
    state: {
      activeFileChatMessages,
      fileChatInput,
      isFileChatTyping,
      latestSaveableFileReply,
    },
  };
}
