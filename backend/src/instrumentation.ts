import { runStartupHealthCheckOnce } from '@/lib/startup-health';

export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  await runStartupHealthCheckOnce();
}
