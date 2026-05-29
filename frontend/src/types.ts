export interface University {
  id: string;
  name: string;
  nativeName: string;
  shortName: string;
  primaryColor: string; // Tailwind color class e.g., 'blue-600'
  accentColor: string;  // e.g., 'emerald-500'
  bgColor: string;      // e.g., 'bg-blue-50/50'
  logoEmoji: string;
  courses: Course[];
}

export interface Course {
  id: string;
  code: string;
  name: string;
  creditHours: number;
}

export interface FileItem {
  id: string;
  name: string;
  type: 'pdf' | 'video' | 'audio' | 'image' | 'link';
  size: string;
  uploadDate: string;
  status: 'processing' | 'ready';
  transcript?: TranscriptSegment[];
  summary?: string;
  totalPages?: number;
  sourceUrl?: string;
}

export interface TranscriptSegment {
  id: string;
  startTime: number; // in seconds
  endTime: number;
  speaker: string;
  text: string;
  important?: boolean;
}

export interface Citation {
  fileId: string;
  fileName: string;
  type: 'page' | 'timestamp';
  position: string; // e.g. "Page 4" or "12:34"
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: Citation[];
  suggestedPrompts?: string[];
}

export interface ConceptNode {
  id: string;
  label: string;
  courseId: string;
  courseCode: string; // e.g., "WIX1002"
  description: string;
  importance: 'high' | 'medium' | 'low';
  tags: string[];
  status: 'mastered' | 'weak' | 'unexplored';
  prerequisites: string[]; // ids of other ConceptNodes
  resources: { name: string; type: 'video' | 'pdf'; source: string }[];
}

export interface ConceptLink {
  source: string; // ConceptNode ID
  target: string; // ConceptNode ID
  type: 'prerequisite' | 'related' | 'interdisciplinary';
}

export interface Flashcard {
  id: string;
  courseId: string;
  front: string;
  back: string;
  translatedBack?: string; // e.g. direct translation or Local BM tips
  confidence?: 'weak' | 'moderate' | 'strong';
  lastStudied?: string;
}

export interface QuizQuestion {
  id: string;
  courseId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  malaysianAnalogy?: string; // Malaysian-styled explanation (e.g. Nasi Lemak, Mamak shop)
  userAnswer?: number;
}

export interface StudyStreak {
  currentStreak: number;
  bestStreak: number;
  lastActive: string;
  weeklyProgress: { day: string; active: boolean; minutes: number }[];
  malaysianTier: 'Faithful Student' | 'Kopi Beng Devotee' | 'Dean\'s Runner' | 'Royal Award Winner';
}

export interface Notebook {
  id: string;
  universityId?: string;
  name: string;
  courseCode: string;
  color: string;
  description: string;
  fileCount: number;
  files: FileItem[];
  conceptCount: number;
}

export interface Goal {
  id: string;
  text: string;
  completed: boolean;
  isPriority: boolean;
}

