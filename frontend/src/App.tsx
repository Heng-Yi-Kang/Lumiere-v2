import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { UNIVERSITIES, MOCK_KNOWLEDGE_GRAPH, MOCK_FLASHCARDS, MOCK_QUIZZES, MOCK_STREAK } from './data/mockData';
import { ChatGroundingScope, GroundedChatRequest, Notebook, Goal } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import NotebookView from './components/NotebookView';
import StudyBuddy from './components/StudyBuddy';
import KnowledgeGraphView from './components/KnowledgeGraphView';
import RevisionView from './components/RevisionView';
import SlangLounge from './components/SlangLounge';
import CreateNotebookModal from './components/CreateNotebookModal';
import { createNotebook, createNotebookFile, deleteNotebook, deleteNotebookFile, fetchNotebooks, updateNotebook } from './lib/notebooksApi';

const pageToPath = {
  Dashboard: '/dashboard',
  Notebooks: '/notebooks',
  KnowledgeGraph: '/knowledge-graph',
  Revision: '/revision',
  StudyLounge: '/study-lounge',
} as const;

const pathToPage = Object.fromEntries(
  Object.entries(pageToPath).map(([page, path]) => [path, page]),
) as Record<string, string>;

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = pathToPage[location.pathname] ?? 'Dashboard';
  const searchParams = new URLSearchParams(location.search);
  const activeNotebookId = currentPage === 'Notebooks' ? searchParams.get('notebookId') : null;

  // Active states
  const [selectedUniId, setSelectedUniId] = useState<string>('um');
  const [preFilledRequest, setPreFilledRequest] = useState<GroundedChatRequest | null>(null);
  const [isNewNotebookModalOpen, setIsNewNotebookModalOpen] = useState<boolean>(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [isStudyBuddyOpen, setIsStudyBuddyOpen] = useState<boolean>(false);
  const [chatGroundingScope, setChatGroundingScope] = useState<ChatGroundingScope | undefined>(undefined);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Loaded mock data based on university selector state
  const curUniversity = UNIVERSITIES.find(u => u.id === selectedUniId) || UNIVERSITIES[0];
  
  // Notebook data is persisted in the backend database and shared across the workspace.
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebookLoadError, setNotebookLoadError] = useState<string>('');
  const notebookLoadRequestIdRef = useRef(0);

  // Track goals with Local Storage persistence
  const [goals, setGoals] = useState<Goal[]>(() => {
    const saved = localStorage.getItem('lumiere_goals');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return [
      { id: 'goal-1', text: 'Score 4.00 CGPA Flat this Semester 🎯', completed: false, isPriority: true },
      { id: 'goal-2', text: 'Master Discrete Math Logic proofs with active recall', completed: false, isPriority: false },
      { id: 'goal-3', text: 'Complete Java normalisation database assignment on time', completed: true, isPriority: false }
    ];
  });

  useEffect(() => {
    localStorage.setItem('lumiere_goals', JSON.stringify(goals));
  }, [goals]);

  useEffect(() => {
    const loadNotebooks = async () => {
      const requestId = ++notebookLoadRequestIdRef.current;

      try {
        setNotebookLoadError('');
        const loadedNotebooks = await fetchNotebooks();
        if (requestId !== notebookLoadRequestIdRef.current) {
          return;
        }

        setNotebooks(loadedNotebooks);
      } catch (error) {
        if (requestId !== notebookLoadRequestIdRef.current) {
          return;
        }

        setNotebookLoadError(error instanceof Error ? error.message : 'Failed to load notebooks.');
      }
    };

    void loadNotebooks();
  }, []);

  const curNotebooksList = notebooks;
  const curGraphData = MOCK_KNOWLEDGE_GRAPH[selectedUniId] || { nodes: [], links: [] };

  const activeNotebook = curNotebooksList.find(nb => nb.id === activeNotebookId);

  const setCurrentPage = useCallback((page: string) => {
    navigate(pageToPath[page as keyof typeof pageToPath] ?? pageToPath.Dashboard);
  }, [navigate]);

  const openNotebook = useCallback((notebookId: string | null) => {
    if (!notebookId) {
      navigate(pageToPath.Notebooks);
      return;
    }

    navigate(`${pageToPath.Notebooks}?notebookId=${encodeURIComponent(notebookId)}`);
  }, [navigate]);

  // Trigger from Header or Selectors
  const handleSelectUni = (id: string) => {
    setSelectedUniId(id);
    setCurrentPage('Dashboard');
  };

  const handleAddNewNotebook = async (name: string, courseCode: string, color: string, description: string) => {
    notebookLoadRequestIdRef.current += 1;
    const notebook = await createNotebook({
      name,
      courseCode,
      color,
      description,
    });

    setNotebooks((prev) => [notebook, ...prev]);
  };

  const handleAddNewFile = async (notebookId: string, file: File) => {
    notebookLoadRequestIdRef.current += 1;
    const notebook = await createNotebookFile(notebookId, file);

    setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? notebook : nb)));
  };

  const handleDeleteFile = async (notebookId: string, fileId: string) => {
    notebookLoadRequestIdRef.current += 1;
    const notebook = await deleteNotebookFile(notebookId, fileId);

    setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? notebook : nb)));
  };

  const handleUpdateNotebook = async (notebookId: string, name: string, color: string, description: string) => {
    notebookLoadRequestIdRef.current += 1;
    const previousNotebook = notebooks.find((nb) => nb.id === notebookId);

    setNotebooks((prev) =>
      prev.map((nb) => (nb.id === notebookId ? { ...nb, name, color, description } : nb)),
    );

    try {
      const notebook = await updateNotebook(notebookId, {
        name,
        color,
        description,
      });

      setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? notebook : nb)));
    } catch (error) {
      if (previousNotebook) {
        setNotebooks((prev) =>
          prev.map((nb) => (nb.id === notebookId ? previousNotebook : nb)),
        );
      }

      throw error;
    }
  };

  const handleDeleteNotebook = async (notebookId: string) => {
    notebookLoadRequestIdRef.current += 1;
    const deletedNotebook = notebooks.find((nb) => nb.id === notebookId);
    const wasActiveNotebook = activeNotebookId === notebookId;

    setNotebooks((prev) => prev.filter((nb) => nb.id !== notebookId));

    if (wasActiveNotebook) {
      openNotebook(null);
    }

    try {
      await deleteNotebook(notebookId);
    } catch (error) {
      if (deletedNotebook) {
        setNotebooks((prev) =>
          prev.some((nb) => nb.id === notebookId) ? prev : [deletedNotebook, ...prev],
        );
      }

      if (wasActiveNotebook) {
        openNotebook(notebookId);
      }

      throw error;
    }

    try {
      const requestId = ++notebookLoadRequestIdRef.current;
      const loadedNotebooks = await fetchNotebooks();
      if (requestId === notebookLoadRequestIdRef.current) {
        setNotebooks(loadedNotebooks);
        setNotebookLoadError('');
      }
    } catch (error) {
      setNotebookLoadError(error instanceof Error ? error.message : 'Failed to refresh notebooks.');
    }
  };

  // Goals CRUD functions
  const handleAddGoal = (text: string) => {
    setGoals(prev => [
      ...prev,
      { id: `goal-${Date.now()}`, text, completed: false, isPriority: prev.length === 0 }
    ]);
  };

  const handleToggleGoal = (id: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const handleSetPriorityGoal = (id: string) => {
    setGoals(prev => prev.map(g => ({ ...g, isPriority: g.id === id })));
  };

  const handleDeleteGoal = (id: string) => {
    setGoals(prev => {
      const updated = prev.filter(g => g.id !== id);
      if (prev.find(g => g.id === id)?.isPriority && updated.length > 0) {
        updated[0].isPriority = true;
      }
      return updated;
    });
  };

  const activeGroundingScope: ChatGroundingScope | undefined = activeNotebook
    ? {
        notebookId: activeNotebook.id,
        notebookName: activeNotebook.name,
      }
    : undefined;
  const studyBuddyGroundingScope = chatGroundingScope || activeGroundingScope;

  useEffect(() => {
    if (chatGroundingScope && chatGroundingScope.notebookId !== activeNotebook?.id) {
      setChatGroundingScope(undefined);
    }
  }, [activeNotebook?.id, chatGroundingScope]);

  const handleAskInChat = (question: string, scope?: ChatGroundingScope) => {
    setChatGroundingScope(scope || activeGroundingScope);
    setPreFilledRequest({
      question,
      scope: scope || activeGroundingScope,
    });
    setIsStudyBuddyOpen(true);
  };

  const handleOpenNotebookByCode = (code: string) => {
    const foundNb = curNotebooksList.find(n => n.courseCode.toLowerCase() === code.toLowerCase());

    if (foundNb) {
      openNotebook(foundNb.id);
    } else {
      openNotebook(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] flex text-slate-100 font-sans relative overflow-hidden">
      {/* Dynamic Ambient Blur Glows matching Design HTML */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/15 rounded-full blur-[120px] animate-glow-slow-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-fuchsia-600/10 rounded-full blur-[150px] animate-glow-slow-2"></div>
        <div className="absolute top-[20%] right-[15%] w-[35%] h-[35%] bg-emerald-500/10 rounded-full blur-[100px] animate-glow-slow-3"></div>
      </div>

      {/* Floating/Standard Left Navigation sidebar with interactive goals */}
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        selectedUniShort={curUniversity.shortName}
        goals={goals}
        onAddGoal={handleAddGoal}
        onToggleGoal={handleToggleGoal}
        onSetPriorityGoal={handleSetPriorityGoal}
        onDeleteGoal={handleDeleteGoal}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Layout Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen relative z-10 bg-transparent transition-[padding] duration-300 ${
          isSidebarCollapsed ? 'pl-20' : 'pl-64'
        }`}
      >
        {/* Top Header bar with Picker & Streak ranks */}
        <Header 
          selectedUniId={selectedUniId} 
          onSelectUni={handleSelectUni} 
          streak={MOCK_STREAK}
          activeTab={currentPage}
        />

        {/* Dynamic Context Canvas */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pb-16 relative z-10">
          <Routes>
            <Route path="/" element={<Navigate to={pageToPath.Dashboard} replace />} />
            <Route
              path={pageToPath.Dashboard}
              element={(
                <DashboardView
                  notebooks={curNotebooksList}
                  onOpenNotebook={openNotebook}
                  onUploadFile={handleAddNewFile}
                  onEditNotebook={(entry) => setEditingNotebook(entry)}
                  onDeleteNotebook={handleDeleteNotebook}
                  onCreateNotebookRequested={() => setIsNewNotebookModalOpen(true)}
                  streak={MOCK_STREAK}
                  notebookError={notebookLoadError}
                />
              )}
            />
            <Route
              path={pageToPath.Notebooks}
              element={(
                <NotebookView
                  notebook={activeNotebook || null}
                  allNotebooks={curNotebooksList}
                  onSelectNotebook={openNotebook}
                  onBackToDashboard={() => setCurrentPage('Dashboard')}
                  onAskInChat={handleAskInChat}
                  onUploadFile={handleAddNewFile}
                  onDeleteFile={handleDeleteFile}
                  onEditNotebook={(entry) => setEditingNotebook(entry)}
                  onDeleteNotebook={handleDeleteNotebook}
                  onCreateNotebookRequested={() => setIsNewNotebookModalOpen(true)}
                />
              )}
            />
            <Route
              path={pageToPath.KnowledgeGraph}
              element={(
                <KnowledgeGraphView
                  nodes={curGraphData.nodes}
                  links={curGraphData.links}
                  university={curUniversity}
                  onAskInChat={handleAskInChat}
                  onOpenNotebookByCode={handleOpenNotebookByCode}
                />
              )}
            />
            <Route
              path={pageToPath.Revision}
              element={(
                <RevisionView
                  flashcards={MOCK_FLASHCARDS}
                  quizzes={MOCK_QUIZZES}
                  courses={curUniversity.courses}
                  onAskInChat={handleAskInChat}
                />
              )}
            />
            <Route path={pageToPath.StudyLounge} element={<SlangLounge />} />
            <Route path="*" element={<Navigate to={pageToPath.Dashboard} replace />} />
          </Routes>
        </main>
      </div>

      {/* Modal overlays for Create Notebook Settings */}
      {isNewNotebookModalOpen && (
        <CreateNotebookModal 
          onClose={() => setIsNewNotebookModalOpen(false)}
          onSubmit={async (name, courseCode, color, description) => {
            await handleAddNewNotebook(name, courseCode, color, description);
            setIsNewNotebookModalOpen(false);
          }}
          courses={curUniversity.courses}
        />
      )}

      {editingNotebook && (
        <CreateNotebookModal
          mode="edit"
          initialValues={{
            name: editingNotebook.name,
            courseCode: editingNotebook.courseCode,
            color: editingNotebook.color,
            description: editingNotebook.description,
          }}
          onClose={() => setEditingNotebook(null)}
          onSubmit={async (name, _courseCode, color, description) => {
            await handleUpdateNotebook(editingNotebook.id, name, color, description);
            setEditingNotebook(null);
          }}
          courses={curUniversity.courses}
        />
      )}

      {/* Floating Study Buddy Helper */}
      <StudyBuddy 
        notebooks={curNotebooksList}
        activeGroundingScope={studyBuddyGroundingScope}
        preFilledRequest={preFilledRequest}
        onClearPreFill={() => setPreFilledRequest(null)}
        isOpen={isStudyBuddyOpen}
        setIsOpen={setIsStudyBuddyOpen}
      />
    </div>
  );
}
