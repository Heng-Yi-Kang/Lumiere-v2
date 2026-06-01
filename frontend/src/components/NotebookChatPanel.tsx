import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Send, Sparkles, Trash2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { ChatMarkdown } from './ChatMarkdown';
import { getNotebookColorTone } from '../lib/notebookColors';

interface NotebookChatPanelProps {
  notebookId: string;
  notebookName: string;
  color?: string;
}

const MOCK_REPLIES = [
  "I'm a frontend-only assistant, so I can't read your files — but keep going, you're doing great!",
  'Study tip: try teaching this topic to an imaginary friend. If you can explain it simply, you know it.',
  "Since I'm offline, I can't ground my answer in your notebook. For grounded help, open a file and use 'Ask This File'.",
  'Active recall beats re-reading every time. Close your notes and write down what you remember!',
  'Break your study into 25-minute Pomodoro chunks. Focus hard, then rest for 5 minutes.',
  'Mock mode: if you need real AI answers, click the floating Study Buddy button at the bottom right.',
];

function getMockReply(): string {
  return MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
}

function createInitialMessage(notebookName: string): ChatMessage {
  return {
    id: 'mock-init',
    role: 'assistant',
    text: `Welcome to "${notebookName}"! This is a frontend-only study space. Ask anything — I'll do my best to motivate and guide you.`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    suggestedPrompts: [
      'Give me a study tip',
      'How should I revise for exams?',
      'What is active recall?',
    ],
  };
}

export default function NotebookChatPanel({ notebookId, notebookName, color }: NotebookChatPanelProps) {
  const storageKey = `lumiere_notebook_chat_${notebookId}`;
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

  const handleSend = (text: string) => {
    if (!text.trim() || isTyping) {
      return;
    }
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    window.setTimeout(() => {
      const reply: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: getMockReply(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, reply]);
      setIsTyping(false);
    }, 800);
  };

  const clearHistory = () => {
    if (window.confirm('Clear chat history for this notebook?')) {
      setMessages([createInitialMessage(notebookName)]);
    }
  };

  return (
    <div className={`surface-card rounded-3xl p-5 md:p-6 flex flex-col h-full min-h-[520px] ${colorTone?.borderGlow || ''}`}>
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${colorTone?.subtleBlock || 'border-cta/25 bg-cta-subtle text-cta'}`}>
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-text-primary font-display">Notebook Chat</h2>
            <p className="text-[10px] text-text-muted">Frontend-only assistant</p>
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
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 my-3 rounded-2xl border border-border-default bg-bg-base/35"
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
              <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-white/10 pb-1 text-[8.5px] font-extrabold uppercase tracking-wide text-text-muted font-mono">
                <span>{msg.role === 'user' ? 'You' : 'Lumiere'}</span>
                <span>{msg.timestamp}</span>
              </div>
              {msg.role === 'assistant' ? (
                <ChatMarkdown content={msg.text} />
              ) : (
                <div className="whitespace-pre-wrap font-semibold leading-relaxed">{msg.text}</div>
              )}
              {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-2">
                  {msg.suggestedPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="w-full rounded-lg border border-border-subtle bg-bg-elevated/40 px-2 py-1.5 text-left text-[9.5px] font-bold text-text-secondary transition hover:border-accent/30 hover:bg-bg-elevated/70 hover:text-text-primary"
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
              Thinking...
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSend(input);
        }}
        className="flex items-center gap-2 border-t border-border-subtle bg-bg-elevated/35 p-3 rounded-2xl"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask anything..."
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
