import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const lock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'foundation.lock.json'), 'utf8'));
export const runtimeRoot = path.join(projectRoot, '.runtime', `vscodium-${lock.version}`);
export const applicationDataRoot = process.env.PERSONAL_IDE_DATA_ROOT ? path.resolve(process.env.PERSONAL_IDE_DATA_ROOT) : path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'PersonalIDE');

export function requireRuntime() {
  const exe = path.join(runtimeRoot, 'VSCodium.exe');
  const markerPath = path.join(runtimeRoot, '.foundation-ready.json');
  if (!fs.existsSync(exe) || !fs.existsSync(markerPath)) {
    throw new Error('Foundation runtime is not prepared. Run npm run setup first.');
  }
  const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8').replace(/^\uFEFF/, ''));
  if (marker.sha256 !== lock.sha256 || marker.version !== lock.version) {
    throw new Error('Runtime does not match foundation.lock.json.');
  }
  return exe;
}

export function resolveWorkspace(input, cwd = process.cwd()) {
  const workspace = input
    ? path.resolve(cwd, input)
    : path.join(projectRoot, 'examples', 'foundation-sandbox');
  if (!fs.existsSync(workspace)) throw new Error(`Project path does not exist: ${workspace}`);
  if (!fs.statSync(workspace).isDirectory() && !workspace.endsWith('.code-workspace')) {
    throw new Error('Choose a project folder or a .code-workspace file.');
  }
  return workspace;
}

export function cleanEnvironment(source = process.env) {
  const env = { ...source };
  for (const name of Object.keys(env)) {
    if (/^(ELECTRON_RUN_AS_NODE|VSCODE_PORTABLE|VSCODE_IPC_HOOK.*|VSCODE_CWD|VSCODE_NLS_CONFIG)$/i.test(name)) {
      delete env[name];
    }
  }
  return env;
}

export function prepareProfile(localRoot = applicationDataRoot) {
  const userData = path.join(localRoot, 'profile');
  const extensions = process.env.PERSONAL_IDE_EXTENSIONS_ROOT ? path.resolve(process.env.PERSONAL_IDE_EXTENSIONS_ROOT) : path.join(localRoot, 'extensions');
  fs.mkdirSync(path.join(userData, 'User'), { recursive: true });
  fs.mkdirSync(extensions, { recursive: true });
  const settings = {
    'workbench.colorTheme': 'Default Dark Modern',
    'workbench.startupEditor': 'none',
    'window.title': 'Personal IDE${separator}${dirty}${activeEditorShort}${separator}${rootName}',
    'terminal.integrated.defaultProfile.windows': 'Windows PowerShell',
    'terminal.integrated.profiles.windows': {
      'Windows PowerShell': { path: '${env:windir}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', args: ['-NoLogo', '-NoProfile'] },
    },
    'editor.minimap.enabled': false,
    'extensions.autoUpdate': false,
    'extensions.autoCheckUpdates': false,
    'git.autofetch': false,
    'typescript.tsserver.maxTsServerMemory': 1024,
    'update.mode': 'manual',
  };
  const settingsPath = path.join(userData, 'User', 'settings.json');
  if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, { flag: 'wx' });
  const bundledCodex=path.join(projectRoot,'.runtime','codex-0.160.1','bin','codex.exe');
  fs.writeFileSync(path.join(userData,'personal-ide-runtime.json'),JSON.stringify({bundledCodex:fs.existsSync(bundledCodex)?bundledCodex:null,nodeExecutable:requireRuntime()}));
  return { userData, extensions };
}
