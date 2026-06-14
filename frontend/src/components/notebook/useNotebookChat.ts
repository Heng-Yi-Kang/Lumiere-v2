import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage, Citation } from '../../types';
import { getGroundedChatErrorMessage } from '../../lib/apiErrors';
import { askGroundedNotebookChatStream } from '../../lib/notebooksApi';

export interface LatestSaveableNotebookReply {
  answer: string;
  citations: Citation[];
  question: string;
  replyId: string;
}

export interface NotebookChatController {
  clearHistory: () => void;
  handleSend: (text: string) => Promise<void>;
  input: string;
  isTyping: boolean;
  latestSaveableReply: LatestSaveableNotebookReply | null;
  messages: ChatMessage[];
  setInput: (input: string) => void;
}

function getLatestSaveableReply(messages: ChatMessage[], isTyping: boolean) {
  if (isTyping) {
    return null;
  }

  for (let index = messages.length - 1; index >= 1; index -= 1) {
    const message = messages[index];
    const previousMessage = messages[index - 1];

    if (
      message.role === 'assistant' &&
      previousMessage?.role === 'user' &&
      message.id !== 'notebook-chat-init' &&
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

function createInitialMessage(notebookName: string): ChatMessage {
  return {
    id: 'notebook-chat-init',
    role: 'assistant',
    text: `Ask questions about "${notebookName}". Answers are grounded across all indexed files uploaded to this notebook and will show references when context is found.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    grounded: true,
    suggestedPrompts: [
      'Summarize the uploaded files in this notebook',
      'What are the likely exam angles from this material?',
      'Make a revision checklist from the grounded context',
    ],
  };
}

function loadMessages(notebookId: string, notebookName: string) {
  try {
    const saved = localStorage.getItem(`lumiere_notebook_grounded_chat_${notebookId}`);
    if (saved) {
      return JSON.parse(saved) as ChatMessage[];
    }
  } catch (_) {
    // ignore unreadable local chat state
  }

  return [createInitialMessage(notebookName)];
}

export function useNotebookChat({
  hasFiles,
  notebookId,
  notebookName,
}: {
  hasFiles: boolean;
  notebookId: string;
  notebookName: string;
}): NotebookChatController {
  const storageKey = `lumiere_notebook_grounded_chat_${notebookId}`;
  const [chatNotebookId, setChatNotebookId] = useState(notebookId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(notebookId, notebookName));
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setChatNotebookId(notebookId);
    setMessages(loadMessages(notebookId, notebookName));
    setInput('');
    setIsTyping(false);
  }, [notebookId, notebookName]);

  useEffect(() => {
    if (chatNotebookId !== notebookId) {
      return;
    }

    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [chatNotebookId, messages, notebookId, storageKey]);

  const latestSaveableReply = useMemo(
    () => getLatestSaveableReply(messages, isTyping),
    [isTyping, messages],
  );

  const handleSend = async (text: string) => {
    if (!hasFiles || !text.trim() || isTyping) {
      return;
    }

    const submittedQuestion = text.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: submittedQuestion,
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    const assistantMessageId = `bot-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      citations: [],
      grounded: true,
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await askGroundedNotebookChatStream(
        {
          notebookId,
          question: submittedQuestion,
        },
        {
          onDelta: (delta) => {
            setMessages((prev) => prev.map((message) => (
              message.id === assistantMessageId
                ? { ...message, text: `${message.text}${delta}` }
                : message
            )));
          },
        },
      );

      setMessages((prev) => prev.map((message) => (
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
      setMessages((prev) => prev.map((message) => (
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
      setIsTyping(false);
    }
  };

  const clearHistory = () => {
    if (!hasFiles) {
      return;
    }

    if (window.confirm('Clear chat history for this notebook?')) {
      setMessages([createInitialMessage(notebookName)]);
    }
  };

  return {
    clearHistory,
    handleSend,
    input,
    isTyping,
    latestSaveableReply,
    messages,
    setInput,
  };
}
