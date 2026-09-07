// Keep the actual browser checks unchanged; optional release proof uses only a disposable database.
import './verify-business-profile-browser.mjs';
if (process.env.PROFILE_RUN_MINIMUM_GATE === '1' && process.env.PROFILE_PROOF_MODE !== 'production' && !process.exitCode) {
  const { verifyProfileRelease } = await import('./verify-business-profile-release.mjs');
  await verifyProfileRelease();
}
