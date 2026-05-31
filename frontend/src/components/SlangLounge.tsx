import React, { useState } from 'react';
import { SLANG_TIPS } from '../data/mockData';
import { 
  Coffee, 
  Calculator, 
  HelpCircle, 
  Sparkles, 
  Award, 
  TrendingUp, 
  GraduationCap, 
  MessageSquareDiff,
  BookOpenCheck
} from 'lucide-react';

interface ModuleGradePlan {
  id: string;
  name: string;
  creditHours: number;
  expectedGrade: string;
}

export default function SlangLounge() {
  const [gradePlans, setGradePlans] = useState<ModuleGradePlan[]>([
    { id: '1', name: 'Discrete Computing Mathematics', creditHours: 3, expectedGrade: 'A' },
    { id: '2', name: 'Database Systems Implementation', creditHours: 4, expectedGrade: 'A-' },
    { id: '3', name: 'Introduction to AI Architectures', creditHours: 4, expectedGrade: 'A+' },
    { id: '4', name: 'Core Humanities & National Studies', creditHours: 2, expectedGrade: 'A' }
  ]);

  const [finalGpa, setFinalGpa] = useState<number | null>(3.92);

  const gradePoints: Record<string, number> = {
    'A+': 4.00,
    'A': 4.00,
    'A-': 3.70,
    'B+': 3.30,
    'B': 3.00,
    'B-': 2.70,
    'C+': 2.30,
    'C': 2.00,
    'F': 0.00
  };

  const handleGradeChange = (id: string, grade: string) => {
    setGradePlans(prev => prev.map(gp => gp.id === id ? { ...gp, expectedGrade: grade } : gp));
  };

  const handleCreditChange = (id: string, credits: number) => {
    setGradePlans(prev => prev.map(gp => gp.id === id ? { ...gp, creditHours: credits } : gp));
  };

  const calculateGpa = () => {
    let totalPoints = 0;
    let totalCredits = 0;

    gradePlans.forEach(gp => {
      const gpValue = gradePoints[gp.expectedGrade] || 0;
      totalPoints += gpValue * gp.creditHours;
      totalCredits += gp.creditHours;
    });

    if (totalCredits === 0) return;
    const gpa = totalPoints / totalCredits;
    setFinalGpa(parseFloat(gpa.toFixed(2)));
  };

  const getGpaHumorAdvice = (gpa: number) => {
    if (gpa >= 3.85) return {
      badge: "ROYAL AWARD TRACK",
      advice: "Wow! A stellar pointer like this will definitely make you proud! Keep utilizing Lumiere's semantic concept connections, you are practically locked for the Dean's List (GPA 4.00 flat)!"
    };
    if (gpa >= 3.50) return {
      badge: "DEAN'S LIST RUNNER ZONE",
      advice: "Dean's List is within reach! Just a bit more to achieve a perfect CGPA. Keep reviewing those remaining weak nodes on your semantic graph, review your flashcards, and lock in for study week!"
    };
    if (gpa >= 3.00) return {
      badge: "SECURE ZONE",
      advice: "Steady pointer! You are safe and meet all standard degree requirements. If you want that extra edge, drop your lecture transcript audio files into Lumiere RAG chat to extract shortcuts and core exam criteria."
    };
    return {
      badge: "ACADEMIC ALERT ZONE",
      advice: "Don't panic, it is not too late to turn things around! Drop those long, messy slide PDFs into Lumiere notes. Use our intuitive study guides to understand difficult concepts simply, and let the AI summarize backprop or logic before midterm nights!"
    };
  };

  const motivation = finalGpa ? getGpaHumorAdvice(finalGpa) : null;

  return (
    <div className="space-y-8 text-left relative z-10">
      {/* Visual top banner */}
      <div className="surface-card rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-15 blur-3xl pointer-events-none">
          <div className="h-48 w-48 rounded-full bg-accent"></div>
        </div>
        
        <div className="relative z-10 space-y-2">
          <span className="rounded-full bg-accent-subtle border border-accent-border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-accent-hover font-mono">
            Study Lounge Corner
          </span>
          <h1 className="text-xl font-extrabold flex items-center gap-2 text-text-primary font-display">
            <Coffee className="h-5 w-5 text-accent-hover" />
            Campus Study Lounge & Planner
          </h1>
          <p className="max-w-xl text-xs text-text-secondary leading-normal font-medium font-serif">
            Take a breather, review campus academic tips, plan your semester grade targets, and let the AI generate customized study paths based on your targets.
          </p>
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* GPA Planner Box */}
        <div className="surface-card rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-5">
          <div className="border-b border-border-subtle pb-3">
            <h2 className="text-xs font-black text-accent-hover uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Calculator className="h-4 w-4 text-accent-hover" />
              Dynamic CGPA Goal Estimator
            </h2>
            <p className="text-[10px] text-text-muted font-mono mt-1">Adjust expected grades to instantly calculate semester pointer goals.</p>
          </div>

          <div className="space-y-3">
            {gradePlans.map((gp) => (
              <div key={gp.id} className="grid grid-cols-12 gap-2 items-center bg-bg-elevated/30 border border-border-subtle p-2.5 rounded-xl text-xs font-semibold text-text-secondary">
                <div className="col-span-6 truncate font-bold text-text-primary leading-tight">
                  {gp.name}
                </div>
                
                {/* Credit Hours picker */}
                <div className="col-span-3">
                  <label htmlFor={`credits-${gp.id}`} className="sr-only">Credit Hours</label>
                  <select
                    id={`credits-${gp.id}`}
                    value={gp.creditHours}
                    onChange={(e) => handleCreditChange(gp.id, parseInt(e.target.value))}
                    className="w-full rounded-lg border border-border-default bg-bg-elevated/60 p-1.5 text-[11px] font-bold text-text-primary focus:border-accent outline-none cursor-pointer transition-colors"
                  >
                    {[1, 2, 3, 4, 5].map(v => (
                      <option key={v} value={v} className="bg-bg-overlay text-text-primary">{v} Credits</option>
                    ))}
                  </select>
                </div>

                {/* Grade selector option */}
                <div className="col-span-3">
                  <label htmlFor={`grade-${gp.id}`} className="sr-only">Expected Grade</label>
                  <select
                    id={`grade-${gp.id}`}
                    value={gp.expectedGrade}
                    onChange={(e) => handleGradeChange(gp.id, e.target.value)}
                    className="w-full rounded-lg border border-border-default bg-bg-elevated/60 p-1.5 text-[11px] font-bold text-text-primary focus:border-accent outline-none cursor-pointer transition-colors"
                  >
                    {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'].map(g => (
                      <option key={g} value={g} className="bg-bg-overlay text-text-primary">{g}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Action calculator button */}
          <div className="flex gap-2">
            <button
              onClick={calculateGpa}
              className="flex-1 rounded-xl bg-accent text-white hover:bg-accent-hover py-2.5 text-xs font-extrabold transition-colors uppercase tracking-wider flex items-center justify-center gap-1.5 border border-accent-border shadow-lg shadow-indigo-500/15"
            >
              <TrendingUp className="h-4 w-4 text-white" />
              <span>Calculate GPA Target</span>
            </button>
          </div>

          {/* CGPA Projection Output badge */}
          {finalGpa !== null && motivation && (
            <div className="rounded-2xl border border-success/25 bg-success-subtle p-4 space-y-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-success/20 pb-2">
                <span className="text-[10.5px] font-black text-text-muted uppercase tracking-widest flex items-center gap-1 font-mono">
                  <Award className="h-4 w-4 text-success" />
                  Estimated Pointer:
                </span>
                <span className="text-lg font-black text-success font-mono">{finalGpa.toFixed(2)} / 4.00</span>
              </div>
              <div>
                <span className="rounded bg-success-subtle border border-success/35 text-success text-[9px] font-black px-1.5 py-0.5 uppercase tracking-wide font-mono">
                  {motivation.badge}
                </span>
                <p className="text-[10.5px] leading-relaxed text-text-secondary mt-1.5 font-serif">{motivation.advice}</p>
              </div>
            </div>
          )}
        </div>

        {/* Localized Glossary dictionary */}
        <div className="surface-card rounded-3xl p-6 md:p-8 flex flex-col justify-between space-y-5 font-semibold">
          <div className="border-b border-border-subtle pb-3">
            <h2 className="text-xs font-black text-accent-hover uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <GraduationCap className="h-4 w-4 text-accent-hover" />
              Campus Study Guide Glossary
            </h2>
            <p className="text-[10px] text-text-muted font-mono mt-1">Common campus academic tips and methods inside Lumiere Learn.</p>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {SLANG_TIPS.map((item, i) => (
              <div key={i} className="flex gap-3 text-xs leading-normal font-medium bg-bg-elevated/20 p-3 rounded-xl border border-border-subtle">
                <div className="h-6 w-6 rounded-full bg-accent-subtle border border-accent-border text-accent-hover font-black text-xs flex items-center justify-center shrink-0 font-mono">
                  {i + 1}
                </div>
                <div className="space-y-0.5 text-left">
                  <h4 className="font-extrabold text-text-primary uppercase tracking-wide font-display">&ldquo;{item.phrase}&rdquo;</h4>
                  <p className="text-text-secondary text-[11px] leading-relaxed font-serif">{item.meaning}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-cta-subtle border border-cta/30 p-4 text-[10.5px] text-cta font-semibold leading-relaxed">
            <BookOpenCheck className="mr-1.5 inline h-3.5 w-3.5 text-cta" />
            <span className="font-extrabold text-cta">Core Course Tip:</span> Facing mandatory general university papers? Drop raw lecture notes into the Lumiere notebook dashboard, choose <b>Exam-focused</b> style, and let AI outline historical legal timelines instantly.
          </div>
        </div>
      </div>
    </div>
  );
}
