import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { cleanEnvironment, prepareProfile, resolveWorkspace } from '../scripts/foundation.mjs';

test('launcher isolates inherited Electron/VS Code launch state without removing the ordinary environment', () => {
  const input = { ELECTRON_RUN_AS_NODE: '1', VSCODE_IPC_HOOK_CLI: 'parent', VSCODE_PORTABLE: 'other', Path: 'tools', USERPROFILE: 'home' };
  assert.deepEqual(cleanEnvironment(input), { Path: 'tools', USERPROFILE: 'home' });
  assert.equal(input.ELECTRON_RUN_AS_NODE, '1');
});

test('project selection handles spaces and rejects a missing folder', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ide-path-'));
  const spaced = path.join(folder, 'a project');
  fs.mkdirSync(spaced);
  assert.equal(resolveWorkspace('a project', folder), spaced);
  assert.throws(() => resolveWorkspace('missing', folder), /does not exist/);
});

test('preparing a profile preserves existing user settings', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'personal-ide-profile-'));
  const profile = prepareProfile(root);
  const settings = path.join(profile.userData, 'User', 'settings.json');
  fs.writeFileSync(settings, '// My settings\n{}\n');
  prepareProfile(root);
  assert.equal(fs.readFileSync(settings, 'utf8'), '// My settings\n{}\n');
});
