import { runStartupHealthCheckOnce } from '@/lib/startup-health';
import { startVideoIngestionWorker } from '@/lib/video-ingestion-job';

export async function registerNodeInstrumentation() {
  await runStartupHealthCheckOnce();
  startVideoIngestionWorker();
}
