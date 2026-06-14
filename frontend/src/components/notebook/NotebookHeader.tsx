import { ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import type { Notebook } from './types';
import type { NotebookColorTone } from '../../lib/notebookColors';

export function NotebookHeader({
  colorTone,
  notebook,
  onBackToDashboard,
  onEditNotebook,
  onSelectNotebook,
  onDeleteNotebookClick,
}: {
  colorTone: NotebookColorTone | null;
  notebook: Notebook;
  onBackToDashboard: () => void;
  onEditNotebook?: (notebook: Notebook) => void;
  onSelectNotebook: (id: string | null) => void;
  onDeleteNotebookClick: () => void;
}) {
  return (
    <div className="surface-card rounded-3xl p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelectNotebook(null)}
              className="rounded-xl border border-border-default bg-bg-elevated/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            >
              <span className="inline-flex items-center gap-1">
                <ArrowLeft className="h-3.5 w-3.5" />
                All Notebooks
              </span>
            </button>
            <button
              onClick={onBackToDashboard}
              className="rounded-xl border border-border-default bg-bg-elevated/60 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            >
              Dashboard
            </button>
          </div>
          <div className="space-y-1">
            <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${colorTone?.text || 'text-accent-hover'}`}>{notebook.courseLabel || notebook.courseCode}</p>
            <h1 className="text-2xl font-black text-text-primary font-display">{notebook.name}</h1>
            <p className="max-w-3xl text-sm leading-relaxed text-text-secondary font-serif">
              {notebook.description || 'No description set yet.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border font-mono ${colorTone?.badge || 'border-accent-border bg-accent-subtle text-accent-hover'}`}>
                {notebook.fileCount} files
              </span>
              <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border font-mono ${colorTone?.badge || 'border-accent-border bg-accent-subtle text-accent-hover'}`}>
                {notebook.conceptCount} concepts
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="group relative">
            <button
              type="button"
              onClick={() => onEditNotebook?.(notebook)}
              title={`Edit ${notebook.name}`}
              aria-label={`Edit ${notebook.name}`}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${colorTone?.button || 'border-accent-border bg-accent-subtle text-accent-hover hover:bg-accent/20'}`}
            >
              <Edit3 className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              Edit notebook
            </div>
          </div>
          <div className="group relative">
            <button
              type="button"
              onClick={onDeleteNotebookClick}
              title={`Delete ${notebook.name}`}
              aria-label={`Delete ${notebook.name}`}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-error/20 bg-error-subtle text-error transition hover:bg-error/20"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 rounded-lg border border-border-default bg-bg-overlay px-2.5 py-1 text-[10px] font-bold text-text-primary opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              Delete notebook
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
