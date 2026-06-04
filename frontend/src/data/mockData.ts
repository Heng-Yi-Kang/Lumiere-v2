import { Course, Notebook, ConceptNode, ConceptLink, Flashcard, QuizQuestion, StudyStreak } from '../types';

interface StudyCatalog {
  id: string;
  name: string;
  nativeName: string;
  shortName: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  logoEmoji: string;
  courses: Course[];
}

export const STUDY_CATALOGS: StudyCatalog[] = [
  {
    id: 'um',
    name: 'University of Malaya',
    nativeName: 'University of Malaya (UM)',
    shortName: 'UM',
    primaryColor: 'blue-600',
    accentColor: 'indigo-500',
    bgColor: 'bg-blue-50/40',
    logoEmoji: '🏛️',
    courses: [
      { id: 'wix1001', code: 'WIX1001', name: 'Computing Mathematics', creditHours: 3 },
      { id: 'wix1002', code: 'WIX1002', name: 'Fundamentals of Programming (Java)', creditHours: 5 },
      { id: 'wia1002', code: 'WIA1002', name: 'Database Systems', creditHours: 4 },
      { id: 'giga1003', code: 'GIG1003', name: 'Ethnic Relations & Islamic Civilization (TITAS)', creditHours: 2 }
    ]
  },
  {
    id: 'apu',
    name: 'Asia Pacific University',
    nativeName: 'Asia Pacific University (APU)',
    shortName: 'APU',
    primaryColor: 'cyan-600',
    accentColor: 'rose-500',
    bgColor: 'bg-cyan-50/40',
    logoEmoji: '🚀',
    courses: [
      { id: 'ct001', code: 'CT044-3-1', name: 'Introduction to AI & Machine Learning', creditHours: 4 },
      { id: 'ct002', code: 'CT055-3-1', name: 'Data Structures & Algorithms', creditHours: 4 },
      { id: 'ct003', code: 'CT077-3-1', name: 'Cloud Infrastructure and Services', creditHours: 3 },
      { id: 'mqa001', code: 'MPU2162', name: 'Appreciation of Ethics and Civilisation', creditHours: 2 }
    ]
  },
  {
    id: 'taylors',
    name: "Taylor's University",
    nativeName: "Taylor's University (Lakeside)",
    shortName: 'Taylors',
    primaryColor: 'red-600',
    accentColor: 'slate-800',
    bgColor: 'bg-red-50/40',
    logoEmoji: '🌊',
    courses: [
      { id: 'law601', code: 'LAW60104', name: 'Malaysian Business & Corporate Law', creditHours: 4 },
      { id: 'fin201', code: 'FIN20103', name: 'Corporate Finance and Investment', creditHours: 3 },
      { id: 'mkt201', code: 'MKT20304', name: 'Digital Marketing & Consumer Psychology', creditHours: 4 },
      { id: 'mpu201', code: 'MPU3183', name: 'Philosophy and Current Issues', creditHours: 2 }
    ]
  },
  {
    id: 'uitm',
    name: 'MARA University of Technology',
    nativeName: 'MARA University of Technology (UiTM)',
    shortName: 'UiTM',
    primaryColor: 'violet-700',
    accentColor: 'amber-500',
    bgColor: 'bg-purple-50/40',
    logoEmoji: '🛡️',
    courses: [
      { id: 'csc118', code: 'CSC118', name: 'Fundamental of Computer Problem Solving', creditHours: 4 },
      { id: 'mat112', code: 'MAT112', name: 'Business Mathematics', creditHours: 3 },
      { id: 'law445', code: 'LAW445', name: 'Introduction to Selangor Land Administration Law', creditHours: 3 },
      { id: 'ctu551', code: 'CTU551', name: 'Islamic and Asian Civilisations (TITAS)', creditHours: 2 }
    ]
  }
];

export const MOCK_STREAK: StudyStreak = {
  currentStreak: 12,
  bestStreak: 24,
  lastActive: '2026-05-28',
  weeklyProgress: [
    { day: 'Mon', active: true, minutes: 45 },
    { day: 'Tue', active: true, minutes: 120 },
    { day: 'Wed', active: true, minutes: 75 },
    { day: 'Thu', active: true, minutes: 90 },
    { day: 'Fri', active: false, minutes: 0 },
    { day: 'Sat', active: true, minutes: 30 },
    { day: 'Sun', active: true, minutes: 110 }
  ],
  malaysianTier: 'Dean\'s Runner' // Levels: 'Faithful Student' -> 'Iced Coffee Devotee' -> 'Dean\'s Runner' -> 'Royal Award Winner'
};

export const MOCK_NOTEBOOKS: Record<string, Notebook[]> = {
  um: [
    {
      id: 'nb-wix1001',
      name: 'Computing Mathematics Notes',
      courseCode: 'WIX1001',
      courseLabel: 'Computing Mathematics',
      color: 'blue',
      description: 'Lectures on Discrete structures, boolean algebra, set theory, and recurrences for test preparation.',
      fileCount: 4,
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
          summary: 'This document defines the core foundations of Propositional Calculus. It includes truth tables, logic operators, standard logic equivalent charts, and proofs for De Morgan\'s laws.'
        },
        {
          id: 'f-um-m2',
          name: 'Prof_Azmi_Set_Theory_Recording.mp3',
          type: 'audio',
          size: '28.1 MB',
          uploadDate: '26 May 2026',
          status: 'ready',
          transcript: [
            { id: 'ts-1', startTime: 0, endTime: 12, speaker: 'Prof. Azmi', text: 'Peace be upon you and good morning everyone. Today we revisit Set Theory and the concept of subsets...', important: false },
            { id: 'ts-2', startTime: 13, endTime: 35, speaker: 'Prof. Azmi', text: 'Please pay attention to De Morgan\'s Law. I guarantee that this will be tested on your Midterm exam! Do not skip logic proofs.', important: true },
            { id: 'ts-3', startTime: 36, endTime: 55, speaker: 'Syahmi (Student)', text: 'Professor, do we need to draw Venn diagrams for 3 subsets to represent Selangor and Kuala Lumpur constituent sectors?', important: false },
            { id: 'ts-4', startTime: 56, endTime: 88, speaker: 'Prof. Azmi', text: 'Yes, Syahmi. Think of Kuala Lumpur being a subset of Selangor. Similarly, we can build logical relations using Venn diagrams. Very important, okay? Let\'s write down this relation.' }
          ],
          summary: 'In this audio clip, Prof. Azmi explains Set Theory by using Federal Territory of Kuala Lumpur as a nested subset of Selangor state, highlights likely Midterm examination proof structures, and advises Syahmi on drawing Venn Diagrams with 3 circles.'
        },
        {
          id: 'f-um-m3',
          name: 'Discrete_Math_Recursive_Tutorial.pdf',
          type: 'pdf',
          size: '1.8 MB',
          uploadDate: '27 May 2026',
          status: 'ready',
          totalPages: 6,
          summary: 'Step-by-step tutorial on solving mathematical recurrence relationships. Includes standard course marking schemes.'
        }
      ]
    },
    {
      id: 'nb-wia1002',
      name: 'Database Systems Masterfile',
      courseCode: 'WIA1002',
      courseLabel: 'Database Systems',
      color: 'indigo',
      description: 'SQL Queries, 3NF Normalization, and Entity Relationship Diagrams with medium-sized business domains.',
      fileCount: 3,
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
          summary: 'Explains First, Second, and Third Normal Form in depth. Normalising structural data schemas to avoid anomalies using restaurant bill forms as an explicit real-world schema baseline.'
        },
        {
          id: 'f-um-db2',
          name: 'WIA1002_Final_Past_Year_2025.pdf',
          type: 'pdf',
          size: '2.5 MB',
          uploadDate: '22 May 2026',
          status: 'ready',
          totalPages: 10,
          summary: 'Archive of the UM 2025 Database Systems final exam papers. High-frequency questions sorted by relational algebra, trigger creations, and dynamic procedural locks.'
        }
      ]
    },
    {
      id: 'nb-gig1003',
      name: 'TITAS & Ethnic Relations',
      courseCode: 'GIG1003',
      courseLabel: 'Ethnic Relations & Islamic Civilization (TITAS)',
      color: 'amber',
      description: 'Mandatory general subjects focusing on heritage, multi-ethnic history and societal models of development.',
      fileCount: 2,
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
          summary: 'Historical context behind the drafting of the Federal Constitution and National Principles. Contains essential timelines for general studies papers.'
        }
      ]
    }
  ],
  apu: [
    {
      id: 'nb-ct001',
      name: 'Introduction to AI & ML Notes',
      courseCode: 'CT044-3-1',
      courseLabel: 'Introduction to AI & Machine Learning',
      color: 'cyan',
      description: 'Comprehensive deck covering Neural Networks, Gradient Descent, KNN, Decision Trees, and Ethics of GenAI.',
      fileCount: 3,
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
          summary: 'Defines Feedforward network architecture, Activation Functions (Sigmoid, ReLU), Backpropagation algorithms, error margins, and loss curves.'
        },
        {
          id: 'f-apu-ai2',
          name: 'My_AI_Project_Lecture_Dr_Hafizah.mp4',
          type: 'video',
          size: '128 MB',
          uploadDate: '18 May 2026',
          status: 'ready',
          transcript: [
            { id: 'ts-ai1', startTime: 0, endTime: 15, speaker: 'Dr. Hafizah', text: 'Okay guys, welcome to APU Level 2 AI lab. Today we look at how optimization occurs in actual models. We start with Gradient Descent...', important: false },
            { id: 'ts-ai2', startTime: 16, endTime: 40, speaker: 'Dr. Hafizah', text: 'Think of taking a downhill path from the peak of a high mountain resort back down to the valley in heavy fog. You feel the slope with your feet. That steepness guides your next step. That is literally Gradient Descent!', important: true },
            { id: 'ts-ai3', startTime: 41, endTime: 58, speaker: 'APU Student', text: 'Doctor, what happens if we step too far and fall off a steep cliff? Is our learning rate too large?', important: false },
            { id: 'ts-ai4', startTime: 59, endTime: 85, speaker: 'Dr. Hafizah', text: 'Exactly! (laughs) If your learning rate alpha is too high, you overshoot local minima and bounce unstable. Overshooting makes model diverge. We code this optimization next.' }
          ],
          summary: 'In this video recording, Dr. Hafizah explains Gradient Descent via an intuitive analogy of descending safely from a highland mountain resort back down to the valley in deep fog, and answers an overshooting query using learning rate hyperparameter dynamics.'
        }
      ]
    },
    {
      id: 'nb-ct002',
      name: 'Data Structures & Algorithms Techdeck',
      courseCode: 'CT055-3-1',
      courseLabel: 'Data Structures & Algorithms',
      color: 'rose',
      description: 'Java implementations of Trees, Graphs, Sorting algorithms, Hash maps, and Big-O complexity audits.',
      fileCount: 3,
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
          summary: 'Tabulates visual mechanics, average/worst runtime complexities for QuickSort, MergeSort, BubbleSort, and InsertionSort in Java.'
        }
      ]
    }
  ],
  taylors: [
    {
      id: 'nb-law601',
      name: 'Malaysian Business & Corporate Law',
      courseCode: 'LAW60104',
      courseLabel: 'Malaysian Business & Corporate Law',
      color: 'red',
      description: 'Essential Malaysian law notes regarding the Contracts Act 1950, Consumer Protection Act, and company formations.',
      fileCount: 3,
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
          summary: 'Focuses on critical provisions: Section 2 (Offer and Acceptance), consideration principles, coercion rules, and judicial breach remedies in Malaysian jurisprudence.'
        },
        {
          id: 'f-law2',
          name: 'Restaurant_SST_Taxation_Law_Guide.pdf',
          type: 'pdf',
          size: '1.5 MB',
          uploadDate: '19 May 2026',
          status: 'ready',
          totalPages: 10,
          summary: 'Practical classroom guide modeling indirect taxation limits for local retail, bistros, and eateries.'
        }
      ]
    }
  ],
  uitm: [
    {
      id: 'nb-csc118',
      name: 'Computer Problem Solving (C++)',
      courseCode: 'CSC118',
      courseLabel: 'Fundamental of Computer Problem Solving',
      color: 'violet',
      description: 'UiTM computer science main course. Loops, recursive calls, multi-dimensional structures, pointers, and memory allocations in Modern C++.',
      fileCount: 2,
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
          summary: 'Covers reference variables, address pointers, dynamic allocation memory, class constructors, private vs public scope parameters, and C++ pointer logic.'
        }
      ]
    }
  ]
};

// Simulated cross-linked concepts Map
export const MOCK_KNOWLEDGE_GRAPH: Record<string, { nodes: ConceptNode[], links: ConceptLink[] }> = {
  um: {
    nodes: [
      {
        id: 'node-prop-calc',
        label: 'Propositional Calculus',
        courseId: 'wix1001',
        courseCode: 'WIX1001',
        description: 'Logical statements, truth valuation columns, variables, and De Morgan equivalent formulas.',
        importance: 'high',
        tags: ['Discrete Math', 'Core Logic'],
        status: 'mastered',
        prerequisites: [],
        resources: [{ name: 'Logic Crash Course Youtube', type: 'video', source: 'https://youtube.com' }]
      },
      {
        id: 'node-set-theory',
        label: 'Set Theory & Unions',
        courseId: 'wix1001',
        courseCode: 'WIX1001',
        description: 'Venn boundaries, infinite sets, relations, subsets represented in logic models.',
        importance: 'high',
        tags: ['Math Basics'],
        status: 'unexplored',
        prerequisites: ['node-prop-calc'],
        resources: [{ name: 'Prof Azmi Recording', type: 'video', source: 'Internal Playback' }]
      },
      {
        id: 'node-java-types',
        label: 'Java Primitive Data Types',
        courseId: 'wix1002',
        courseCode: 'WIX1002',
        description: 'Integers, Floating-points, Booleans, characters, and logical operations inside JVM compiled pipelines.',
        importance: 'medium',
        tags: ['OOP Basics'],
        status: 'mastered',
        prerequisites: [],
        resources: []
      },
      {
        id: 'node-logical-ops',
        label: 'Java Logical Operations',
        courseId: 'wix1002',
        courseCode: 'WIX1002',
        description: 'If-else branching, Boolean evaluations (`&&` vs `||`) connected back to Propositional Math logic tables.',
        importance: 'high',
        tags: ['Java Flow', 'Evaluation logic'],
        status: 'weak',
        prerequisites: ['node-prop-calc', 'node-java-types'], // Core Cross-linking!
        resources: [{ name: 'Java Branching Tutorial.pdf', type: 'pdf', source: 'LMS Resource' }]
      },
      {
        id: 'node-sql-join',
        label: 'Relational Joins & Algebra',
        courseId: 'wia1002',
        courseCode: 'WIA1002',
        description: 'Cartesian products, full/inner/outer joins, filtered maps translating directly to Set Venn Diagrams.',
        importance: 'high',
        tags: ['SQL Database'],
        status: 'mastered',
        prerequisites: ['node-set-theory'], // Cross-link UM math into UM database course!
        resources: []
      },
      {
        id: 'node-db-norm',
        label: '3NF Database Normalization',
        courseId: 'wia1002',
        courseCode: 'WIA1002',
        description: 'Formulating structured schemas, deleting duplicated column relationships, 1NF to 3NF logic steps.',
        importance: 'high',
        tags: ['DB Architecture', 'Midterm Topic'],
        status: 'weak',
        prerequisites: ['node-java-types'],
        resources: [{ name: 'Restaurant Order Normalisation Slides', type: 'pdf', source: 'SME Database Module' }]
      },
      {
        id: 'node-perlembagaan',
        label: 'Constitution & National Principles',
        courseId: 'giga1003',
        courseCode: 'GIG1003',
        description: 'Five key pillars, Federal Constitution mechanics, and community contracts.',
        importance: 'medium',
        tags: ['General Studies', 'UM Mandatory'],
        status: 'unexplored',
        prerequisites: [],
        resources: []
      }
    ],
    links: [
      { source: 'node-prop-calc', target: 'node-set-theory', type: 'prerequisite' },
      { source: 'node-prop-calc', target: 'node-logical-ops', type: 'interdisciplinary' }, // Discrete Math intersects Programming
      { source: 'node-java-types', target: 'node-logical-ops', type: 'prerequisite' },
      { source: 'node-set-theory', target: 'node-sql-join', type: 'interdisciplinary' },  // Set theory intersects SQL Join
      { source: 'node-java-types', target: 'node-db-norm', type: 'related' }
    ]
  },
  apu: {
    nodes: [
      {
        id: 'node-grad-desc',
        label: 'Gradient Descent Optimization',
        courseId: 'ct001',
        courseCode: 'CT044-3-1',
        description: 'Iterative optimization to calculate weights, finding minimal localized loss paths using differential steps.',
        importance: 'high',
        tags: ['AI core', 'Math ML'],
        status: 'weak',
        prerequisites: [],
        resources: [{ name: 'Mountain Resort Analogy Audio', type: 'video', source: 'Class Recording' }]
      },
      {
        id: 'node-neural-net',
        label: 'Artificial Neural Network (ANN)',
        courseId: 'ct001',
        courseCode: 'CT044-3-1',
        description: 'Multi-layered node graph, artificial neurons, hidden states, activation thresholds.',
        importance: 'high',
        tags: ['Deep Learning'],
        status: 'mastered',
        prerequisites: ['node-grad-desc'],
        resources: []
      },
      {
        id: 'node-big-o',
        label: 'Big-O Big Notation metrics',
        courseId: 'ct002',
        courseCode: 'CT055-3-1',
        description: 'Complexity index, measuring scalability limits, constant vs exponential steps.',
        importance: 'high',
        tags: ['Complexity', 'Tech Interviews'],
        status: 'mastered',
        prerequisites: [],
        resources: []
      },
      {
        id: 'node-binary-trees',
        label: 'Adelson-Velsky Landis (AVL) Trees',
        courseId: 'ct002',
        courseCode: 'CT055-3-1',
        description: 'Self-balancing binary structures. Rebalance triggers during insertions and deletions with runtime complexity bounds.',
        importance: 'medium',
        tags: ['Trees', 'APU exam specials'],
        status: 'weak',
        prerequisites: ['node-big-o'],
        resources: []
      },
      {
        id: 'node-cloud-models',
        label: 'SaaS, PaaS, IaaS Hyperscaling',
        courseId: 'ct003',
        courseCode: 'CT077-3-1',
        description: 'Cloud deployment tiers, identifying resource limits, managed compute setups (AWS/Azure).',
        importance: 'medium',
        tags: ['Cloud Basics'],
        status: 'unexplored',
        prerequisites: [],
        resources: []
      }
    ],
    links: [
      { source: 'node-grad-desc', target: 'node-neural-net', type: 'prerequisite' },
      { source: 'node-big-o', target: 'node-binary-trees', type: 'prerequisite' },
      { source: 'node-neural-net', target: 'node-cloud-models', type: 'related' }
    ]
  },
  taylors: {
    nodes: [
      {
        id: 'node-contracts-act',
        label: 'Section 2: Offer & Acceptance',
        courseId: 'law601',
        courseCode: 'LAW60104',
        description: 'Constituents of legal contracts. Differentiating invitations to treat (e.g. products displayed on shelves) and formal binding offers.',
        importance: 'high',
        tags: ['Contracts Act 1950', 'Court Precedents'],
        status: 'mastered',
        prerequisites: [],
        resources: []
      },
      {
        id: 'node-law-coercion',
        label: 'Coercion & Misrepresentation',
        courseId: 'law601',
        courseCode: 'LAW60104',
        description: 'Factors that void genuine consent. Distinguishing innocent slips from fraudulent deceptions under Malaysian commercial law.',
        importance: 'high',
        tags: ['Legal Consent', 'SSM Rules'],
        status: 'weak',
        prerequisites: ['node-contracts-act'],
        resources: []
      },
      {
        id: 'node-fin-nv',
        label: 'Net Present Value (NPV)',
        courseId: 'fin201',
        courseCode: 'FIN20103',
        description: 'Discounting future capital payouts, accounting for inflation rates under Bank Negara Malaysia guidelines.',
        importance: 'medium',
        tags: ['Finance basics'],
        status: 'mastered',
        prerequisites: [],
        resources: []
      }
    ],
    links: [
      { source: 'node-contracts-act', target: 'node-law-coercion', type: 'prerequisite' }
    ]
  },
  uitm: {
    nodes: [
      {
        id: 'node-cpp-pointers',
        label: 'Pointers & Address Memory',
        courseId: 'csc118',
        courseCode: 'CSC118',
        description: 'Declaring dereference stars (`*`), memory lookup ampersands (`&`), allocating and deallocating RAM.',
        importance: 'high',
        tags: ['C++ core', 'Memory'],
        status: 'weak',
        prerequisites: [],
        resources: []
      }
    ],
    links: []
  }
};

export const DEFAULT_COURSES = STUDY_CATALOGS[0].courses;
export const DEFAULT_KNOWLEDGE_GRAPH = MOCK_KNOWLEDGE_GRAPH.um;

// FLASHCARDS DATABASE
export const MOCK_FLASHCARDS: Record<string, Flashcard[]> = {
  wix1001: [
    {
      id: 'fc-m1',
      courseId: 'wix1001',
      front: 'What are De Morgan\'s logical equivalences?',
      back: 'De Morgan\'s laws state that:\n1. ¬(P ∧ Q) ≡ ¬P ∨ ¬Q\n2. ¬(P v Q) ≡ ¬P ∧ ¬Q\n(Useful for simplifying logic gates inside digital circuits!)',
      translatedBack: 'Study Tip: Remember to flip the middle operator. If it was AND (∧), flip it to OR (∨) when distributing the negation.'
    },
    {
      id: 'fc-m2',
      courseId: 'wix1001',
      front: 'What is a Power Set, and what is its size for set A with cardinality n?',
      back: 'The Power Set P(A) is the set of all subsets of A (including the empty set and A itself).\nIts size is exactly 2ⁿ.',
      translatedBack: 'Example: If a set of regional offices A = {East, West}, the subsets are 4: {}, {East}, {West}, and the full set {East, West}. Cardinality is 2² = 4!'
    }
  ],
  wix1002: [
    {
      id: 'fc-java-1',
      courseId: 'wix1002',
      front: 'What is JVM dynamic method dispatch in polymorphism?',
      back: 'The process in which a class method override call is resolved at runtime instead of compile-time. JVM runs the subclass version.',
      translatedBack: 'Exam Trivia: Commonly tested in computer science papers. JVM references the actual object instance on the Heap.'
    }
  ],
  wia1002: [
    {
      id: 'fc-db-1',
      courseId: 'wia1002',
      front: 'What is a Transitive Dependency in Database Normalization?',
      back: 'When a non-key column determines another non-key column (e.g. A → B, B → C, where A is PK). Violates Third Normal Form (3NF).',
      translatedBack: 'Restaurant Visual: Bill_ID determines Restaurant_Type, Restaurant_Type determines Brew_Method. Split the table to eliminate transitive dependencies!'
    }
  ],
  ct001: [
    {
      id: 'fc-ai-1',
      courseId: 'ct001',
      front: 'Why do we need activation functions in Neural Networks?',
      back: 'To introduce non-linearity! Without activation functions, no matter how many layers are stacked, the entire network remains a simple linear model.',
      translatedBack: 'Flavor Analogy: Like a complex menu dish. Without specific spices (non-linearity), the taste remains a standard linear mix without any flavor depth!'
    },
    {
      id: 'fc-ai-2',
      courseId: 'ct001',
      front: 'What is the role of the Learning Rate Alpha (α) in Gradient Descent?',
      back: 'It determines the size of the steps taken toward the local minimum. Too small = too slow. Too large = overshoots and diverges.',
      translatedBack: 'Dr. Hafizah\'s Tip: Like driving up a steep mountain in heavy fog. Accelerate too slowly and you will be late, too fast and you will crash!'
    }
  ],
  law60104: [
    {
      id: 'fc-law-1',
      courseId: 'law60104',
      front: 'What is an Invitation to Treat under the Contracts Act 1950?',
      back: 'An invitation to receive offers. Displaying goods with price tags (e.g., inside a store) is not an offer, it is an Invitation to Treat. The shopper makes the offer at the checkout counter.',
      translatedBack: 'Key Precedent: Study the landmark case of Fisher v Bell. The cashier has the right to refuse sale if the price tag is set incorrectly!'
    }
  ]
};

// MULTIPLE CHOICE QUIZZES
export const MOCK_QUIZZES: Record<string, QuizQuestion[]> = {
  wix1001: [
    {
      id: 'q-m1',
      courseId: 'wix1001',
      question: 'Let P satisfy truth value TRUE, Q satisfy truth value FALSE. What is the value of: ¬P ∨ (P ∧ ¬Q)?',
      options: ['TRUE', 'FALSE', 'Indeterminate', 'NaN'],
      correctAnswer: 0,
      explanation: '¬P is FALSE. ¬Q is TRUE. Hence (P ∧ ¬Q) is (TRUE ∧ TRUE) ≡ TRUE. Combining them under ∨ yields FALSE ∨ TRUE ≡ TRUE.',
      malaysianAnalogy: 'Coconut Rice Analogy: The Professor says, "I will serve Coconut Rice without extra sauce (P = FALSE) OR with spicy sambal (Q = TRUE)". As long as one of them is true, you\'re happy!'
    },
    {
      id: 'q-m2',
      courseId: 'wix1001',
      question: 'If a logic set contains 4 constituent elements, how many items are in its subset partition tree (including null configurations)?',
      options: ['4', '8', '16', '32'],
      correctAnswer: 2,
      explanation: 'The subset count of a set of size n is formulated as 2ⁿ. In this case, 2⁴ equals 16.',
      malaysianAnalogy: 'Like combining toppings at a salad bar stall. If there are 4 types of toppings, how many combinations are there? There are exactly 2⁴ = 16 combinations!'
    }
  ],
  ct001: [
    {
      id: 'q-ai1',
      courseId: 'ct001',
      question: 'If backpropagation calculates an extremely high correction step and the gradient values grow exponentially, what is this anomaly called?',
      options: ['Vanishing Gradients', 'Exploding Gradients', 'Overfitting Regression', 'Stochastic Quenching'],
      correctAnswer: 1,
      explanation: 'Exploding gradients occur when large derivatives accumulate, causing wild, uncontrolled weight updates at each step.',
      malaysianAnalogy: 'Like putting a handful of extra hot hot-sauce into your soup. One taste and the flavor "explodes", making it impossible to balance!'
    },
    {
      id: 'q-ai2',
      courseId: 'ct001',
      question: 'Which of the following activation functions outputs values strictly scaled between 0 and 1, mapping directly to class probabilities?',
      options: ['ReLU', 'Leaky ReLU', 'Sigmoid', 'Tanh'],
      correctAnswer: 2,
      explanation: 'The Sigmoid function maps any real value into a visual range between 0 and 1, making it ideal for binomial probability estimation.',
      malaysianAnalogy: 'Like your CGPA grade scaled into probability. A standard Sigmoid scales from 0.0 (total fail) to 1.0 (absolute Dean\'s List!).'
    }
  ],
  law60104: [
    {
      id: 'q-law1',
      courseId: 'law60104',
      question: 'Section 10 of the Malaysian Contracts Act 1950 lists essential conditions of an agreement. Which of these is NOT an absolute requirement?',
      options: ['Free consent of the parties', 'Competency to contract', 'Lawful consideration', 'Written on stamped official letterhead'],
      correctAnswer: 3,
      explanation: 'A contract under the Contracts Act 1950 can be legal and enforceable orally; stamping or formal letterheads are administrative procedures but do not govern the core definition of a contract.',
      malaysianAnalogy: 'Verbal agreements (such as "I\'ll buy your motorcycle for $2,000," and "Deal!") at an eatery constitute a legally binding contract, provided there is mutual consent, consideration of $2,000, and legal capacity.'
    }
  ]
};

// Generic study tips glossary for students
export const SLANG_TIPS = [
  { phrase: "Dean's List Goal", meaning: "Aim for a strong semester by setting weekly targets, checking progress early, and protecting focused revision time." },
  { phrase: "Overloaded Syllabus", meaning: "When the workload feels heavy, split topics into small batches and prioritize the areas most likely to affect your grade." },
  { phrase: "Cooperative Study Sessions", meaning: "Study with peers by assigning each person a topic, teaching it back, and comparing answers to practice questions." },
  { phrase: "Mandatory Core Courses", meaning: "For required subjects, focus first on recurring concepts, common question patterns, and definitions that need exact wording." },
  { phrase: "Study Week Preparations", meaning: "Use the final revision week for timed practice, active recall, and targeted review of weaker topics instead of rereading everything." }
];
