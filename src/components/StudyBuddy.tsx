import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Citation, Notebook } from '../types';
import { 
  Send, 
  Sparkles, 
  FileText, 
  Video, 
  HelpCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  X,
  Minimize2,
  Trash2,
  MessageSquare,
  Bot
} from 'lucide-react';

interface StudyBuddyProps {
  notebooks: Notebook[];
  preFilledQuestion?: string;
  onClearPreFill?: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export default function StudyBuddy({ 
  notebooks, 
  preFilledQuestion, 
  onClearPreFill,
  isOpen,
  setIsOpen 
}: StudyBuddyProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('lumiere_buddy_messages2');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return [
      {
        id: 'buddy-init',
        role: 'assistant',
        text: "Hai student! I'm your virtual Study Buddy 🎓 Ask me anything grounded in your university notebooks & syllabus material.\n\nSelect a study shortcut chip below, or ask any academic question!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedPrompts: [
          "Explain backpropagation using Mamak Teh Tarik recipe analogy ☕",
          "Explain De Morgan logic mathematically & give a Nasi Lemak example",
          "SSM Corporate Law: Explain Invitation to Treat using maggi goreng prices"
        ]
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll and save logs
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    localStorage.setItem('lumiere_buddy_messages2', JSON.stringify(messages));
  }, [messages, isTyping]);

  // Handle external prefill from other views
  useEffect(() => {
    if (preFilledQuestion) {
      setIsOpen(true);
      handleSendMessage(preFilledQuestion);
      if (onClearPreFill) onClearPreFill();
    }
  }, [preFilledQuestion]);

  const handleSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI synthesis with custom Malaysian grounding responses
    setTimeout(() => {
      const lowerText = textToSend.toLowerCase();
      let isAiTopic = lowerText.includes('backprop') || lowerText.includes('teh tarik') || lowerText.includes('hafi');
      let isMathTopic = lowerText.includes('morgan') || lowerText.includes('logic') || lowerText.includes('nasi lemak');
      let isLawTopic = lowerText.includes('invitation') || lowerText.includes('treat') || lowerText.includes('maggi') || lowerText.includes('ssm');

      let replyText = "Faham! Let me reference your active course materials to answer that.\n\n";
      let citations: Citation[] = [];

      if (isAiTopic) {
        replyText += "Here is the explanation for **Backpropagation and hyperparameter Learning Rate** using the **Teh Tarik formulation analogy**:\n\n1. **The weights (Our Ingredients)**: Think of your recipe parameters (the amount of condensed milk, tea density) as weights $W$. \n2. **The Loss (Unpleasant taste)**: If the pulled tea is too sweet, our loss score/error is high.\n3. **Backpropagation (Calculus feedback)**: Rather than randomly guessing new ratios, backprop calculates how much sweetness derivative came from the milk vs. the tea. Calculus ($\\partial C/\\partial W$) provides the optimal correction direction.\n4. **Learning Rate (Pour speed)**: Your $\\alpha$ learning rate governs how fast you adjust the ingredients. Pour too fast, you overshoot the local optimum and ruin the cup. Adjust too slowly, the customer gets impatient.\n\nThis maps directly to the video lecture segment (timestamp **0:16**).";
        citations = [
          { fileId: 'f-apu-ai2', fileName: 'My_AI_Project_Lecture_Dr_Hafizah.mp4', type: 'timestamp', position: '0:16' },
          { fileId: 'f-apu-ai1', fileName: 'APU_Intro_to_Neural_Networks_Slides.pdf', type: 'page', position: 'Page 12' }
        ];
      } else if (isMathTopic) {
        replyText += "Let's prove **De Morgan's Theorem** mathematically and map it to a **Nasi Lemak selection** logic table:\n\n1. **Theorem**: $\\neg(P \\land Q) \\equiv \\neg P \\lor \\neg Q$.\n2. **The Case**: Think of a diet rule 'You are NOT allowed to have BOTH (Santan Rice $P$ AND Spicy Sambal $Q$)' inside the health-safe pack. \n3. **Equivalent state**: This is identical to: 'You either do NOT have Santan Rice ($\\neg P$), OR you do NOT have Spicy Sambal ($\\neg Q$)'. As long as one criteria fails, the rule is fully satisfied!\n4. **Truth Table Verification**: Both $\\neg(P \\land Q)$ and $\\neg P \\lor \\neg Q$ evaluate to identical outputs across all binary variables, proving equivalence.";
        citations = [
          { fileId: 'f-um-m1', fileName: 'Lecture_1_Propositional_Calculus.pdf', type: 'page', position: 'Page 4' },
          { fileId: 'f-um-m2', fileName: 'Prof_Azmi_Set_Theory_Recording.mp3', type: 'timestamp', position: '1:13' }
        ];
      } else if (isLawTopic) {
        replyText += "Under **Section 2 of the Malaysian Contracts Act 1950**, displaying an item with a price tag is legally classified as an **Invitation to Treat** rather than a binding offer proposal:\n\n1. **The Mamak Cafe Scenario**: You view a banner citing *'Maggi Goreng Ayam RM7'* on the wall. This banner is legally just an *Invitation to Treat* (inviting negotiations). You cannot legally 'accept' the banner and lock a contract.\n2. **Proposal Stage**: When you order to the cashier: *'Anee, Maggie Goreng satu!'*, you are initiating the formal legal **Offer (Proposal)** under Section 2(a).\n3. **Acceptance Stage**: Only when the vendor begins cooking or replies *'Siap bos!'* does the **Acceptance** under Section 2(b) lock. Since displays are invitations, vendors have the right to refuse checkout if they run out of noodles, avoiding breach of contract suits.";
        citations = [
          { fileId: 'f-law1', fileName: 'Malaysian_Contracts_Act_1950_Full.pdf', type: 'page', position: 'Page 8' },
          { fileId: 'f-law2', fileName: 'Mamak_Stall_SST_Taxation_Law.pdf', type: 'page', position: 'Page 3' }
        ];
      } else {
        // Dynamic search answer based on context words
        replyText += `I've analyzed your question: "${textToSend}" against your uploaded academic material.\n\nHere are the critical takeaways formulated for you:\n\n`;
        replyText += `- **Syllabus Context**: Our curriculum notebooks indicate this topic crosses over with your core course expectations.\n`;
        replyText += `- **Main Insight**: A thorough breakdown reveals that optimizing this concept requires reviewing subset parameters, boundary variables, and your past tutorial notes.\n`;
        replyText += `- **Study Tip**: Your course lecturer advises focusing closely on proofs, core terms, and real-life analogies to secure full points in the final examination.\n\nLet me know if you would like me to draft an adaptive revision quiz on this!`;
        
        // Pick of mock notebooks citation
        citations = notebooks.length > 0 ? [
          { fileId: notebooks[0].id, fileName: notebooks[0].files[0]?.name || `${notebooks[0].courseCode}_Lecture_Notes.pdf`, type: 'page', position: 'Page 3' }
        ] : [
          { fileId: 'f-um-m1', fileName: 'Lecture_1_Propositional_Calculus.pdf', type: 'page', position: 'Page 2' }
        ];
      }

      const aiMsg: ChatMessage = {
        id: `buddy-${Date.now()}`,
        role: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: citations
      };

      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1100);
  };

  const clearChatHistory = () => {
    if (window.confirm("Clear study buddy chat history?")) {
      const init: ChatMessage[] = [
        {
          id: 'buddy-init',
          role: 'assistant',
          text: "Hai student! I'm your virtual Study Buddy 🎓 Ask me anything grounded in your university notebooks & syllabus material.\n\nSelect a study shortcut chip below, or ask any academic question!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedPrompts: [
            "Explain backpropagation using Mamak Teh Tarik recipe analogy ☕",
            "Explain De Morgan logic mathematically & give a Nasi Lemak example",
            "SSM Corporate Law: Explain Invitation to Treat using maggi goreng prices"
          ]
        }
      ];
      setMessages(init);
    }
  };

  return (
    <>
      {/* 2. Floating Action Button (FAB) (fixed on the lower right corner) */}
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

      {/* 3. Floating Interactive Chat Panel Dialog */}
      {isOpen && (
        <div 
          id="study-buddy-panel"
          className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-3rem)] h-[520px] rounded-3xl border border-white/10 bg-slate-950/90 backdrop-blur-2xl shadow-2xl flex flex-col z-[100] text-left overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-6 fade-in-20"
        >
          {/* Subtle Ambient Background Light */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          {/* Header area */}
          <div className="relative border-b border-white/10 bg-slate-950/40 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-300">
                <Sparkles className="h-4.5 w-4.5 text-glow-indigo animate-pulse" />
              </div>
              <div>
                <h2 className="text-xs font-black text-white flex items-center gap-1 font-display leading-tight uppercase tracking-wider">
                  Tanya Study Buddy
                  <span className="rounded-full bg-indigo-400/20 border border-indigo-500/30 px-1 py-0.2 text-[8px] font-black text-indigo-300">Grounded</span>
                </h2>
                <p className="text-[10px] text-slate-400 leading-none mt-0.5">Your personal Malaysian college AI buddy</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Clear History Button */}
              <button 
                onClick={clearChatHistory}
                className="h-7 w-7 rounded-md hover:bg-white/5 flex items-center justify-center text-slate-405 hover:text-rose-450 transition-colors cursor-pointer"
                title="Clear history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              
              {/* Minimize action button */}
              <button 
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 rounded-md hover:bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Minimize Study Buddy"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Interactive Chat messages thread scroll space */}
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
                  {/* Persona head bar */}
                  <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-white/5 text-[8.5px] text-slate-400 font-extrabold uppercase tracking-wide font-mono">
                    <span>{msg.role === 'user' ? 'You' : 'Buddy'}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message plain contents */}
                  <div className="whitespace-pre-wrap leading-relaxed space-y-1.5 font-semibold text-slate-300">
                    {msg.text}
                  </div>

                  {/* Grounded Citation details */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-1">
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-0.5 font-mono">
                        <ShieldCheck className="h-3 w-3 text-emerald-400 text-glow-emerald" />
                        Grounded References:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {msg.citations.map((cite, i) => (
                          <div 
                            key={i}
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

                  {/* suggested chips (only for first message) */}
                  {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-white/5">
                      <span className="block text-[8.5px] font-black text-slate-400 uppercase tracking-wide mb-1.5 font-mono">
                        ⚡ Quick University Shortcuts:
                      </span>
                      <div className="space-y-1.5">
                        {msg.suggestedPrompts.map((p, index) => (
                          <button
                            key={index}
                            onClick={() => handleSendMessage(p)}
                            className="w-full text-left rounded-lg bg-white/5 hover:bg-white/[0.08] border border-white/5 hover:border-indigo-500/30 p-2 text-[9.5px] font-bold text-slate-300 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                          >
                            <span className="truncate pr-3">{p}</span>
                            <ArrowUpRight className="h-3 w-3 text-indigo-400 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* AI Typing loader */}
            {isTyping && (
              <div className="flex w-full justify-start">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-2 px-3 shadow-xl flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold text-slate-400 uppercase font-mono">indexing notes...</span>
                  <div className="flex gap-0.5">
                    <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce delay-100"></div>
                    <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce delay-200"></div>
                    <div className="h-1 w-1 rounded-full bg-indigo-500 animate-bounce delay-300"></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Prompt inputs space footer */}
          <div className="border-t border-white/10 p-3 bg-slate-950/40 relative z-10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                id="buddy-input"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask Study Buddy simple maths, laws, slides..."
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
