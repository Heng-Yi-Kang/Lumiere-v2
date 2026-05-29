import React, { useState } from 'react';
import { X, BookOpen, Hash, Edit3 } from 'lucide-react';
import { Course } from '../types';

interface CreateNotebookModalProps {
  onClose: () => void;
  onSubmit: (name: string, courseCode: string, color: string, description: string) => void;
  courses: Course[];
}

const COLORS = [
  { id: 'blue', name: 'Royal Blue', bgClass: 'bg-blue-500', borderClass: 'border-blue-500' },
  { id: 'indigo', name: 'Midnight Indigo', bgClass: 'bg-indigo-500', borderClass: 'border-indigo-500' },
  { id: 'amber', name: 'Golden Amber', bgClass: 'bg-amber-500', borderClass: 'border-amber-500' },
  { id: 'cyan', name: 'Teal Cyan', bgClass: 'bg-cyan-500', borderClass: 'border-cyan-500' },
  { id: 'rose', name: 'Deep Rose', bgClass: 'bg-rose-500', borderClass: 'border-rose-500' },
  { id: 'violet', name: 'Soft Violet', bgClass: 'bg-violet-500', borderClass: 'border-violet-500' },
  { id: 'red', name: 'Crimson Red', bgClass: 'bg-red-500', borderClass: 'border-red-500' }
];

export default function CreateNotebookModal({ onClose, onSubmit, courses }: CreateNotebookModalProps) {
  const [name, setName] = useState('');
  const [courseCode, setCourseCode] = useState(courses[0]?.code || '');
  const [customCourseCode, setCustomCourseCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [color, setColor] = useState('blue');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const finalName = name.trim();
    const finalCode = (useCustomCode ? customCourseCode : courseCode).trim().toUpperCase();
    const finalDesc = description.trim();

    if (!finalName) {
      setError('Notebook title is required.');
      return;
    }
    if (!finalCode) {
      setError('Course code is required.');
      return;
    }

    onSubmit(finalName, finalCode, color, finalDesc);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-[#0b101c] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-left relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#0e1627]/60">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white font-display">Create New Notebook</h3>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Configure your academic syllabus settings</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 text-slate-200">
          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-3 text-xs text-rose-400 font-semibold">
              ⚠️ {error}
            </div>
          )}

          {/* Notebook Name */}
          <div className="space-y-1.5">
            <label htmlFor="nb-title-input" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
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
                className="w-full rounded-xl border border-white/15 bg-slate-950/40 py-2.5 pl-10 pr-4 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-all focus:bg-slate-950/80"
              />
            </div>
          </div>

          {/* Course Code Segment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                Course Code mapping
              </label>
              <button 
                type="button"
                onClick={() => setUseCustomCode(!useCustomCode)}
                className="text-[10px] text-indigo-400 hover:underline font-bold font-mono"
              >
                {useCustomCode ? "Select predefined course" : "Input custom code"}
              </button>
            </div>

            {useCustomCode ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center text-slate-500 font-mono text-[10px] font-bold">
                  CODE
                </div>
                <input 
                  type="text"
                  required
                  placeholder="e.g. WIX1002"
                  value={customCourseCode}
                  onChange={(e) => setCustomCourseCode(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 pl-12 pr-4 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 font-mono font-bold"
                />
              </div>
            ) : (
              <div className="relative">
                <select 
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/40 p-2.5 text-xs text-slate-100 outline-none focus:border-indigo-500 cursor-pointer font-bold font-mono"
                >
                  {courses.map(course => (
                    <option key={course.id} value={course.code} className="bg-[#0f172a] text-slate-100">
                      {course.code} — {course.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Theme Color Picker */}
          <div className="space-y-2">
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
              Visual Accent Color
            </label>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map((col) => {
                const isSelected = color === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setColor(col.id)}
                    className={`h-7 w-7 rounded-full ${col.bgClass} relative flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
                      isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0b101c]' : ''
                    }`}
                    title={col.name}
                  >
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="nb-desc-input" className="block text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
              Syllabus Brief & Description
            </label>
            <textarea 
              id="nb-desc-input"
              rows={3}
              maxLength={200}
              placeholder="Explain what topics are studied, past exam rules, and course expectations..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 transition-all resize-none focus:bg-slate-950/80 leading-relaxed font-semibold"
            />
          </div>

          {/* Submit Action Buttons */}
          <div className="flex gap-3 justify-end pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 hover:bg-white/5 py-2 px-4 text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2 px-5 text-xs font-bold text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer border border-indigo-500/10"
            >
              Configure & Build
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
