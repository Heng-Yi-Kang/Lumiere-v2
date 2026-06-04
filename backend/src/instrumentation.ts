function importRuntimeModule<T>(specifier: string): Promise<T> {
  // Next instrumentation traces static imports and can resolve Node built-ins
  // through non-Node bundles even when guarded by NEXT_RUNTIME.
  return (new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<T>)(specifier);
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { runStartupHealthCheckOnce } = await importRuntimeModule<typeof import('@/lib/startup-health')>(
    '@/lib/startup-health',
  );
  await runStartupHealthCheckOnce();

  const { startVideoIngestionWorker } = await importRuntimeModule<typeof import('@/lib/video-ingestion-job')>(
    '@/lib/video-ingestion-job',
  );
  startVideoIngestionWorker();
}
