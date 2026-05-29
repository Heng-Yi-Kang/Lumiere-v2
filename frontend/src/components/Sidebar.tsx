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
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { Goal } from '../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
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
  activeTab, 
  onTabChange, 
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
    { id: 'dashboard', label: 'Dashboard', icon: Compass },
    { id: 'notebooks', label: 'My Notebooks', icon: BookOpen },
    { id: 'graph', label: 'Semantic Knowledge Graph', icon: Network },
    { id: 'revision', label: 'Revision & Quizzes', icon: CheckSquare },
    { id: 'lepak', label: 'Campus Study Lounge', icon: Coffee }
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
      className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-slate-950/45 backdrop-blur-xl text-slate-300 shadow-2xl transition-[width] duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Platform Branding */}
      <div className={`flex h-16 items-center border-b border-white/10 gap-2 ${isCollapsed ? 'px-4 justify-center' : 'px-6'}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 shadow-lg shadow-indigo-500/20">
          <span className="text-white font-bold text-lg font-display">L</span>
        </div>
        {!isCollapsed && (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-base font-black tracking-tight text-white uppercase font-display bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Lumiere</span>
              <span className="rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[8.5px] font-black tracking-widest text-[#a5b4fc] uppercase">
                STUDENT
              </span>
            </div>
            <span className="text-[9px] font-extrabold tracking-widest text-slate-400 uppercase mt-0.5 font-mono">
              Student OS v1.2
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`ml-auto flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
            isCollapsed ? 'ml-0' : ''
          }`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Navigation Menu */}
      <nav className={`flex-1 space-y-1.5 py-6 overflow-y-auto ${isCollapsed ? 'px-3' : 'px-4'}`}>
        {!isCollapsed && (
          <span className="block px-3 text-[10px] font-black tracking-wider text-slate-400 uppercase pb-1 font-mono">
            Study Workspaces
          </span>
        )}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              title={item.label}
              className={`group flex w-full items-center rounded-xl text-xs font-semibold tracking-normal transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-white/10 text-white border-l-2 border-indigo-400 font-bold backdrop-blur-md shadow-xs'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              } ${isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'}`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Icon className={`h-4.5 w-4.5 transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-slate-350 group-hover:text-white'
                }`} />
                {!isCollapsed && (
                  <span className={isActive ? 'text-white' : 'text-slate-200'}>{item.label}</span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Target Slogan & Fun Study Progress (Replaced UM Campus Target with Goals list) */}
      <div className={`border border-white/10 rounded-xl bg-white/[0.03] backdrop-blur-md text-left ${isCollapsed ? 'mx-3 mb-4 p-2.5' : 'm-4 p-4 space-y-3'}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setIsManageGoalsOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300 transition-colors hover:bg-indigo-500/20 hover:text-white"
              id="manage-goals-btn"
              title="Manage goals"
              aria-label="Manage goals"
            >
              <Target className="h-4.5 w-4.5" />
            </button>
            <div className="text-center">
              <div className="text-[11px] font-black text-white">{progressPercent}%</div>
              <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Goals</div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-400" />
                <span className="text-[10px] font-extrabold tracking-wider text-slate-300 uppercase font-mono">
                  Top Study Goal
                </span>
              </div>
              <button
                onClick={() => setIsManageGoalsOpen(true)}
                className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 font-mono cursor-pointer"
                id="manage-goals-btn"
              >
                <Settings className="h-3 w-3" />
                Manage
              </button>
            </div>

            {priorityGoal ? (
              <div className="space-y-2">
                <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 p-2.5 space-y-1">
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 font-mono">TOP PRIORITY</span>
                  </div>
                  <p className={`text-xs font-semibold leading-tight text-white ${priorityGoal.completed ? 'line-through text-slate-400' : ''}`}>
                    {priorityGoal.text}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[8px] text-slate-400">
                    <span>Completed goals</span>
                    <span>{completedCount} / {goals.length} ({progressPercent}%)</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-[#34d399] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-[11px] text-slate-400 italic">No goals added yet.</p>
                <button 
                  onClick={() => setIsManageGoalsOpen(true)}
                  className="mt-1.5 text-[10px] bg-indigo-600 px-2 py-0.5 rounded text-white font-bold"
                >
                  Add first goal
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className={`flex h-12 items-center border-t border-white/5 text-[10px] text-slate-400 font-mono ${isCollapsed ? 'justify-center px-2' : 'justify-between px-6'}`}>
        {isCollapsed ? (
          <span title={selectedUniShort}>MY</span>
        ) : (
          <>
            <span>Kuala Lumpur, MY</span>
            <span>Student OS</span>
          </>
        )}
      </div>

      {/* Local floating Goals Manager popover dialog overlay */}
      {isManageGoalsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setIsManageGoalsOpen(false)}>
          <div 
            className="bg-[#0b101c] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4 text-left relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4.5 w-4.5 text-amber-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider font-mono">Manage Study Goals</h3>
              </div>
              <button 
                onClick={() => setIsManageGoalsOpen(false)}
                className="h-6 w-6 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
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
                className="flex-1 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-1.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
              />
              <button 
                type="submit"
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all flex items-center justify-center cursor-pointer"
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
                        : 'border-white/5 bg-slate-950/20'
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
                      <span className={`truncate font-semibold text-slate-200 ${g.completed ? 'line-through text-slate-500 font-normal' : ''}`}>
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

            <div className="pt-2 border-t border-white/5 flex justify-end">
              <button 
                type="button"
                onClick={() => setIsManageGoalsOpen(false)}
                className="rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-[10.5px] font-bold text-slate-300 font-mono transition-colors"
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
