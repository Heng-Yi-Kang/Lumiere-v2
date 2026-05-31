import React from 'react';
import { StudyStreak } from '../types';
import { UNIVERSITIES } from '../data/mockData';
import { Search, Flame, GraduationCap, Award, Bell } from 'lucide-react';

interface HeaderProps {
  selectedUniId: string;
  onSelectUni: (id: string) => void;
  streak: StudyStreak;
  activeTab: string;
}

export default function Header({ selectedUniId, onSelectUni, streak, activeTab }: HeaderProps) {
  const selectedUni = UNIVERSITIES.find(u => u.id === selectedUniId) || UNIVERSITIES[0];

  return (
    <header className="sticky top-0 z-40 mx-3 mt-3 flex h-[4.75rem] items-center justify-between rounded-3xl border border-black/10 bg-white/70 px-4 text-ink-950 shadow-[0_18px_50px_rgba(42,33,18,0.08)] backdrop-blur-2xl md:mx-6 md:px-6">
      {/* Search and Context Indicators */}
      <div className="flex flex-1 items-center gap-4">
        <div className="hidden min-w-0 md:block">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-ink-500 font-mono">
            {selectedUni.shortName} / {activeTab}
          </div>
          <div className="truncate text-sm font-bold text-ink-950">{selectedUni.name}</div>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-500" />
          <input
            type="text"
            id="global-search"
            placeholder="Search notes, slides, transcripts..."
            className="premium-focus w-full rounded-2xl border border-black/10 bg-white/75 py-2.5 pr-4 pl-10 text-sm font-semibold text-ink-950 outline-none transition-colors duration-200 placeholder:text-ink-500 focus:border-gold"
          />
        </div>
      </div>

      {/* University Picker and Streak Metrics */}
      <div className="flex items-center gap-3 md:gap-4">
        <label htmlFor="university-picker" className="sr-only">Select university</label>
        <select
          id="university-picker"
          value={selectedUniId}
          onChange={(event) => onSelectUni(event.target.value)}
          className="premium-focus hidden max-w-[150px] rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-bold text-ink-950 outline-none md:block"
        >
          {UNIVERSITIES.map((university) => (
            <option key={university.id} value={university.id}>
              {university.shortName}
            </option>
          ))}
        </select>
        {/* Streak Counter */}
        <div
          className="group relative hidden cursor-help items-center gap-2 rounded-2xl border border-gold/25 bg-gold/10 px-3 py-2 text-gold-strong shadow-sm transition-colors hover:bg-gold/15 sm:flex"
          title={`${streak.currentStreak} Days Streak!`}
        >
          <Flame className="h-4 w-4 fill-gold text-gold-strong" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-extrabold">{streak.currentStreak} Days</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-500 font-mono">Streak</span>
          </div>

          {/* Hover state for Student rank levels */}
          <div className="absolute right-0 top-12 z-50 w-60 origin-top-right rounded-3xl border border-black/10 bg-white/90 p-4 text-left opacity-0 shadow-2xl backdrop-blur-xl transition-opacity duration-200 pointer-events-none group-hover:opacity-100">
            <div className="flex items-center gap-1.5 border-b border-black/10 pb-2 mb-2">
              <Award className="h-4 w-4 text-gold-strong" />
              <h4 className="text-xs font-extrabold text-ink-950 font-display">Lumiere Study Rank</h4>
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase text-ink-500 font-mono">Current Tier</div>
              <div className="flex items-center gap-1 text-sm font-black text-ink-950">
                <GraduationCap className="h-3.5 w-3.5 text-gold-strong" />
                {streak.malaysianTier}
              </div>
              <p className="text-xs leading-relaxed text-ink-650 font-normal">
                You studied 6/7 days this week. Rank progress toward <span className="font-bold text-gold-strong">Royal Award</span>: 80%
              </p>
            </div>
          </div>
        </div>

        {/* Mini academic rank badge */}
        <div className="hidden h-9 items-center gap-1 rounded-2xl border border-black/10 bg-white/55 px-3 text-ink-650 xl:flex">
          <GraduationCap className="h-3.5 w-3.5 text-gold-strong" />
          <span className="text-[11px] font-bold tracking-tight font-mono">{streak.malaysianTier}</span>
        </div>

        {/* Simulated notification bell */}
        <button 
          id="notif-bell"
          className="premium-focus relative rounded-full p-2 text-ink-650 transition-colors hover:bg-black/5 hover:text-ink-950"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-600"></span>
        </button>

        {/* Avatar block */}
        <div className="flex items-center gap-2 border-l border-black/10 pl-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-ink-950 text-xs font-black text-white shadow-md">
            YK
          </div>
          <div className="hidden flex-col text-left xl:flex">
            <span className="text-sm font-bold text-ink-950 font-display">Yi Kang</span>
            <span className="text-[11px] text-ink-500 font-mono">yikangheng@gmail.um</span>
          </div>
        </div>
      </div>
    </header>
  );
}
