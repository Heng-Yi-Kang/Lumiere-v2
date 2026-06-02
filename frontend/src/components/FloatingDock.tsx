import React, { useState } from 'react';
import { 
  Compass, 
  BookOpen, 
  Target,
  Star,
  Plus,
  Trash2,
  CheckSquare as CheckIcon,
  Square,
  Trophy,
  X,
  Settings,
} from 'lucide-react';
import { Goal } from '../types';

interface FloatingDockProps {
  currentPage: string;
  setCurrentPage: (page: string) => void;
  goals: Goal[];
  onAddGoal: (text: string) => Promise<void>;
  onToggleGoal: (id: string) => void;
  onSetPriorityGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
}

export default function FloatingDock({ 
  currentPage, 
  setCurrentPage,
  goals,
  onAddGoal,
  onToggleGoal,
  onSetPriorityGoal,
  onDeleteGoal,
}: FloatingDockProps) {
  const [isManageGoalsOpen, setIsManageGoalsOpen] = useState(false);
  const [newGoalText, setNewGoalText] = useState('');
  const [goalCreateError, setGoalCreateError] = useState('');
  const [isCreatingGoal, setIsCreatingGoal] = useState(false);
  const [isDockHovered, setIsDockHovered] = useState(false);

  const menuItems = [
    { page: 'Dashboard', label: 'Dashboard', icon: Compass },
    { page: 'Notebooks', label: 'My Notebooks', icon: BookOpen },
  ];

  const priorityGoal = goals.find(g => g.isPriority) || goals[0];
  const completedCount = goals.filter(g => g.completed).length;
  const progressPercent = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0;

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newGoalText.trim();

    if (!text || isCreatingGoal) {
      return;
    }

    setGoalCreateError('');
    setIsCreatingGoal(true);

    try {
      await onAddGoal(text);
      setNewGoalText('');
    } catch (error) {
      setGoalCreateError(error instanceof Error ? error.message : 'Failed to create goal.');
    } finally {
      setIsCreatingGoal(false);
    }
  };

  const renderDockOverlay = (label: string, isVisible = false) => (
    <span
      className={`pointer-events-none absolute left-14 whitespace-nowrap rounded-xl border border-border-default bg-bg-elevated px-3 py-1.5 text-xs font-semibold text-text-primary shadow-xl transition-all duration-200 ${
        isVisible
          ? 'translate-x-0 opacity-100'
          : 'translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100'
      }`}
    >
      {label}
    </span>
  );

  return (
    <>
      {/* Floating Dock */}
      <nav 
        onMouseEnter={() => setIsDockHovered(true)}
        onMouseLeave={() => setIsDockHovered(false)}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-2 rounded-3xl border border-border-default bg-bg-surface/70 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        style={{ backdropFilter: 'blur(24px) saturate(1.2)' }}
      >
        {/* Navigation Items */}
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => setCurrentPage(item.page)}
              title={item.label}
              aria-label={item.label}
              className={`premium-focus group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'bg-accent text-white shadow-lg shadow-indigo-500/20'
                  : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {renderDockOverlay(item.label, isActive && isDockHovered)}
            </button>
          );
        })}

        <div className="h-px w-8 bg-border-default my-1" />

        {/* Goals Button */}
        <button
          onClick={() => setIsManageGoalsOpen(true)}
          className={`premium-focus group relative flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-200 ${
            progressPercent === 100
              ? 'bg-success/15 text-success'
              : 'text-text-secondary hover:bg-bg-elevated hover:text-cta'
          }`}
          title="Study Goals"
          aria-label="Manage study goals"
        >
          <Target className="h-[18px] w-[18px]" />
          {progressPercent < 100 && goals.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-cta ring-2 ring-bg-surface" />
          )}
          {progressPercent === 100 && goals.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-bg-surface" />
          )}
          {renderDockOverlay('Study Goals')}
        </button>
      </nav>

      {/* Goals Manager Modal */}
      {isManageGoalsOpen && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          onClick={() => setIsManageGoalsOpen(false)}
        >
          <div 
            className="surface-glass relative w-full max-w-md space-y-5 rounded-3xl p-6 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border-default pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cta/15 text-cta">
                  <Trophy className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Study Goals</h3>
                  <p className="text-[11px] text-text-muted font-mono mt-0.5">{completedCount} of {goals.length} completed</p>
                </div>
              </div>
              <button 
                onClick={() => setIsManageGoalsOpen(false)}
                className="premium-focus flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-text-secondary">
                <span className="font-medium">Overall progress</span>
                <span className="font-mono font-semibold">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-bg-elevated overflow-hidden">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
            </div>

            {/* Priority Goal Highlight */}
            {priorityGoal && (
              <div className="rounded-2xl bg-accent-subtle border border-accent-border p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 text-cta fill-cta" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cta font-mono">Top Priority</span>
                </div>
                <p className={`text-sm font-medium leading-relaxed text-text-primary ${priorityGoal.completed ? 'line-through text-text-muted' : ''}`}>
                  {priorityGoal.text}
                </p>
              </div>
            )}

            {/* Goal creation form */}
            <form onSubmit={handleCreateGoal} className="flex gap-2">
              <input 
                type="text"
                maxLength={80}
                required
                placeholder="e.g. Ace the WIX1001 Midterm exam"
                value={newGoalText}
                onChange={(e) => {
                  setNewGoalText(e.target.value);
                  if (goalCreateError) {
                    setGoalCreateError('');
                  }
                }}
                disabled={isCreatingGoal}
                className="premium-focus flex-1 rounded-2xl border border-border-default bg-bg-elevated/80 px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-accent"
              />
              <button 
                type="submit"
                disabled={isCreatingGoal}
                className="premium-focus flex items-center justify-center rounded-2xl bg-accent px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
              </button>
            </form>
            {goalCreateError && (
              <p className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs font-medium text-error">
                {goalCreateError}
              </p>
            )}

            {/* List of goals */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {goals.length > 0 ? (
                goals.map((g) => (
                  <div 
                    key={g.id}
                    className={`flex items-center justify-between rounded-xl border p-3 text-xs transition-all ${
                      g.isPriority 
                        ? 'border-cta/30 bg-cta-subtle' 
                        : 'border-border-default bg-bg-elevated/50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button 
                        type="button"
                        onClick={() => onToggleGoal(g.id)}
                        className="text-text-muted hover:text-success transition-colors shrink-0"
                      >
                        {g.completed ? (
                          <CheckIcon className="h-5 w-5 text-success" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                      <span className={`truncate font-medium text-sm text-text-primary ${g.completed ? 'line-through text-text-muted' : ''}`}>
                        {g.text}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 ml-3 shrink-0">
                      <button 
                        type="button"
                        onClick={() => onSetPriorityGoal(g.id)}
                        className={`p-1.5 rounded-lg transition-colors ${g.isPriority ? 'text-cta' : 'text-text-muted hover:text-cta'}`}
                        title={g.isPriority ? "Current Top Priority" : "Set as Top Priority"}
                      >
                        <Star className={`h-4 w-4 ${g.isPriority ? 'fill-cta' : ''}`} />
                      </button>

                      <button 
                        type="button"
                        onClick={() => onDeleteGoal(g.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-error transition-colors"
                        title="Delete Goal"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border-default bg-bg-elevated/35 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cta/15 text-cta">
                      <Target className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 space-y-3">
                      <div>
                        <p className="text-sm font-bold text-text-primary">Set up your first study goal</p>
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">
                          Write one concrete target you can finish or measure, like a chapter, quiz, or exam prep milestone.
                        </p>
                      </div>
                      <div className="grid gap-2 text-xs text-text-secondary">
                        <div className="flex gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bg-overlay text-[10px] font-bold text-text-primary">1</span>
                          <span>Add the goal in the field above and press the plus button.</span>
                        </div>
                        <div className="flex gap-2">
                          <Star className="mt-0.5 h-4 w-4 shrink-0 text-cta" />
                          <span>Star the goal that matters most right now.</span>
                        </div>
                        <div className="flex gap-2">
                          <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                          <span>Mark goals complete as you finish them to track progress.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-border-default pt-4">
              <button 
                type="button"
                onClick={() => setIsManageGoalsOpen(false)}
                className="premium-focus rounded-2xl border border-border-default bg-bg-elevated px-5 py-2.5 text-xs font-bold text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
