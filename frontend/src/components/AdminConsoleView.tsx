import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, LogOut, Search, Shield, UserCheck, Users, UserX } from 'lucide-react';
import { AdminUser, AdminUserStats, AuthUser } from '../types';
import { fetchAdminUsers, setAdminUserDisabled, setAdminUserRole } from '../lib/adminApi';

interface AdminConsoleViewProps {
  currentUser: AuthUser;
  onLogout: () => void;
}

type AdminTab = 'dashboard' | 'manage';
type RoleFilter = 'ALL' | AdminUser['role'];
type StatusFilter = 'ALL' | 'ACTIVE' | 'DISABLED';

const EMPTY_STATS: AdminUserStats = {
  activeSessions: 0,
  activeUsers: 0,
  adminUsers: 0,
  disabledUsers: 0,
  regularUsers: 0,
  totalGoals: 0,
  totalNotebooks: 0,
  totalUsers: 0,
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'AD';
}

function getActiveTab(search: string): AdminTab {
  const tab = new URLSearchParams(search).get('tab');
  return tab === 'manage' ? 'manage' : 'dashboard';
}

function buildStats(users: AdminUser[]): AdminUserStats {
  return users.reduce(
    (stats, user) => ({
      activeSessions: stats.activeSessions + user.sessionCount,
      activeUsers: stats.activeUsers + (user.disabled ? 0 : 1),
      adminUsers: stats.adminUsers + (user.role === 'ADMIN' ? 1 : 0),
      disabledUsers: stats.disabledUsers + (user.disabled ? 1 : 0),
      regularUsers: stats.regularUsers + (user.role === 'USER' ? 1 : 0),
      totalGoals: stats.totalGoals + user.goalCount,
      totalNotebooks: stats.totalNotebooks + user.notebookCount,
      totalUsers: stats.totalUsers + 1,
    }),
    { ...EMPTY_STATS },
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function AdminConsoleView({ currentUser, onLogout }: AdminConsoleViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = getActiveTab(location.search);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminUserStats>(EMPTY_STATS);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  useEffect(() => {
    let isActive = true;

    void fetchAdminUsers()
      .then((payload) => {
        if (!isActive) {
          return;
        }

        const nextUsers = payload.users || [];
        setUsers(nextUsers);
        setStats(payload.stats || buildStats(nextUsers));
        setError('');
      })
      .catch((nextError) => {
        if (isActive) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load admin users.');
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setStats(buildStats(users));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch = !normalizedSearch
        || user.name.toLowerCase().includes(normalizedSearch)
        || user.email.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'ALL'
        || (statusFilter === 'ACTIVE' && !user.disabled)
        || (statusFilter === 'DISABLED' && user.disabled);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  const activeAdminCount = useMemo(() => {
    return users.filter((user) => user.role === 'ADMIN' && !user.disabled).length;
  }, [users]);

  const navigateToTab = (tab: AdminTab) => {
    navigate(`/admin?tab=${tab}`);
  };

  const updateUser = (updatedUser: Partial<AdminUser>) => {
    setUsers((prev) => prev.map((entry) => entry.id === updatedUser.id ? { ...entry, ...updatedUser } : entry));
  };

  const handleToggleDisabled = async (user: AdminUser) => {
    const disabled = !user.disabled;
    const previousUser = user;

    updateUser({ id: user.id, disabled });

    try {
      const updatedUser = await setAdminUserDisabled(user.id, disabled);
      updateUser(updatedUser);
      setError('');
    } catch (nextError) {
      updateUser(previousUser);
      setError(nextError instanceof Error ? nextError.message : 'Failed to update user status.');
    }
  };

  const handleRoleChange = async (user: AdminUser, role: AdminUser['role']) => {
    if (role === user.role) {
      return;
    }

    const previousUser = user;
    updateUser({ id: user.id, role });

    try {
      const updatedUser = await setAdminUserRole(user.id, role);
      updateUser(updatedUser);
      setError('');
    } catch (nextError) {
      updateUser(previousUser);
      setError(nextError instanceof Error ? nextError.message : 'Failed to update user role.');
    }
  };

  const metricCards = [
    { label: 'Total users', value: stats.totalUsers, tone: 'text-text-primary' },
    { label: 'Active users', value: stats.activeUsers, tone: 'text-success' },
    { label: 'Disabled users', value: stats.disabledUsers, tone: 'text-error' },
    { label: 'Admins', value: stats.adminUsers, tone: 'text-cta' },
    { label: 'Regular users', value: stats.regularUsers, tone: 'text-accent-hover' },
    { label: 'Active sessions', value: stats.activeSessions, tone: 'text-text-primary' },
    { label: 'Notebooks', value: stats.totalNotebooks, tone: 'text-text-primary' },
    { label: 'Goals', value: stats.totalGoals, tone: 'text-text-primary' },
  ];

  return (
    <div className="premium-dark min-h-screen bg-bg-base text-text-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-surface/80 px-4 py-4 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-subtle text-accent-hover">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-text-muted font-mono">Lumiere Admin</p>
              <h1 className="text-xl font-black text-text-primary font-display">Admin Console</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="premium-focus inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to app
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-black text-white">
                {getInitials(currentUser.name)}
              </div>
              <span className="hidden text-xs font-bold text-text-secondary sm:inline">{currentUser.email}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="premium-focus inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <div className="surface-card rounded-3xl p-3">
          <div className="grid gap-2 md:grid-cols-2">
            <button
              type="button"
              onClick={() => navigateToTab('dashboard')}
              className={`premium-focus flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                activeTab === 'dashboard' ? 'bg-accent-subtle text-accent-hover' : 'text-text-secondary hover:bg-bg-overlay hover:text-text-primary'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigateToTab('manage')}
              className={`premium-focus flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${
                activeTab === 'manage' ? 'bg-accent-subtle text-accent-hover' : 'text-text-secondary hover:bg-bg-overlay hover:text-text-primary'
              }`}
            >
              <Users className="h-4 w-4" />
              Manage Users
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-error/20 bg-error-subtle px-4 py-3 text-sm font-semibold text-error">
            {error}
          </div>
        )}

        {activeTab === 'dashboard' ? (
          <section className="mt-6 space-y-6">
            <div className="surface-card rounded-3xl p-6 md:p-8">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent-hover font-mono">Overview</p>
              <h2 className="mt-2 text-3xl font-black text-text-primary font-display">Workspace control room</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary font-serif">
                Monitor account health, administrator coverage, sessions, and workspace volume from one admin-only view.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {metricCards.map((card) => (
                <div key={card.label} className="surface-elevated rounded-3xl p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-text-muted font-mono">{card.label}</p>
                  <div className={`mt-3 text-3xl font-black font-display ${card.tone}`}>
                    {isLoading ? '...' : card.value}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-6 space-y-6">
            <div className="surface-card rounded-3xl p-6 md:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent-hover font-mono">Manage</p>
                  <h2 className="mt-2 text-3xl font-black text-text-primary font-display">User Management</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary font-serif">
                    Search users, update roles, and enable or disable accounts. Disabling users immediately clears active sessions.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search users"
                      className="premium-focus w-full rounded-xl border border-border-default bg-bg-elevated/70 py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                    className="premium-focus rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2.5 text-sm font-bold text-text-primary outline-none"
                  >
                    <option value="ALL">All roles</option>
                    <option value="ADMIN">Admins</option>
                    <option value="USER">Users</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    className="premium-focus rounded-xl border border-border-default bg-bg-elevated/70 px-3 py-2.5 text-sm font-bold text-text-primary outline-none"
                  >
                    <option value="ALL">All statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="surface-elevated overflow-hidden rounded-3xl">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px] text-left text-sm">
                  <thead className="border-b border-border-default bg-bg-elevated/60 text-[11px] uppercase tracking-[0.14em] text-text-muted font-mono">
                    <tr>
                      <th className="px-5 py-4">User</th>
                      <th className="px-5 py-4">Role</th>
                      <th className="px-5 py-4">Workspace</th>
                      <th className="px-5 py-4">Sessions</th>
                      <th className="px-5 py-4">Joined</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {isLoading ? (
                      <tr>
                        <td className="px-5 py-8 text-text-secondary" colSpan={7}>Loading users...</td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td className="px-5 py-8 text-text-secondary" colSpan={7}>No users match the current filters.</td>
                      </tr>
                    ) : filteredUsers.map((user) => {
                      const isSelf = user.id === currentUser.id;
                      const isLastActiveAdmin = user.role === 'ADMIN' && !user.disabled && activeAdminCount <= 1;

                      return (
                        <tr key={user.id} className="bg-bg-surface/30">
                          <td className="px-5 py-4">
                            <div className="font-bold text-text-primary">{user.name}</div>
                            <div className="mt-1 text-xs text-text-muted font-mono">{user.email}</div>
                          </td>
                          <td className="px-5 py-4">
                            <select
                              value={user.role}
                              disabled={isSelf || isLastActiveAdmin}
                              onChange={(event) => void handleRoleChange(user, event.target.value as AdminUser['role'])}
                              className="premium-focus rounded-xl border border-border-default bg-bg-elevated px-3 py-2 text-xs font-black text-text-primary outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <option value="ADMIN">ADMIN</option>
                              <option value="USER">USER</option>
                            </select>
                          </td>
                          <td className="px-5 py-4 text-text-secondary">
                            {user.notebookCount} notebooks / {user.goalCount} goals
                          </td>
                          <td className="px-5 py-4 text-text-secondary">{user.sessionCount}</td>
                          <td className="px-5 py-4 text-text-secondary">{formatDate(user.createdAt)}</td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${user.disabled ? 'bg-error-subtle text-error' : 'bg-success/10 text-success'}`}>
                              {user.disabled ? 'Disabled' : 'Active'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              disabled={isSelf || isLastActiveAdmin}
                              onClick={() => void handleToggleDisabled(user)}
                              className="premium-focus inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated px-3 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {user.disabled ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                              {user.disabled ? 'Enable' : 'Disable'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
