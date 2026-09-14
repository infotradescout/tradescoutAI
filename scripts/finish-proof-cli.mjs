// Call only after cleanup and durable evidence. embedded-postgres installs a
// beforeExit hook that hardcodes status 0, so natural exit cannot carry a verdict.
export async function finishProofCli(exitCode) {
  try {
    const flushed = await Promise.allSettled([process.stdout, process.stderr].map(stream =>
      new Promise((resolve, reject) => stream.write('', error => error ? reject(error) : resolve()))));
    if (flushed.some(result => result.status === 'rejected')) exitCode = 1;
  } catch {
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}
