import React, { useState, useEffect } from 'react';
import { UNIVERSITIES, MOCK_NOTEBOOKS, MOCK_KNOWLEDGE_GRAPH, MOCK_FLASHCARDS, MOCK_QUIZZES, MOCK_STREAK } from './data/mockData';
import { Notebook, FileItem, University, Goal } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import NotebookView from './components/NotebookView';
import StudyBuddy from './components/StudyBuddy';
import KnowledgeGraphView from './components/KnowledgeGraphView';
import RevisionView from './components/RevisionView';
import SlangLounge from './components/SlangLounge';
import CreateNotebookModal from './components/CreateNotebookModal';
import { Flame, Sparkles, BookOpen } from 'lucide-react';

export default function App() {
  // Active states
  const [selectedUniId, setSelectedUniId] = useState<string>('um');
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [preFilledQuestion, setPreFilledQuestion] = useState<string>('');
  const [isNewNotebookModalOpen, setIsNewNotebookModalOpen] = useState<boolean>(false);
  const [isStudyBuddyOpen, setIsStudyBuddyOpen] = useState<boolean>(false);

  // Loaded mock data based on university selector state
  const curUniversity = UNIVERSITIES.find(u => u.id === selectedUniId) || UNIVERSITIES[0];
  
  // Stateful notebooks to allow virtual mock uploading inside the browser (persisted to localStorage)
  const [universityNotebooks, setUniversityNotebooks] = useState<Record<string, Notebook[]>>(() => {
    const saved = localStorage.getItem('lumiere_notebooks');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) {}
    }
    return MOCK_NOTEBOOKS;
  });

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
    localStorage.setItem('lumiere_notebooks', JSON.stringify(universityNotebooks));
  }, [universityNotebooks]);

  useEffect(() => {
    localStorage.setItem('lumiere_goals', JSON.stringify(goals));
  }, [goals]);

  const curNotebooksList = universityNotebooks[selectedUniId] || [];
  const curGraphData = MOCK_KNOWLEDGE_GRAPH[selectedUniId] || { nodes: [], links: [] };

  const activeNotebook = curNotebooksList.find(nb => nb.id === activeNotebookId);

  // Trigger from Header or Selectors
  const handleSelectUni = (id: string) => {
    setSelectedUniId(id);
    setActiveNotebookId(null);
    setActiveTab('dashboard');
  };

  const handleAddNewNotebook = (name: string, courseCode: string, color: string, description: string) => {
    setUniversityNotebooks(prev => {
      const copy = { ...prev };
      const list = copy[selectedUniId] || [];
      const newNb: Notebook = {
        id: `nb-${Date.now()}`,
        name,
        courseCode,
        color,
        description,
        fileCount: 0,
        files: [],
        conceptCount: Math.floor(Math.random() * 4) + 3 // add some initial simulation concepts count
      };
      copy[selectedUniId] = [...list, newNb];
      return copy;
    });
  };

  const handleAddNewFile = (notebookId: string, file: FileItem) => {
    // Append in-memory file list
    setUniversityNotebooks(prev => {
      const copy = { ...prev };
      const list = copy[selectedUniId] || [];
      const updatedList = list.map(nb => {
        if (nb.id === notebookId) {
          return {
            ...nb,
            fileCount: nb.fileCount + 1,
            files: [file, ...nb.files]
          };
        }
        return nb;
      });
      copy[selectedUniId] = updatedList;
      return copy;
    });
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

  const handleAskInChat = (question: string) => {
    setPreFilledQuestion(question);
    setIsStudyBuddyOpen(true);
  };

  const handleOpenNotebookByCode = (code: string) => {
    const foundNb = curNotebooksList.find(n => n.courseCode.toLowerCase() === code.toLowerCase());

    if (foundNb) {
      setActiveNotebookId(foundNb.id);
      setActiveTab('notebooks');
    } else {
      setActiveTab('notebooks');
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
        activeTab={activeTab} 
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'notebooks') {
            setActiveNotebookId(null); // Show all notebooks list by default!
          }
        }} 
        selectedUniShort={curUniversity.shortName}
        goals={goals}
        onAddGoal={handleAddGoal}
        onToggleGoal={handleToggleGoal}
        onSetPriorityGoal={handleSetPriorityGoal}
        onDeleteGoal={handleDeleteGoal}
      />

      {/* Main Layout Area */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen relative z-10 bg-transparent">
        {/* Top Header bar with Picker & Streak ranks */}
        <Header 
          selectedUniId={selectedUniId} 
          onSelectUni={handleSelectUni} 
          streak={MOCK_STREAK}
          activeTab={activeTab}
        />

        {/* Dynamic Context Canvas */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full pb-16 relative z-10">
          {activeTab === 'dashboard' && (
            <DashboardView 
              notebooks={curNotebooksList}
              university={curUniversity}
              onOpenNotebook={(nbId) => {
                setActiveNotebookId(nbId);
                setActiveTab('notebooks');
              }}
              onAddNewFile={handleAddNewFile}
              onCreateNotebookRequested={() => setIsNewNotebookModalOpen(true)}
              streak={MOCK_STREAK}
            />
          )}

          {activeTab === 'notebooks' && (
            <NotebookView 
              notebook={activeNotebook || null}
              allNotebooks={curNotebooksList}
              onSelectNotebook={(id) => setActiveNotebookId(id)}
              onBackToDashboard={() => setActiveTab('dashboard')}
              onAskInChat={handleAskInChat}
              onAddNewFile={handleAddNewFile}
              onCreateNotebookRequested={() => setIsNewNotebookModalOpen(true)}
            />
          )}

          {activeTab === 'graph' && (
            <KnowledgeGraphView 
              nodes={curGraphData.nodes}
              links={curGraphData.links}
              university={curUniversity}
              onAskInChat={handleAskInChat}
              onOpenNotebookByCode={handleOpenNotebookByCode}
            />
          )}

          {activeTab === 'revision' && (
            <RevisionView 
              flashcards={MOCK_FLASHCARDS}
              quizzes={MOCK_QUIZZES}
              courses={curUniversity.courses}
              onAskInChat={handleAskInChat}
            />
          )}

          {activeTab === 'lepak' && (
            <SlangLounge />
          )}
        </main>
      </div>

      {/* Modal overlays for Create Notebook Settings */}
      {isNewNotebookModalOpen && (
        <CreateNotebookModal 
          onClose={() => setIsNewNotebookModalOpen(false)}
          onSubmit={(name, courseCode, color, description) => {
            handleAddNewNotebook(name, courseCode, color, description);
            setIsNewNotebookModalOpen(false);
          }}
          courses={curUniversity.courses}
        />
      )}

      {/* Floating Study Buddy Helper */}
      <StudyBuddy 
        notebooks={curNotebooksList}
        preFilledQuestion={preFilledQuestion}
        onClearPreFill={() => setPreFilledQuestion('')}
        isOpen={isStudyBuddyOpen}
        setIsOpen={setIsStudyBuddyOpen}
      />
    </div>
  );
}
