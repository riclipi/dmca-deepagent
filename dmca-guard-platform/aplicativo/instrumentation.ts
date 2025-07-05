export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only initialize telemetry on the server
    await import('./lib/monitoring/telemetry')
  }
}