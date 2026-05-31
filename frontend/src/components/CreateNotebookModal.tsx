import React, { useState } from 'react';
import { X, BookOpen, Edit3 } from 'lucide-react';
import { DEFAULT_NOTEBOOK_COLOR, NOTEBOOK_COLORS } from '../lib/notebookColors';

interface CreateNotebookModalProps {
  onClose: () => void;
  onSubmit: (name: string, courseCode: string, color: string, description: string) => Promise<void> | void;
  reusableCourseCodes: string[];
  mode?: 'create' | 'edit';
  initialValues?: {
    name: string;
    courseCode: string;
    color: string;
    description: string;
  };
}

export default function CreateNotebookModal({
  onClose,
  onSubmit,
  reusableCourseCodes,
  mode = 'create',
  initialValues,
}: CreateNotebookModalProps) {
  const isEditMode = mode === 'edit';
  const [name, setName] = useState(initialValues?.name || '');
  const [courseCode, setCourseCode] = useState(initialValues?.courseCode || reusableCourseCodes[0] || '');
  const [customCourseCode, setCustomCourseCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(reusableCourseCodes.length === 0);
  const [color, setColor] = useState(initialValues?.color || DEFAULT_NOTEBOOK_COLOR);
  const [description, setDescription] = useState(initialValues?.description || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalName = name.trim();
    const finalCode = (useCustomCode ? customCourseCode : courseCode).trim().toUpperCase();
    const finalDesc = description.trim();

    if (!finalName) {
      setError('Notebook title is required.');
      return;
    }

    if (!isEditMode && !finalCode) {
      setError('Course code is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(finalName, finalCode, color, finalDesc);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : `Failed to ${isEditMode ? 'update' : 'create'} notebook.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        className="surface-glass relative w-full max-w-lg overflow-hidden rounded-3xl text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-default bg-bg-elevated/60 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cta/25 bg-cta-subtle text-cta">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-text-primary font-display">{isEditMode ? 'Edit Notebook' : 'Create New Notebook'}</h3>
              <p className="mt-0.5 text-[10px] font-semibold text-text-muted">
                {isEditMode ? 'Update notebook details' : 'Configure your academic syllabus settings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="premium-focus flex h-8 w-8 items-center justify-center rounded-full border border-border-default bg-bg-elevated/60 text-text-muted transition-colors hover:bg-bg-overlay hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-5 p-6 text-text-primary">
          {error && (
            <div className="rounded-xl border border-error/25 bg-error-subtle p-3 text-xs font-semibold text-error">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="nb-title-input" className="block text-[10px] font-black uppercase tracking-wider text-text-muted font-mono">
              Notebook Title / Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center text-text-muted">
                <Edit3 className="h-4 w-4" />
              </div>
              <input
                id="nb-title-input"
                type="text"
                required
                maxLength={60}
                placeholder="e.g. Operating Systems & Algorithms"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="premium-focus w-full rounded-2xl border border-border-default bg-bg-elevated/80 py-2.5 pl-10 pr-4 text-xs text-text-primary outline-none transition-colors placeholder:text-text-muted"
              />
            </div>
          </div>

          {!isEditMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-wider text-text-muted font-mono">
                  Course Code
                </label>
                {reusableCourseCodes.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setUseCustomCode(!useCustomCode)}
                    className="text-[10px] font-bold text-accent-hover hover:text-accent transition-colors font-mono"
                  >
                    {useCustomCode ? 'Reuse saved code' : 'Input new code'}
                  </button>
                ) : null}
              </div>

              {useCustomCode ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center text-[10px] font-bold text-text-muted font-mono">
                    CODE
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CS101"
                    value={customCourseCode}
                    onChange={(e) => setCustomCourseCode(e.target.value)}
                    className="premium-focus w-full rounded-2xl border border-border-default bg-bg-elevated/80 py-2.5 pl-12 pr-4 text-xs font-bold text-text-primary outline-none placeholder:text-text-muted font-mono"
                  />
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="premium-focus w-full cursor-pointer rounded-2xl border border-border-default bg-bg-elevated/80 p-2.5 text-xs font-bold text-text-primary outline-none font-mono"
                  >
                    {reusableCourseCodes.map((savedCode) => (
                      <option key={savedCode} value={savedCode} className="bg-bg-overlay text-text-primary">
                        {savedCode}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-text-muted font-mono">
              Visual Accent Color
            </label>
            <div className="flex flex-wrap gap-2.5">
              {NOTEBOOK_COLORS.map((col) => {
                const isSelected = color === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setColor(col.id)}
                    className={`relative flex h-7 w-7 items-center justify-center rounded-full ${col.swatchClass} transition-shadow ${
                      isSelected ? 'ring-2 ring-text-primary ring-offset-2 ring-offset-bg-base' : ''
                    }`}
                    title={col.name}
                  >
                    {isSelected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="nb-desc-input" className="block text-[10px] font-black uppercase tracking-wider text-text-muted font-mono">
              Syllabus Brief & Description
            </label>
            <textarea
              id="nb-desc-input"
              rows={3}
              maxLength={200}
              placeholder="Explain what topics are studied, past exam rules, and course expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="premium-focus w-full resize-none rounded-2xl border border-border-default bg-bg-elevated/80 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-text-primary outline-none transition-colors placeholder:text-text-muted"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-border-default pt-4">
            <button
              type="button"
              onClick={onClose}
              className="premium-focus rounded-2xl border border-border-default bg-bg-elevated/60 px-4 py-2 text-xs font-bold text-text-secondary transition-colors hover:bg-bg-overlay hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="premium-focus rounded-2xl bg-accent px-5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Configure & Build'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
