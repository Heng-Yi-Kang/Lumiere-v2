import React, { useState } from 'react';
import { Flashcard, QuizQuestion, Course } from '../types';
import { 
  CheckSquare, 
  BookMarked, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCcw, 
  CheckCircle, 
  XCircle, 
  Sparkles, 
  Award,
  BookOpen,
  ArrowRight,
  ThumbsUp,
  HelpCircle,
  GraduationCap
} from 'lucide-react';

interface RevisionViewProps {
  flashcards: Record<string, Flashcard[]>;
  quizzes: Record<string, QuizQuestion[]>;
  courses: Course[];
  onAskInChat: (question: string) => void;
}

export default function RevisionView({ flashcards, quizzes, courses, onAskInChat }: RevisionViewProps) {
  const [activeCourseId, setActiveCourseId] = useState<string>(courses[0]?.id || '');

  // Flashcards state
  const activeCourseCode = courses.find(c => c.id === activeCourseId)?.code.toLowerCase() || '';
  const currentFlashcards = flashcards[activeCourseCode] || [];
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcConfidenceHistory, setFcConfidenceHistory] = useState<Record<string, 'weak' | 'moderate' | 'strong'>>({});

  // Quiz state
  const currentQuizzes = quizzes[activeCourseCode] || [];
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({}); // questionId -> chosenOptionIndex
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({}); // questionId -> submitted state

  const activeFC = currentFlashcards[fcIndex];

  // Grade calculators
  const calculateScoreCard = () => {
    if (currentQuizzes.length === 0) return { score: 0, grade: 'N/A', rating: 'Syllabus Not Ready' };
    let correct = 0;
    let attempted = 0;

    currentQuizzes.forEach(q => {
      if (quizSubmitted[q.id]) {
        attempted++;
        if (quizAnswers[q.id] === q.correctAnswer) {
          correct++;
        }
      }
    });

    if (attempted === 0) return { score: 0, grade: 'Idle', rating: 'Ready to Test!' };
    const pct = (correct / currentQuizzes.length) * 100;

    if (pct >= 85) return { score: pct, grade: 'A+ (Excellent Dean\'s List)', rating: 'Highly Mastered!' };
    if (pct >= 70) return { score: pct, grade: 'A- (Very Good)', rating: 'Passing standards' };
    if (pct >= 50) return { score: pct, grade: 'B (Average)', rating: 'Keep reading slides' };
    return { score: pct, grade: 'C (Needs Work)', rating: 'Urgent revision required!' };
  };

  const scorecard = calculateScoreCard();

  const handleConfidenceRating = (id: string, rating: 'weak' | 'moderate' | 'strong') => {
    setFcConfidenceHistory(prev => ({ ...prev, [id]: rating }));
    setFcFlipped(false);
    // Auto advance card index
    if (fcIndex < currentFlashcards.length - 1) {
      setFcIndex(prev => prev + 1);
    } else {
      setFcIndex(0); // loop
    }
  };

  const handleSelectOption = (qId: string, optIndex: number) => {
    if (quizSubmitted[qId]) return; // locked
    setQuizAnswers(prev => ({ ...prev, [qId]: optIndex }));
  };

  const handleSubmitQuestion = (qId: string) => {
    if (quizAnswers[qId] === undefined) return;
    setQuizSubmitted(prev => ({ ...prev, [qId]: true }));
  };

  const handleResetQuiz = () => {
    setQuizAnswers({});
    setQuizSubmitted({});
  };

  return (
    <div className="space-y-6 text-left relative z-10">
      {/* Revision Engine Header */}
      <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-white flex items-center gap-2 font-display">
            <CheckSquare className="h-5.5 w-5.5 text-indigo-400" />
            Smart Revision Engine & Active Quizzes
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Validate retention of syllabus concepts using active recall flashcards and diagnostic examinations.
          </p>
        </div>

        {/* Dynamic selector for active course modules */}
        <div className="flex items-center gap-2">
          <label htmlFor="course-select-revision" className="text-[11px] font-bold tracking-wider text-slate-400 uppercase font-mono">
            Active Module:
          </label>
          <select
            id="course-select-revision"
            value={activeCourseId}
            onChange={(e) => {
              setActiveCourseId(e.target.value);
              setFcIndex(0);
              setFcFlipped(false);
            }}
            className="rounded-lg border border-white/10 bg-slate-950/50 py-1.5 pr-8 pl-3 text-xs font-semibold text-slate-250 focus:border-indigo-400 outline-none cursor-pointer"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0f172a] text-slate-200">
                ({c.code}) {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of tools: left interactive flashcard, right quizzes */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Flashcard Component Deck */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between">
          <div className="border-b border-white/5 pb-2 mb-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1 font-mono">
                <BookMarked className="h-4 w-4 text-indigo-400" />
                Spaced Repetition Flashcards
              </h2>
              <p className="text-[10px] text-slate-500 font-mono">Flip card to test memory recall confidence.</p>
            </div>
            
            <span className="text-xs font-bold text-slate-400 font-mono">
              {currentFlashcards.length > 0 ? `${fcIndex + 1} / ${currentFlashcards.length}` : '0 / 0'} cards
            </span>
          </div>

          {currentFlashcards.length > 0 && activeFC ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              {/* Actual Flippable Flashcard Canvas */}
              <div 
                onClick={() => setFcFlipped(!fcFlipped)}
                className={`min-h-[220px] rounded-2xl border p-6 flex flex-col justify-between transition-all duration-300 cursor-pointer text-center relative overflow-hidden select-none ${
                  fcFlipped 
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/5' 
                    : 'border-white/10 bg-white/5 hover:bg-white/[0.08] hover:shadow-2xl'
                }`}
              >
                {/* Visual Watermark indicator depending on state */}
                <div className="absolute top-3 left-4 text-[8.5px] font-black tracking-widest text-slate-400 uppercase font-mono">
                  {fcFlipped ? 'RECALL ANSWER' : 'Recall Query'}
                </div>

                {/* Question Front or Answer Back */}
                <div className="my-auto py-4 space-y-4">
                  {!fcFlipped ? (
                    <p className="text-sm font-extrabold text-white leading-relaxed font-display">
                      {activeFC.front}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Technical Back answer */}
                      <p className="text-xs font-semibold text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {activeFC.back}
                      </p>

                      {/* Relatable Local Malaysian translated study Tip! */}
                      {activeFC.translatedBack && (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-[10.5px] leading-relaxed text-amber-200 text-left font-medium">
                          💡 <span className="font-extrabold text-amber-300">Local Study Tip:</span> {activeFC.translatedBack}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Flip callout reminder inside footer */}
                <div className="text-[10px] text-slate-500 font-bold flex items-center justify-center gap-1.5 pt-2 border-t border-white/5 font-mono">
                  <RefreshCcw className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Click to Flip Card</span>
                </div>
              </div>

              {/* Confidence rating tools buttons - directly affects Box progression */}
              <div className="space-y-3">
                <span className="block text-center text-[10.5px] font-extrabold text-slate-405 uppercase font-mono">
                  RATE YOUR MEMORY CONFIDENCE (Spaced Rep):
                </span>
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleConfidenceRating(activeFC.id, 'weak')}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 p-2.5 text-xs font-bold text-red-300 transition-colors flex flex-col items-center justify-center cursor-pointer"
                  >
                    <span>Again (Weak)</span>
                    <span className="text-[9px] font-normal text-red-400 font-mono mt-0.5">Review tonight</span>
                  </button>

                  <button
                    onClick={() => handleConfidenceRating(activeFC.id, 'moderate')}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/10 hover:bg-amber-500/20 p-2.5 text-xs font-bold text-amber-350 transition-colors flex flex-col items-center justify-center cursor-pointer"
                  >
                    <span>Moderate</span>
                    <span className="text-[9px] font-normal text-amber-400 font-mono mt-0.5">Review 3 days</span>
                  </button>

                  <button
                    onClick={() => handleConfidenceRating(activeFC.id, 'strong')}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 p-2.5 text-xs font-bold text-emerald-300 transition-colors flex flex-col items-center justify-center cursor-pointer"
                  >
                    <span>Mastered! ✓</span>
                    <span className="text-[9px] font-normal text-emerald-400 font-mono mt-0.5">Box 5 Lock</span>
                  </button>
                </div>

                {/* Confidence tracking bar */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1 pt-2">
                  <span>Current Card Status:</span>
                  <span className="font-extrabold text-[#10b981] block bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/15 font-mono">
                    {fcConfidenceHistory[activeFC.id] ? `Level: ${fcConfidenceHistory[activeFC.id].toUpperCase()}` : 'NEW (UNREVIEWED)'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-xs text-slate-500 font-mono">
              No flashcards uploaded for this course code. Drop syllabus files to auto-compile memory sets!
            </div>
          )}
        </div>

        {/* Quizzing exam deck terminal */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2 mb-2 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1 font-mono">
                <Award className="h-4.5 w-4.5 text-indigo-400" />
                Adaptive Syllabus Examination
              </h2>
              <p className="text-[10px] text-slate-500 font-mono">Multiple choice queries with custom grading algorithms.</p>
            </div>

            <button
              onClick={handleResetQuiz}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-mono"
            >
              Reset Quiz Paper
            </button>
          </div>

          {currentQuizzes.length > 0 ? (
            <div className="space-y-6 flex-1 overflow-y-auto max-h-[350px] pr-1">
              {currentQuizzes.map((q, qIndex) => {
                const isAnsChosen = quizAnswers[q.id] !== undefined;
                const isSub = quizSubmitted[q.id];
                const selectedOpt = quizAnswers[q.id];

                return (
                  <div key={q.id} className="rounded-2xl border border-white/5 p-4 space-y-3 relative text-left bg-slate-950/20 backdrop-blur-sm shadow-sm">
                    <span className="absolute top-3 right-4 text-[9px] font-black text-slate-500 uppercase font-mono">
                      Question {qIndex + 1}
                    </span>

                    <h3 className="text-xs font-extrabold text-white max-w-[85%] leading-relaxed font-display">
                      {q.question}
                    </h3>

                    {/* Options checkboxes mapping */}
                    <div className="space-y-2 font-semibold">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selectedOpt === oIdx;
                        const isCorrect = q.correctAnswer === oIdx;

                        let pillBorder = 'border-white/10 bg-[#0f172a]/20 hover:bg-[#0f172a]/40 text-slate-300';
                        if (isSelected) pillBorder = 'border-indigo-400 bg-indigo-500/20 text-indigo-200 font-bold';
                        
                        if (isSub) {
                          if (isCorrect) {
                            pillBorder = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-extrabold';
                          } else if (isSelected) {
                            pillBorder = 'border-red-500/40 bg-red-500/10 text-red-300';
                          } else {
                            pillBorder = 'border-white/5 bg-slate-950/40 text-slate-600 opacity-40';
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            onClick={() => handleSelectOption(q.id, oIdx)}
                            disabled={isSub}
                            className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-xs text-left transition-all cursor-pointer ${pillBorder}`}
                          >
                            <span>{opt}</span>
                            {isSub && isCorrect && <CheckCircle className="h-4 w-4 text-emerald-450 shrink-0" />}
                            {isSub && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-red-450 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Submit confirmation button */}
                    {!isSub ? (
                      <button
                        onClick={() => handleSubmitQuestion(q.id)}
                        disabled={!isAnsChosen}
                        className="rounded-xl bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-500 transition-all disabled:opacity-30 uppercase tracking-widest flex items-center gap-1 cursor-pointer border border-indigo-400/20 shadow-md shadow-indigo-600/10 font-mono"
                      >
                        <span>Verify Answer</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ) : (
                      /* Highlight Explanation and Local Analogy! */
                      <div className="mt-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-4 space-y-3 text-[11px] leading-relaxed text-slate-300 shadow-inner">
                        <div>
                          <span className="font-extrabold text-indigo-300 block uppercase text-[9.5px] font-mono">Syllabus Explanation:</span>
                          <p className="text-slate-200 mt-0.5">{q.explanation}</p>
                        </div>

                        {q.malaysianAnalogy && (
                          <div className="border-t border-indigo-500/20 pt-3 mt-3">
                            <span className="font-extrabold text-emerald-400 block uppercase text-[9.5px] flex items-center gap-1 font-mono">
                              <Sparkles className="h-3.5 w-3.5 text-emerald-400 text-glow-emerald" />
                              Local Analogy:
                            </span>
                            <p className="text-emerald-300 font-semibold mt-0.5">{q.malaysianAnalogy}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-xs text-slate-500 font-mono">
              No quiz questions parsed. Upload course notes slides inside Dashboard to populate diagnostic papers!
            </div>
          )}

          {/* Smart Revision Diagnostic Card Analytics */}
          {currentQuizzes.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-550/10 p-4 space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="h-4.5 w-4.5 text-emerald-400" />
                  <span className="text-xs font-extrabold text-white font-display">Your Diagnostic Grade Projection:</span>
                </div>
                <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-400 border border-emerald-500/20 uppercase animate-pulse font-mono tracking-wide">
                  {scorecard.grade}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] leading-none text-slate-400 font-bold font-mono">
                <span>Result Assessment: <span className="text-emerald-300 font-semibold">{scorecard.rating}</span></span>
                <span className="text-emerald-300">Accuracy: {Math.round(scorecard.score)}%</span>
              </div>

              {scorecard.score < 55 && scorecard.grade !== 'Idle' && (
                <button
                  onClick={() => onAskInChat(`I scored a ${scorecard.score}% on the adaptive quiz for course ${activeCourseCode.toUpperCase()}. Can you explain where my knowledge gaps are and curate a step-by-step study guide?`)}
                  className="w-full rounded-xl bg-indigo-600 border border-indigo-500/30 text-white hover:bg-indigo-500 py-2.5 text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2 shadow-lg shadow-indigo-600/15"
                >
                  <Sparkles className="h-4 w-4 text-indigo-200 text-glow-indigo" />
                  <span>Curate Remedial Study Plan with AI</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
