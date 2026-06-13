export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { registerNodeInstrumentation } = require('./instrumentation.node') as typeof import('./instrumentation.node');
  await registerNodeInstrumentation();
}
