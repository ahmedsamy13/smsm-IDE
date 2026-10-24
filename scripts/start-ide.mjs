import { spawn } from 'node:child_process';
import { ensureInterface } from './install-interface.mjs';
import { ensureCore } from './install-core.mjs';
import { requireRuntime, resolveWorkspace, prepareProfile, cleanEnvironment } from './foundation.mjs';

try {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npm start -- [project-folder | project.code-workspace]');
    process.exit(0);
  }
  if (process.platform !== 'win32') throw new Error('This foundation targets Windows.');
  const prepareOnly = args.includes('--prepare-only');
  if (prepareOnly) args.splice(args.indexOf('--prepare-only'), 1);
  if (args.length > 1) throw new Error('Pass one quoted project path.');
  const workspace = resolveWorkspace(args[0]);
  const exe = requireRuntime();
  const { userData, extensions } = prepareProfile();
  await ensureInterface({exe, userData, extensions});
  await ensureCore({exe, userData, extensions});
  if (prepareOnly) { console.log('Personal IDE profile prepared.'); process.exit(0); }
  const child = spawn(exe, [
    '--user-data-dir', userData, '--extensions-dir', extensions, '--new-window', workspace,
  ], { cwd: workspace, env: cleanEnvironment(), detached: true, stdio: 'ignore' });
  child.on('error', error => { console.error(`Could not launch IDE: ${error.message}`); process.exitCode = 1; });
  child.on('spawn', () => {
    console.log(`Personal IDE launched (PID ${child.pid}).\nProject: ${workspace}`);
    child.unref();
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
