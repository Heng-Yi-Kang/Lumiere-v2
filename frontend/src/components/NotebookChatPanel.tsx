import React, { useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { ChatMarkdown } from './ChatMarkdown';
import { getNotebookColorTone } from '../lib/notebookColors';
import { askGroundedNotebookChat } from '../lib/notebooksApi';
import { getGroundedChatErrorMessage } from '../lib/apiErrors';

interface NotebookChatPanelProps {
  notebookId: string;
  notebookName: string;
  color?: string;
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

export default function NotebookChatPanel({ notebookId, notebookName, color }: NotebookChatPanelProps) {
  const storageKey = `lumiere_notebook_grounded_chat_${notebookId}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {
      // ignore
    }
    return [createInitialMessage(notebookName)];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const colorTone = color ? getNotebookColorTone(color) : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, isTyping, storageKey]);

  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping) {
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

    try {
      const response = await askGroundedNotebookChat({
        notebookId,
        question: submittedQuestion,
      });

      const assistantMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: response.citations,
        grounded: response.grounded,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: `bot-error-${Date.now()}`,
        role: 'assistant',
        text: getGroundedChatErrorMessage(error),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: [],
        grounded: false,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear chat history for this notebook?')) {
      setMessages([createInitialMessage(notebookName)]);
    }
  };

  return (
    <div className={`surface-card flex h-[38rem] min-h-0 flex-col rounded-3xl p-5 md:p-6 ${colorTone?.borderGlow || ''}`}>
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
        <button
          onClick={clearHistory}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-elevated hover:text-error"
          title="Clear history"
          type="button"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={scrollRef}
        className="my-3 min-h-0 flex-1 space-y-3 overflow-y-scroll rounded-2xl border border-border-default bg-bg-base/35 p-3"
      >
        {messages.map((msg) => (
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
                <div className="mt-2.5 border-t border-border-subtle pt-2">
                  <div className="mb-1.5 flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-success font-mono">
                    <ShieldCheck className="h-3 w-3" />
                    Grounded references
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {msg.citations.map((citation, index) => (
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
        ))}
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
          placeholder="Ask across this notebook..."
          className="min-w-0 flex-1 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-semibold text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={!input.trim() || isTyping}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
