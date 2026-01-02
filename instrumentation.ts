export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run in Node.js runtime (server-side)
    const { initializeScheduledJobs } = await import('./lib/scheduled-jobs');
    initializeScheduledJobs();
  }
}

