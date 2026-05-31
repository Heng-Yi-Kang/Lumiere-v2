import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bot, FileText, Minimize2, Send, ShieldCheck, Sparkles, Trash2, Video, X } from 'lucide-react';
import { askGroundedNotebookChat } from '../lib/notebooksApi';
import { ChatGroundingScope, ChatMessage, GroundedChatRequest, Notebook } from '../types';

interface StudyBuddyProps {
  activeGroundingScope?: ChatGroundingScope;
  notebooks: Notebook[];
  preFilledRequest?: GroundedChatRequest | null;
  onClearPreFill?: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const initialPrompts = [
  'Summarize the uploaded files in this notebook',
  'What are the likely exam angles from this material?',
  'Make a revision checklist from the grounded context',
];

function createInitialMessage(): ChatMessage {
  return {
    id: 'buddy-init',
    role: 'assistant',
    text: "Hai student! I'm your virtual Study Buddy. Ask from inside a notebook to receive answers grounded in indexed notebook files.\n\nIf there are no uploaded or indexed files, I will say there is no grounded context.",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    suggestedPrompts: initialPrompts,
  };
}

export default function StudyBuddy({
  activeGroundingScope,
  notebooks,
  preFilledRequest,
  onClearPreFill,
  isOpen,
  setIsOpen,
}: StudyBuddyProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('lumiere_buddy_messages2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }

    return [createInitialMessage()];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scopeLabel = activeGroundingScope
    ? activeGroundingScope.fileName
      ? `Grounded on ${activeGroundingScope.fileName}`
      : `Grounded on ${activeGroundingScope.notebookName}`
    : 'No notebook grounding active';

  const notebookCountLabel = notebooks.length === 1 ? '1 notebook' : `${notebooks.length} notebooks`;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    localStorage.setItem('lumiere_buddy_messages2', JSON.stringify(messages));
  }, [messages, isTyping]);

  const buildNoContextMessage = (scope?: ChatGroundingScope) => {
    if (!scope?.notebookId) {
      return 'No grounded context is active. Open a notebook or use Ask AI on a notebook file before asking grounded questions.';
    }

    const fileLabel = scope.fileName ? ` for "${scope.fileName}"` : '';
    return `No grounded context is available${fileLabel} in "${scope.notebookName}". Upload and index at least one file in this notebook before asking grounded questions.`;
  };

  const handleSendMessage = async (textToSend: string, requestedScope?: ChatGroundingScope) => {
    if (!textToSend.trim() || isTyping) {
      return;
    }

    const scope = requestedScope || activeGroundingScope;
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    if (!scope?.notebookId) {
      const aiMsg: ChatMessage = {
        id: `buddy-${Date.now()}`,
        role: 'assistant',
        text: buildNoContextMessage(scope),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: [],
        grounded: false,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
      return;
    }

    try {
      const response = await askGroundedNotebookChat({
        fileId: scope.fileId,
        notebookId: scope.notebookId,
        question: textToSend,
      });

      const aiMsg: ChatMessage = {
        id: `buddy-${Date.now()}`,
        role: 'assistant',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: response.citations,
        grounded: response.grounded,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      const aiMsg: ChatMessage = {
        id: `buddy-${Date.now()}`,
        role: 'assistant',
        text: error instanceof Error ? error.message : 'Grounded chat failed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: [],
        grounded: false,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (preFilledRequest) {
      setIsOpen(true);
      void handleSendMessage(preFilledRequest.question, preFilledRequest.scope || activeGroundingScope);
      onClearPreFill?.();
    }
  }, [preFilledRequest]);

  const clearChatHistory = () => {
    if (window.confirm('Clear study buddy chat history?')) {
      setMessages([createInitialMessage()]);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="premium-focus fixed bottom-6 right-6 z-[100] flex h-14 w-14 items-center justify-center rounded-full border border-black/10 bg-ink-950 text-white shadow-[0_18px_45px_rgba(17,17,17,0.22)] transition-colors duration-200 hover:bg-ink-800"
        title="Ask Study Buddy"
        id="study-buddy-fab"
      >
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-gold text-[8px] font-black text-ink-950 font-mono">AI</span>
        </span>

        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <div className="relative">
            <Bot className="h-6 w-6 text-white" />
            <Sparkles className="absolute -top-1.5 -right-1.5 h-3 w-3 text-gold" />
          </div>
        )}
      </button>

      {isOpen && (
        <div
          id="study-buddy-panel"
          className="fixed bottom-24 right-6 z-[100] flex h-[520px] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-3xl border border-black/10 bg-white/85 text-left shadow-2xl backdrop-blur-2xl transition-opacity duration-200"
        >
          <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-gold/10 blur-2xl"></div>

          <div className="relative flex items-center justify-between border-b border-black/10 bg-white/65 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold-strong">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div>
                <h2 className="flex items-center gap-1 text-xs font-black uppercase tracking-wider text-ink-950 font-display leading-tight">
                  Tanya Study Buddy
                  <span className={`rounded-full border px-1 py-0.2 text-[8px] font-black ${
                    activeGroundingScope
                      ? 'bg-emerald-400/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-400/15 border-amber-500/30 text-amber-300'
                  }`}>
                    {activeGroundingScope ? 'Grounded' : 'No Context'}
                  </span>
                </h2>
                <p className="mt-0.5 text-[10px] leading-none text-ink-500">{scopeLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={clearChatHistory}
                className="premium-focus flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-black/5 hover:text-rose-700"
                title="Clear history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="premium-focus flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-black/5 hover:text-ink-950"
                title="Minimize Study Buddy"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 p-4 overflow-y-auto space-y-3 bg-transparent relative z-10"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed border ${
                  msg.role === 'user'
                    ? 'bg-ink-950 border-ink-950 text-white font-medium rounded-tr-xs'
                    : 'bg-white/70 border-black/10 text-ink-800 rounded-tl-xs'
                }`}>
                  <div className="mb-1.5 flex items-center justify-between border-b border-black/10 pb-1 text-[8.5px] font-extrabold uppercase tracking-wide text-ink-500 font-mono">
                    <span>{msg.role === 'user' ? 'You' : 'Buddy'}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap leading-relaxed space-y-1.5 font-semibold">
                    {msg.text}
                  </div>

                  {msg.role === 'assistant' && msg.grounded === false && (
                    <div className="mt-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[9px] font-bold text-amber-200">
                      No grounded context was used.
                    </div>
                  )}

                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-1">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5 font-mono">
                        <ShieldCheck className="h-3 w-3 text-emerald-400 text-glow-emerald" />
                        Grounded References:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {msg.citations.map((cite, i) => (
                          <div
                            key={`${cite.fileId}-${cite.position}-${i}`}
                            className="rounded border border-emerald-500/20 bg-emerald-500/5 px-1.5 py-0.5 text-[9px] font-extrabold text-emerald-300 flex items-center gap-1"
                          >
                            {cite.type === 'page' ? <FileText className="h-2.5 w-2.5 text-rose-450" /> : <Video className="h-2.5 w-2.5 text-blue-450" />}
                            <span className="truncate max-w-[110px]">{cite.fileName}</span>
                            <span className="bg-emerald-500/10 px-0.5 rounded-sm text-[8px] font-black font-mono">
                              {cite.position}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/5">
                      <span className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wide mb-1.5 font-mono">
                        Quick Grounded Shortcuts:
                      </span>
                      <div className="space-y-1.5">
                        {msg.suggestedPrompts.map((prompt, index) => (
                          <button
                            key={index}
                            onClick={() => void handleSendMessage(prompt)}
                            className="w-full text-left rounded-lg bg-white/5 hover:bg-white/[0.08] border border-white/5 hover:border-indigo-500/30 p-2 text-[9.5px] font-bold text-slate-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                          >
                            <span className="truncate pr-3">{prompt}</span>
                            <ArrowUpRight className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex w-full justify-start">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-2 px-3 shadow-xl flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase font-mono">retrieving context...</span>
                  <div className="flex gap-0.5">
                    <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce delay-100"></div>
                    <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce delay-200"></div>
                    <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce delay-300"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="relative z-10 border-t border-black/10 bg-white/65 p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSendMessage(inputText);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                id="buddy-input"
                value={inputText}
                onChange={(event) => setInputText(event.target.value)}
                placeholder={activeGroundingScope ? 'Ask grounded questions about this notebook...' : `Open a notebook for grounded chat (${notebookCountLabel})...`}
                className="premium-focus flex-1 rounded-2xl border border-black/10 bg-white/80 p-2.5 text-xs font-semibold text-ink-950 outline-none transition-colors placeholder:text-ink-500"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="premium-focus flex shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-ink-950 p-2.5 text-white shadow-lg transition-colors hover:bg-ink-800 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
