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
  expectedGrade: string; // A+, A, A-, B+, B, C, F
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
      badge: "ROYAL AWARD TRACK 🏆",
      advice: "Wow! A stellar pointer like this will definitely make you proud! Keep utilizing Lumiere's semantic concept connections, you are practically locked for the Dean's List (GPA 4.00 flat)!"
    };
    if (gpa >= 3.50) return {
      badge: "DEAN'S LIST RUNNER ZONE 🎓",
      advice: "Dean's List is within reach! Just a bit more to achieve a perfect CGPA. Keep reviewing those remaining weak nodes on your semantic graph, review your flashcards, and lock in for study week!"
    };
    if (gpa >= 3.00) return {
      badge: "SECURE ZONE 👍",
      advice: "Steady pointer! You are safe and meet all standard degree requirements. If you want that extra edge, drop your lecture transcript audio files into Lumiere RAG chat to extract shortcuts and core exam criteria."
    };
    return {
      badge: "ACADEMIC ALERT ZONE ☕",
      advice: "Don't panic, it is not too late to turn things around! Drop those long, messy slide PDFs into Lumiere notes. Use our intuitive study guides to understand difficult concepts simply, and let the AI summarize backprop or logic before midterm nights!"
    };
  };

  const motivation = finalGpa ? getGpaHumorAdvice(finalGpa) : null;

  return (
    <div className="space-y-6 text-left border-t border-transparent relative z-10">
      {/* Visual top banner */}
      <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute right-0 top-0 opacity-10 blur-xl pointer-events-none">
          <div className="h-44 w-44 rounded-full bg-indigo-500"></div>
        </div>
        
        <div className="relative z-10 space-y-2">
          <span className="rounded-full bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-300 font-mono">
            Study Lounge Corner
          </span>
          <h1 className="text-xl font-extrabold flex items-center gap-1.5 text-white font-display">
            <Coffee className="h-5.5 w-5.5 text-indigo-400 text-glow-indigo" />
            Campus Study Lounge & Planner
          </h1>
          <p className="max-w-xl text-xs text-slate-400 leading-normal font-medium">
            Take a breather, review campus academic tips, plan your semester grade targets, and let the AI generate customized study paths based on your targets.
          </p>
        </div>
      </div>

      {/* Grid of details */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
        {/* GPA Planner Box */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="border-b border-white/5 pb-2">
            <h2 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <Calculator className="h-4 w-4 text-indigo-400" />
              Dynamic CGPA Goal Estimator
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">Adjust expected grades to instantly calculate semester pointer goals.</p>
          </div>

          <div className="space-y-3">
            {gradePlans.map((gp) => (
              <div key={gp.id} className="grid grid-cols-12 gap-2 items-center bg-slate-950/20 border border-white/5 p-2.5 rounded-lg text-xs font-semibold text-slate-205">
                <div className="col-span-6 truncate font-bold text-slate-100 leading-tight">
                  {gp.name}
                </div>
                
                {/* Credit Hours picker */}
                <div className="col-span-3">
                  <label htmlFor={`credits-${gp.id}`} className="sr-only">Credit Hours</label>
                  <select
                    id={`credits-${gp.id}`}
                    value={gp.creditHours}
                    onChange={(e) => handleCreditChange(gp.id, parseInt(e.target.value))}
                    className="w-full rounded-md border border-white/10 bg-slate-950/60 p-1 text-[11px] font-bold text-slate-200 focus:border-indigo-400 outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map(v => (
                      <option key={v} value={v} className="bg-[#0f172a] text-slate-205">{v} Credits</option>
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
                    className="w-full rounded-md border border-white/10 bg-slate-950/60 p-1 text-[11px] font-bold text-slate-100 focus:border-indigo-400 outline-none cursor-pointer"
                  >
                    {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'F'].map(g => (
                      <option key={g} value={g} className="bg-[#0f172a] text-slate-205">{g}</option>
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
              className="flex-1 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 py-2.5 text-xs font-extrabold transition-colors uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer border border-indigo-400/20 shadow-md shadow-indigo-600/15"
            >
              <TrendingUp className="h-4 w-4 text-indigo-300" />
              <span>Calculate GPA Target</span>
            </button>
          </div>

          {/* CGPA Projection Output badge */}
          {finalGpa !== null && motivation && (
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 space-y-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <span className="text-[10.5px] font-black text-slate-450 uppercase tracking-widest flex items-center gap-1 font-mono">
                  <Award className="h-4 w-4 text-emerald-400 animate-bounce" />
                  Estimated Pointer:
                </span>
                <span className="text-md font-black text-emerald-400 font-mono text-glow-emerald">{finalGpa.toFixed(2)} / 4.00</span>
              </div>
              <div>
                <span className="rounded bg-emerald-500/20 border border-emerald-500/35 text-emerald-300 text-[9px] font-black px-1.5 py-0.2 uppercase tracking-wide font-mono">
                  {motivation.badge}
                </span>
                <p className="text-[10.5px] leading-relaxed text-slate-200 mt-1.5">{motivation.advice}</p>
              </div>
            </div>
          )}
        </div>

        {/* Localized Glossary dictionary */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl flex flex-col justify-between space-y-4 font-semibold">
          <div className="border-b border-white/5 pb-2">
            <h2 className="text-xs font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
              <GraduationCap className="h-4.5 w-4.5 text-indigo-400" />
              Campus Study Guide Glossary
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">Common campus academic tips and methods inside Lumiere Learn.</p>
          </div>

          <div className="space-y-3.5 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {SLANG_TIPS.map((item, i) => (
              <div key={i} className="flex gap-3 text-xs leading-normal font-medium bg-slate-950/20 p-3 rounded-xl border border-white/5">
                <div className="h-6 w-6 rounded-full bg-indigo-500/20 border border-indigo-500/25 text-indigo-300 font-black text-xs flex items-center justify-center shrink-0 font-mono">
                  {i + 1}
                </div>
                <div className="space-y-0.5 text-left">
                  <h4 className="font-extrabold text-white uppercase tracking-wide font-display">“{item.phrase}”</h4>
                  <p className="text-slate-300 text-[11px] leading-relaxed">{item.meaning}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-amber-500/15 border border-amber-500/30 p-4 text-[10.5px] text-amber-200 font-semibold leading-relaxed">
            🎓 <span className="font-extrabold text-amber-300">Core Course Tip:</span> Facing mandatory general university papers? Drop raw lecture notes into the Lumiere notebook dashboard, choose <b>Exam-focused</b> style, and let AI outline historical legal timelines instantly.
          </div>
        </div>
      </div>
    </div>
  );
}
