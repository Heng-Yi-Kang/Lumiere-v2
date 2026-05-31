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
  GraduationCap,
  Lightbulb
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
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});

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
    if (fcIndex < currentFlashcards.length - 1) {
      setFcIndex(prev => prev + 1);
    } else {
      setFcIndex(0);
    }
  };

  const handleSelectOption = (qId: string, optIndex: number) => {
    if (quizSubmitted[qId]) return;
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
      <div className="border-b border-border-default pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-extrabold text-text-primary flex items-center gap-2 font-display">
            <CheckSquare className="h-5 w-5 text-accent-hover" />
            Smart Revision Engine & Active Quizzes
          </h1>
          <p className="text-xs text-text-secondary mt-1 font-serif">
            Validate retention of syllabus concepts using active recall flashcards and diagnostic examinations.
          </p>
        </div>

        {/* Dynamic selector for active course modules */}
        <div className="flex items-center gap-2">
          <label htmlFor="course-select-revision" className="text-[11px] font-bold tracking-wider text-text-muted uppercase font-mono">
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
            className="rounded-lg border border-border-default bg-bg-elevated/70 py-1.5 pr-8 pl-3 text-xs font-semibold text-text-primary focus:border-accent outline-none cursor-pointer transition-colors"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id} className="bg-bg-overlay text-text-primary">
                ({c.code}) {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of tools: left interactive flashcard, right quizzes */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Flashcard Component Deck */}
        <div className="surface-card rounded-3xl p-6 md:p-8 flex flex-col justify-between">
          <div className="border-b border-border-subtle pb-3 mb-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-xs font-black text-accent-hover uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <BookMarked className="h-4 w-4 text-accent-hover" />
                Spaced Repetition Flashcards
              </h2>
              <p className="text-[10px] text-text-muted font-mono">Flip card to test memory recall confidence.</p>
            </div>
            
            <span className="text-xs font-bold text-text-muted font-mono">
              {currentFlashcards.length > 0 ? `${fcIndex + 1} / ${currentFlashcards.length}` : '0 / 0'} cards
            </span>
          </div>

          {currentFlashcards.length > 0 && activeFC ? (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              {/* Actual Flippable Flashcard Canvas */}
              <div 
                onClick={() => setFcFlipped(!fcFlipped)}
                className={`min-h-[220px] rounded-2xl border p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer text-center relative overflow-hidden select-none ${
                  fcFlipped 
                    ? 'border-accent bg-accent-subtle shadow-lg shadow-indigo-500/10' 
                    : 'border-border-default bg-bg-elevated/30 hover:bg-bg-elevated/50'
                }`}
              >
                {/* Visual Watermark indicator depending on state */}
                <div className="absolute top-3 left-4 text-[8.5px] font-black tracking-widest text-text-muted uppercase font-mono">
                  {fcFlipped ? 'RECALL ANSWER' : 'Recall Query'}
                </div>

                {/* Question Front or Answer Back */}
                <div className="my-auto py-4 space-y-4">
                  {!fcFlipped ? (
                    <p className="text-sm font-extrabold text-text-primary leading-relaxed font-display">
                      {activeFC.front}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-text-secondary leading-relaxed whitespace-pre-wrap font-serif">
                        {activeFC.back}
                      </p>

                      {activeFC.translatedBack && (
                        <div className="rounded-xl bg-cta-subtle border border-cta/20 p-3 text-[10.5px] leading-relaxed text-cta text-left font-medium">
                          <Lightbulb className="mr-1 inline h-3.5 w-3.5 text-cta" />
                          <span className="font-extrabold text-cta">Local Study Tip:</span> {activeFC.translatedBack}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Flip callout reminder inside footer */}
                <div className="text-[10px] text-text-muted font-bold flex items-center justify-center gap-1.5 pt-2 border-t border-border-subtle font-mono">
                  <RefreshCcw className="h-3.5 w-3.5 text-accent-hover" />
                  <span>Click to Flip Card</span>
                </div>
              </div>

              {/* Confidence rating tools buttons */}
              <div className="space-y-3">
                <span className="block text-center text-[10.5px] font-extrabold text-text-muted uppercase font-mono">
                  RATE YOUR MEMORY CONFIDENCE (Spaced Rep):
                </span>
                
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleConfidenceRating(activeFC.id, 'weak')}
                    className="rounded-xl border border-error/20 bg-error-subtle hover:bg-error/20 p-2.5 text-xs font-bold text-error transition-colors flex flex-col items-center justify-center"
                  >
                    <span>Again (Weak)</span>
                    <span className="text-[9px] font-normal text-error/80 font-mono mt-0.5">Review tonight</span>
                  </button>

                  <button
                    onClick={() => handleConfidenceRating(activeFC.id, 'moderate')}
                    className="rounded-xl border border-cta/20 bg-cta-subtle hover:bg-cta/20 p-2.5 text-xs font-bold text-cta transition-colors flex flex-col items-center justify-center"
                  >
                    <span>Moderate</span>
                    <span className="text-[9px] font-normal text-cta/80 font-mono mt-0.5">Review 3 days</span>
                  </button>

                  <button
                    onClick={() => handleConfidenceRating(activeFC.id, 'strong')}
                    className="rounded-xl border border-success/20 bg-success-subtle hover:bg-success/20 p-2.5 text-xs font-bold text-success transition-colors flex flex-col items-center justify-center"
                  >
                    <span>Mastered</span>
                    <span className="text-[9px] font-normal text-success/80 font-mono mt-0.5">Box 5 Lock</span>
                  </button>
                </div>

                {/* Confidence tracking bar */}
                <div className="flex items-center justify-between text-[10px] text-text-muted px-1 pt-2">
                  <span>Current Card Status:</span>
                  <span className="font-extrabold text-success block bg-success-subtle px-2 py-0.5 rounded-md border border-success/15 font-mono">
                    {fcConfidenceHistory[activeFC.id] ? `Level: ${fcConfidenceHistory[activeFC.id].toUpperCase()}` : 'NEW (UNREVIEWED)'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-default p-12 text-center text-xs text-text-muted font-mono">
              No flashcards uploaded for this course code. Drop syllabus files to auto-compile memory sets!
            </div>
          )}
        </div>

        {/* Quizzing exam deck terminal */}
        <div className="surface-card rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-4">
          <div className="border-b border-border-subtle pb-3 mb-2 flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="text-xs font-black text-accent-hover uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Award className="h-4 w-4 text-accent-hover" />
                Adaptive Syllabus Examination
              </h2>
              <p className="text-[10px] text-text-muted font-mono">Multiple choice queries with custom grading algorithms.</p>
            </div>

            <button
              onClick={handleResetQuiz}
              className="text-[10px] font-bold text-accent-hover hover:text-accent transition-colors font-mono"
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
                  <div key={q.id} className="rounded-2xl border border-border-subtle p-4 space-y-3 relative text-left bg-bg-elevated/20 backdrop-blur-sm shadow-sm">
                    <span className="absolute top-3 right-4 text-[9px] font-black text-text-muted uppercase font-mono">
                      Question {qIndex + 1}
                    </span>

                    <h3 className="text-xs font-extrabold text-text-primary max-w-[85%] leading-relaxed font-display">
                      {q.question}
                    </h3>

                    {/* Options checkboxes mapping */}
                    <div className="space-y-2 font-semibold">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selectedOpt === oIdx;
                        const isCorrect = q.correctAnswer === oIdx;

                        let pillBorder = 'border-border-default bg-bg-elevated/30 hover:bg-bg-elevated/50 text-text-secondary';
                        if (isSelected) pillBorder = 'border-accent bg-accent-subtle text-accent-hover font-bold';
                        
                        if (isSub) {
                          if (isCorrect) {
                            pillBorder = 'border-success/40 bg-success-subtle text-success font-extrabold';
                          } else if (isSelected) {
                            pillBorder = 'border-error/40 bg-error-subtle text-error';
                          } else {
                            pillBorder = 'border-border-subtle bg-bg-base/40 text-text-muted opacity-40';
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            onClick={() => handleSelectOption(q.id, oIdx)}
                            disabled={isSub}
                            className={`flex w-full items-center justify-between rounded-lg border p-2.5 text-xs text-left transition-all ${pillBorder}`}
                          >
                            <span>{opt}</span>
                            {isSub && isCorrect && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                            {isSub && isSelected && !isCorrect && <XCircle className="h-4 w-4 text-error shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Submit confirmation button */}
                    {!isSub ? (
                      <button
                        onClick={() => handleSubmitQuestion(q.id)}
                        disabled={!isAnsChosen}
                        className="rounded-xl bg-accent px-3 py-2 text-[10px] font-black text-white hover:bg-accent-hover transition-all disabled:opacity-30 uppercase tracking-widest flex items-center gap-1 border border-accent-border shadow-md shadow-indigo-500/10 font-mono"
                      >
                        <span>Verify Answer</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ) : (
                      <div className="mt-3 rounded-2xl bg-accent-subtle border border-accent-border p-4 space-y-3 text-[11px] leading-relaxed text-text-secondary shadow-inner">
                        <div>
                          <span className="font-extrabold text-accent-hover block uppercase text-[9.5px] font-mono">Syllabus Explanation:</span>
                          <p className="text-text-primary mt-1 font-serif">{q.explanation}</p>
                        </div>

                        {q.malaysianAnalogy && (
                          <div className="border-t border-accent-border/50 pt-3 mt-3">
                            <span className="font-extrabold text-success block uppercase text-[9.5px] flex items-center gap-1 font-mono">
                              <Sparkles className="h-3.5 w-3.5 text-success" />
                              Local Analogy:
                            </span>
                            <p className="text-success font-semibold mt-1">{q.malaysianAnalogy}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border-default p-12 text-center text-xs text-text-muted font-mono">
              No quiz questions parsed. Upload course notes slides inside Dashboard to populate diagnostic papers!
            </div>
          )}

          {/* Smart Revision Diagnostic Card Analytics */}
          {currentQuizzes.length > 0 && (
            <div className="rounded-2xl border border-success/25 bg-success-subtle p-4 space-y-3 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-success" />
                  <span className="text-xs font-extrabold text-text-primary font-display">Your Diagnostic Grade Projection:</span>
                </div>
                <span className="rounded-lg bg-success-subtle px-2.5 py-1 text-xs font-black text-success border border-success/20 uppercase font-mono tracking-wide">
                  {scorecard.grade}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] leading-none text-text-muted font-bold font-mono">
                <span>Result Assessment: <span className="text-success font-semibold">{scorecard.rating}</span></span>
                <span className="text-success">Accuracy: {Math.round(scorecard.score)}%</span>
              </div>

              {scorecard.score < 55 && scorecard.grade !== 'Idle' && (
                <button
                  onClick={() => onAskInChat(`I scored a ${scorecard.score}% on the adaptive quiz for course ${activeCourseCode.toUpperCase()}. Can you explain where my knowledge gaps are and curate a step-by-step study guide?`)}
                  className="w-full rounded-xl bg-accent border border-accent-border text-white hover:bg-accent-hover py-2.5 text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 mt-2 shadow-lg shadow-indigo-500/15"
                >
                  <Sparkles className="h-4 w-4 text-white" />
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
