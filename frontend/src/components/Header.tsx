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
    <header className="sticky top-0 z-40 mx-4 mt-4 flex h-[4.5rem] items-center justify-between rounded-2xl border border-border-default bg-bg-surface/60 px-5 text-text-primary shadow-[0_18px_50px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
      {/* Search and Context Indicators */}
      <div className="flex flex-1 items-center gap-5">
        <div className="hidden min-w-0 md:block">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-text-muted font-mono">
            {selectedUni.shortName} / {activeTab}
          </div>
          <div className="truncate text-sm font-bold text-text-primary">{selectedUni.name}</div>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            id="global-search"
            placeholder="Search notes, slides, transcripts..."
            className="premium-focus w-full rounded-xl border border-border-default bg-bg-elevated/70 py-2.5 pr-4 pl-10 text-sm font-medium text-text-primary outline-none transition-colors duration-200 placeholder:text-text-muted focus:border-accent hover:bg-bg-elevated"
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
          className="premium-focus hidden max-w-[150px] rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-bold text-text-primary outline-none md:block cursor-pointer hover:bg-bg-elevated transition-colors"
        >
          {UNIVERSITIES.map((university) => (
            <option key={university.id} value={university.id}>
              {university.shortName}
            </option>
          ))}
        </select>
        
        {/* Streak Counter */}
        <div
          className="group relative hidden cursor-help items-center gap-2 rounded-xl border border-cta/20 bg-cta-subtle px-3 py-2 text-cta shadow-sm transition-colors hover:bg-cta/15 sm:flex"
          title={`${streak.currentStreak} Days Streak!`}
        >
          <Flame className="h-4 w-4 fill-cta" />
          <div className="flex flex-col leading-none">
            <span className="text-sm font-extrabold">{streak.currentStreak} Days</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted font-mono">Streak</span>
          </div>

          {/* Hover state for Student rank levels */}
          <div className="absolute right-0 top-12 z-50 w-64 origin-top-right rounded-2xl border border-border-default bg-bg-overlay p-5 text-left opacity-0 shadow-2xl backdrop-blur-xl transition-all duration-200 pointer-events-none translate-y-1 group-hover:opacity-100 group-hover:translate-y-0">
            <div className="flex items-center gap-2 border-b border-border-default pb-3 mb-3">
              <Award className="h-4 w-4 text-cta" />
              <h4 className="text-xs font-extrabold text-text-primary uppercase tracking-wider font-mono">Lumiere Study Rank</h4>
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase text-text-muted font-mono">Current Tier</div>
              <div className="flex items-center gap-2 text-sm font-black text-text-primary">
                <GraduationCap className="h-4 w-4 text-cta" />
                {streak.malaysianTier}
              </div>
              <p className="text-xs leading-relaxed text-text-secondary">
                You studied 6/7 days this week. Rank progress toward <span className="font-bold text-cta">Royal Award</span>: 80%
              </p>
            </div>
          </div>
        </div>

        {/* Mini academic rank badge */}
        <div className="hidden h-9 items-center gap-1.5 rounded-xl border border-border-default bg-bg-elevated/60 px-3 text-text-muted xl:flex">
          <GraduationCap className="h-3.5 w-3.5 text-cta" />
          <span className="text-[11px] font-bold tracking-tight font-mono">{streak.malaysianTier}</span>
        </div>

        {/* Notification bell */}
        <button 
          id="notif-bell"
          className="premium-focus relative rounded-full p-2.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-error ring-2 ring-bg-surface"></span>
        </button>

        {/* Avatar block */}
        <div className="flex items-center gap-2.5 border-l border-border-default pl-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border-default bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-black text-white shadow-lg shadow-indigo-500/25">
            YK
          </div>
          <div className="hidden flex-col text-left xl:flex">
            <span className="text-sm font-bold text-text-primary">Yi Kang</span>
            <span className="text-[11px] text-text-muted font-mono">yikangheng@gmail.um</span>
          </div>
        </div>
      </div>
    </header>
  );
}
