export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { registerNodeInstrumentation } = await (
    new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<typeof import('./instrumentation.node')>
  )('./instrumentation.node');
  await registerNodeInstrumentation();
}
