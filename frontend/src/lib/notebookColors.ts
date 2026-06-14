export const NOTEBOOK_COLORS = [
  { id: 'blue', name: 'Royal Blue', swatchClass: 'bg-blue-500' },
  { id: 'indigo', name: 'Midnight Indigo', swatchClass: 'bg-indigo-500' },
  { id: 'amber', name: 'Golden Amber', swatchClass: 'bg-amber-500' },
  { id: 'cyan', name: 'Teal Cyan', swatchClass: 'bg-cyan-500' },
  { id: 'rose', name: 'Deep Rose', swatchClass: 'bg-rose-500' },
  { id: 'violet', name: 'Soft Violet', swatchClass: 'bg-violet-500' },
  { id: 'red', name: 'Crimson Red', swatchClass: 'bg-red-500' },
] as const;

export const DEFAULT_NOTEBOOK_COLOR = 'blue';

export interface NotebookColorTone {
  badge: string;
  text: string;
  button: string;
  subtleBlock: string;
  borderGlow: string;
  strip: string;
}

export function getNotebookColorTone(color: string) {
  const tones: Record<string, NotebookColorTone> = {
    blue: {
      badge: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
      text: 'text-blue-300',
      button: 'border-blue-500/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20',
      subtleBlock: 'border-blue-500/10 bg-blue-500/5 text-blue-100',
      borderGlow: 'hover:border-blue-500/40 hover:shadow-blue-500/5',
      strip: 'before:bg-blue-500',
    },
    indigo: {
      badge: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
      text: 'text-indigo-300',
      button: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20',
      subtleBlock: 'border-indigo-500/10 bg-indigo-500/5 text-indigo-100',
      borderGlow: 'hover:border-indigo-500/40 hover:shadow-indigo-500/5',
      strip: 'before:bg-indigo-500',
    },
    amber: {
      badge: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
      text: 'text-amber-300',
      button: 'border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20',
      subtleBlock: 'border-amber-500/10 bg-amber-500/5 text-amber-100',
      borderGlow: 'hover:border-amber-500/40 hover:shadow-amber-500/5',
      strip: 'before:bg-amber-500',
    },
    cyan: {
      badge: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
      text: 'text-cyan-300',
      button: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20',
      subtleBlock: 'border-cyan-500/10 bg-cyan-500/5 text-cyan-100',
      borderGlow: 'hover:border-cyan-500/40 hover:shadow-cyan-500/5',
      strip: 'before:bg-cyan-500',
    },
    rose: {
      badge: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
      text: 'text-rose-300',
      button: 'border-rose-500/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20',
      subtleBlock: 'border-rose-500/10 bg-rose-500/5 text-rose-100',
      borderGlow: 'hover:border-rose-500/40 hover:shadow-rose-500/5',
      strip: 'before:bg-rose-500',
    },
    violet: {
      badge: 'border-violet-500/20 bg-violet-500/10 text-violet-300',
      text: 'text-violet-300',
      button: 'border-violet-500/20 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20',
      subtleBlock: 'border-violet-500/10 bg-violet-500/5 text-violet-100',
      borderGlow: 'hover:border-violet-500/40 hover:shadow-violet-500/5',
      strip: 'before:bg-violet-500',
    },
    red: {
      badge: 'border-red-500/20 bg-red-500/10 text-red-300',
      text: 'text-red-300',
      button: 'border-red-500/20 bg-red-500/10 text-red-100 hover:bg-red-500/20',
      subtleBlock: 'border-red-500/10 bg-red-500/5 text-red-100',
      borderGlow: 'hover:border-red-500/40 hover:shadow-red-500/5',
      strip: 'before:bg-red-500',
    },
  };

  return tones[color] || tones[DEFAULT_NOTEBOOK_COLOR];
}
