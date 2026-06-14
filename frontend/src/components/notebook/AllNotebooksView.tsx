import { Edit3, ListChecks, Plus, Search, Trash2 } from 'lucide-react';
import type { Notebook } from './types';
import { countMatchingFiles } from './notebookHelpers';
import { getNotebookColorTone } from '../../lib/notebookColors';

export function AllNotebooksView({
  allNotebooks,
  filteredNotebooks,
  isSearchActive,
  normalizedSearchQuery,
  onCreateNotebookRequested,
  onDeleteNotebook,
  onEditNotebook,
  onSelectNotebook,
  searchQuery,
  totalFileMatchCount,
}: {
  allNotebooks: Notebook[];
  filteredNotebooks: Notebook[];
  isSearchActive: boolean;
  normalizedSearchQuery: string;
  onCreateNotebookRequested?: () => void;
  onDeleteNotebook?: (notebookId: string) => Promise<void> | void;
  onEditNotebook?: (notebook: Notebook) => void;
  onSelectNotebook: (id: string | null) => void;
  searchQuery: string;
  totalFileMatchCount: number;
}) {
  const hasNotebooks = allNotebooks.length > 0;
  const hasVisibleNotebooks = filteredNotebooks.length > 0;
  const visibleNotebookCount = filteredNotebooks.length;

  return (
    <div className="space-y-8 text-left relative z-10" id="all-notebooks-tab">
      <div className="surface-card rounded-3xl p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="rounded-full border border-accent-border bg-accent-subtle px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-accent-hover">
              Notebook Workspace
            </span>
            <h2 className="text-2xl font-black text-text-primary font-display">My Academic Course Notebooks</h2>
            <p className="max-w-2xl text-sm leading-relaxed text-text-secondary font-serif">
              {isSearchActive
                ? `${visibleNotebookCount} notebook${visibleNotebookCount === 1 ? '' : 's'} and ${totalFileMatchCount} file match${totalFileMatchCount === 1 ? '' : 'es'} for "${searchQuery.trim()}".`
                : hasNotebooks
                ? 'Upload lecture materials and open previews inline without leaving the notebook.'
                : 'Set up your first notebook to start collecting course files, previews, and study context.'}
            </p>
          </div>
          <button
            onClick={onCreateNotebookRequested}
            className="rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-white transition hover:bg-accent-hover shadow-lg shadow-indigo-500/20 shrink-0"
          >
            <span className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              New Notebook
            </span>
          </button>
        </div>
      </div>

      {!hasNotebooks ? (
        <div className="surface-elevated rounded-3xl p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border-default bg-bg-elevated/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-text-primary">
                <ListChecks className="h-3.5 w-3.5 text-accent-hover" />
                First-Time Setup
              </div>
              <h3 className="text-2xl font-black text-text-primary font-display">No notebooks available yet</h3>
              <p className="max-w-2xl text-base leading-relaxed text-text-secondary font-serif">
                Lumiere organizes each course inside its own notebook. Create one first, then upload lecture slides, readings, or plain text notes to unlock previews and grounded AI study help.
              </p>
              <button
                onClick={onCreateNotebookRequested}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-black text-white transition hover:bg-accent-hover shadow-lg shadow-indigo-500/20"
              >
                <Plus className="h-4 w-4" />
                Create First Notebook
              </button>
            </div>

            <div className="rounded-3xl border border-border-default bg-bg-elevated/40 p-6">
              <h4 className="text-sm font-black text-text-primary font-display">Get started in 3 steps</h4>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl border border-border-default bg-bg-elevated/30 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-accent-hover font-mono">1. Create a course notebook</div>
                  <div className="mt-1 text-sm leading-relaxed text-text-secondary font-serif">Use a subject name and course code so your materials stay grouped cleanly.</div>
                </div>
                <div className="rounded-2xl border border-border-default bg-bg-elevated/30 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-success font-mono">2. Upload your first files</div>
                  <div className="mt-1 text-sm leading-relaxed text-text-secondary font-serif">Add PDFs, DOCX, PPTX, TXT notes, images, or lecture audio from classes and revision packs.</div>
                </div>
                <div className="rounded-2xl border border-border-default bg-bg-elevated/30 p-4">
                  <div className="text-[11px] font-black uppercase tracking-[0.14em] text-cta font-mono">3. Study from one place</div>
                  <div className="mt-1 text-sm leading-relaxed text-text-secondary font-serif">Open the notebook to preview files, review descriptions, and ask notebook-grounded questions.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : !hasVisibleNotebooks ? (
        <div className="rounded-2xl border border-dashed border-border-default bg-bg-elevated/20 px-6 py-14 text-center">
          <Search className="mx-auto h-10 w-10 text-text-muted" />
          <h3 className="mt-4 text-lg font-black text-text-primary font-display">No notebook matches found</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-text-secondary font-serif">
            No notebook titles, course details, file names, links, or generated descriptions matched "{searchQuery.trim()}".
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredNotebooks.map((entry) => {
            const entryTone = getNotebookColorTone(entry.color);
            const fileMatchCount = countMatchingFiles(entry, normalizedSearchQuery);

            return (
              <button
                key={entry.id}
                onClick={() => onSelectNotebook(entry.id)}
                className={`rounded-2xl border border-border-default bg-bg-elevated/40 p-5 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-bg-elevated/60 ${entryTone.borderGlow}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-widest border font-mono ${entryTone.badge}`}>
                    {entry.courseLabel || entry.courseCode}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm font-bold text-text-muted">{entry.fileCount} files</span>
                      {isSearchActive && fileMatchCount > 0 ? (
                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest border font-mono ${entryTone.subtleBlock}`}>
                          {fileMatchCount} match{fileMatchCount === 1 ? '' : 'es'}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEditNotebook?.(entry);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-bg-elevated/60 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                        title={`Edit ${entry.name}`}
                        aria-label={`Edit ${entry.name}`}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (window.confirm(`Delete "${entry.name}" and all its files?`)) {
                            void onDeleteNotebook?.(entry.id);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-error/20 bg-error-subtle text-error transition hover:bg-error/20"
                        title={`Delete ${entry.name}`}
                        aria-label={`Delete ${entry.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <h3 className="mt-4 text-base font-black text-text-primary font-display">{entry.name}</h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-text-secondary font-serif">
                  {entry.description || 'No description set yet.'}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
