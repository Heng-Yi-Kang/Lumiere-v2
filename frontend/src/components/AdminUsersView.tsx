import React, { useEffect, useState } from 'react';
import { Shield, UserX, UserCheck } from 'lucide-react';
import { AdminUser, AuthUser } from '../types';
import { fetchAdminUsers, setAdminUserDisabled } from '../lib/adminApi';

interface AdminUsersViewProps {
  currentUser: AuthUser;
}

export default function AdminUsersView({ currentUser }: AdminUsersViewProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    void fetchAdminUsers()
      .then((nextUsers) => {
        if (!isActive) {
          return;
        }

        setUsers(nextUsers);
        setError('');
      })
      .catch((nextError) => {
        if (isActive) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to load users.');
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

  const handleToggleDisabled = async (user: AdminUser) => {
    const disabled = !user.disabled;

    setUsers((prev) => prev.map((entry) => entry.id === user.id ? { ...entry, disabled } : entry));

    try {
      await setAdminUserDisabled(user.id, disabled);
    } catch (nextError) {
      setUsers((prev) => prev.map((entry) => entry.id === user.id ? user : entry));
      setError(nextError instanceof Error ? nextError.message : 'Failed to update user.');
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="surface-card rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent-hover font-mono">Admin Console</p>
            <h1 className="mt-2 text-3xl font-black text-text-primary font-display">User Management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary font-serif">
              Disable compromised accounts and monitor workspace counts. Disabled users lose active sessions immediately.
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent-hover">
            <Shield className="h-5 w-5" />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-error/20 bg-error-subtle px-4 py-3 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <div className="surface-elevated overflow-hidden rounded-3xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border-default bg-bg-elevated/60 text-[11px] uppercase tracking-[0.14em] text-text-muted font-mono">
              <tr>
                <th className="px-5 py-4">User</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Workspace</th>
                <th className="px-5 py-4">Sessions</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {isLoading ? (
                <tr>
                  <td className="px-5 py-8 text-text-secondary" colSpan={6}>Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-text-secondary" colSpan={6}>No users found.</td>
                </tr>
              ) : users.map((user) => (
                <tr key={user.id} className="bg-bg-surface/30">
                  <td className="px-5 py-4">
                    <div className="font-bold text-text-primary">{user.name}</div>
                    <div className="mt-1 text-xs text-text-muted font-mono">{user.email}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${user.role === 'ADMIN' ? 'bg-cta-subtle text-cta' : 'bg-accent-subtle text-accent-hover'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-text-secondary">
                    {user.notebookCount} notebooks / {user.goalCount} goals
                  </td>
                  <td className="px-5 py-4 text-text-secondary">{user.sessionCount}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${user.disabled ? 'bg-error-subtle text-error' : 'bg-success/10 text-success'}`}>
                      {user.disabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      disabled={user.id === currentUser.id}
                      onClick={() => void handleToggleDisabled(user)}
                      className="premium-focus inline-flex items-center gap-2 rounded-xl border border-border-default bg-bg-elevated px-3 py-2 text-xs font-bold text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {user.disabled ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                      {user.disabled ? 'Enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
