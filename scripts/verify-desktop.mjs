import fs from 'node:fs';
import { ensureCore } from './install-core.mjs';
import { ensureInterface, installVsix } from './install-interface.mjs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { projectRoot, applicationDataRoot, requireRuntime, cleanEnvironment, prepareProfile } from './foundation.mjs';

try {
  const exe = requireRuntime();
  const root = path.join(applicationDataRoot, 'verification', new Date().toISOString().replace(/[:.]/g, '-'));
  const workspace = path.join(root, 'workspace');
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(path.join(workspace, 'app.js'), '// foundation smoke fixture\nconsole.log("ready");\n');
  const { userData, extensions: localExtensions } = prepareProfile(root);
  const sharedExtensions=process.argv.includes("--toolbox");
  const extensions=sharedExtensions?prepareProfile().extensions:localExtensions;
  // Reproduce the real profile case: a registry already exists and the old
  // manually copied interface has been marked obsolete by the editor.
  if(!sharedExtensions)fs.writeFileSync(path.join(extensions, "extensions.json"), "[]");
  if(!sharedExtensions)fs.writeFileSync(path.join(extensions, ".obsolete"), JSON.stringify({"personal-ide.workspace-interface-0.1.0":true}));

  const fullstack=process.argv.includes('--workflow');
  if(fullstack){
    const installed=prepareProfile().extensions;
    for(const id of ['esbenp.prettier-vscode','dbaeumer.vscode-eslint','bradlc.vscode-tailwindcss']){
      const names=fs.readdirSync(installed).filter(name=>name.startsWith(id+'-'));
      if(!names.length)throw Error('Missing core extension '+id);
      for(const name of names){
        const archive=path.join(applicationDataRoot,'extension-cache',name+'.vsix');
        if(!fs.existsSync(archive))throw Error('Missing cached workflow extension; run npm run setup:workflow');
        await installVsix(exe,userData,extensions,archive);
      }
    }
    fs.symlinkSync('D:\\personal-ide-build-cache\\workflow-tools\\node_modules',path.join(workspace,'node_modules'),'junction');
    fs.writeFileSync(path.join(workspace,'package.json'),JSON.stringify({name:'workflow-check',private:true,scripts:{start:'node package-probe.cjs'}}));
    fs.writeFileSync(path.join(workspace,'package-probe.cjs'),'require("node:fs").writeFileSync("package-result.json","ok");');
    fs.writeFileSync(path.join(workspace,'eslint.config.mjs'),'export default [{files:["**/*.js"],rules:{"no-unused-vars":"error"}}];');
    fs.writeFileSync(path.join(workspace,'.prettierrc.json'),'{"singleQuote":false,"semi":true}');
    const settingsPath=path.join(userData,'User','settings.json');
    const settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
    settings['[javascript]']={'editor.defaultFormatter':'esbenp.prettier-vscode'};
    settings['[typescript]']={'editor.defaultFormatter':'esbenp.prettier-vscode'};
    fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));
    execFileSync('git',['init','--initial-branch','main'],{cwd:workspace,windowsHide:true,stdio:'ignore'});
  }
  await ensureInterface({exe,userData,extensions});
  await ensureCore({exe,userData,extensions});
  if(await ensureInterface({exe,userData,extensions}))throw Error('Unchanged interface unexpectedly reinstalled');
  console.log('Registered interface installation and unchanged relaunch check passed.');
  const env = { ...cleanEnvironment(), PERSONAL_IDE_SMOKE_ROOT: root, PERSONAL_IDE_SMOKE_NODE: process.execPath,PERSONAL_IDE_WORKFLOW_TEST:fullstack?'1':'',PERSONAL_IDE_CODEX_DESKTOP:process.argv.includes('--codex')?'1':'',PERSONAL_IDE_TOOLBOX_TEST:process.argv.includes('--toolbox')?'1':'' };
  // Trust is disabled only for this generated, disposable fixture/profile.
  // The normal launcher retains the runtime's workspace-trust behavior.
  const child = spawn(exe, [
    '--user-data-dir', userData, '--extensions-dir', extensions, '--new-window',
    '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
    `--extensionDevelopmentPath=${path.join(projectRoot, 'tests', 'desktop')}`,
    `--extensionTestsPath=${path.join(projectRoot, 'tests', 'desktop', 'run.cjs')}`,
    workspace,
  ], { cwd: workspace, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const log = fs.createWriteStream(path.join(root, 'desktop.log'));
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  console.log(`Desktop verification started (PID ${child.pid}). Evidence: ${root}`);
  const timer = setTimeout(() => {
    console.error('Desktop verification exceeded 120 seconds. Inspect the test window and logs.');
    child.kill();
  }, (process.argv.includes('--workflow') || process.argv.includes('--codex')) ? 300_000 : 120_000);
  child.on('error', error => { clearTimeout(timer); console.error(error.message); process.exitCode = 1; });
  child.on('close', code => {
    clearTimeout(timer);
    log.end();
    const resultPath = path.join(root, 'result.json');
    if (fs.existsSync(resultPath)) {
      const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      if(process.argv.includes("--toolbox")&&fs.readFileSync(path.join(root,"desktop.log"),"utf8").includes("Failed to open database")){result.passed=false;result.error="Native SQLite explorer reported a failure";}
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = code === 0 && result.passed ? 0 : 1;
    } else {
      console.error(`No test result was written. Exit code: ${code}. See ${path.join(root, 'desktop.log')}`);
      process.exitCode = 1;
    }
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
