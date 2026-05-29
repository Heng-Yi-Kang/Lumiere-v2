import React from 'react';
import { University, StudyStreak } from '../types';
import { UNIVERSITIES } from '../data/mockData';
import { Search, Sparkles, Flame, GraduationCap, Award, Bell } from 'lucide-react';

interface HeaderProps {
  selectedUniId: string;
  onSelectUni: (id: string) => void;
  streak: StudyStreak;
  activeTab: string;
}

export default function Header({ selectedUniId, onSelectUni, streak, activeTab }: HeaderProps) {
  const selectedUni = UNIVERSITIES.find(u => u.id === selectedUniId) || UNIVERSITIES[0];

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-white/10 bg-slate-950/25 backdrop-blur-md px-6 shadow-2xl text-white">
      {/* Search and Context Indicators */}
      <div className="flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            id="global-search"
            placeholder="Search notes, slides, transcripts..."
            className="w-full rounded-lg border border-white/10 bg-slate-950/40 py-1.5 pr-4 pl-9 text-xs font-semibold text-slate-150 outline-none transition-all placeholder:text-slate-400 focus:border-indigo-400 focus:bg-slate-900/60 focus:ring-1 focus:ring-indigo-400/20"
          />
        </div>
      </div>

      {/* University Picker and Streak Metrics */}
      <div className="flex items-center gap-4">
        {/* Streak Counter */}
        <div 
          className="flex items-center gap-2 rounded-lg bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 text-orange-300 shadow-sm hover:bg-orange-500/20 transition-all cursor-help group relative"
          title={`${streak.currentStreak} Days Streak!`}
        >
          <Flame className="h-4 w-4 fill-orange-500 text-orange-400 animate-bounce" />
          <div className="flex flex-col leading-none">
            <span className="text-xs font-extrabold">{streak.currentStreak} Days</span>
            <span className="text-[9px] font-bold text-orange-400 uppercase tracking-tight font-mono">STREAK</span>
          </div>

          {/* Hover state for Student rank levels */}
          <div className="absolute right-0 top-11 scale-0 group-hover:scale-100 transition-all origin-top-right z-50 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl pointer-events-none text-left">
            <div className="flex items-center gap-1.5 border-b border-white/10 pb-2 mb-2">
              <Award className="h-4 w-4 text-amber-400" />
              <h4 className="text-xs font-extrabold text-white font-display">Lumiere Study Rank</h4>
            </div>
            <div className="space-y-1.5">
              <div className="text-[10px] text-slate-350 uppercase font-semibold font-mono">Current Tier:</div>
              <div className="text-xs font-black text-indigo-300 flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                {streak.malaysianTier}
              </div>
              <p className="text-[10px] text-slate-300 leading-relaxed font-normal">
                You studied 6/7 days this week! Rank progress toward <span className="font-bold text-amber-400">Royal Award</span>: 80%
              </p>
            </div>
          </div>
        </div>

        {/* Mini academic rank badge */}
        <div className="hidden items-center gap-1 h-8 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-slate-300 xl:flex">
          <GraduationCap className="h-3.5 w-3.5 text-[#38bdf8]" />
          <span className="text-[10px] font-bold tracking-tight text-slate-200 font-mono">{streak.malaysianTier}</span>
        </div>

        {/* Simulated notification bell */}
        <button 
          id="notif-bell"
          className="relative rounded-full p-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500"></span>
        </button>

        {/* Avatar block */}
        <div className="flex items-center gap-2 border-l border-white/10 pl-3">
          <div className="h-8 w-8 rounded-full border border-indigo-400/50 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center font-black text-white text-xs shadow-md cursor-pointer">
            YK
          </div>
          <div className="hidden flex-col text-left xl:flex">
            <span className="text-xs font-bold text-slate-100 font-display">Yi Kang</span>
            <span className="text-[9px] text-slate-300 font-mono">yikangheng@gmail.um</span>
          </div>
        </div>
      </div>
    </header>
  );
}
