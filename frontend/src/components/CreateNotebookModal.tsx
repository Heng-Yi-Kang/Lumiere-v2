import React, { useState } from 'react';
import { X, BookOpen, Edit3 } from 'lucide-react';
import { Course } from '../types';
import { DEFAULT_NOTEBOOK_COLOR, NOTEBOOK_COLORS } from '../lib/notebookColors';

interface CreateNotebookModalProps {
  onClose: () => void;
  onSubmit: (name: string, courseCode: string, color: string, description: string) => Promise<void> | void;
  courses: Course[];
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
  courses,
  mode = 'create',
  initialValues,
}: CreateNotebookModalProps) {
  const isEditMode = mode === 'edit';
  const [name, setName] = useState(initialValues?.name || '');
  const [courseCode, setCourseCode] = useState(initialValues?.courseCode || courses[0]?.code || '');
  const [customCourseCode, setCustomCourseCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div
        className="surface-glass relative w-full max-w-lg overflow-hidden rounded-3xl text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/10 bg-white/55 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-gold/25 bg-gold/10 text-gold-strong">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-ink-950 font-display">{isEditMode ? 'Edit Notebook' : 'Create New Notebook'}</h3>
              <p className="mt-0.5 text-[10px] font-semibold text-ink-500">
                {isEditMode ? 'Update notebook details' : 'Configure your academic syllabus settings'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="premium-focus flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/60 text-ink-500 transition-colors hover:bg-black/5 hover:text-ink-950"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-5 p-6 text-ink-800">
          {error && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="nb-title-input" className="block text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Notebook Title / Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center text-slate-500">
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
                className="premium-focus w-full rounded-2xl border border-black/10 bg-white/80 py-2.5 pl-10 pr-4 text-xs text-ink-950 outline-none transition-colors placeholder:text-ink-500"
              />
            </div>
          </div>

          {!isEditMode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
                  Course Code mapping
                </label>
                <button
                  type="button"
                  onClick={() => setUseCustomCode(!useCustomCode)}
                  className="text-[10px] font-bold text-indigo-400 hover:underline font-mono"
                >
                  {useCustomCode ? 'Select predefined course' : 'Input custom code'}
                </button>
              </div>

              {useCustomCode ? (
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center text-[10px] font-bold text-slate-500 font-mono">
                    CODE
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WIX1002"
                    value={customCourseCode}
                    onChange={(e) => setCustomCourseCode(e.target.value)}
                    className="premium-focus w-full rounded-2xl border border-black/10 bg-white/80 py-2.5 pl-12 pr-4 text-xs font-bold text-ink-950 outline-none placeholder:text-ink-500 font-mono"
                  />
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    className="premium-focus w-full cursor-pointer rounded-2xl border border-black/10 bg-white/80 p-2.5 text-xs font-bold text-ink-950 outline-none font-mono"
                  >
                    {courses.map((course) => (
                      <option key={course.id} value={course.code} className="bg-[#0f172a] text-slate-100">
                        {course.code} - {course.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
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
                      isSelected ? 'ring-2 ring-ink-950 ring-offset-2 ring-offset-white' : ''
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
            <label htmlFor="nb-desc-input" className="block text-[10px] font-black uppercase tracking-wider text-slate-400 font-mono">
              Syllabus Brief & Description
            </label>
            <textarea
              id="nb-desc-input"
              rows={3}
              maxLength={200}
              placeholder="Explain what topics are studied, past exam rules, and course expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="premium-focus w-full resize-none rounded-2xl border border-black/10 bg-white/80 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-ink-950 outline-none transition-colors placeholder:text-ink-500"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-black/10 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="premium-focus rounded-2xl border border-black/10 px-4 py-2 text-xs font-bold text-ink-650 transition-colors hover:bg-black/5 hover:text-ink-950"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="premium-focus rounded-2xl border border-black/10 bg-ink-950 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-black/15 transition-colors hover:bg-ink-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Configure & Build'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
