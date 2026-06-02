import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { AuthUser } from '../types';
import { login, signup } from '../lib/authApi';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const user = mode === 'login'
        ? await login({ email, password })
        : await signup({ email, name, password });
      onAuthenticated(user);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="premium-dark min-h-screen overflow-hidden bg-bg-base px-4 py-8 text-text-primary">
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cta/20 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-border-default bg-bg-surface/70 shadow-[0_32px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl lg:grid-cols-[1.05fr_0.95fr]">
          <section className="hidden min-h-[620px] flex-col justify-between bg-gradient-to-br from-indigo-950 via-slate-950 to-emerald-950 p-10 lg:flex">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                  <span className="text-lg font-black leading-none">L</span>
                </div>
                <span className="text-xl font-black text-white font-display">Lumiere</span>
              </div>
              <h1 className="mt-10 max-w-md text-5xl font-black leading-tight tracking-tight font-display">
                Study from your materials, not from guesses.
              </h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-300 font-serif">
                Upload lecture slides, PDFs, videos, audio, and images to chat with grounded context, get AI summaries, and keep notes attached to every file.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Grounded notebook chat over your uploaded study materials.</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Multi-format uploads with AI summaries for faster revision.</div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Add your notes to each upload and keep context in one place.</div>
            </div>
          </section>

          <section className="p-6 sm:p-10">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-accent-hover font-mono">Lumiere Auth</p>
                <h2 className="text-2xl font-black font-display">{mode === 'login' ? 'Log in' : 'Create account'}</h2>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-2xl border border-border-default bg-bg-elevated/60 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === 'login' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${mode === 'signup' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
              >
                Sign up
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-2xl border border-error/20 bg-error-subtle px-4 py-3 text-sm font-semibold text-error">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-text-muted font-mono">Name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    className="premium-focus w-full rounded-2xl border border-border-default bg-bg-elevated/70 px-4 py-3 text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted"
                    placeholder="Your display name"
                  />
                </label>
              )}

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-text-muted font-mono">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="premium-focus w-full rounded-2xl border border-border-default bg-bg-elevated/70 px-4 py-3 text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-text-muted font-mono">Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={8}
                    required
                    className="premium-focus w-full rounded-2xl border border-border-default bg-bg-elevated/70 px-4 py-3 pr-14 text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted"
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-text-secondary transition hover:text-text-primary"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="premium-focus w-full rounded-2xl bg-cta px-5 py-3 text-sm font-black text-text-inverse transition hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Working...' : mode === 'login' ? 'Get me in' : 'Get started'}
              </button>
            </form>

            <div className="mt-6 rounded-2xl border border-border-default bg-bg-elevated/40 p-4 text-xs leading-relaxed text-text-secondary">
              Use your workspace account to sign in, or create a new account if you do not have one yet.
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
