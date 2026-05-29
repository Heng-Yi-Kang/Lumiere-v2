import React, { useState, useEffect } from 'react';
import { Notebook, FileItem, TranscriptSegment, QuizQuestion } from '../types';
import { MOCK_QUIZZES } from '../data/mockData';
import { 
  FileText, 
  Video, 
  Music, 
  Play, 
  Pause, 
  Search, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink,
  BookOpen,
  Volume2,
  BookmarkCheck,
  Zap,
  HelpCircle,
  Plus,
  Youtube,
  Globe,
  Upload,
  X,
  Clock,
  Eye,
  CheckCircle,
  FileSpreadsheet,
  Link2,
  BrainCircuit, 
  Star, 
  RefreshCw, 
  XCircle, 
  CheckCircle2
} from 'lucide-react';

interface NotebookViewProps {
  notebook: Notebook | null;
  allNotebooks: Notebook[];
  onSelectNotebook: (id: string | null) => void;
  onBackToDashboard: () => void;
  onAskInChat: (question: string) => void;
  onAddNewFile?: (notebookId: string, file: FileItem) => void;
  onCreateNotebookRequested?: () => void;
}

type ExplainMode = 'beginner' | 'exam' | 'local_analogy' | 'visual' | 'math';

export default function NotebookView({ 
  notebook, 
  allNotebooks, 
  onSelectNotebook, 
  onBackToDashboard, 
  onAskInChat, 
  onAddNewFile,
  onCreateNotebookRequested
}: NotebookViewProps) {
  
  // Custom interactive quiz states for the "Test Me" action
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [quizAnswerIndex, setQuizAnswerIndex] = useState<number | null>(null);
  const [isQuizActive, setIsQuizActive] = useState<boolean>(false);
  const [isQuizDone, setIsQuizDone] = useState<boolean>(false);
  const [quizScore, setQuizScore] = useState<number>(0);

  
  // State for upload forms
  const [uploadTab, setUploadTab] = useState<'file' | 'youtube' | 'web'>('file');
  const [ytUrl, setYtUrl] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [webTitle, setWebTitle] = useState('');
  
  // Simulated file upload form states
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileType, setUploadFileType] = useState<'pdf' | 'audio' | 'video' | 'image'>('pdf');
  const [isUploadingProgress, setIsUploadingProgress] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  // Modal focus state
  const [selectedMaterial, setSelectedMaterial] = useState<FileItem | null>(null);
  
  // Search inside materials lists
  const [materialSearchText, setMaterialSearchText] = useState('');

  // Active explainer section and sub-states
  const [explainMode, setExplainMode] = useState<ExplainMode>('local_analogy');
  const [activeFileForExplanation, setActiveFileForExplanation] = useState<FileItem | null>(null);

  // Audio/video playback state within the Modal
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(90);
  const [modalPdfPage, setModalPdfPage] = useState(1);
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Set default active explanation file when notebook changes
  useEffect(() => {
    if (notebook && notebook.files.length > 0) {
      setActiveFileForExplanation(notebook.files[0]);
    } else {
      setActiveFileForExplanation(null);
    }
  }, [notebook]);

  // Audio timer ticking inside Modal
  useEffect(() => {
    let timer: any = null;
    if (isPlaying && selectedMaterial && (selectedMaterial.type === 'audio' || selectedMaterial.type === 'video')) {
      timer = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= audioDuration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isPlaying, selectedMaterial, audioDuration]);

  // Handle opening details modal on file click
  const handleOpenMaterialModal = (file: FileItem) => {
    setSelectedMaterial(file);
    setIsPlaying(false);
    setCurrentTime(0);
    setModalPdfPage(1);
    setTranscriptSearch('');
    // customize audio duration based on mock files
    if (file.type === 'audio' || file.type === 'video') {
      const match = file.size.match(/(\d+)/);
      const seed = match ? parseInt(match[0]) : 15;
      setAudioDuration(seed * 3); // mock duration
    }
  };

  // Seek handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseInt(e.target.value));
  };

  const jumpToTimestamp = (sec: number) => {
    setCurrentTime(sec);
    setIsPlaying(true);
  };

  // Generate dynamic contextual mock metadata (summary, transcript segments) based on file type and course code
  const generateMockMetaData = (name: string, type: 'pdf' | 'audio' | 'video' | 'image' | 'link', code: string) => {
    const cleanCode = code.toUpperCase();
    const isMath = cleanCode.includes('WIX1001') || cleanCode.includes('MATH');
    const isProg = cleanCode.includes('WIX1002') || cleanCode.includes('PROG');
    const isDB = cleanCode.includes('WIA1002') || cleanCode.includes('DATA');
    const isAI = cleanCode.includes('CT044') || cleanCode.includes('CT001') || cleanCode.includes('AI');
    const isLaw = cleanCode.includes('LAW601') || cleanCode.includes('LAW');

    let summary = '';
    let transcript: TranscriptSegment[] = [];

    if (isMath) {
      summary = `Artificial intelligence-enabled study brief for: ${name}. This card highlights crucial propositional logic equations, Venn subset mapping structures, and logic constants. Key takeaways cover Boolean equivalence theorems (¬(P ∧ Q) ≡ ¬P ∨ ¬Q) and logical proofs highly prioritized for University Malaya (UM) Section B Midterms.`;
      transcript = [
        { id: 't-1', startTime: 0, endTime: 12, speaker: 'Prof. Azmi', text: 'Okay, let us start our Discrete Mathematics seminar. Pay close attention to De Morgan\'s equivalence laws.' },
        { id: 't-2', startTime: 13, endTime: 25, speaker: 'Prof. Azmi', text: 'You should understand that when we distribute a logical negation bumbung, we ALWAYS flip the central operator: AND to OR, OR to AND.', important: true },
        { id: 't-3', startTime: 26, endTime: 44, speaker: 'Farhana (Scholar)', text: 'Professor, will drawing logic gates and Venn diagrams be evaluated with step marks in the final exam paper?' },
        { id: 't-4', startTime: 45, endTime: 70, speaker: 'Prof. Azmi', text: 'Yes, Farhana! Always document the Intermediate logic statements. Doing so ensures you receive full credit under the marking scheme guidelines.' }
      ];
    } else if (isProg) {
      summary = `Dynamic syllabus indexing for Java Object-Oriented Principles in: ${name}. Stresses the operation of Virtual Machines (JVM) during dynamic method dispatch, polymorphic run-time lookup, and stack allocation parameters. Recalls common exam pitfalls involving class-level casting issues.`;
      transcript = [
        { id: 't-1', startTime: 0, endTime: 15, speaker: 'Dr. Tan', text: 'Good morning, class. Today we discuss polymorphism. What happens in memory when we override parent methods?' },
        { id: 't-2', startTime: 16, endTime: 33, speaker: 'Dr. Tan', text: 'Crucial Exam concept: Dynamic method dispatch resolves method calls at runtime. JVM inspects the actual object instance on the heap, not the class reference.', important: true },
        { id: 't-3', startTime: 34, endTime: 55, speaker: 'Alif (Student)', text: 'So, if we have an array of class objects, the runtime will automatically locate the overridden subclass methods?' },
        { id: 't-4', startTime: 56, endTime: 78, speaker: 'Dr. Tan', text: 'Spot on, Alif! That is precisely what makes polymorphism incredibly robust. Write this explanation down, as it is a common UM Paper 2 essay topic.' }
      ];
    } else if (isDB) {
      summary = `Normalisation and SME Relational Schema guide for: ${name}. Breaks down structural redundancy issues, the avoidance of update/delete anomalies, and translating database layout into Third Normal Form (3NF). Uses practical local purchase tables as mapping vectors.`;
      transcript = [
        { id: 't-1', startTime: 0, endTime: 12, speaker: 'Madam Sarah', text: 'Today, let\'s normalize our databases. We want to convert our tables from 2NF into 3NF.' },
        { id: 't-2', startTime: 13, endTime: 28, speaker: 'Madam Sarah', text: 'To achieve 3NF, we must strictly eliminate transitive dependencies. If non-key field A determines field B, which determines field C, they must be split!', important: true },
        { id: 't-3', startTime: 29, endTime: 45, speaker: 'Devan (Student)', text: 'Can we map this anomaly to receipt id databases inside dining bills?' },
        { id: 't-4', startTime: 46, endTime: 66, speaker: 'Madam Sarah', text: 'Absolutely, Devan. Receipt ID determines the cashier desk, which determines the duty shifts. We split that into two modular reference tables to prevent data leaks.' }
      ];
    } else if (isAI) {
      summary = `High-Yield Deep Learning handbook for: ${name}. Formulates Artificial Neural networks, Backpropagation gradients, and partial derivatives. Evaluates activation functions (ReLU, Sigmoid thresholds) and details gradient clipping solutions for exploding weight limits.`;
      transcript = [
        { id: 't-1', startTime: 0, endTime: 14, speaker: 'Prof. Marina', text: 'Welcome to Advanced AI. Today we study the mechanical backpropagation of error signals.' },
        { id: 't-2', startTime: 15, endTime: 30, speaker: 'Prof. Marina', text: 'Remember that the gradient describes the partial derivative of cost with respect to weights. We update using descent parameters.', important: true },
        { id: 't-3', startTime: 31, endTime: 48, speaker: 'Nabil (Student)', text: 'How do learning rate limits and gradient clipping safeguard models against deep divergence, Professor?' },
        { id: 't-4', startTime: 49, endTime: 71, speaker: 'Prof. Marina', text: 'Well, clipping caps maximum gradient values at 1.0, keeping updates stable. Otherwise, gradients inflate exponentially, breaking the train.' }
      ];
    } else if (isLaw) {
      summary = `Malaysian Business Precedents review for: ${name}. Clarifies the critical difference under the Contracts Act 1950 between a formal Contract Offer and an Invitation to Treat. Cites landmark judicial codes including Fisher v Bell and Boots Cash Chemists definitions.`;
      transcript = [
        { id: 't-1', startTime: 0, endTime: 15, speaker: 'Dr. Hafizah', text: 'Good day, legal scholars. We are examining the inception elements of agreements under Malaysian Business Law.' },
        { id: 't-2', startTime: 16, endTime: 32, speaker: 'Dr. Hafizah', text: 'Displaying goods inside store displays is NOT a binding offer. Under Contracts Act 1950, it is merely an Invitation to Treat.', important: true },
        { id: 't-3', startTime: 33, endTime: 50, speaker: 'Syazwan (Student)', text: 'So if Lotus\'s accidental pricing displays RM1 for a smartphone, they can legally refuse sale at checkouts?' },
        { id: 't-4', startTime: 51, endTime: 72, speaker: 'Dr. Hafizah', text: 'Correct, Syazwan! The shopping customer makes the official offer proposal at cashiers, which the merchant is free to accept or reject.' }
      ];
    } else {
      summary = `Standard academic study notes for: ${name}. Indexed and verified by Lumiere AI. Provides bulleted points, concept hierarchies, and summaries to support continuous spaced repetition revisions.`;
      transcript = [
        { id: 't-1', startTime: 0, endTime: 15, speaker: 'Lecturer', text: 'Let us go through this syllabus segment thoroughly.' },
        { id: 't-2', startTime: 16, endTime: 35, speaker: 'Lecturer', text: 'Ensure you review these key slides and summarize core points before the end of the semester review session.', important: true }
      ];
    }

    return { summary, transcript };
  };

  const startQuizForNotebook = () => {
    const code = notebook?.courseCode.toLowerCase() || 'general';
    let questions = MOCK_QUIZZES[code] || [];
    
    // Fallback if no specific pre-defined quizzes exist for custom notebooks
    if (questions.length === 0) {
      questions = [
        {
          id: `q-gen-1-${Date.now()}`,
          courseId: notebook?.id || 'gen',
          question: `Which represents the most high-yield strategy for mastering ${notebook?.name || 'this academic course'}?`,
          options: [
            "Active recall testing using spaced repetition quizzes",
            "Cramming and rereading entire textbooks passive mode",
            "Leaving notes untouched till the exact night before midterms",
            "Awaiting generic pre-programmed mock answers"
          ],
          correctAnswer: 0,
          explanation: "Grounding active revision using interactive test-prep triggers yields the highest level of cognitive memory recall.",
          malaysianAnalogy: "Like talking to seasoned UM seniors who scored 4.00 Flat, they always advise focusing on past questions early!"
        },
        {
          id: `q-gen-2-${Date.now()}`,
          courseId: notebook?.id || 'gen',
          question: `How does Lumiere RAG safeguard academic study workflows?`,
          options: [
            "It strictly grounds answers in the university Syllabus folders and files to avoid hallucinations",
            "It gives random general internet opinions from unreliable blogs",
            "It suggests skipping course lectures entirely",
            "It relies solely on pre-trained ungrounded data"
          ],
          correctAnswer: 0,
          explanation: "Localised AI grounded in university dossiers guarantees syllabus-safe outputs representing exact course standards.",
          malaysianAnalogy: "This is like referencing the official UM handbook for course guidelines instead of asking rumors on Whatsapp groups."
        },
        {
          id: `q-gen-3-${Date.now()}`,
          courseId: notebook?.id || 'gen',
          question: `What represents the optimal way to remember conceptual logic formulas?`,
          options: [
            "Pairing abstract variables to local scenarios and analogies",
            "Memorising the formulas blindly with no context",
            "Hoping the formulas are printed on the back of exam sheets",
            "Leaving logic questions completely blank"
          ],
          correctAnswer: 0,
          explanation: "Associating abstract boolean variables to local campus food or locations helps you remember them under high exam stress.",
          malaysianAnalogy: "Mapping De Morgan's logic operators to your Mamak order of Milo Ais vs Kopi Beng makes proofs intuitive!"
        }
      ];
    }
    
    setQuizQuestions(questions);
    setActiveQuestionIdx(0);
    setQuizAnswerIndex(null);
    setQuizScore(0);
    setIsQuizDone(false);
    setIsQuizActive(true);
  };

  const handleSelectQuizOption = (optionIdx: number) => {
    if (quizAnswerIndex !== null) return;
    setQuizAnswerIndex(optionIdx);
    const activeQ = quizQuestions[activeQuestionIdx];
    if (optionIdx === activeQ.correctAnswer) {
      setQuizScore(prev => prev + 1);
    }
  };

  const handleNextQuizQuestion = () => {
    if (activeQuestionIdx + 1 < quizQuestions.length) {
      setActiveQuestionIdx(prev => prev + 1);
      setQuizAnswerIndex(null);
    } else {
      setIsQuizDone(true);
    }
  };

  const handleExitQuiz = () => {
    setIsQuizActive(false);
    setIsQuizDone(false);
    setQuizAnswerIndex(null);
    setQuizQuestions([]);
  };

  // Simulated upload triggers
  const handleSimulatedUpload = () => {
    if (!notebook) return;
    const name = uploadFileName.trim() || `Lecture_Notes_Revision_${Math.floor(Math.random() * 90) + 10}.${uploadFileType}`;
    
    setIsUploadingProgress(true);
    setUploadPercent(10);
    
    const interval = setInterval(() => {
      setUploadPercent(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const size = `${(Math.random() * 8 + 1).toFixed(1)} MB`;
            const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            
            const meta = generateMockMetaData(name, uploadFileType, notebook.courseCode);

            const newFile: FileItem = {
              id: `f-new-${Date.now()}`,
              name,
              type: uploadFileType,
              size,
              uploadDate: date,
              status: 'ready',
              totalPages: uploadFileType === 'pdf' ? Math.floor(Math.random() * 15) + 4 : undefined,
              summary: meta.summary,
              transcript: meta.transcript
            };

            if (onAddNewFile) {
              onAddNewFile(notebook.id, newFile);
            }
            setIsUploadingProgress(false);
            setUploadFileName('');
            // Open modal to show what was uploaded!
            handleOpenMaterialModal(newFile);
          }, 300);
          return 100;
        }
        return prev + 30;
      });
    }, 150);
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notebook || !ytUrl) return;
    const title = ytTitle.trim() || `YouTube: ${notebook.courseCode} Lecture Video`;
    
    setIsUploadingProgress(true);
    setUploadPercent(20);

    const interval = setInterval(() => {
      setUploadPercent(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const meta = generateMockMetaData(title, 'video', notebook.courseCode);
            
            const newFile: FileItem = {
              id: `f-yt-${Date.now()}`,
              name: title,
              type: 'video', // we classify it under video media so we can render transcript
              size: 'Embed Link',
              uploadDate: date,
              status: 'ready',
              summary: `[Imported YouTube Video summary] ${meta.summary}`,
              transcript: meta.transcript
            };

            if (onAddNewFile) {
              onAddNewFile(notebook.id, newFile);
            }
            setIsUploadingProgress(false);
            setYtUrl('');
            setYtTitle('');
            handleOpenMaterialModal(newFile);
          }, 300);
          return 100;
        }
        return p + 40;
      });
    }, 150);
  };

  const handleWebSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notebook || !webUrl) return;
    const title = webTitle.trim() || `Web: Article on ${notebook.courseCode} Topics`;

    setIsUploadingProgress(true);
    setUploadPercent(20);

    const interval = setInterval(() => {
      setUploadPercent(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            const meta = generateMockMetaData(title, 'link', notebook.courseCode);

            const newFile: FileItem = {
              id: `f-web-${Date.now()}`,
              name: title,
              type: 'link', // web links use link representation style
              size: 'Indexed Web',
              uploadDate: date,
              status: 'ready',
              summary: `[Semantic Web Index Summary] Analyzed Article details: ${meta.summary}`,
              transcript: [] // no native audio transcript segments for plain text link
            };

            if (onAddNewFile) {
              onAddNewFile(notebook.id, newFile);
            }
            setIsUploadingProgress(false);
            setWebUrl('');
            setWebTitle('');
            handleOpenMaterialModal(newFile);
          }, 300);
          return 100;
        }
        return p + 40;
      });
    }, 150);
  };

  // Helper to resolve specific explanations
  const getTopicExplanation = () => {
    if (!notebook) return { title: '', text: '' };
    const code = notebook.courseCode.toUpperCase();
    const isMath = code.includes('WIX1001') || code.includes('MATH');
    const isAI = code.includes('CT044') || code.includes('CT001') || code.includes('AI');
    const isLaw = code.includes('LAW601') || code.includes('LAW');
    
    if (isMath) {
      switch (explainMode) {
        case 'beginner':
          return {
            title: "Logic Foundations Simplified",
            text: "Propositional Logic is just like deciding criteria using a list. De Morgan's Law states that we can flip logical connections (AND turns into OR, OR turns into AND) if we distribute a negative bumbung (negation) across the entire statement. It is like saying: 'It is not true that you can have both a heavy lunch AND do a fast sprint' is logically equal to: 'You did NOT have a heavy lunch, OR you did NOT do a fast sprint'."
          };
        case 'exam':
          return {
            title: "UM Exam Blueprint & Marking Scheme (WIX1001 Section B)",
            text: "Expected 10-Mark Question: Disproving logic validity via Truth Tables or Equivalence Proofs. Always write: 'L.H.S ≡ R.H.S by De Morgan's Law of Logic' rather than jumping straight to the conclusion. Double logical negation counts as +1 mark. Skipping the intermediate state results in step loss under standard University Malaya marking rubric guidance."
          };
        case 'local_analogy':
          return {
            title: "Nasi Lemak Lauk Combination Analogy 🌶️",
            text: "Imagine the UM cafeteria server saying: 'You cannot order Fried Chicken AND Squid Sambal together' (¬(A ∧ S)). This is exactly the same as: 'You do not order Fried Chicken, OR you do not order Squid Sambal' (¬A ∨ ¬S). As long as you don't take one of those sides, you do not violate the server's rule. That is De Morgan's Law for you! Simple, right?"
          };
        case 'visual':
          return {
            title: "Venn Diagram visual spatial bounds",
            text: "Visualize two intersecting circles inside a box (A and B). The intersection has a shaded overlap representing (A ∧ B). Denying this overlap ¬(A ∧ B) is equivalent to taking the union of the outer circles: everything except the center slice, which indeed is (¬A) combined under union with (¬B)."
          };
        case 'math':
          return {
            title: "Formal Logical Boolean Formulation",
            text: "Let B = {0, 1} be a boolean algebraic system. Define logical operations (¬, ∧, ∨). De Morgan asserts: ∀ x, y ∈ B: f(x, y) = ¬(x ∧ y) = (¬x) ∨ (¬y). Proof by induction on the evaluation space mapping 2² constraints: f(0,0) = ¬0 = 1 ≡ 1 ∨ 1 which is TRUE. f(1,1) = ¬1 = 0 ≡ 0 ∨ 0 which is FALSE."
          };
      }
    } else if (isAI) {
      switch (explainMode) {
        case 'beginner':
          return {
            title: "Neural Networks & Backpropagation Simplified",
            text: "An Artificial Neural Network is like a massive guessing game. Backpropagation is the feedback. When your AI makes a guess at whether an image is a local Proton Saga or Perodua Myvi, the loss measures the error. Backpropagation traces the error backwards from the output to each layer, tweaking the connections (weights) slightly using Calculus so the next guess is closer."
          };
        case 'exam':
          return {
            title: "APU Exam High-Distinction Points (CT044 Exam Section 1)",
            text: "Syllabus Checklist: 1. You must state that Backpropagation calculates the Partial Derivative of the cost function with respect to each weight: (∂C/∂W). 2. Highlight key activation limits: Exploding weights happen when gradient values exceed 1.0 continuously. To solve, state that we apply 'Gradient Clipping'. Failure to write 'Gradient Clipping' loses 2 descriptive marks."
          };
        case 'local_analogy':
          return {
            title: "Mamak Teh Tarik Scaling Analogy ☕",
            text: "You want to make the most optimal Teh Tarik recipe (minimise loss). First, you do a random pour (random weights): 5 spoons of condensed milk, 1 spoon of tea. One sip, and it is way too sweet! (Very high loss). Backpropagation is like your friend saying: 'Hey, it is too sweet! Reduce the condensed milk, add a bit more tea'. You adjust little by little (tuning gradient weights) until you get the perfect signature frothy drink. That is AI training!"
          };
        case 'visual':
          return {
            title: "Spatial Error Descent Visual Mapping",
            text: "Imagine a 3D bowl shape. The bottom of the bowl is the global minimum (perfect weights). Backpropagation calculates which way is 'down' at your current coordinate, sending a billiard ball rolling downhill stage by stage towards the bottom of the bowl."
          };
        case 'math':
          return {
            title: "Gradient Partial Derivative Formula",
            text: "Given a feedforward network layer, the Error Signal is computed, δˡ = ∇_a C ⊙ σ'(zˡ) where ⊙ denotes the Hadamard product. The change in error per weight is formulated as ∂C/∂w_jkˡ = a_kˡ⁻¹ * δ_jˡ. The weight updates on iteration t + 1 follow: w := w - α * ∇_w C."
          };
      }
    } else {
      switch (explainMode) {
        case 'beginner':
          return {
            title: "Agreement Rules Simplified",
            text: "A contract is a promise the law enforces. An invitation to treat is not a contract offer. It is simply starting a conversation. When a vendor displays products inside an air-conditioned mall in Bukit Bintang, they are inviting you to buy; only when you offer cash at the register does a formal contract negotiation lock."
          };
        case 'exam':
          return {
            title: "Taylor's LAW60104 Assessment Target points",
            text: "CRITICAL: Under Malaysian judicial precedent, you must cite the landmark case of pharmaceutical purchases (Pharmaceutical Society of Great Britain v Boots Cash Chemists 1953) to justify display shelf classifications. Spelled-out sections: Contracts Act 1950 Sec 2(a) for proposal definitions, Sec 2(b) for acceptance."
          };
        case 'local_analogy':
          return {
            title: "Mamak Maggie Goreng Request Analogy 🍜",
            text: "You see a banner at a restaurant 'Maggie Goreng Ayam RM7' (Invitation to Treat). When you say to the waiter: 'One Maggie Goreng, please!' (This is the offer proposal). When the waiter replies 'Sure thing!' and starts cooking (This is the acceptance). If they suddenly run out of noodles, you can't sue them because the banner on the wall was not an official offer, but merely an 'Invitation to Treat', okay?"
          };
        case 'visual':
          return {
            title: "Negotiation flow mapping model",
            text: "Render a linear sequence timeline: Displaying Item (Invitation) → Customer Offers Cash (Offer Proposal) → Cashier Accepts (Acceptance Lock) → Mutual Transfer of Goods & Cash (Consideration & Execution)."
          };
        case 'math':
          return {
            title: "Formal Jurisprudence Logic Matrix",
            text: "Let Contract C(P, A, R) valid iff: Prop(P) ∧ Commit(A) ∧ Consideration(R) ∧ Capacity(M) ∧ LegalConsent(C) = 1. If DisplayGoods(T) ⇒ T = InvitationToTreat ∧ T ≠ Proposal(P). Therefore C is void."
          };
      }
    }
  };

  const selectedExplanation = getTopicExplanation();

  // Highlight file type icon
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="h-5 w-5 text-rose-400" />;
      case 'video': return <Video className="h-5 w-5 text-indigo-400" />;
      case 'audio': return <Music className="h-5 w-5 text-blue-400" />;
      case 'link': return <Globe className="h-5 w-5 text-emerald-400" />;
      default: return <FileText className="h-5 w-5 text-slate-400" />;
    }
  };

  // Resolve current active file segments matched
  const filteredTranscriptSegments = selectedMaterial?.transcript?.filter(t => 
    t.text.toLowerCase().includes(transcriptSearch.toLowerCase()) ||
    t.speaker.toLowerCase().includes(transcriptSearch.toLowerCase())
  ) || [];

  // Rendering Notebooks Menu / List View (When notebook prop is null)
  if (!notebook) {
    return (
      <div className="space-y-8 text-left animate-fade-in relative z-10" id="all-notebooks-tab">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-white/10 pb-5 gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight text-white font-display flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-indigo-500 animate-pulse"></span>
              My Academic Course Notebooks
            </h1>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              Browse your organized university syllabi, verify OCR indexes, play recorded transcripts, and consult Lumiere RAG guides.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onCreateNotebookRequested}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 border border-emerald-400/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Notebook
            </button>
            <button 
              onClick={onBackToDashboard}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="h-4 w-4 text-indigo-200" />
              Central Student Dashboard
            </button>
          </div>
        </div>

        {/* Notebooks Grid Layout */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {allNotebooks.map((nb) => {
            const hasFiles = nb.files && nb.files.length > 0;
            return (
              <div 
                key={nb.id}
                onClick={() => onSelectNotebook(nb.id)}
                className="group relative rounded-3xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] backdrop-blur-xl p-6 transition-all duration-300 shadow-xl hover:shadow-indigo-500/5 cursor-pointer hover:border-indigo-500/20 flex flex-col justify-between hover:scale-[1.01]"
                id={`nb-card-${nb.id}`}
              >
                {/* Visual gradient top bar color scheme */}
                <div className={`absolute top-0 inset-x-0 h-1.5 rounded-t-3xl bg-indigo-500`} style={{
                  backgroundImage: nb.color === 'blue' ? 'linear-gradient(to right, #3b82f6, #60a5fa)' :
                                   nb.color === 'indigo' ? 'linear-gradient(to right, #6366f1, #818cf8)' :
                                   nb.color === 'amber' ? 'linear-gradient(to right, #f59e0b, #fbbf24)' :
                                   nb.color === 'cyan' ? 'linear-gradient(to right, #06b6d4, #22d3ee)' :
                                   'linear-gradient(to right, #8b5cf6, #a78bfa)'
                }}></div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between mt-2">
                    <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-[10px] font-black text-indigo-300 font-mono tracking-wider uppercase">
                      {nb.courseCode}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      Sem 1, 2026
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-md font-black text-white font-display group-hover:text-indigo-200 transition-colors">
                      {nb.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold leading-relaxed line-clamp-3">
                      {nb.description || "No customized course syllabus briefs mapped currently in details."}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4 mt-6 flex items-center justify-between">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1 text-[10.5px] text-slate-500 font-mono font-bold">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span>{nb.files ? nb.files.length : nb.fileCount} Materials</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10.5px] text-slate-500 font-mono font-bold">
                      <Sparkles className="h-4 w-4 text-indigo-400" />
                      <span>{nb.conceptCount} Nodes</span>
                    </div>
                  </div>

                  <span className="text-[10.5px] font-extrabold text-indigo-400 hover:underline flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Explore & Upload →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------
  // RENDER SINGLE NOTEBOOK DETAIL (When notebook prop is NOT null)
  // -----------------------------------------------------
  return (
    <div className="space-y-6 text-left relative z-10 animate-fade-in" id={`notebook-workspace-${notebook.id}`}>
      
      {/* Detail Header Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={() => onSelectNotebook(null)}
              className="text-xs font-extrabold text-indigo-400 hover:text-indigo-350 flex items-center gap-1 font-mono cursor-pointer hover:underline"
            >
              ← All Notebooks
            </button>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-slate-400 font-black uppercase tracking-wide font-mono">{notebook.courseCode}</span>
          </div>
          <h1 className="text-xl font-black text-white flex items-center gap-2.5 font-display mt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
            {notebook.name}
          </h1>
          <p className="text-xs text-slate-400 font-medium leading-normal max-w-2xl">
            {notebook.description}
          </p>
        </div>

        {/* Ask IA Chat helper trigger */}
        <button
          onClick={() => onAskInChat(`Explain the main points of my uploaded materials in "${notebook.name}" in a short list.`)}
          className="self-start sm:self-auto rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <Sparkles className="h-4 w-4 text-indigo-300 text-glow-indigo animate-pulse" />
          <span>Lumiere AI Assistant</span>
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* ======================================================== */}
        {/* LEFT COMPARTMENT: UPLOAD WORKSPACE & INTERACTIVE ACTIONS (5 Cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 shadow-2xl space-y-4">
            
            <div className="border-b border-white/5 pb-2">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <Plus className="h-4.5 w-4.5 text-indigo-400" />
                Add Study Materials & Links
              </h3>
              <p className="text-[10px] text-slate-500 mt-1">
                Upload files, save online articles, or process recorded YouTube webinars recursively.
              </p>
            </div>

            {/* Upload Category Toggle tabs */}
            <div className="flex bg-slate-950/45 p-1 rounded-xl border border-white/5 text-xs">
              <button 
                onClick={() => setUploadTab('file')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg font-bold transition-all ${
                  uploadTab === 'file' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                File Upload
              </button>
              <button 
                onClick={() => setUploadTab('youtube')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg font-bold transition-all ${
                  uploadTab === 'youtube' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Youtube className="h-3.5 w-3.5" />
                YouTube Link
              </button>
              <button 
                onClick={() => setUploadTab('web')}
                className={`flex-1 flex justify-center items-center gap-1.5 py-1.5 rounded-lg font-bold transition-all ${
                  uploadTab === 'web' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                Web Link
              </button>
            </div>

            {/* Simulated execution state wrapper */}
            {isUploadingProgress ? (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                <div className="relative h-12 w-12 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
                  <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-black text-white font-mono">LUMIERE AI PARSING INDEX...</p>
                  <p className="text-[10px] text-slate-500">Extracting mathematical layouts & segmenting transcripts ({uploadPercent}%)</p>
                </div>
                <div className="h-1.5 w-44 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-200" style={{ width: `${uploadPercent}%` }}></div>
                </div>
              </div>
            ) : (
              <div>
                {/* 1. FILE UPLOAD TAB */}
                {uploadTab === 'file' && (
                  <div className="space-y-4">
                    {/* Simulated Dropzone */}
                    <div className="rounded-2xl border-2 border-dashed border-white/10 hover:border-indigo-500/30 bg-slate-950/20 hover:bg-slate-950/40 p-5 text-center transition-colors">
                      <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2 animate-bounce" />
                      <span className="text-xs font-bold text-slate-300 block">Drag & Drop Slide files or Audio Recordings</span>
                      <span className="text-[10.5px] text-slate-500 block mt-1">Accept PDF, MP3, MP4, WAV, JPG, PNG format up to 50MB</span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-mono">Custom Material Name (Optional)</label>
                        <input 
                          type="text"
                          placeholder="e.g. Tutorial_3_Boolean_Inductions"
                          value={uploadFileName}
                          onChange={(e) => setUploadFileName(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-mono">File Category Type</label>
                        <select 
                          value={uploadFileType}
                          onChange={(e) => setUploadFileType(e.target.value as any)}
                          className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 px-3.5 text-xs text-slate-100 outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="pdf" className="bg-[#0f172a] text-slate-200">PDF Document Slides</option>
                          <option value="audio" className="bg-[#0f172a] text-slate-200">Audio Voice Clip (MP3/WAV)</option>
                          <option value="video" className="bg-[#0f172a] text-slate-200">Video Lecture Recording (MP4)</option>
                          <option value="image" className="bg-[#0f172a] text-slate-200">Student Handwriting Image (JPG/PNG)</option>
                        </select>
                      </div>

                      <button
                        onClick={handleSimulatedUpload}
                        className="w-full mt-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 font-bold text-white transition-all cursor-pointer shadow-lg shadow-indigo-600/10"
                      >
                        Simulate Material Upload
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. YOUTUBE VIDEO LINK TAB */}
                {uploadTab === 'youtube' && (
                  <form onSubmit={handleYoutubeSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-mono">YouTube Video URL</label>
                      <input 
                        type="url"
                        required
                        placeholder="https://www.youtube.com/watch?v=uD9f-A5WwYQ"
                        value={ytUrl}
                        onChange={(e) => setYtUrl(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-mono">Custom Video Title (Optional)</label>
                      <input 
                        type="text"
                        placeholder="e.g. MIT Discrete Math Set Theory Lecture"
                        value={ytTitle}
                        onChange={(e) => setYtTitle(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-3 text-[10.5px] leading-relaxed text-orange-200 font-semibold">
                      🎥 <span className="font-extrabold text-orange-300">Youtube Transcripts:</span> Our indexing engine automatically fetches captions, partitions clips by speaker and translates Malaysian slang overlays instantly.
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-[#ef4444] hover:bg-red-500 py-2.5 font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-red-500/10"
                    >
                      <Youtube className="h-4.5 w-4.5" />
                      Process YouTube Lecture
                    </button>
                  </form>
                )}

                {/* 3. WEB ARTICLE LINK TAB */}
                {uploadTab === 'web' && (
                  <form onSubmit={handleWebSubmit} className="space-y-4 text-xs">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-mono">Website Article URL</label>
                      <input 
                        type="url"
                        required
                        placeholder="https://en.wikipedia.org/wiki/Propositional_calculus"
                        value={webUrl}
                        onChange={(e) => setWebUrl(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 font-mono">Custom Link Title (Optional)</label>
                      <input 
                        type="text"
                        placeholder="e.g. Propositional Logic - Wikipedia"
                        value={webTitle}
                        onChange={(e) => setWebTitle(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/40 py-2.5 px-3.5 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 font-bold text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/10"
                    >
                      <Globe className="h-4.5 w-4.5" />
                      Index Webpage Content
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Quick study habits reminder sidebar */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 text-slate-300 text-xs text-left shadow-lg space-y-2">
            <h4 className="font-extrabold text-white flex items-center gap-1.5">
              <BookmarkCheck className="h-4.5 w-4.5 text-emerald-400" />
              Multi-mode Study Guidelines
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal">
              Click on any material inside your list to trigger preview boxes, read outline notes, search transcripts, or interact with play bars.
            </p>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COMPARTMENT: MATERIALS DIRECTORY LIST (7 Cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5 shadow-2xl space-y-4">
            
            {/* Header with quick search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-3">
              <div>
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono">
                  Syllabus Materials Directory ({notebook.files.length})
                </h3>
                <p className="text-[10px] text-slate-500">Select any indexed item below to open preview modals.</p>
              </div>

              {/* quick filter */}
              <div className="relative">
                <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter elements..."
                  value={materialSearchText}
                  onChange={(e) => setMaterialSearchText(e.target.value)}
                  className="rounded-lg border border-white/10 bg-slate-950/60 py-1 pl-8 pr-3 text-[10.5px] text-slate-200 outline-none focus:border-indigo-400 w-full sm:w-40"
                />
              </div>
            </div>

            {/* Uploaded items matching query */}
            <div className="space-y-2.5">
              {notebook.files.filter(f => f.name.toLowerCase().includes(materialSearchText.toLowerCase())).length > 0 ? (
                notebook.files
                  .filter(f => f.name.toLowerCase().includes(materialSearchText.toLowerCase()))
                  .map((file) => {
                    return (
                      <div
                        key={file.id}
                        onClick={() => handleOpenMaterialModal(file)}
                        className="group flex w-full items-center justify-between rounded-2xl border border-white/5 bg-slate-950/20 hover:bg-white/[0.04] p-3 text-xs transition-all duration-200 cursor-pointer hover:border-indigo-500/20"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 group-hover:bg-indigo-500/15 group-hover:border-indigo-500/20 transition-all">
                            {getFileIcon(file.type)}
                          </div>
                          <div className="text-left min-w-0 leading-snug">
                            <h4 className="truncate font-bold text-slate-200 group-hover:text-indigo-200 transition-colors">
                              {file.name}
                            </h4>
                            <div className="flex items-center gap-2 text-[9px] text-slate-500 mt-1 font-mono">
                              <span className="capitalize">{file.type}</span>
                              <span>•</span>
                              <span>{file.size}</span>
                              {file.totalPages && (
                                <>
                                  <span>•</span>
                                  <span>{file.totalPages} Slides</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-slate-500 font-mono text-right hidden sm:block">
                            Uploaded: {file.uploadDate}
                          </span>
                          <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-black text-emerald-400 uppercase font-mono tracking-wider">
                            Ready
                          </span>
                          <Eye className="h-4 w-4 text-slate-500 group-hover:text-white transition-colors ml-1" />
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-10 border border-dashed border-white/5 rounded-2xl text-slate-500 text-xs">
                  <BookOpen className="h-7 w-7 text-slate-600 mx-auto mb-2" />
                  No uploaded materials found for "{materialSearchText}"
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* "TEST ME" ACTIVE RECALL & SYLLABUS QUIZZES */}
          {/* ======================================================== */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl space-y-5 text-slate-100">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-3 gap-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                    <BrainCircuit className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
                    Continuous Active Recall
                  </h3>
                  <h2 className="text-sm font-extrabold text-white font-display">
                    Syllabus-Grounded Revision Quizzes
                  </h2>
                </div>
                
                <button
                  onClick={startQuizForNotebook}
                  className="self-start sm:self-auto rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-black text-white hover:scale-105 transition-all shadow-md shadow-indigo-600/30 border border-indigo-400/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Test Me 🧠</span>
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-slate-950/25 p-5 flex items-center gap-4 text-left">
                <div className="h-11 w-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 font-display">
                  🎯
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-200">Prepare for Exam Conditions</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Challenge your understanding with random syllabus questions sourced directly from your course documents. Every correct answer contributes to your learning memory!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* FULL PREVIEW MODAL OVERLAY (shows details, preview, summaries & transcripts) */}
      {/* ======================================================== */}
      {selectedMaterial && (
        <div 
          className="fixed inset-0 bg-[#03060b]/85 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto"
          onClick={() => { setSelectedMaterial(null); setIsPlaying(false); }}
        >
          <div 
            className="relative bg-[#0b101c] border border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-[500px] max-h-[92vh]"
            onClick={(e) => e.stopPropagation()} // retain content clicks
          >
            
            {/* Close trigger button */}
            <button 
              onClick={() => { setSelectedMaterial(null); setIsPlaying(false); }}
              className="absolute top-4 right-4 z-50 h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <X className="h-4.5 w-4.5" />
            </button>

            {/* PREVIEW COMPARTMENT (Left 45%) */}
            <div className="w-full md:w-[45%] bg-[#0e1627] border-b md:border-b-0 md:border-r border-white/10 p-5 flex flex-col justify-between overflow-y-auto max-h-[45vh] md:max-h-full">
              
              <div className="space-y-4">
                {/* Modal Title Details */}
                <div className="flex items-center gap-2.5 pb-3 border-b border-white/5">
                  <div className="rounded-lg bg-indigo-500/10 border border-indigo-500/25 p-2">
                    {getFileIcon(selectedMaterial.type)}
                  </div>
                  <div className="text-left min-w-0">
                    <h3 className="text-sm font-extrabold text-white truncate font-display" title={selectedMaterial.name}>
                      {selectedMaterial.name}
                    </h3>
                    <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">
                      {selectedMaterial.size} • Uploaded: {selectedMaterial.uploadDate}
                    </p>
                  </div>
                </div>

                {/* DYNAMIC VISUAL PREVIEW BLOCK PER TYPE */}
                <div>
                  <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 font-mono">
                    Lumiere Workspace Preview
                  </span>

                  {/* PDF PRESENTATION MOCK PREVIEW */}
                  {selectedMaterial.type === 'pdf' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-4 space-y-3 min-h-[180px] flex flex-col justify-between relative text-left">
                        <div className="absolute top-2.5 right-2.5 text-[8.5px] font-black tracking-widest text-[#6366f1] bg-[#6366f1]/10 px-1.5 py-0.5 rounded uppercase font-mono">
                          OCR EXTRACT
                        </div>

                        <div className="space-y-2 mt-2">
                          <span className="text-[9px] font-black text-slate-500 font-mono tracking-wider">
                            PAGE {modalPdfPage} OF {selectedMaterial.totalPages || 12}
                          </span>
                          
                          {modalPdfPage === 1 ? (
                            <div className="space-y-1.5 leading-relaxed text-xs">
                              <h4 className="text-sm font-bold text-white font-display">Core Concept Syllabus outlines</h4>
                              <p className="text-slate-300 font-medium text-[11px]">
                                This course reviews propositional calculus structures, logical equivalence tables, subsets and bijections equations. This represents standard curriculum requirements.
                              </p>
                            </div>
                          ) : modalPdfPage === 2 ? (
                            <div className="space-y-1.5 leading-relaxed text-xs">
                              <h4 className="text-sm font-bold text-white font-display">Rules of Logical Conversions</h4>
                              <p className="text-slate-300 font-medium text-[11px]">
                                Double logic negations: ¬(¬P) ≡ P. Idempotents assert P ∨ P ≡ P. Under De Morgan laws of computation, the negation flips operator components perfectly.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1.5 leading-relaxed text-xs">
                              <h4 className="text-sm font-bold text-white font-display">Concept Connections Block</h4>
                              <p className="text-slate-300 font-medium text-[11px]">
                                Evaluating matrices of validation. Please review past year midterm questions as logical proofs are prioritized for scoring descriptive credits.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Slide Selector */}
                        <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3 text-xs">
                          <button 
                            disabled={modalPdfPage === 1}
                            onClick={() => setModalPdfPage(prev => Math.max(1, prev - 1))}
                            className="rounded bg-white/5 hover:bg-white/10 px-2 py-1 text-[10px] font-medium text-slate-300 disabled:opacity-30 cursor-pointer"
                          >
                            Prev
                          </button>
                          <span className="font-mono text-slate-400 font-bold">Slide {modalPdfPage} / {selectedMaterial.totalPages || 12}</span>
                          <button 
                            disabled={modalPdfPage === (selectedMaterial.totalPages || 12)}
                            onClick={() => setModalPdfPage(prev => Math.min(selectedMaterial.totalPages || 12, prev + 1))}
                            className="rounded bg-white/5 hover:bg-white/10 px-2 py-1 text-[10px] font-medium text-slate-300 disabled:opacity-30 cursor-pointer"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AUDIO & VIDEO PLAYBACK PREVIEWER */}
                  {(selectedMaterial.type === 'audio' || selectedMaterial.type === 'video') && (
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-slate-950/60 p-4 border border-white/5 text-slate-300 space-y-4">
                        
                        {selectedMaterial.type === 'video' ? (
                          /* Video player thumbnail screen mockup */
                          <div className="relative aspect-video rounded-xl bg-slate-900 border border-white/10 overflow-hidden flex items-center justify-center">
                            <Video className="h-10 w-10 text-slate-600 animate-pulse" />
                            {isPlaying && (
                              <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[8px] font-black text-white uppercase tracking-wider font-mono animate-pulse">
                                <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                                Streaming
                              </div>
                            )}
                            {/* subtitles display overlap */}
                            {isPlaying && (
                              <div className="absolute bottom-3 inset-x-2 text-center">
                                <span className="inline-block bg-[#020509]/80 backdrop-blur-sm border border-white/5 whitespace-pre-wrap rounded px-2.5 py-1 text-[10.5px] font-bold text-slate-200">
                                  {selectedMaterial.transcript && selectedMaterial.transcript.length > 0
                                    ? selectedMaterial.transcript.find(t => currentTime >= t.startTime && currentTime <= t.endTime)?.text || "Lecture audio running..."
                                    : "Parsing voice tracks..."}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* Audio player icon layout */
                          <div className="flex h-16 items-center justify-center rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                            <Volume2 className={`h-8 w-8 text-indigo-400 ${isPlaying ? 'scale-110 animate-pulse' : 'opacity-40'}`} />
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="h-9 w-9 rounded-full bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white cursor-pointer shadow-md shadow-indigo-600/10"
                          >
                            {isPlaying ? <Pause className="h-4.5 w-4.5 fill-white" /> : <Play className="h-4.5 w-4.5 fill-white translate-x-0.5" />}
                          </button>
                          
                          <div className="flex-1 px-4">
                            <input 
                              type="range"
                              min="0"
                              max={audioDuration}
                              value={currentTime}
                              onChange={handleSeek}
                              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                              id="modal-seek"
                            />
                          </div>

                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {Math.floor(currentTime / 60)}:{(currentTime % 60).toString().padStart(2, '0')} / {Math.floor(audioDuration / 60)}:{(audioDuration % 60).toString().padStart(2, '0')}
                          </span>
                        </div>

                        {/* Interactive soundwave graphics visualization */}
                        <div className="h-6 flex items-end justify-between gap-0.5 px-1 opacity-70">
                          {Array.from({ length: 30 }).map((_, i) => {
                            const isPast = (i / 30) * audioDuration < currentTime;
                            const hVal = i % 2 === 0 ? 'h-4' : i % 3 === 0 ? 'h-6' : 'h-2';
                            return (
                              <div 
                                key={i} 
                                className={`w-1 rounded-full ${hVal} ${
                                  isPlaying && isPast ? 'bg-indigo-400 opacity-100' : 'bg-white/10 opacity-30'
                                }`}
                              ></div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LINK / WEBPAGE INTERACTIVE PREVIEW */}
                  {selectedMaterial.type === 'link' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-[#070b13] overflow-hidden text-left shadow-lg">
                        {/* browser header bar mockup */}
                        <div className="bg-[#121c33] px-3.5 py-2 flex items-center gap-1.5 border-b border-white/5">
                          <span className="h-2 w-2 rounded-full bg-red-500"></span>
                          <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
                          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                          <div className="ml-3 rounded-md bg-black/30 border border-white/5 px-2.5 py-0.5 text-[8.5px] font-mono text-slate-400 truncate w-full max-w-[200px]">
                            https://en.wikipedia.org/wiki/Syllabus
                          </div>
                        </div>

                        {/* simulated webpage outline content */}
                        <div className="p-4 space-y-2.5 text-xs text-slate-300 min-h-[160px] overflow-y-auto">
                          <div className="flex items-center gap-1">
                            <span className="rounded bg-indigo-500/10 px-1 text-[8px] font-bold text-indigo-300 font-mono tracking-wider">WIKIPEDIA</span>
                            <span className="text-slate-500 text-[9px]">• Article Index</span>
                          </div>
                          <h4 className="text-sm font-bold text-white font-display">{selectedMaterial.name}</h4>
                          <p className="leading-relaxed text-[11px] text-slate-400">
                            The syllabus outline includes deep descriptions on computing logic constraints, algorithms runtime estimations, normalized SME business tables, and Malaysian Business Precedent histories. Our AI has crawled this page successfully to support citations.
                          </p>
                          <a 
                            href={webUrl || "#"} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:underline font-bold"
                          >
                            Visit live webpage source
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* IMAGE / HANDWRITING OCR PREVIEW */}
                  {selectedMaterial.type === 'image' && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4 font-mono text-[9.5px] text-left leading-normal min-h-[160px] text-indigo-300 flex flex-col justify-between">
                        <div className="space-y-1">
                          <div className="text-[8.5px] font-black text-slate-500 uppercase tracking-wider">Handwriting Scribble Analyzed:</div>
                          <p className="text-white italic">"Exam Checklist: Remember Fisher vs Bell display of goods isn't standard offer! 3NF requires no transitives. ReLU maps f(x) = max(0, x). Dr. Hafizah guaranteed this!"</p>
                        </div>
                        <div className="border-t border-white/5 pt-2 mt-4 text-[8px] text-slate-500">
                          Lumiere Vision OCR model index: confidence score 98.4%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Left column bottom actions */}
              <div className="pt-4 border-t border-white/5 text-[10px] text-slate-500 font-mono text-left">
                Lumiere Indexed Concept Folder • {notebook.courseCode}
              </div>
            </div>

            {/* AI SUMMARY & TRANSCRIPT DETAILS COMPARTMENT (Right 55%, scrollable) */}
            <div className="w-full md:w-[55%] p-5 flex flex-col justify-between overflow-y-auto max-h-[50vh] md:max-h-full">
              
              <div className="space-y-5 text-left">
                
                {/* 1. LLM-GENERATED SUMMARY PANEL */}
                <div className="rounded-2xl bg-emerald-500/5 p-4 border border-emerald-500/10 space-y-2">
                  <div className="flex items-center gap-1 text-xs font-black text-emerald-400 uppercase tracking-wider font-mono">
                    <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse text-glow-emerald" />
                    LLM-Generated Brief Summary
                  </div>
                  <p className="text-xs text-emerald-200/90 leading-relaxed font-semibold">
                    {selectedMaterial.summary || "No active summary segment annotated for this item."}
                  </p>
                </div>

                {/* 2. TRANSCRIPTION SEGMENTS (Only for Audio/Video) */}
                {(selectedMaterial.type === 'audio' || selectedMaterial.type === 'video') && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider font-mono">
                        Transcription Segments ({filteredTranscriptSegments.length})
                      </span>
                      {/* Sub-search inside transcript */}
                      <div className="relative">
                        <Search className="absolute top-1/2 left-2.5 h-3 w-3 -translate-y-1/2 text-slate-500" />
                        <input 
                          type="text" 
                          placeholder="Search speech..."
                          value={transcriptSearch}
                          onChange={(e) => setTranscriptSearch(e.target.value)}
                          className="rounded-lg border border-white/5 bg-slate-950/60 py-1 pl-7 pr-2.5 text-[10px] text-slate-200 outline-none focus:border-indigo-500 w-full sm:w-36"
                        />
                      </div>
                    </div>

                    {/* Speech bubbles wrapper */}
                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {filteredTranscriptSegments.length > 0 ? (
                        filteredTranscriptSegments.map((seg) => {
                          const isSpeakingNow = currentTime >= seg.startTime && currentTime <= seg.endTime;
                          return (
                            <div
                              key={seg.id}
                              onClick={() => jumpToTimestamp(seg.startTime)}
                              className={`group text-xs text-left p-2.5 rounded-xl transition-all border cursor-pointer ${
                                isSpeakingNow
                                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-200 font-semibold'
                                  : seg.important
                                    ? 'bg-amber-500/10 border-amber-500/20 text-slate-200'
                                    : 'bg-white/[0.01] border-transparent hover:bg-white/5 text-slate-400'
                              }`}
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-extrabold text-slate-200 flex items-center gap-1.5 font-display">
                                  {seg.speaker}
                                  {seg.important && (
                                    <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[8px] text-white font-mono uppercase font-black uppercase tracking-wider">
                                      Exam Warning 🔥
                                    </span>
                                  )}
                                </span>
                                <span className="text-[9.5px] font-mono text-slate-500 group-hover:text-indigo-400 group-hover:underline">
                                  {Math.floor(seg.startTime / 60)}:{(seg.startTime % 60).toString().padStart(2, '0')}
                                </span>
                              </div>
                              <p className="leading-relaxed text-[11px] font-medium">{seg.text}</p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-6 text-[10.5px] text-slate-500 font-semibold">
                          No speech segment matching "{transcriptSearch}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Right column footer buttons */}
              <div className="flex gap-2.5 pt-4 border-t border-white/5 mt-5">
                <button
                  onClick={() => {
                    onAskInChat(`I'm reviewing the material "${selectedMaterial.name}" under course "${notebook.courseCode}". Please explain the key terms from its LLM summary: "${selectedMaterial.summary}".`);
                  }}
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold text-white shadow transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask AI About Material
                </button>
                <button
                  onClick={() => { setSelectedMaterial(null); setIsPlaying(false); }}
                  className="rounded-xl border border-white/10 hover:bg-white/5 py-2.5 px-4 text-xs font-bold text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  Close Workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* "TEST ME" HIGH-FOCUS RECALL OVERLAY MODAL */}
      {/* ======================================================== */}
      {isQuizActive && (
        <div 
          className="fixed inset-0 bg-[#040811]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
          onClick={handleExitQuiz}
        >
          <div 
            className="bg-[#0b111e] border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#0e172a]/80">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-indigo-400 uppercase tracking-widest font-mono">
                    High-Focus Recall Suite
                  </h3>
                  <h2 className="text-sm font-extrabold text-white font-display">
                    {notebook?.courseCode.toUpperCase() || "General"} Active Quiz Prep
                  </h2>
                </div>
              </div>
              <button 
                onClick={handleExitQuiz}
                className="h-7 w-7 rounded-lg bg-white/5 hover:bg-rose-500/10 hover:border-rose-500/20 border border-white/10 flex items-center justify-center text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                title="Exit quiz"
              >
                <XCircle className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* Modal Body Container with customized scrolling */}
            <div className="p-6 text-slate-100 max-h-[80vh] overflow-y-auto space-y-5">
              {isQuizDone ? (
                // State A: Quiz Completed & Stat Breakdown
                <div className="text-center py-6 space-y-5 animate-scale-up">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-2">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  </div>
                  
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-black text-white font-display">Active Quiz Session Completed!</h2>
                    <p className="text-xs text-slate-300">
                      You correctly answered <span className="font-extrabold text-emerald-400 font-mono text-base">{quizScore} / {quizQuestions.length}</span> questions covering this syllabi segment.
                    </p>
                  </div>

                  {/* High contrast visual score indicator */}
                  <div className="flex justify-center items-center py-4">
                    <div className="flex gap-2.5">
                      {quizQuestions.map((_, qIdx) => (
                        <div 
                          key={qIdx} 
                          className={`h-2.5 w-10 rounded-full transition-all ${
                            qIdx < quizScore 
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm shadow-emerald-500/20' 
                              : 'bg-white/5 border border-white/5'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Personal diagnostic notes */}
                  <div className="max-w-md mx-auto rounded-2xl bg-[#070b14] border border-white/5 p-4 text-left leading-relaxed text-xs text-slate-300">
                    <span className="font-bold text-slate-500 font-mono text-[9px] block uppercase mb-1 tracking-wider">Lumiere Study Advice & Feedback:</span>
                    {quizScore === quizQuestions.length ? (
                      <span><strong>Excellent work (Power lah)!</strong> You have a bulletproof grasp of De Morgan logic gates and core constraints. Keep it up! 🎓 🔥</span>
                    ) : quizScore >= 1 ? (
                      <span><strong>Good effort (Sudah dekat)!</strong> Review the explanation cards and Mamak analogies under the question breakdown before taking the mock exam. ☕</span>
                    ) : (
                      <span><strong>Need backup (Kena revise lagi ni)!</strong> Retake this quiz or consult Lumiere RAG guides and files in details for key definitions. 📚</span>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-4">
                    <button
                      onClick={startQuizForNotebook}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retake Recall Quiz
                    </button>
                    <button
                      onClick={handleExitQuiz}
                      className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-6 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
                    >
                      Return to Workspace
                    </button>
                  </div>
                </div>
              ) : (
                // State B: Immersive testing screen
                <div className="space-y-5 animate-slide-up">
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-[9px] font-mono font-black text-indigo-300 uppercase tracking-widest shadow-inner">
                        Question {activeQuestionIdx + 1} of {quizQuestions.length}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold font-mono">
                        {notebook?.courseCode.toUpperCase() || 'GENERAL'} Focus Environment
                      </span>
                    </div>
                    
                    <span className="text-[9.5px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      ● active exam simulator
                    </span>
                  </div>

                  {/* Actual Question */}
                  <div className="space-y-5">
                    <h3 className="text-sm font-extrabold text-white leading-relaxed font-display p-1">
                      {quizQuestions[activeQuestionIdx]?.question}
                    </h3>

                    {/* Styled MCQ options */}
                    <div className="space-y-2.5">
                      {quizQuestions[activeQuestionIdx]?.options.map((opt, oIdx) => {
                        const isUnanswered = quizAnswerIndex === null;
                        const isChosen = quizAnswerIndex === oIdx;
                        const isCorrect = quizQuestions[activeQuestionIdx]?.correctAnswer === oIdx;
                        
                        let btnStyle = "bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/[0.04] hover:border-white/10 hover:scale-[1.005]";
                        
                        if (!isUnanswered) {
                          if (isCorrect) {
                            btnStyle = "bg-emerald-500/15 border-emerald-500/80 text-emerald-200 shadow-md shadow-emerald-500/5";
                          } else if (isChosen) {
                            btnStyle = "bg-rose-500/15 border-rose-500/80 text-rose-200 scale-[0.99] opacity-90";
                          } else {
                            btnStyle = "bg-white/[0.005] border-white/5 text-slate-500 opacity-40";
                          }
                        }

                        return (
                          <button
                            key={oIdx}
                            disabled={!isUnanswered}
                            onClick={() => handleSelectQuizOption(oIdx)}
                            className={`w-full rounded-2xl border p-4 text-left text-xs font-semibold leading-relaxed transition-all flex items-start gap-4 cursor-pointer ${btnStyle}`}
                          >
                            <span className={`h-5 w-5 rounded-md border text-[9px] font-black flex items-center justify-center shrink-0 font-mono transition-colors ${
                              isChosen 
                                ? 'bg-indigo-600 border-indigo-400 text-white' 
                                : isCorrect && !isUnanswered 
                                  ? 'bg-emerald-600 border-emerald-400 text-white'
                                  : 'border-white/15 text-slate-400 bg-white/5'
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="pt-0.5">{opt}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Interactive Explanation card after picking an answer */}
                    {quizAnswerIndex !== null && (
                      <div className="rounded-2xl border border-white/10 bg-[#070b14]/70 p-5 space-y-4 animate-fade-in text-xs leading-relaxed shadow-xl">
                        <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[10px] uppercase font-mono tracking-widest">
                          <Star className="h-3.5 w-3.5 animate-spin" />
                          Lumiere AI Guidance & RAG Verification
                        </div>
                        
                        <p className="text-slate-300 font-medium">
                          {quizQuestions[activeQuestionIdx]?.explanation}
                        </p>

                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 text-amber-200">
                          <strong className="font-mono text-[9.5px] block uppercase text-amber-500 tracking-wider font-extrabold">Mamak Analogy ☕:</strong>
                          <p className="mt-1 font-semibold text-amber-100">{quizQuestions[activeQuestionIdx]?.malaysianAnalogy}</p>
                        </div>

                        <div className="flex justify-end pt-2 border-t border-white/5">
                          <button
                            onClick={handleNextQuizQuestion}
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-505 px-5 py-2.5 text-xs font-black text-[#ffffff] shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-1 transition-transform active:scale-95"
                          >
                            {activeQuestionIdx + 1 < quizQuestions.length ? "Next Question ➔" : "Finish Test Results ➔"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
