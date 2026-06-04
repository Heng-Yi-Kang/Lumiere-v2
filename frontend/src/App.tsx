import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthUser, ChatGroundingScope, GroundedChatRequest, Notebook, Goal, StudyStreak } from './types';
import FloatingDock from './components/FloatingDock';
import Header from './components/Header';
import PriorityGoalBox from './components/PriorityGoalBox';
import DashboardView from './components/DashboardView';
import NotebookView from './components/NotebookView';
import StudyBuddy from './components/StudyBuddy';
import CreateNotebookModal from './components/CreateNotebookModal';
import AuthPage from './components/AuthPage';
import AdminConsoleView from './components/AdminConsoleView';
import { createNotebook, createNotebookFile, createNotebookLink, deleteNotebook, deleteNotebookFile, fetchNotebooks, retryNotebookFileSummary, updateNotebook } from './lib/notebooksApi';
import {
  getLostUploadResponseMessage,
  getRetryLaterUploadMessage,
  isLostUploadResponseError,
  isRetryLaterUploadError,
} from './lib/apiErrors';
import { fetchCurrentUser, logout as logoutCurrentUser } from './lib/authApi';
import { createGoal, deleteGoal, fetchGoals, updateGoal as updateGoalApi } from './lib/goalsApi';
import { recordStudyActivity } from './lib/streakApi';

const pageToPath = {
  Admin: '/admin',
  Dashboard: '/dashboard',
  Notebooks: '/notebooks',
} as const;

const pathToPage = Object.fromEntries(
  Object.entries(pageToPath).map(([page, path]) => [path, page]),
) as Record<string, string>;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function countNotebookFilesNamed(notebook: Notebook | undefined, fileName: string) {
  return notebook?.files.filter((entry) => entry.name === fileName).length ?? 0;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPage = pathToPage[location.pathname] ?? 'Dashboard';
  const searchParams = new URLSearchParams(location.search);
  const activeNotebookId = currentPage === 'Notebooks' ? searchParams.get('notebookId') : null;
  const activeSearchQuery = currentPage === 'Notebooks' ? searchParams.get('search')?.trim() || '' : '';

  // Active states
  const [preFilledRequest, setPreFilledRequest] = useState<GroundedChatRequest | null>(null);
  const [globalSearchValue, setGlobalSearchValue] = useState('');
  const [isNewNotebookModalOpen, setIsNewNotebookModalOpen] = useState<boolean>(false);
  const [editingNotebook, setEditingNotebook] = useState<Notebook | null>(null);
  const [isStudyBuddyOpen, setIsStudyBuddyOpen] = useState<boolean>(false);
  const [chatGroundingScope, setChatGroundingScope] = useState<ChatGroundingScope | undefined>(undefined);
  const [rateLimitDialogMessage, setRateLimitDialogMessage] = useState('');
  const [uploadRecoveryDialogMessage, setUploadRecoveryDialogMessage] = useState('');
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoadError, setAuthLoadError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Notebook data is persisted in the backend database and shared across the workspace.
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [notebookLoadError, setNotebookLoadError] = useState<string>('');
  const notebookLoadRequestIdRef = useRef(0);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalLoadError, setGoalLoadError] = useState('');
  const [studyStreak, setStudyStreak] = useState<StudyStreak | undefined>(undefined);
  const [streakLoadError, setStreakLoadError] = useState('');

  useEffect(() => {
    setGlobalSearchValue(activeSearchQuery);
  }, [activeSearchQuery]);

  useEffect(() => {
    let isActive = true;

    void fetchCurrentUser()
      .then((user) => {
        if (!isActive) {
          return;
        }

        setAuthUser(user);
        setAuthLoadError('');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setAuthUser(null);
        const message = error instanceof Error ? error.message : '';
        setAuthLoadError(message && message !== 'authentication required' ? message : '');
      })
      .finally(() => {
        if (isActive) {
          setIsAuthLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!authUser || authUser.role === 'ADMIN') {
      setNotebooks([]);
      setNotebookLoadError('');
      return;
    }

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
  }, [authUser]);

  useEffect(() => {
    if (!authUser || authUser.role === 'ADMIN') {
      setGoals([]);
      setGoalLoadError('');
      return;
    }

    let isActive = true;

    void fetchGoals()
      .then((loadedGoals) => {
        if (!isActive) {
          return;
        }

        setGoals(loadedGoals);
        setGoalLoadError('');
      })
      .catch((error) => {
        if (isActive) {
          setGoalLoadError(error instanceof Error ? error.message : 'Failed to load goals.');
        }
      });

    return () => {
      isActive = false;
    };
  }, [authUser]);

  useEffect(() => {
    if (!authUser || authUser.role === 'ADMIN') {
      setStudyStreak(undefined);
      setStreakLoadError('');
      return;
    }

    if (currentPage !== 'Dashboard') {
      return;
    }

    let isActive = true;

    void recordStudyActivity()
      .then((streak) => {
        if (!isActive) {
          return;
        }

        setStudyStreak(streak);
        setStreakLoadError('');
      })
      .catch((error) => {
        if (isActive) {
          setStudyStreak(undefined);
          setStreakLoadError(error instanceof Error ? error.message : 'Failed to load study streak.');
        }
      });

    return () => {
      isActive = false;
    };
  }, [authUser, currentPage]);

  const curNotebooksList = notebooks;
  const reusableCourseCodes = useMemo(() => {
    return Array.from(
      new Set(
        curNotebooksList
          .map((notebook) => notebook.courseCode.trim().toUpperCase())
          .filter(Boolean),
      ),
    ).sort((firstCode, secondCode) => firstCode.localeCompare(secondCode));
  }, [curNotebooksList]);

  const activeNotebook = curNotebooksList.find(nb => nb.id === activeNotebookId);
  const hasGeneratingSummaries = curNotebooksList.some((notebook) =>
    notebook.files.some((file) => file.summaryStatus === 'in-progress'),
  );

  useEffect(() => {
    if (!hasGeneratingSummaries) {
      return;
    }

    let isActive = true;
    const intervalId = window.setInterval(() => {
      const requestId = ++notebookLoadRequestIdRef.current;

      void fetchNotebooks()
        .then((loadedNotebooks) => {
          if (!isActive || requestId !== notebookLoadRequestIdRef.current) {
            return;
          }

          setNotebooks(loadedNotebooks);
          setNotebookLoadError('');
        })
        .catch((error) => {
          if (isActive) {
            setNotebookLoadError(error instanceof Error ? error.message : 'Failed to refresh notebooks.');
          }
        });
    }, 5000);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [hasGeneratingSummaries]);

  const setCurrentPage = useCallback((page: string) => {
    navigate(pageToPath[page as keyof typeof pageToPath] ?? pageToPath.Dashboard);
  }, [navigate]);

  const buildNotebooksPath = useCallback((notebookId: string | null, searchQuery: string) => {
    const nextParams = new URLSearchParams();
    const normalizedSearch = searchQuery.trim();

    if (notebookId) {
      nextParams.set('notebookId', notebookId);
    }

    if (normalizedSearch) {
      nextParams.set('search', normalizedSearch);
    }

    const queryString = nextParams.toString();
    return queryString ? `${pageToPath.Notebooks}?${queryString}` : pageToPath.Notebooks;
  }, []);

  const openNotebook = useCallback((notebookId: string | null) => {
    navigate(buildNotebooksPath(notebookId, activeSearchQuery));
  }, [activeSearchQuery, buildNotebooksPath, navigate]);

  const handleGlobalSearchSubmit = useCallback((value: string) => {
    const normalizedSearch = value.trim();

    if (!normalizedSearch) {
      if (currentPage !== 'Notebooks') {
        return;
      }

      navigate(buildNotebooksPath(activeNotebookId, ''));
      return;
    }

    navigate(buildNotebooksPath(null, normalizedSearch));
  }, [activeNotebookId, buildNotebooksPath, currentPage, navigate]);

  const handleGlobalSearchClear = useCallback(() => {
    setGlobalSearchValue('');
    if (currentPage !== 'Notebooks') {
      return;
    }

    navigate(buildNotebooksPath(activeNotebookId, ''));
  }, [activeNotebookId, buildNotebooksPath, currentPage, navigate]);

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
    const previousMatchingFileCount = countNotebookFilesNamed(
      notebooks.find((entry) => entry.id === notebookId),
      file.name,
    );
    let notebook: Notebook;

    try {
      notebook = await createNotebookFile(notebookId, file);
    } catch (error) {
      if (isLostUploadResponseError(error)) {
        const recoveredNotebook = await recoverNotebookAfterLostUploadResponse(
          notebookId,
          file,
          previousMatchingFileCount,
        );
        if (recoveredNotebook) {
          return;
        }

        const message = getLostUploadResponseMessage();
        setUploadRecoveryDialogMessage(message);
        throw new Error(message);
      }

      if (isRetryLaterUploadError(error)) {
        const message = getRetryLaterUploadMessage();
        setRateLimitDialogMessage(message);
        throw new Error(message);
      }

      throw error;
    }

    setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? notebook : nb)));

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

  const recoverNotebookAfterLostUploadResponse = async (
    notebookId: string,
    file: File,
    previousMatchingFileCount: number,
  ) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      if (attempt > 0) {
        await sleep(1500);
      }

      const requestId = ++notebookLoadRequestIdRef.current;
      const loadedNotebooks = await fetchNotebooks().catch(() => null);
      if (!loadedNotebooks || requestId !== notebookLoadRequestIdRef.current) {
        continue;
      }

      const refreshedNotebook = loadedNotebooks.find((entry) => entry.id === notebookId);
      setNotebooks(loadedNotebooks);
      setNotebookLoadError('');

      if (countNotebookFilesNamed(refreshedNotebook, file.name) > previousMatchingFileCount) {
        return refreshedNotebook;
      }
    }

    return null;
  };

  const handleAddNewLink = async (notebookId: string, url: string) => {
    notebookLoadRequestIdRef.current += 1;
    const notebook = await createNotebookLink(notebookId, url);

    setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? notebook : nb)));
  };

  const handleDeleteFile = async (notebookId: string, fileId: string) => {
    notebookLoadRequestIdRef.current += 1;
    const notebook = await deleteNotebookFile(notebookId, fileId);

    setNotebooks((prev) => prev.map((nb) => (nb.id === notebook.id ? notebook : nb)));
  };

  const handleRetryFileSummary = async (notebookId: string, fileId: string) => {
    notebookLoadRequestIdRef.current += 1;
    const notebook = await retryNotebookFileSummary(notebookId, fileId);

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

  const handleAuthenticated = useCallback((user: AuthUser) => {
    setAuthUser(user);
    setAuthLoadError('');
    navigate(user.role === 'ADMIN' ? pageToPath.Admin : pageToPath.Dashboard, { replace: true });
  }, [navigate]);

  const handleLogout = useCallback(() => {
    void logoutCurrentUser().finally(() => {
      setAuthUser(null);
      setGoals([]);
      setNotebooks([]);
      setPreFilledRequest(null);
      setChatGroundingScope(undefined);
      navigate('/auth', { replace: true });
    });
  }, [navigate]);

  // Goals CRUD functions
  const handleAddGoal = async (text: string) => {
    setGoalLoadError('');

    try {
      const goal = await createGoal(text);
      setGoals((prev) => [...prev, goal]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create goal.';
      setGoalLoadError(message);
      throw new Error(message);
    }
  };

  const handleToggleGoal = (id: string) => {
    const previousGoal = goals.find((goal) => goal.id === id);
    if (!previousGoal) {
      return;
    }

    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
    void updateGoalApi(id, { completed: !previousGoal.completed })
      .catch((error) => {
        setGoals((prev) => prev.map((goal) => goal.id === id ? previousGoal : goal));
        setGoalLoadError(error instanceof Error ? error.message : 'Failed to update goal.');
      });
  };

  const handleSetPriorityGoal = (id: string) => {
    const previousGoals = goals;
    setGoals(prev => prev.map(g => ({ ...g, isPriority: g.id === id })));
    void updateGoalApi(id, { isPriority: true })
      .then((goal) => {
        setGoals((prev) => prev.map((entry) => entry.id === goal.id ? goal : { ...entry, isPriority: false }));
      })
      .catch((error) => {
        setGoals(previousGoals);
        setGoalLoadError(error instanceof Error ? error.message : 'Failed to update goal.');
      });
  };

  const handleDeleteGoal = (id: string) => {
    const previousGoals = goals;
    setGoals(prev => {
      const updated = prev.filter(g => g.id !== id);
      if (prev.find(g => g.id === id)?.isPriority && updated.length > 0) {
        updated[0] = { ...updated[0], isPriority: true };
      }
      return updated;
    });
    void deleteGoal(id)
      .catch((error) => {
        setGoals(previousGoals);
        setGoalLoadError(error instanceof Error ? error.message : 'Failed to delete goal.');
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

  if (isAuthLoading) {
    return (
      <div className="premium-dark flex min-h-screen items-center justify-center bg-bg-base text-text-secondary">
        Loading workspace...
      </div>
    );
  }

  if (!authUser) {
    return (
      <Routes>
        <Route
          path="/auth"
          element={(
            <AuthPage onAuthenticated={handleAuthenticated} />
          )}
        />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  if (authUser.role === 'ADMIN' && !location.pathname.startsWith('/admin')) {
    return <Navigate to={pageToPath.Admin} replace />;
  }

  if (location.pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route
          path={pageToPath.Admin}
          element={authUser.role === 'ADMIN' ? (
            <AdminConsoleView currentUser={authUser} onLogout={handleLogout} />
          ) : (
            <Navigate to={pageToPath.Dashboard} replace />
          )}
        />
        <Route path="/admin/users" element={<Navigate to={`${pageToPath.Admin}?tab=manage`} replace />} />
        <Route path="*" element={<Navigate to={pageToPath.Admin} replace />} />
      </Routes>
    );
  }

  return (
    <div className="premium-dark min-h-screen flex font-sans relative overflow-hidden">
      {authLoadError && (
        <div className="fixed right-4 top-4 z-[100] rounded-2xl border border-error/20 bg-error-subtle px-4 py-3 text-sm font-semibold text-error">
          {authLoadError}
        </div>
      )}

      {/* Floating Left Navigation Dock */}
      <FloatingDock 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        goals={goals}
        onAddGoal={handleAddGoal}
        onToggleGoal={handleToggleGoal}
        onSetPriorityGoal={handleSetPriorityGoal}
        onDeleteGoal={handleDeleteGoal}
      />

      {/* Top Priority Goal — Lower Left */}
      <PriorityGoalBox goal={goals.find(g => g.isPriority)} />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-h-screen relative z-10 bg-transparent pl-20 md:pl-24">
        {/* Top Header bar with Picker & Streak ranks */}
        <Header
          activeTab={currentPage}
          currentUser={authUser}
          searchValue={globalSearchValue}
          onSearchChange={setGlobalSearchValue}
          onSearchClear={handleGlobalSearchClear}
          onSearchSubmit={handleGlobalSearchSubmit}
          onLogout={handleLogout}
        />

        {/* Dynamic Context Canvas */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full pb-16 relative z-10">
          <Routes>
            <Route path="/" element={<Navigate to={pageToPath.Dashboard} replace />} />
            <Route
              path={pageToPath.Dashboard}
              element={(
                <DashboardView
                  currentUserName={authUser.name}
                  notebooks={curNotebooksList}
                  onOpenNotebook={openNotebook}
                  onUploadFile={handleAddNewFile}
                  onAddLink={handleAddNewLink}
                  onEditNotebook={(entry) => setEditingNotebook(entry)}
                  onDeleteNotebook={handleDeleteNotebook}
                  onCreateNotebookRequested={() => setIsNewNotebookModalOpen(true)}
                  streak={studyStreak}
                  notebookError={notebookLoadError || goalLoadError || streakLoadError}
                />
              )}
            />
            <Route
              path={pageToPath.Notebooks}
              element={(
                <NotebookView
                  notebook={activeNotebook || null}
                  allNotebooks={curNotebooksList}
                  searchQuery={activeSearchQuery}
                  onSelectNotebook={openNotebook}
                  onBackToDashboard={() => setCurrentPage('Dashboard')}
                  onUploadFile={handleAddNewFile}
                  onAddLink={handleAddNewLink}
                  onDeleteFile={handleDeleteFile}
                  onRetryFileSummary={handleRetryFileSummary}
                  onEditNotebook={(entry) => setEditingNotebook(entry)}
                  onDeleteNotebook={handleDeleteNotebook}
                  onCreateNotebookRequested={() => setIsNewNotebookModalOpen(true)}
                />
              )}
            />
            <Route
              path={pageToPath.Admin}
              element={<Navigate to={pageToPath.Admin} replace />}
            />
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
          reusableCourseCodes={reusableCourseCodes}
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
          reusableCourseCodes={reusableCourseCodes}
        />
      )}

      {rateLimitDialogMessage && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rate-limit-dialog-title"
          onClick={() => setRateLimitDialogMessage('')}
        >
          <div
            className="surface-glass w-full max-w-md rounded-3xl p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-cta font-mono">
                  Service busy
                </p>
                <h3 id="rate-limit-dialog-title" className="mt-2 text-lg font-black text-text-primary font-display">
                  Try again later
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRateLimitDialogMessage('')}
                className="premium-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-elevated/60 text-text-muted transition-colors hover:bg-bg-overlay hover:text-text-primary"
                aria-label="Close dialog"
              >
                X
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary font-serif">
              {rateLimitDialogMessage}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setRateLimitDialogMessage('')}
                className="rounded-xl bg-cta px-4 py-2 text-xs font-bold text-text-inverse transition hover:bg-cta-hover"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {uploadRecoveryDialogMessage && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-recovery-dialog-title"
          onClick={() => setUploadRecoveryDialogMessage('')}
        >
          <div
            className="surface-glass w-full max-w-md rounded-3xl p-6 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-cta font-mono">
                  Upload still running
                </p>
                <h3 id="upload-recovery-dialog-title" className="mt-2 text-lg font-black text-text-primary font-display">
                  Refresh in a moment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setUploadRecoveryDialogMessage('')}
                className="premium-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-default bg-bg-elevated/60 text-text-muted transition-colors hover:bg-bg-overlay hover:text-text-primary"
                aria-label="Close dialog"
              >
                X
              </button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary font-serif">
              {uploadRecoveryDialogMessage}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-xl bg-cta px-4 py-2 text-xs font-bold text-text-inverse transition hover:bg-cta-hover"
              >
                Refresh page
              </button>
            </div>
          </div>
        </div>
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
