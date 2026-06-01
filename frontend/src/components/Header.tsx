import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
}

export default function Header({ activeTab }: HeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 mx-4 mt-4 flex h-[4.5rem] items-center justify-between rounded-2xl border border-border-default bg-bg-surface/60 px-5 text-text-primary shadow-[0_18px_50px_rgba(0,0,0,0.30)] backdrop-blur-2xl">
      {/* Brand Logo */}
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="premium-focus mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 transition-transform duration-200 hover:scale-105"
        title="Lumiere Dashboard"
        aria-label="Go to Dashboard"
      >
        <span className="text-lg font-black text-white">L</span>
      </button>

      {/* Search and Context Indicators */}
      <div className="flex flex-1 items-center gap-5">
        <div className="hidden min-w-0 md:block">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-text-muted font-mono">
            Workspace / {activeTab}
          </div>
          <div className="truncate text-sm font-bold text-text-primary">Lumiere study workspace</div>
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

      <div className="flex items-center gap-3 md:gap-4">
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
