export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { runStartupHealthCheckOnce } = await import('@/lib/startup-health');
  await runStartupHealthCheckOnce();
}
