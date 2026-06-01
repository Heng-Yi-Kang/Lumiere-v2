import React from 'react';
import { Star } from 'lucide-react';
import { Goal } from '../types';

interface PriorityGoalBoxProps {
  goal: Goal | undefined;
}

export default function PriorityGoalBox({ goal }: PriorityGoalBoxProps) {
  if (!goal) return null;

  return (
    <div className="fixed bottom-4 left-4 z-30 w-[140px] md:w-[152px]">
      <div className="surface-glass rounded-2xl p-4 space-y-2 border border-cta/20">
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-cta fill-cta" />
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-cta font-mono">Top Priority</span>
        </div>
        <p className={`text-sm font-medium leading-relaxed text-text-primary ${goal.completed ? 'line-through text-text-muted' : ''}`}>
          {goal.text}
        </p>
      </div>
    </div>
  );
}
