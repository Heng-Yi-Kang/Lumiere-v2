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
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-fuchsia-500 border border-indigo-400/30 flex items-center justify-center text-white shadow-[0_0_25px_rgba(99,102,241,0.5)] cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300 z-[100] group hover:ring-2 hover:ring-indigo-300/50"
        title="Ask Study Buddy"
        id="study-buddy-fab"
      >
        <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 text-[8px] font-black text-slate-950 items-center justify-center font-mono">AI</span>
        </span>

        {isOpen ? (
          <X className="h-6 w-6 text-white group-hover:rotate-90 transition-transform duration-300" />
        ) : (
          <div className="relative">
            <Bot className="h-6 w-6 text-white group-hover:scale-110 transition-transform duration-300" />
            <Sparkles className="h-3 w-3 text-amber-300 absolute -top-1.5 -right-1.5 animate-pulse text-glow-sm" />
          </div>
        )}
      </button>

      {isOpen && (
        <div
          id="study-buddy-panel"
          className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[520px] rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-2xl shadow-2xl flex flex-col z-[100] text-left overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-6 fade-in-20"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative border-b border-white/10 bg-slate-950/40 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-300">
                <Sparkles className="h-4.5 w-4.5 text-glow-indigo animate-pulse" />
              </div>
              <div>
                <h2 className="text-xs font-black text-white flex items-center gap-1 font-display leading-tight uppercase tracking-wider">
                  Tanya Study Buddy
                  <span className={`rounded-full border px-1 py-0.2 text-[8px] font-black ${
                    activeGroundingScope
                      ? 'bg-emerald-400/15 border-emerald-500/30 text-emerald-300'
                      : 'bg-amber-400/15 border-amber-500/30 text-amber-300'
                  }`}>
                    {activeGroundingScope ? 'Grounded' : 'No Context'}
                  </span>
                </h2>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">{scopeLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={clearChatHistory}
                className="h-7 w-7 rounded-md hover:bg-white/5 flex items-center justify-center text-slate-405 hover:text-rose-450 transition-colors cursor-pointer"
                title="Clear history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 rounded-md hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                    ? 'bg-indigo-600 border-indigo-500/30 text-white font-medium rounded-tr-xs'
                    : 'bg-white/[0.03] border-white/5 text-slate-205 rounded-tl-xs'
                }`}>
                  <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-white/5 text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wide font-mono">
                    <span>{msg.role === 'user' ? 'You' : 'Buddy'}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap leading-relaxed space-y-1.5 font-semibold text-slate-300">
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

          <div className="border-t border-white/10 p-3 bg-slate-950/40 relative z-10">
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
                className="flex-1 rounded-xl border border-white/10 bg-slate-950/40 p-2.5 text-xs font-semibold text-slate-200 outline-none transition-all placeholder:text-slate-500 focus:border-indigo-500 focus:bg-slate-900/60"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="rounded-xl bg-indigo-600 p-2.5 text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center border border-indigo-400/20 shadow-lg shrink-0"
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
