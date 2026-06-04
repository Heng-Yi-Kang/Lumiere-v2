export interface Course {
  id: string;
  code: string;
  name: string;
  creditHours: number;
}

export interface FileItem {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'pptx' | 'txt' | 'video' | 'audio' | 'image' | 'link';
  mimeType?: string;
  siteName?: string;
  sourceUrl?: string;
  size: string;
  uploadDate: string;
  status: 'processing' | 'ready';
  transcript?: TranscriptSegment[];
  summary?: string;
  summaryError?: string;
  summaryGeneratedAt?: string;
  summaryStatus?: 'idle' | 'in-progress' | 'done' | 'error';
  hlsGeneratedAt?: string;
  hlsMasterPlaylistUrl?: string;
  hlsStatus?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  videoDurationSeconds?: number;
  videoResolution?: string;
  totalPages?: number;
}

export interface NotebookFilePreview {
  id: string;
  name: string;
  type: 'pdf' | 'docx' | 'pptx' | 'txt' | 'audio' | 'video' | 'image' | 'link';
  mimeType?: string;
  siteName?: string;
  sourceUrl?: string;
  previewFormat?: 'pdf' | 'html' | 'text';
  previewContent?: string;
  totalPages?: number;
  summary?: string;
  summaryError?: string;
  summaryGeneratedAt?: string;
  summaryStatus?: 'idle' | 'in-progress' | 'done' | 'error';
  hlsGeneratedAt?: string;
  hlsMasterPlaylistUrl?: string;
  hlsStatus?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  videoDurationSeconds?: number;
  videoResolution?: string;
}

export interface HlsStatus {
  hlsGeneratedAt?: string;
  hlsMasterPlaylistUrl?: string;
  hlsStatus: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  videoDurationSeconds?: number;
  videoResolution?: string;
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
  score?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: Citation[];
  grounded?: boolean;
  suggestedPrompts?: string[];
}

export interface ChatGroundingScope {
  fileId?: string;
  fileName?: string;
  notebookId: string;
  notebookName: string;
}

export interface GroundedChatRequest {
  question: string;
  scope?: ChatGroundingScope;
}

export interface GroundedChatResponse {
  answer: string;
  citations: Citation[];
  grounded: boolean;
  scope: ChatGroundingScope;
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
  weeklyProgress: { day: string; active: boolean; minutes?: number }[];
  malaysianTier: 'Faithful Student' | 'Kopi Beng Devotee' | 'Dean\'s Runner' | 'Royal Award Winner';
}

export interface Notebook {
  id: string;
  name: string;
  courseCode: string;
  courseLabel?: string;
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

export interface AuthUser {
  disabled: boolean;
  email: string;
  id: string;
  name: string;
  role: 'ADMIN' | 'USER';
}

export interface AdminUser {
  createdAt: string;
  disabled: boolean;
  email: string;
  goalCount: number;
  id: string;
  name: string;
  notebookCount: number;
  role: 'ADMIN' | 'USER';
  sessionCount: number;
}

export interface AdminUserStats {
  activeSessions: number;
  activeUsers: number;
  adminUsers: number;
  disabledUsers: number;
  regularUsers: number;
  totalGoals: number;
  totalNotebooks: number;
  totalUsers: number;
}

export interface FileNote {
  id: string;
  fileId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
