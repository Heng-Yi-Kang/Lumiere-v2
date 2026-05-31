import React, { useState } from 'react';
import { 
  Compass, 
  BookOpen, 
  Network, 
  CheckSquare, 
  Coffee, 
  Target,
  Star,
  Plus,
  Trash2,
  CheckSquare as CheckIcon,
  Square,
  Settings,
  X,
  Trophy,
} from 'lucide-react';
import { Goal } from '../types';

interface SidebarProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  selectedUniShort: string;
  goals: Goal[];
  onAddGoal: (text: string) => void;
  onToggleGoal: (id: string) => void;
  onSetPriorityGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function Sidebar({ 
  currentPage, 
  setCurrentPage, 
  selectedUniShort,
  goals,
  onAddGoal,
  onToggleGoal,
  onSetPriorityGoal,
  onDeleteGoal,
  isCollapsed,
  onToggleCollapsed
}: SidebarProps) {
  const [isManageGoalsOpen, setIsManageGoalsOpen] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');

  const menuItems = [
    { page: 'Dashboard', label: 'Dashboard', icon: Compass },
    { page: 'Notebooks', label: 'My Notebooks', icon: BookOpen },
    { page: 'KnowledgeGraph', label: 'Semantic Knowledge Graph', icon: Network },
    { page: 'Revision', label: 'Revision & Quizzes', icon: CheckSquare },
    { page: 'StudyLounge', label: 'Campus Study Lounge', icon: Coffee }
  ];

  // Derive goals stats
  const priorityGoal = goals.find(g => g.isPriority) || goals[0];
  const completedCount = goals.filter(g => g.completed).length;
  const progressPercent = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    onAddGoal(newGoalText.trim());
    setNewGoalText('');
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-black/10 bg-white/75 text-ink-650 shadow-[16px_0_55px_rgba(42,33,18,0.08)] backdrop-blur-2xl transition-[width] duration-300 ${
        isCollapsed ? 'w-20' : 'w-20 md:w-64'
      }`}
    >
      {/* Platform Branding */}
      <button
        type="button"
        onClick={onToggleCollapsed}
        className={`premium-focus flex h-20 w-full items-center gap-3 border-b border-black/10 text-left transition-colors hover:bg-black/[0.03] ${
          isCollapsed ? 'justify-center px-4' : 'px-6'
        }`}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink-950 shadow-lg shadow-black/10">
          <span className="text-white font-bold text-lg font-display">L</span>
        </div>
        {!isCollapsed && (
          <div className="hidden min-w-0 flex-col md:flex">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xl font-black tracking-tight text-ink-950 font-display">Lumiere</span>
              <span className="rounded-full border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[10px] font-black tracking-[0.14em] text-gold-strong uppercase">
                STUDENT
              </span>
            </div>
            <span className="mt-1 text-[11px] font-bold tracking-[0.12em] text-ink-500 uppercase font-mono">
              Student OS v1.2
            </span>
          </div>
        )}
      </button>

      {/* Main Navigation Menu */}
      <nav className={`flex-1 space-y-2 overflow-y-auto py-6 ${isCollapsed ? 'px-3' : 'px-3 md:px-4'}`}>
        {!isCollapsed && (
          <span className="hidden px-3 pb-2 text-[11px] font-bold tracking-[0.14em] text-ink-500 uppercase font-mono md:block">
            Study Workspaces
          </span>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => setCurrentPage(item.page)}
              title={item.label}
              className={`premium-focus group flex w-full items-center rounded-2xl text-sm font-semibold tracking-normal transition-colors duration-200 ${
                isActive
                  ? 'bg-ink-950 text-white font-bold shadow-sm'
                  : 'text-ink-650 hover:bg-black/5 hover:text-ink-950'
              } ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-center px-0 py-3 md:justify-between md:px-3 md:py-2.5'}`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-center md:justify-start md:gap-3'}`}>
                <Icon className={`h-4.5 w-4.5 transition-colors ${
                  isActive ? 'text-white' : 'text-ink-500 group-hover:text-ink-950'
                }`} />
                {!isCollapsed && (
                  <span className={`hidden md:inline ${isActive ? 'text-white' : 'text-ink-800'}`}>{item.label}</span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Target Slogan & Fun Study Progress (Replaced UM Campus Target with Goals list) */}
      <div className={`rounded-3xl border border-black/10 bg-white/60 text-left shadow-sm backdrop-blur-xl ${isCollapsed ? 'mx-3 mb-4 p-2.5' : 'mx-3 mb-4 p-2.5 md:m-4 md:p-4 md:space-y-3'}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setIsManageGoalsOpen(true)}
              className="premium-focus flex h-10 w-10 items-center justify-center rounded-2xl bg-gold/10 text-gold-strong transition-colors hover:bg-gold/15"
              id="manage-goals-btn"
              title="Manage goals"
              aria-label="Manage goals"
            >
              <Target className="h-4.5 w-4.5" />
            </button>
            <div className="text-center">
              <div className="text-sm font-black text-ink-950">{progressPercent}%</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-slate-500">Goals</div>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden items-center justify-between md:flex">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-gold-strong" />
                <span className="text-[11px] font-bold tracking-[0.12em] text-ink-650 uppercase font-mono">
                  Top Study Goal
                </span>
              </div>
              <button
                onClick={() => setIsManageGoalsOpen(true)}
                className="premium-focus flex items-center gap-0.5 text-[11px] font-bold text-gold-strong hover:text-ink-950 font-mono"
                id="manage-goals-btn"
              >
                <Settings className="h-3 w-3" />
                Manage
              </button>
            </div>

            {priorityGoal ? (
              <div className="hidden space-y-2 md:block">
                <div className="rounded-2xl bg-white/70 border border-black/10 p-3 space-y-1">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-400 font-mono">TOP PRIORITY</span>
                  </div>
                  <p className={`text-sm font-semibold leading-6 text-ink-950 ${priorityGoal.completed ? 'line-through text-ink-500' : ''}`}>
                    {priorityGoal.text}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Completed goals</span>
                    <span>{completedCount} / {goals.length} ({progressPercent}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-ink-950 transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="hidden text-center py-2 md:block">
                <p className="text-sm text-slate-400 italic">No goals added yet.</p>
                <button 
                  onClick={() => setIsManageGoalsOpen(true)}
                  className="mt-1.5 rounded bg-indigo-600 px-2 py-1 text-xs font-bold text-white"
                >
                  Add first goal
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={`flex h-12 items-center border-t border-black/10 text-[11px] text-ink-500 font-mono ${isCollapsed ? 'justify-center px-2' : 'justify-center px-2 md:justify-between md:px-6'}`}>
        {isCollapsed ? (
          <span title={selectedUniShort}>MY</span>
        ) : (
          <div className="hidden w-full justify-between md:flex">
            <span>Kuala Lumpur, MY</span>
            <span>Student OS</span>
          </div>
        )}
      </div>

      {/* Local floating Goals Manager popover dialog overlay */}
      {isManageGoalsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" onClick={() => setIsManageGoalsOpen(false)}>
          <div 
            className="surface-glass relative w-full max-w-sm space-y-4 rounded-3xl p-5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-black/10 pb-3">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4.5 w-4.5 text-amber-400" />
                <h3 className="text-sm font-black text-ink-950 uppercase tracking-[0.12em] font-mono">Manage Study Goals</h3>
              </div>
              <button 
                onClick={() => setIsManageGoalsOpen(false)}
                className="premium-focus flex h-7 w-7 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-black/5 hover:text-ink-950"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Goal creation form */}
            <form onSubmit={handleCreateGoal} className="flex gap-2">
              <input 
                type="text"
                maxLength={80}
                required
                placeholder="e.g. Ace the WIX1001 Midterm exam"
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                className="premium-focus flex-1 rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-ink-950 placeholder:text-ink-500 outline-none"
              />
              <button 
                type="submit"
                className="premium-focus flex items-center justify-center rounded-2xl bg-ink-950 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-ink-800"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </form>

            {/* List of goals */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {goals.length > 0 ? (
                goals.map((g) => (
                  <div 
                    key={g.id}
                    className={`flex items-center justify-between rounded-lg border p-2 text-xs transition-all ${
                      g.isPriority 
                        ? 'border-indigo-500/40 bg-indigo-500/5' 
                        : 'border-black/10 bg-white/55'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <button 
                        type="button"
                        onClick={() => onToggleGoal(g.id)}
                        className="text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                      >
                        {g.completed ? (
                          <CheckIcon className="h-4.5 w-4.5 text-emerald-400" />
                        ) : (
                          <Square className="h-4.5 w-4.5" />
                        )}
                      </button>
                      <span className={`truncate font-semibold text-ink-800 ${g.completed ? 'line-through text-ink-500 font-normal' : ''}`}>
                        {g.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <button 
                        type="button"
                        onClick={() => onSetPriorityGoal(g.id)}
                        className={`p-1 rounded transition-colors ${g.isPriority ? 'text-amber-400' : 'text-slate-500 hover:text-amber-300'} cursor-pointer`}
                        title={g.isPriority ? "Current Top Priority" : "Set as Top Priority"}
                      >
                        <Star className={`h-3.5 w-3.5 ${g.isPriority ? 'fill-amber-400' : ''}`} />
                      </button>

                      <button 
                        type="button"
                        onClick={() => onDeleteGoal(g.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Goal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-[10.5px] text-slate-500 italic">No goals added yet. Define some focus targets above.</div>
              )}
            </div>

            <div className="flex justify-end border-t border-black/10 pt-2">
              <button 
                type="button"
                onClick={() => setIsManageGoalsOpen(false)}
                className="premium-focus rounded-2xl border border-black/10 bg-white/60 px-3 py-1.5 text-[10.5px] font-bold text-ink-650 font-mono transition-colors hover:bg-black/5 hover:text-ink-950"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
