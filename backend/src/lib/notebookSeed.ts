type NotebookFileSeed = {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadDate: string;
  status: string;
  summary?: string;
  transcript?: unknown;
  totalPages?: number;
  sourceUrl?: string;
};

type NotebookSeed = {
  id: string;
  universityId: string;
  name: string;
  courseCode: string;
  color: string;
  description: string;
  conceptCount: number;
  files: NotebookFileSeed[];
};

export const DEFAULT_NOTEBOOK_SEEDS: NotebookSeed[] = [
  {
    id: 'nb-wix1001',
    universityId: 'um',
    name: 'Computing Mathematics Notes',
    courseCode: 'WIX1001',
    color: 'blue',
    description: 'Lectures on discrete structures, boolean algebra, set theory, and recurrences for test preparation.',
    conceptCount: 5,
    files: [
      {
        id: 'f-um-m1',
        name: 'Lecture_1_Propositional_Calculus.pdf',
        type: 'pdf',
        size: '4.2 MB',
        uploadDate: '24 May 2026',
        status: 'ready',
        totalPages: 12,
        summary: 'Foundations of propositional calculus with truth tables, operators, equivalent laws, and De Morgan proofs.',
      },
      {
        id: 'f-um-m2',
        name: 'Prof_Azmi_Set_Theory_Recording.mp3',
        type: 'audio',
        size: '28.1 MB',
        uploadDate: '26 May 2026',
        status: 'ready',
        summary: 'Prof. Azmi explains set theory and subsets while highlighting likely exam proof structures.',
        transcript: [
          { id: 'ts-1', startTime: 0, endTime: 12, speaker: 'Prof. Azmi', text: 'Good morning. Today we revisit set theory and subsets.' },
          { id: 'ts-2', startTime: 13, endTime: 35, speaker: 'Prof. Azmi', text: "Please pay attention to De Morgan's law. This will likely be tested.", important: true },
        ],
      },
      {
        id: 'f-um-m3',
        name: 'Discrete_Math_Recursive_Tutorial.pdf',
        type: 'pdf',
        size: '1.8 MB',
        uploadDate: '27 May 2026',
        status: 'ready',
        totalPages: 6,
        summary: 'Step-by-step tutorial on recurrence relationships and standard marking-scheme style solutions.',
      },
    ],
  },
  {
    id: 'nb-wia1002',
    universityId: 'um',
    name: 'Database Systems Masterfile',
    courseCode: 'WIA1002',
    color: 'indigo',
    description: 'SQL queries, 3NF normalisation, and entity relationship diagrams with medium-sized business domains.',
    conceptCount: 6,
    files: [
      {
        id: 'f-um-db1',
        name: 'Lecture_4_Database_Normalization_3NF.pdf',
        type: 'pdf',
        size: '5.1 MB',
        uploadDate: '15 May 2026',
        status: 'ready',
        totalPages: 18,
        summary: 'Explains First, Second, and Third Normal Form with practical examples and anomaly avoidance.',
      },
      {
        id: 'f-um-db2',
        name: 'WIA1002_Final_Past_Year_2025.pdf',
        type: 'pdf',
        size: '2.5 MB',
        uploadDate: '22 May 2026',
        status: 'ready',
        totalPages: 10,
        summary: 'Archive of the UM 2025 Database Systems final exam papers.',
      },
    ],
  },
  {
    id: 'nb-gig1003',
    universityId: 'um',
    name: 'TITAS & Ethnic Relations',
    courseCode: 'GIG1003',
    color: 'amber',
    description: 'Mandatory general subjects focusing on heritage, multi-ethnic history and societal models of development.',
    conceptCount: 4,
    files: [
      {
        id: 'f-um-titas1',
        name: 'Federal_Constitution_And_National_Principles.pdf',
        type: 'pdf',
        size: '3.6 MB',
        uploadDate: '12 May 2026',
        status: 'ready',
        totalPages: 30,
        summary: 'Historical context behind the Federal Constitution and National Principles.',
      },
    ],
  },
  {
    id: 'nb-ct001',
    universityId: 'apu',
    name: 'Introduction to AI & ML Notes',
    courseCode: 'CT044-3-1',
    color: 'cyan',
    description: 'Comprehensive deck covering neural networks, gradient descent, KNN, decision trees, and GenAI ethics.',
    conceptCount: 7,
    files: [
      {
        id: 'f-apu-ai1',
        name: 'APU_Intro_to_Neural_Networks_Slides.pdf',
        type: 'pdf',
        size: '6.4 MB',
        uploadDate: '10 May 2026',
        status: 'ready',
        totalPages: 45,
        summary: 'Defines feedforward networks, activation functions, backpropagation, error margins, and loss curves.',
      },
      {
        id: 'f-apu-ai2',
        name: 'My_AI_Project_Lecture_Dr_Hafizah.mp4',
        type: 'video',
        size: '128 MB',
        uploadDate: '18 May 2026',
        status: 'ready',
        summary: 'Dr. Hafizah explains gradient descent with a mountain descent analogy and answers overshooting questions.',
        transcript: [
          { id: 'ts-ai1', startTime: 0, endTime: 15, speaker: 'Dr. Hafizah', text: 'Welcome to AI lab. Today we look at how optimization happens in real models.' },
          { id: 'ts-ai2', startTime: 16, endTime: 40, speaker: 'Dr. Hafizah', text: 'Think of taking a downhill path from a mountain resort to the valley. That is gradient descent.', important: true },
        ],
      },
    ],
  },
  {
    id: 'nb-ct002',
    universityId: 'apu',
    name: 'Data Structures & Algorithms Techdeck',
    courseCode: 'CT055-3-1',
    color: 'rose',
    description: 'Java implementations of trees, graphs, sorting algorithms, hash maps, and Big-O complexity audits.',
    conceptCount: 8,
    files: [
      {
        id: 'f-apu-dsa1',
        name: 'Sorting_Algorithms_Cheatsheet.pdf',
        type: 'pdf',
        size: '1.9 MB',
        uploadDate: '23 May 2026',
        status: 'ready',
        totalPages: 8,
        summary: 'Table of average and worst-case runtime complexity for common sorting algorithms.',
      },
    ],
  },
  {
    id: 'nb-law601',
    universityId: 'taylors',
    name: 'Malaysian Business & Corporate Law',
    courseCode: 'LAW60104',
    color: 'red',
    description: 'Essential Malaysian law notes regarding the Contracts Act 1950, Consumer Protection Act, and company formations.',
    conceptCount: 5,
    files: [
      {
        id: 'f-law1',
        name: 'Malaysian_Contracts_Act_1950_Full.pdf',
        type: 'pdf',
        size: '3.1 MB',
        uploadDate: '05 May 2026',
        status: 'ready',
        totalPages: 24,
        summary: 'Critical provisions on offer and acceptance, consideration, coercion, and remedies in Malaysian jurisprudence.',
      },
      {
        id: 'f-law2',
        name: 'Restaurant_SST_Taxation_Law_Guide.pdf',
        type: 'pdf',
        size: '1.5 MB',
        uploadDate: '19 May 2026',
        status: 'ready',
        totalPages: 10,
        summary: 'Practical classroom guide modelling indirect taxation limits for local retail, bistros, and eateries.',
      },
    ],
  },
  {
    id: 'nb-csc118',
    universityId: 'uitm',
    name: 'Computer Problem Solving (C++)',
    courseCode: 'CSC118',
    color: 'violet',
    description: 'UiTM computer science main course covering loops, recursion, structures, pointers, and modern C++ memory management.',
    conceptCount: 6,
    files: [
      {
        id: 'f-uitm-csc1',
        name: 'CSC118_C++_Pointers_And_Classes.pdf',
        type: 'pdf',
        size: '2.8 MB',
        uploadDate: '20 May 2026',
        status: 'ready',
        totalPages: 14,
        summary: 'Covers reference variables, address pointers, dynamic allocation, and class constructor logic.',
      },
    ],
  },
];
